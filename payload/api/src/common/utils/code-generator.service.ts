import { Injectable } from "@nestjs/common";
import { DbService, DrizzleDb } from "../../database/db.service";
import { codeCounters } from "../../database/schema";
import { createId } from "../../database/id";

@Injectable()
export class CodeGeneratorService {
  constructor(private readonly dbs: DbService) {}

  // SQLite has no SELECT ... FOR UPDATE; instead a single atomic
  // UPDATE ... RETURNING (SQLite >= 3.35) increments and reads the counter.
  // The caller invokes this inside DbService.transaction() so the increment
  // rolls back if the parent op fails — the `db` parameter documents that
  // requirement (it is the same shared drizzle handle; statement routing to
  // the open transaction happens via AsyncLocalStorage in DbService).
  async next(prefix: string, db: DrizzleDb, pad = 6): Promise<string> {
    const key = prefix.toUpperCase();
    // Ensure the counter row exists before the atomic increment.
    await db
      .insert(codeCounters)
      .values({ id: createId(), key, last: 0 })
      .onConflictDoNothing({ target: codeCounters.key });
    const rows = await this.dbs.queryRaw<{ last: number }>(
      "UPDATE code_counters SET last = last + 1 WHERE key = ? RETURNING last",
      [key],
    );
    const next = Number(rows[0]?.last ?? 1);
    return `${prefix}${String(next).padStart(pad, "0")}`;
  }
}
