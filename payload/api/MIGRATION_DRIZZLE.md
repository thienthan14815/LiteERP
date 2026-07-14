# Prisma → Drizzle migration conventions (LiteERP API)

Runtime-verified pipeline (see `scripts/probe-drizzle.ts` — all 8 mechanics PASS
against the seeded DB). Reference implementation: `src/modules/suppliers/suppliers.service.ts`.

## Why

Prisma's Rust query engine cannot run on Android (glibc-linked; Bionic has no
glibc). The replacement stack is Mapbox `sqlite3` (N-API, cross-compiled for
android-arm64) + `drizzle-orm/sqlite-proxy`. `DbService` owns the pipeline.

## Core plumbing (already migrated — do NOT touch these files)

- `src/database/schema.ts` — all 29 tables + relations. Import tables from here.
- `src/database/db.service.ts` — `DbService` with `.db` (drizzle), `.transaction()`,
  `.queryRaw()`, `.runRaw()`, `.execRaw()`.
- `src/database/id.ts` — `createId()` replaces Prisma's `@default(cuid())`.
- `src/common/utils/code-generator.service.ts` — `codes.next(prefix, db, pad?)`.
- `src/modules/audit-logs/audit-logs.service.ts` — `audit.record(input, db?)`.
- `src/repository/base.repository.ts` + attachment/backup repositories.

## Injection

```ts
// BEFORE
constructor(private readonly prisma: PrismaService) {}
// AFTER
constructor(private readonly dbs: DbService) {}
// usage: const db = this.dbs.db;
```

Remove ALL `@prisma/client` and `../database/prisma.service` imports.
Enum imports from `@app/shared` stay unchanged.

## Value semantics (differences from Prisma)

- **Decimal columns are plain `number`** (schema uses `real`). No `.toNumber()`,
  no `new Prisma.Decimal`. Arithmetic is direct; write numbers back.
- **Timestamps are `Date`** (integer millis in DB, `timestamp_ms` mode). Write
  `new Date()`. CAUTION: fields on **nested relation rows** from `db.query`
  (`with:`) may deserialize as raw numbers/strings — wrap with `new Date(x)`
  before calling Date methods on nested values (top-level rows are real Dates).
- **Booleans are real booleans** (mode: "boolean").
- **`updatedAt` is NOT automatic.** Every `.update().set({...})` must include
  `updatedAt: new Date()` (except tables without updated_at: stock_transactions,
  audit_logs, attachments, refresh_tokens, backup_records, permissions).
- **`id` is NOT automatic.** Every `.insert().values({...})` must include
  `id: createId()`.
- `createdAt`/`updatedAt` on INSERT: omit them — SQL defaults fill them.

## Query translation table

```ts
import { and, or, eq, ne, like, inArray, notInArray, gte, lte, gt, lt, isNull, isNotNull, desc, asc, sql, type SQL } from "drizzle-orm";
```

| Prisma | Drizzle |
|---|---|
| `prisma.x.findUnique({where:{id}})` | `(await db.select().from(x).where(eq(x.id, id)).limit(1))[0]` → check falsy |
| `findUniqueOrThrow` | same + `if (!row) throw new NotFoundException({code: "..."})` (keep the service's existing error code) |
| `findFirst({where, orderBy})` | `.select().from(x).where(...).orderBy(...).limit(1)` → `[0] ?? null` |
| `findMany({where, orderBy, take, skip})` | `.select().from(x).where(...).orderBy(desc(x.col)).limit(take).offset(skip)` |
| `create({data})` | `(await db.insert(x).values({id: createId(), ...data}).returning())[0]` |
| `createMany({data})` | `await db.insert(x).values(rows.map(r => ({id: createId(), ...r})))` |
| `update({where:{id}, data})` | `(await db.update(x).set({...data, updatedAt: new Date()}).where(eq(x.id, id)).returning())[0]` — Prisma threw P2025 when the row was missing; if the service relied on that, add `if (!row) throw new NotFoundException(...)` |
| `updateMany({where, data})` | `.update(x).set(...).where(...)` (use `.returning({id: x.id})` + `.length` if the count is needed) |
| `delete({where:{id}})` | `.delete(x).where(eq(x.id, id))` (add `.returning()` if the row is needed) |
| `deleteMany({where})` | `.delete(x).where(...)` + `.returning({id})`.length for count |
| `upsert({where, create, update})` | `.insert(x).values({...}).onConflictDoUpdate({target: x.col, set: {...}})` or `onConflictDoNothing({target})` |
| `count({where})` | `Number((await db.select({count: sql<number>\`count(*)\`.as("count")}).from(x).where(...))[0]?.count ?? 0)` |
| `groupBy({by:["col"], _count:{_all:true}})` | `db.select({col: x.col, count: sql<number>\`count(*)\`.as("count")}).from(x).groupBy(x.col)` — read `.count` not `._count._all` |
| `where: { OR: [...] }` | `or(...)`; `AND` → `and(...)`; nested combos compose |
| `{ contains: s }` | `like(x.col, \`%${s}%\`)` (SQLite LIKE is case-insensitive for ASCII — same as Prisma SQLite) |
| `{ startsWith: s }` | `like(x.col, \`${s}%\`)` |
| `{ in: arr }` | `inArray(x.col, arr)` — guard `arr.length === 0` (drizzle throws): return early or use `sql\`1=0\`` |
| `{ not: v }` | `ne(x.col, v)`; `{ not: null }` → `isNotNull(x.col)` |
| `{ gte/lte/gt/lt: v }` | `gte(x.col, v)` etc. (Dates OK) |
| `field: null` in where | `isNull(x.col)` |
| relation `some:` filter | `sql\`EXISTS (SELECT 1 FROM ${child} WHERE ${child.parentId} = ${parent.id} AND ...)\`` or `inArray(parent.id, db.select({id: child.parentId}).from(child).where(...))` |

Build dynamic filters as `const conds: SQL[] = []; ... conds.push(...); const where = conds.length ? and(...conds) : undefined;`

## include → relational queries

```ts
// BEFORE: prisma.purchaseOrder.findUnique({ where: {id}, include: { items: true, supplier: true } })
const po = await db.query.purchaseOrders.findFirst({
  where: eq(purchaseOrders.id, id),
  with: { items: true, supplier: true },
});
// Nested: with: { items: { with: { machines: true } } }
// findMany({ where, with, orderBy: [desc(t.createdAt)], limit, offset })
```

Relation keys match the old Prisma field names (defined in schema.ts relations).
`db.query.<key>` uses the schema **export names** (camelCase: `purchaseOrders`,
`finishedPcs`, `componentCategories`, ...).

## `_count` emulation

`include: { _count: { select: { items: true } } }` has no drizzle equivalent —
use a grouped count query:

```ts
// list page: ONE grouped query, not per-row
const ids = items.map(i => i.id);
const counts = ids.length ? await db
  .select({ refId: child.parentId, count: sql<number>`count(*)`.as("count") })
  .from(child).where(inArray(child.parentId, ids)).groupBy(child.parentId) : [];
const countMap = new Map(counts.map(c => [c.refId, Number(c.count)]));
// single entity: plain count query
```

## Transactions

```ts
// BEFORE: this.prisma.$transaction(async (tx) => { ... tx.x.create(...) })
return this.dbs.transaction(async (db) => {
  // use `db` exactly like this.dbs.db — routing into the open BEGIN..COMMIT
  // is automatic (AsyncLocalStorage); helpers take it as documentation:
  const code = await this.codes.next("SUP", db);
  await this.audit.record({...}, db);
});
```

- Array form `$transaction([p1, p2])` for **reads** (list+count) → just run the
  two awaits sequentially WITHOUT a transaction (see suppliers.list()).
- NEVER nest `this.dbs.transaction` inside itself intentionally (it flattens,
  but write it flat).
- Do not keep a transaction open across Drive/network calls (backup service
  handles this itself).

## Raw SQL

- `$queryRawUnsafe("PRAGMA ...")` → `this.dbs.queryRaw("PRAGMA ...")` (objects back)
- `$queryRaw\`...\`` with params → `this.dbs.queryRaw("... WHERE x = ?", [v])`
- Never build SQL by string-concatenating user input.

## Hard rules

1. NEVER hand-write a join that selects same-named columns from two tables
   without aliasing every column (`db.select({a: t1.id, ...})` is positional and
   safe; `db.select().from(t1).leftJoin(t2, ...)` selecting `*` of both is FORBIDDEN
   — node-sqlite3 returns object rows and duplicate names silently collapse).
   Prefer `db.query...with` for relations.
2. Keep every existing error `code:` string and HTTP status exactly as-is.
3. Keep response shapes identical (same field names; decimals become numbers —
   that is accepted globally).
4. Keep Vietnamese comments where they exist; keep file structure/method order.
5. `inArray` with possibly-empty arrays: guard first.
6. After editing, run `pnpm --filter @app/api exec tsc --noEmit` and fix until
   YOUR files show zero errors (other unmigrated files may still error).
