// Versioned, idempotent schema migrations.
//
// The device has no CLI to run `drizzle-kit migrate`, and an on-device SQLite
// file created by an older app version has no upgrade path otherwise. This
// runner fills that gap:
//   - ddl/init.sql (via ensureDdl) creates the BASE schema on a brand-new file.
//   - THIS runner then applies every migration whose id is not yet recorded in
//     `schema_migrations`, on EVERY boot, for both fresh and existing files.
//
// Rules for authoring a migration:
//   - Never edit or reorder an existing entry — only append new ones.
//   - Keep `up` idempotent (CREATE TABLE IF NOT EXISTS, guarded ADD COLUMN) so
//     a half-applied boot can be safely retried.
//   - Each migration runs exactly once (tracked in schema_migrations) and is
//     wrapped in its own transaction by the runner.

import { Logger } from "@nestjs/common";

const logger = new Logger("DbMigrations");

export interface Migration {
  id: string;
  statements: string[];
}

// Append-only. Order matters.
export const MIGRATIONS: Migration[] = [
  {
    // Auth hardening: per-account lockout counters + forced password rotation.
    id: "0001_auth_hardening",
    statements: [
      `ALTER TABLE users ADD COLUMN failed_login_count INTEGER NOT NULL DEFAULT 0`,
      `ALTER TABLE users ADD COLUMN locked_until INTEGER`,
      `ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0`,
    ],
  },
  {
    // Durable job ledger: gives the in-process queues crash visibility. A job
    // left "running" when the process dies is reconciled to "failed" on boot so
    // a client polling its status is never stuck on "running" forever.
    id: "0002_jobs",
    statements: [
      `CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'queued',
        payload_json TEXT,
        result_json TEXT,
        error TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
      )`,
      `CREATE INDEX IF NOT EXISTS jobs_status_idx ON jobs (status)`,
      `CREATE INDEX IF NOT EXISTS jobs_type_idx ON jobs (type)`,
      `CREATE INDEX IF NOT EXISTS jobs_created_at_idx ON jobs (created_at)`,
    ],
  },
];

/**
 * Apply all not-yet-recorded migrations. `runStatement` executes one SQL
 * statement; `queryAppliedIds` returns the ids already in schema_migrations.
 * The caller supplies both so this module stays decoupled from the driver.
 */
export async function runMigrations(
  runStatement: (sql: string, params?: unknown[]) => Promise<void>,
  queryAppliedIds: () => Promise<string[]>,
): Promise<number> {
  await runStatement(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    )`,
  );

  const applied = new Set(await queryAppliedIds());
  let count = 0;

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.id)) continue;
    await runStatement("BEGIN IMMEDIATE");
    try {
      for (const stmt of migration.statements) {
        try {
          await runStatement(stmt);
        } catch (err) {
          // Tolerate "duplicate column" so a migration interrupted between a
          // successful ALTER and the tracking insert can be re-run cleanly.
          const msg = (err as Error).message ?? "";
          if (/duplicate column name/i.test(msg)) {
            logger.warn(`[${migration.id}] column already exists — skipping: ${msg}`);
            continue;
          }
          throw err;
        }
      }
      await runStatement(`INSERT INTO schema_migrations (id) VALUES (?)`, [migration.id]);
      await runStatement("COMMIT");
      count += 1;
      logger.log(`Applied migration ${migration.id}`);
    } catch (err) {
      await runStatement("ROLLBACK").catch(() => undefined);
      throw new Error(`Migration ${migration.id} failed: ${(err as Error).message}`);
    }
  }

  if (count > 0) logger.log(`${count} migration(s) applied`);
  return count;
}
