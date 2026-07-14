// Runtime probe: validates the drizzle sqlite-proxy + node-sqlite3 pipeline
// against the real seeded DB before the service migration builds on it.
//   1. relational query (db.query.*.findMany with `with`)
//   2. positional flattening (select + count aliases)
//   3. insert/returning + manual transaction rollback
// Run: pnpm --filter @app/api exec ts-node scripts/probe-drizzle.ts

/* eslint-disable no-console */
import * as path from "node:path";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { desc, eq, like, or, sql } from "drizzle-orm";
import { schema, suppliers, users, userRoles, componentCategories, components } from "../src/database/schema";
import { createId } from "../src/database/id";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const sqlite3 = require("sqlite3");

async function main() {
  const dbPath = path.resolve(__dirname, "..", "data", "liteerp.sqlite");
  const raw = await new Promise<any>((resolve, reject) => {
    const h = new sqlite3.Database(dbPath, (err: Error | null) => (err ? reject(err) : resolve(h)));
  });
  const allAsync = (s: string, p: unknown[]) =>
    new Promise<any[]>((resolve, reject) => raw.all(s, p, (e: Error | null, r: any[]) => (e ? reject(e) : resolve(r ?? []))));
  const runAsync = (s: string, p: unknown[] = []) =>
    new Promise<void>((resolve, reject) => raw.run(s, p, (e: Error | null) => (e ? reject(e) : resolve())));

  const db = drizzle(
    async (sqlText, params, method) => {
      const rows = await allAsync(sqlText, params as unknown[]);
      const values = rows.map((row) => Object.values(row as Record<string, unknown>));
      if (method === "get") return { rows: (values[0] ?? []) as unknown[] };
      return { rows: values };
    },
    { schema },
  );

  // --- 1. plain select -------------------------------------------------------
  const sup = await db.select().from(suppliers).orderBy(desc(suppliers.createdAt)).limit(2);
  console.log("[1] select suppliers:", sup.length, "rows; first code =", sup[0]?.code, "; createdAt instanceof Date =", sup[0]?.createdAt instanceof Date);

  // --- 2. count alias --------------------------------------------------------
  const cnt = await db.select({ count: sql<number>`count(*)`.as("count") }).from(suppliers);
  console.log("[2] count suppliers =", cnt[0]?.count);

  // --- 3. where or/like ------------------------------------------------------
  const filtered = await db
    .select()
    .from(suppliers)
    .where(or(like(suppliers.name, "%m%"), like(suppliers.code, "%SUP%")));
  console.log("[3] filtered =", filtered.length);

  // --- 4. relational query (with) -------------------------------------------
  const usersWithRoles = await db.query.users.findMany({ with: { userRoles: true } });
  console.log("[4] users with roles:", usersWithRoles.length, "; roles of first =", JSON.stringify(usersWithRoles[0]?.userRoles));

  // --- 4b. nested relational (components -> category) ------------------------
  const comps = await db.query.components.findMany({ with: { category: true }, limit: 2 });
  console.log("[4b] components with category:", comps.length, "; cat code =", comps[0]?.category?.code, "; costPrice typeof =", typeof comps[0]?.costPrice);

  // --- 5. groupBy -------------------------------------------------------------
  const grouped = await db
    .select({ status: components.status, count: sql<number>`count(*)`.as("count") })
    .from(components)
    .groupBy(components.status);
  console.log("[5] groupBy status:", JSON.stringify(grouped));

  // --- 6. insert/returning + rollback ----------------------------------------
  await runAsync("BEGIN IMMEDIATE");
  const inserted = await db
    .insert(suppliers)
    .values({ id: createId(), code: "PROBE1", name: "probe supplier" })
    .returning();
  console.log("[6] inserted id =", inserted[0]?.id, "; createdAt =", inserted[0]?.createdAt instanceof Date);
  await runAsync("ROLLBACK");
  const after = await db.select().from(suppliers).where(eq(suppliers.code, "PROBE1"));
  console.log("[6b] rollback OK =", after.length === 0);

  // --- 7. update/returning ----------------------------------------------------
  const cat = await db.select().from(componentCategories).limit(1);
  if (cat[0]) {
    const upd = await db
      .update(componentCategories)
      .set({ sortOrder: cat[0].sortOrder, updatedAt: new Date() })
      .where(eq(componentCategories.id, cat[0].id))
      .returning();
    console.log("[7] update/returning OK =", upd.length === 1, "; updatedAt Date =", upd[0]?.updatedAt instanceof Date);
  }

  // --- 8. EXISTS subquery (relation `some` emulation) -------------------------
  const withRole = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(sql`EXISTS (SELECT 1 FROM ${userRoles} WHERE ${userRoles.userId} = ${users.id})`);
  console.log("[8] users having roles =", withRole.length);

  raw.close();
  console.log("PROBE PASS");
}

main().catch((e) => {
  console.error("PROBE FAIL:", e);
  process.exit(1);
});
