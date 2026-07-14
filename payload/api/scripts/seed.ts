/* eslint-disable no-console */
// Dev/demo seed — sample business data on top of the core bootstrap.
//
// The API self-provisions schema + auth core (permissions/roles/admin/
// categories) at startup via src/database/bootstrap.ts. This script adds the
// demo suppliers/customers/components used for local testing, and is
// idempotent (upsert-by-code).
//
// Run: pnpm --filter @app/api db:seed
import "dotenv/config";
import * as path from "node:path";
import * as fs from "node:fs";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { eq } from "drizzle-orm";

import {
  schema,
  suppliers,
  customers,
  components,
  componentCategories,
  codeCounters,
} from "../src/database/schema";
import { createId } from "../src/database/id";
import { ensureCoreSeed, ensureDdl } from "../src/database/bootstrap";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const sqlite3 = require("sqlite3");

function resolveDbPath(): string {
  const url = process.env.DATABASE_URL ?? "file:../data/liteerp.sqlite";
  let p = url.startsWith("file:") ? url.slice(5) : url;
  if (!path.isAbsolute(p)) p = path.resolve(__dirname, "..", "prisma", p);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  return p;
}

async function main() {
  const dbPath = resolveDbPath();
  console.log(`Seeding ${dbPath} ...`);

  const raw: any = await new Promise((resolve, reject) => {
    const h = new sqlite3.Database(dbPath, (err: Error | null) => (err ? reject(err) : resolve(h)));
  });
  const allAsync = (s: string, p: unknown[] = []) =>
    new Promise<any[]>((res, rej) => raw.all(s, p, (e: Error | null, r: any[]) => (e ? rej(e) : res(r ?? []))));
  const execAsync = (s: string) =>
    new Promise<void>((res, rej) => raw.exec(s, (e: Error | null) => (e ? rej(e) : res())));

  const db = drizzle(
    async (sqlText, params, method) => {
      const rows = await allAsync(sqlText, params as unknown[]);
      const values = rows.map((row) => Object.values(row as Record<string, unknown>));
      if (method === "get") return { rows: (values[0] ?? []) as unknown[] };
      return { rows: values };
    },
    { schema },
  );

  await execAsync("PRAGMA foreign_keys = ON");

  // Core bootstrap first (schema + auth) so this script also works on a
  // completely fresh file.
  await ensureDdl(
    async (name) =>
      (await allAsync("SELECT name FROM sqlite_master WHERE type='table' AND name = ?", [name]))
        .length > 0,
    execAsync,
  );
  await ensureCoreSeed(db);

  // --- sample suppliers -------------------------------------------------------
  const SUPPLIERS = [
    {
      code: "SUP000001",
      name: "Công ty TNHH Linh kiện ABC",
      fbUrl: "https://facebook.com/linhkien.abc",
      category: "WHOLESALE",
    },
    {
      code: "SUP000002",
      name: "Computer Wholesale Group",
      marketplaceUrl: "https://shopee.tw/computer-wholesale",
      category: "WHOLESALE",
    },
    { code: "SUP000003", name: "Cá nhân thu mua máy cũ", category: "RETAIL" },
  ];
  for (const s of SUPPLIERS) {
    await db
      .insert(suppliers)
      .values({ id: createId(), ...s })
      .onConflictDoUpdate({
        target: suppliers.code,
        set: {
          name: s.name,
          fbUrl: s.fbUrl ?? null,
          marketplaceUrl: s.marketplaceUrl ?? null,
          category: s.category ?? null,
          updatedAt: new Date(),
        },
      });
  }
  console.log(`  -> ${SUPPLIERS.length} suppliers`);

  // --- sample customers -------------------------------------------------------
  const CUSTOMERS = [
    { code: "CUS000001", name: "Khách lẻ", phone: "0900000000" },
    { code: "CUS000002", name: "Công ty XYZ", phone: "0913456789", email: "kt@xyz.vn" },
    { code: "CUS000003", name: "Nguyễn Văn A", phone: "0908765432" },
  ];
  for (const c of CUSTOMERS) {
    await db
      .insert(customers)
      .values({ id: createId(), ...c })
      .onConflictDoUpdate({
        target: customers.code,
        set: {
          name: c.name,
          phone: c.phone ?? null,
          email: (c as { email?: string }).email ?? null,
          updatedAt: new Date(),
        },
      });
  }
  console.log(`  -> ${CUSTOMERS.length} customers`);

  // --- sample components ------------------------------------------------------
  const catByCode = new Map<string, string>();
  for (const row of await db.select().from(componentCategories)) {
    catByCode.set(row.code, row.id);
  }
  const need = (code: string): string => {
    const id = catByCode.get(code);
    if (!id) throw new Error(`Category ${code} missing — core bootstrap did not run?`);
    return id;
  };

  const COMPONENTS = [
    { code: "CPU000001", categoryId: need("CPU"), model: "Intel Core i5-9400F", costPrice: 1500000 },
    { code: "CPU000002", categoryId: need("CPU"), model: "Intel Core i7-9700K", costPrice: 3200000 },
    { code: "RAM000001", categoryId: need("RAM"), model: "Kingston DDR4 8GB 2666MHz", costPrice: 450000 },
    { code: "RAM000002", categoryId: need("RAM"), model: "Corsair Vengeance 16GB DDR4 3200", costPrice: 1100000 },
    { code: "SSD000001", categoryId: need("SSD"), model: "Samsung 870 EVO 500GB", costPrice: 1200000 },
    { code: "SSD000002", categoryId: need("SSD"), model: "WD Blue SN570 1TB NVMe", costPrice: 1800000 },
    { code: "GPU000001", categoryId: need("GPU"), model: "NVIDIA GTX 1660 Super 6GB", costPrice: 3500000 },
    { code: "PSU000001", categoryId: need("PSU"), model: "Corsair CV550 550W 80+ Bronze", costPrice: 1100000 },
    { code: "MB0000001", categoryId: need("MB"), model: "ASUS PRIME B365M-A", costPrice: 1800000 },
  ];
  for (const c of COMPONENTS) {
    await db
      .insert(components)
      .values({
        id: createId(),
        code: c.code,
        categoryId: c.categoryId,
        model: c.model,
        costPrice: c.costPrice,
        status: "IN_STOCK",
        condition: "GOOD",
      })
      .onConflictDoUpdate({
        target: components.code,
        set: { model: c.model, costPrice: c.costPrice, updatedAt: new Date() },
      });
  }
  console.log(`  -> ${COMPONENTS.length} sample components (status=IN_STOCK)`);

  // --- code counters ----------------------------------------------------------
  // Bump counters for hardcoded codes above so CodeGenerator never collides.
  const COUNTERS = [
    { key: "SUP", last: 3 },
    { key: "CUS", last: 3 },
    { key: "CPU", last: 2 },
    { key: "RAM", last: 2 },
    { key: "SSD", last: 2 },
    { key: "GPU", last: 1 },
    { key: "PSU", last: 1 },
    { key: "MB", last: 1 },
  ];
  for (const c of COUNTERS) {
    // Không overwrite nếu counter đã cao hơn (user có thể đã tạo thêm record).
    const existing = await db.select().from(codeCounters).where(eq(codeCounters.key, c.key)).limit(1);
    if (!existing[0]) {
      await db.insert(codeCounters).values({ id: createId(), key: c.key, last: c.last });
    } else if (existing[0].last < c.last) {
      await db
        .update(codeCounters)
        .set({ last: c.last, updatedAt: new Date() })
        .where(eq(codeCounters.key, c.key));
    }
  }
  console.log(`  -> synced ${COUNTERS.length} code counters`);

  await new Promise<void>((res) => raw.close(() => res()));
  console.log("Seed completed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
