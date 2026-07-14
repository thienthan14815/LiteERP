// Drizzle + sqlite3 database service — the replacement for PrismaService.
//
// Backend: Mapbox `sqlite3` (async, N-API). On Android/nodejs-mobile the native
// addon lives in the app's jniLibs dir (Bionic namespace requirement); we load
// it via ANDROID_NATIVE_LIB_DIR and a bindings shim. On dev machines the
// standard sqlite3 prebuilt works transparently.
//
// Query pipeline: drizzle-orm's sqlite-proxy adapter delegates every statement
// to the callback below. node-sqlite3 has no positional-row mode, so we flatten
// row objects via Object.values(). That is safe ONLY while every result column
// name is unique within a query:
//   - single-table CRUD: always unique
//   - db.query.* relational queries: drizzle aliases relation payloads
//   - aggregates: alias explicitly, e.g. sql`count(*)`.as("count")
// NEVER hand-write joins that select same-named columns from two tables
// without aliases — the duplicate column silently overwrites the first.
//
// Transactions: sqlite-proxy has no db.transaction(). DbService.transaction()
// wraps BEGIN IMMEDIATE/COMMIT/ROLLBACK and serialises: all transactions and
// standalone statements are queued so a transaction's statements never
// interleave with others on the single shared connection. Statements issued
// inside the transaction callback bypass the queue via AsyncLocalStorage.

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import type { SqliteRemoteDatabase } from "drizzle-orm/sqlite-proxy";
import { AsyncLocalStorage } from "node:async_hooks";
import * as path from "node:path";
import * as fs from "node:fs";

import { schema } from "./schema";
import { ensureCoreSeed, ensureDdl } from "./bootstrap";
import { runMigrations } from "./migrations";

type SqliteDb = {
  all: (sql: string, params: unknown[], cb: (err: Error | null, rows: unknown[]) => void) => void;
  run: (
    sql: string,
    params: unknown[],
    cb: (this: { lastID?: number; changes?: number }, err: Error | null) => void,
  ) => void;
  exec: (sql: string, cb: (err: Error | null) => void) => void;
  close: (cb: (err: Error | null) => void) => void;
};

type SqliteModule = {
  Database: new (path: string, mode?: number, cb?: (err: Error | null) => void) => SqliteDb;
  OPEN_READWRITE: number;
  OPEN_CREATE: number;
  OPEN_READONLY: number;
};

export type DrizzleDb = SqliteRemoteDatabase<typeof schema>;

/**
 * Locate + require the sqlite3 addon. On Android, ANDROID_NATIVE_LIB_DIR points
 * at the app's jniLibs where the N-API build (libnode_sqlite3.so) lives — it
 * must be dlopen'd from there because it DT_NEEDs libnode.so, resolvable only
 * inside the app's linker namespace.
 */
function loadSqlite3(): SqliteModule {
  const nativeDir = process.env.ANDROID_NATIVE_LIB_DIR;
  if (nativeDir) {
    const jniAddon = path.join(nativeDir, "libnode_sqlite3.so");
    if (fs.existsSync(jniAddon)) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Module = require("node:module") as {
        _resolveFilename: (...args: unknown[]) => string;
      };
      const shimPath = path.resolve(__dirname, "__bindings_shim.js");
      const shim =
        `module.exports = function () {\n` +
        `  const m = { exports: {} };\n` +
        `  process.dlopen(m, ${JSON.stringify(jniAddon)});\n` +
        `  return m.exports;\n` +
        `};\n`;
      fs.writeFileSync(shimPath, shim);
      const origResolve = Module._resolveFilename.bind(Module);
      Module._resolveFilename = function (request: unknown, ...rest: unknown[]) {
        if (request === "bindings") return shimPath;
        return origResolve(request, ...rest);
      };
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("sqlite3") as SqliteModule;
}

@Injectable()
export class DbService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DbService.name);
  private sqliteDb!: SqliteDb;
  private drizzleDb!: DrizzleDb;
  private dbPath!: string;

  // Serialisation queue: a promise chain every unit of work appends to.
  private queueTail: Promise<unknown> = Promise.resolve();
  // Flags statements executing inside an open transaction so they bypass
  // the queue instead of deadlocking behind their own transaction.
  private readonly txContext = new AsyncLocalStorage<boolean>();

  constructor(private readonly config: ConfigService) {}

  get db(): DrizzleDb {
    if (!this.drizzleDb) throw new Error("DbService not initialised");
    return this.drizzleDb;
  }

  async onModuleInit(): Promise<void> {
    const url = this.config.get<string>("database.url") ?? process.env.DATABASE_URL ?? "";
    let dbPath = url.startsWith("file:") ? url.slice("file:".length) : url;
    if (!dbPath) throw new Error("DATABASE_URL not set");
    if (!path.isAbsolute(dbPath)) {
      // Relative file: URL — resolve against cwd (the API is normally launched
      // from apps/api). On-device DATABASE_URL is always absolute, so this
      // branch is dev-only.
      dbPath = path.resolve(process.cwd(), dbPath);
    }
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.dbPath = dbPath;

    await this.openConnection();

    this.drizzleDb = drizzle(
      async (sqlText, params, method) => {
        const rows = await this.serialised(() => this.allDirect(sqlText, params as unknown[]));
        // Flatten row objects → positional value arrays (see header comment).
        const values = rows.map((row) => Object.values(row as Record<string, unknown>));
        if (method === "get") {
          // Không có row → rows phải là undefined (KHÔNG phải []): sqlite-proxy
          // check `if (!row) return undefined`, còn [] là truthy và bị đẩy vào
          // mapRelationalRow → TypeError → mọi GET detail id-không-tồn-tại
          // trả 500 thay vì 404.
          return { rows: values[0] as unknown as unknown[] };
        }
        return { rows: values };
      },
      { schema, logger: false },
    );

    // First-launch bootstrap: create schema + core auth data on an empty file
    // (Android has no CLI for migrations/seeds — the API self-provisions).
    await ensureDdl(
      async (name) => {
        const rows = await this.allDirect(
          "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
          [name],
        );
        return rows.length > 0;
      },
      (script) => this.execDirect(script),
    );

    // Versioned migrations: bring an existing on-device DB up to the current
    // schema (new columns / tables added after its file was first created).
    await this.applyMigrations();

    await ensureCoreSeed(this.drizzleDb);

    this.logger.log(`DbService connected: ${dbPath}`);
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.sqliteDb) return;
    // Graceful shutdown: let queued statements drain, checkpoint the WAL back
    // into the main file (so a subsequent cold open has nothing to replay),
    // then close cleanly. Enqueue guarantees we run AFTER in-flight work.
    try {
      await this.enqueue(async () => {
        await this.execDirect("PRAGMA wal_checkpoint(TRUNCATE)").catch((err) =>
          this.logger.warn(`shutdown checkpoint failed: ${(err as Error).message}`),
        );
        await new Promise<void>((resolve, reject) =>
          this.sqliteDb.close((err) => (err ? reject(err) : resolve())),
        );
      });
    } catch (err) {
      this.logger.warn(`DbService shutdown issue: ${(err as Error).message}`);
    }
    this.logger.log("DbService disconnected (checkpointed)");
  }

  /**
   * Close the underlying connection so the DB file can be swapped on disk
   * (backup restore). Waits for queued statements to drain first. Any
   * statement issued between close() and reopen() fails — callers own that
   * window (single-user app; restore is the only consumer).
   */
  async close(): Promise<void> {
    if (!this.sqliteDb) return;
    await this.enqueue(
      () =>
        new Promise<void>((resolve, reject) =>
          this.sqliteDb.close((err) => (err ? reject(err) : resolve())),
        ),
    );
    this.logger.log("DbService connection closed (file-swap window)");
  }

  /** Re-open the connection after close() — same path + PRAGMAs as boot. */
  async reopen(): Promise<void> {
    await this.openConnection();
    // A restored DB file may be an OLDER schema snapshot (e.g. a backup taken
    // before a column was added). Reconcile it exactly like a cold boot does,
    // otherwise the app runs against a table that's missing columns it relies
    // on and every write fails with an opaque "Failed query".
    await this.applyMigrations();
    this.logger.log("DbService connection re-opened");
  }

  /**
   * Apply versioned schema migrations (idempotent, append-only). Invoked on
   * cold boot AND after a restore reopen so the live schema always matches the
   * code regardless of how old the DB file on disk is.
   */
  private async applyMigrations(): Promise<void> {
    await runMigrations(
      async (sql, params) => {
        await this.runDirect(sql, (params as unknown[]) ?? []);
      },
      async () => {
        const rows = (await this.allDirect(
          "SELECT id FROM schema_migrations",
          [],
        )) as Array<{ id: string }>;
        return rows.map((r) => r.id);
      },
    );
  }

  /**
   * Mở một connection read-only RIÊNG tới `filePath` và chạy
   * PRAGMA integrity_check. Ném lỗi nếu file không mở được hoặc kết quả
   * khác "ok" — dùng để chặn file phục hồi hỏng TRƯỚC khi ghi đè DB thật.
   */
  async verifySqliteFile(filePath: string): Promise<void> {
    const sqlite3 = loadSqlite3();
    const handle = await new Promise<SqliteDb>((resolve, reject) => {
      const h = new sqlite3.Database(filePath, sqlite3.OPEN_READONLY, (err) =>
        err ? reject(err) : resolve(h),
      );
    });
    try {
      const rows = await new Promise<unknown[]>((resolve, reject) =>
        handle.all("PRAGMA integrity_check", [], (err, r) =>
          err ? reject(err) : resolve(r ?? []),
        ),
      );
      const verdict = rows
        .map((r) => Object.values(r as Record<string, unknown>)[0])
        .join("; ");
      if (verdict !== "ok") {
        throw new Error(`integrity_check failed: ${verdict || "no result"}`);
      }
    } finally {
      await new Promise<void>((resolve) => handle.close(() => resolve()));
    }
  }

  private async openConnection(): Promise<void> {
    const sqlite3 = loadSqlite3();
    this.sqliteDb = await new Promise<SqliteDb>((resolve, reject) => {
      const handle = new sqlite3.Database(
        this.dbPath,
        sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
        (err) => (err ? reject(err) : resolve(handle)),
      );
    });
    await this.execDirect("PRAGMA foreign_keys = ON");
    await this.execDirect("PRAGMA journal_mode = WAL");
  }

  /**
   * Interactive transaction. The callback receives the same drizzle instance;
   * all statements inside run directly on the connection while the queue
   * holds every other statement until commit/rollback.
   */
  async transaction<T>(fn: (db: DrizzleDb) => Promise<T>): Promise<T> {
    if (this.txContext.getStore()) {
      // Nested transaction — flatten into the outer one (Prisma behaved the
      // same for interactive transactions in our usage).
      return fn(this.drizzleDb);
    }
    return this.enqueue(async () => {
      await this.runDirect("BEGIN IMMEDIATE", []);
      try {
        const result = await this.txContext.run(true, () => fn(this.drizzleDb));
        await this.runDirect("COMMIT", []);
        return result;
      } catch (err) {
        try {
          await this.runDirect("ROLLBACK", []);
        } catch {
          /* connection-level failure — nothing more to do */
        }
        throw err;
      }
    });
  }

  /** Execute a multi-statement SQL script (DDL / PRAGMA batches). */
  async execRaw(sql: string): Promise<void> {
    return this.serialised(() => this.execDirect(sql));
  }

  /** Run one write statement. Returns { changes, lastID }. */
  async runRaw(sql: string, params: unknown[] = []): Promise<{ changes: number; lastID?: number }> {
    return this.serialised(() => this.runDirect(sql, params));
  }

  /** Run one SELECT, rows as objects keyed by column name. */
  async queryRaw<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    return this.serialised(() => this.allDirect(sql, params) as Promise<T[]>);
  }

  // --- internals -----------------------------------------------------------

  /** Route work through the queue unless already inside a transaction. */
  private serialised<T>(work: () => Promise<T>): Promise<T> {
    if (this.txContext.getStore()) return work();
    return this.enqueue(work);
  }

  private enqueue<T>(work: () => Promise<T>): Promise<T> {
    const next = this.queueTail.then(work, work);
    // Keep the chain alive regardless of individual failures.
    this.queueTail = next.catch(() => undefined);
    return next;
  }

  private allDirect(sql: string, params: unknown[]): Promise<unknown[]> {
    return new Promise((resolve, reject) => {
      this.sqliteDb.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows ?? [])));
    });
  }

  private runDirect(sql: string, params: unknown[]): Promise<{ changes: number; lastID?: number }> {
    return new Promise((resolve, reject) => {
      this.sqliteDb.run(sql, params, function (err) {
        if (err) return reject(err);
        resolve({ changes: this.changes ?? 0, lastID: this.lastID });
      });
    });
  }

  private execDirect(sql: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.sqliteDb.exec(sql, (err) => (err ? reject(err) : resolve()));
    });
  }
}
