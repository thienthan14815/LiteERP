// First-launch bootstrap: bring an EMPTY SQLite file up to a usable state.
//
// On Android there is no CLI to run migrations/seeds, so DbService calls this
// at startup:
//   1. DDL      — if the `users` table is missing, apply ddl/init.sql (the
//                 Prisma-generated schema, kept byte-identical for compat with
//                 DB files created before the Drizzle migration).
//   2. Core seed — if `users` is empty, insert the minimal data the app needs
//                 to be operable: permissions, roles, role-permission grants,
//                 component categories, and the default admin account.
//
// Demo/sample business data (suppliers, customers, components) intentionally
// lives in scripts/seed.ts — dev-only, never auto-inserted on devices.

import { Logger } from "@nestjs/common";
import * as fs from "node:fs";
import * as path from "node:path";
import { randomBytes } from "node:crypto";
import * as bcrypt from "bcryptjs";

import type { DrizzleDb } from "./db.service";
import {
  componentCategories,
  permissions,
  rolePermissions,
  roles,
  userRoles,
  users,
} from "./schema";
import { createId } from "./id";

const logger = new Logger("DbBootstrap");

export const CORE_ROLES: Array<{ code: string; name: string; description: string }> = [
  { code: "ADMIN", name: "Administrator", description: "Full system access" },
  { code: "MANAGER", name: "Manager", description: "Manage operations and view reports" },
  { code: "WAREHOUSE", name: "Warehouse", description: "Handle stock in/out and inventory checks" },
  { code: "TECHNICIAN", name: "Technician", description: "Inspect, disassemble, assemble machines" },
  { code: "SALES", name: "Sales", description: "Create sales orders, manage customers" },
  { code: "ACCOUNTANT", name: "Accountant", description: "View finance, expenses, reports" },
  { code: "VIEWER", name: "Viewer", description: "Read-only access" },
];

export const CORE_PERMISSIONS: string[] = [
  "dashboard:view",
  "user:view", "user:create", "user:update", "user:delete",
  "role:view", "role:create", "role:update", "role:delete",
  "supplier:view", "supplier:create", "supplier:update", "supplier:delete",
  "customer:view", "customer:create", "customer:update", "customer:delete",
  "purchase:view", "purchase:create", "purchase:update", "purchase:confirm", "purchase:cancel",
  "machine:view", "machine:update", "machine:inspect", "machine:allocate_cost", "machine:disassemble", "machine:mark_ready",
  "component:view", "component:update", "component:scrap",
  "inventory:view", "inventory:adjust",
  "assembly:view", "assembly:create", "assembly:update", "assembly:complete", "assembly:cancel",
  "finished_pc:view", "finished_pc:update",
  "sale:view", "sale:create", "sale:update", "sale:cancel",
  "warranty:view", "warranty:create", "warranty:update",
  "attachment:view", "attachment:create", "attachment:delete",
  "report:view",
  "audit:view",
  "setting:view", "setting:update",
];

const VIEW_ONLY = CORE_PERMISSIONS.filter((p) => p.endsWith(":view"));

export const CORE_ROLE_PERMISSIONS: Record<string, string[]> = {
  // Admin gets everything (PermissionsGuard resolves via full grant set).
  ADMIN: ["*"],
  MANAGER: [
    "dashboard:view",
    "user:view",
    "role:view",
    "supplier:view", "supplier:create", "supplier:update",
    "customer:view", "customer:create", "customer:update",
    "purchase:view", "purchase:create", "purchase:update", "purchase:confirm", "purchase:cancel",
    "machine:view", "machine:update", "machine:inspect", "machine:allocate_cost", "machine:disassemble", "machine:mark_ready",
    "component:view", "component:update",
    "inventory:view", "inventory:adjust",
    "assembly:view", "assembly:create", "assembly:update", "assembly:complete", "assembly:cancel",
    "finished_pc:view", "finished_pc:update",
    "sale:view", "sale:create", "sale:update", "sale:cancel",
    "warranty:view", "warranty:create", "warranty:update",
    "attachment:view", "attachment:create", "attachment:delete",
    "report:view",
    "audit:view",
    "setting:view",
  ],
  WAREHOUSE: [
    "dashboard:view",
    "inventory:view", "inventory:adjust",
    "component:view", "component:update", "component:scrap",
    "machine:view",
    "finished_pc:view",
    "supplier:view",
    "customer:view",
    "purchase:view",
    "attachment:view", "attachment:create",
  ],
  TECHNICIAN: [
    "dashboard:view",
    "machine:view", "machine:update", "machine:inspect", "machine:allocate_cost", "machine:disassemble", "machine:mark_ready",
    "component:view", "component:update",
    "assembly:view", "assembly:create", "assembly:update", "assembly:complete", "assembly:cancel",
    "finished_pc:view", "finished_pc:update",
    "inventory:view",
    "warranty:view", "warranty:create", "warranty:update",
    "attachment:view", "attachment:create",
  ],
  SALES: [
    "dashboard:view",
    "customer:view", "customer:create", "customer:update",
    "sale:view", "sale:create", "sale:update", "sale:cancel",
    "warranty:view", "warranty:create", "warranty:update",
    "finished_pc:view",
    "component:view",
    "inventory:view",
    "attachment:view", "attachment:create",
  ],
  ACCOUNTANT: [
    "dashboard:view",
    "report:view",
    "audit:view",
    "purchase:view", "sale:view", "warranty:view",
    "component:view", "machine:view", "finished_pc:view",
    "inventory:view",
    "supplier:view", "customer:view",
    "attachment:view",
  ],
  VIEWER: VIEW_ONLY,
};

// 12 categories — section 4 / 6 of quanlybanhang.md.
export const CORE_CATEGORIES: Array<{ code: string; name: string; prefix: string; sortOrder: number }> = [
  { code: "CPU",   name: "CPU",          prefix: "CPU",  sortOrder: 1 },
  { code: "MB",    name: "Mainboard",    prefix: "MB",   sortOrder: 2 },
  { code: "RAM",   name: "RAM",          prefix: "RAM",  sortOrder: 3 },
  { code: "SSD",   name: "SSD",          prefix: "SSD",  sortOrder: 4 },
  { code: "HDD",   name: "HDD",          prefix: "HDD",  sortOrder: 5 },
  { code: "GPU",   name: "GPU / VGA",    prefix: "GPU",  sortOrder: 6 },
  { code: "PSU",   name: "Power Supply", prefix: "PSU",  sortOrder: 7 },
  { code: "CASE",  name: "Case",         prefix: "CASE", sortOrder: 8 },
  { code: "FAN",   name: "Fan / Cooler", prefix: "FAN",  sortOrder: 9 },
  { code: "WIFI",  name: "WiFi Card",    prefix: "WIFI", sortOrder: 10 },
  { code: "BT",    name: "Bluetooth",    prefix: "BT",   sortOrder: 11 },
  { code: "OTHER", name: "Other",        prefix: "OTH",  sortOrder: 99 },
];

export const DEFAULT_ADMIN_EMAIL = "admin@example.com";
export const DEFAULT_ADMIN_NAME = "System Administrator";

/**
 * Resolve the initial admin credentials WITHOUT ever falling back to a
 * well-known password.
 *   - SEED_ADMIN_PASSWORD set  → use it, no forced change.
 *   - not set                  → generate a strong random password, print it
 *                                ONCE, and force a change on first login.
 */
export function resolveInitialAdmin(): {
  email: string;
  password: string;
  fullName: string;
  generated: boolean;
} {
  const email = process.env.SEED_ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL;
  const fromEnv = process.env.SEED_ADMIN_PASSWORD;
  if (fromEnv && fromEnv.length >= 8) {
    return { email, password: fromEnv, fullName: DEFAULT_ADMIN_NAME, generated: false };
  }
  // 18 bytes → 24-char base64url, ambiguity-free enough for a one-time secret.
  const password = randomBytes(18).toString("base64url");
  return { email, password, fullName: DEFAULT_ADMIN_NAME, generated: true };
}

/** Apply ddl/init.sql when the schema has never been created. */
export async function ensureDdl(
  hasTable: (name: string) => Promise<boolean>,
  execScript: (sql: string) => Promise<void>,
): Promise<boolean> {
  if (await hasTable("users")) return false;
  const ddlPath = path.resolve(__dirname, "ddl", "init.sql");
  const ddl = fs.readFileSync(ddlPath, "utf8");
  await execScript(ddl);
  logger.log("Applied ddl/init.sql (fresh database)");
  return true;
}

/** Insert permissions/roles/grants/categories/admin when users is empty. */
export async function ensureCoreSeed(db: DrizzleDb): Promise<boolean> {
  const anyUser = await db.select({ id: users.id }).from(users).limit(1);
  if (anyUser.length > 0) return false;

  logger.log("Empty database — seeding core auth data…");

  const permRows = CORE_PERMISSIONS.map((code) => ({ id: createId(), code, description: code }));
  await db.insert(permissions).values(permRows).onConflictDoNothing();

  const roleRows = CORE_ROLES.map((r) => ({
    id: createId(),
    code: r.code,
    name: r.name,
    description: r.description,
    isSystem: true,
  }));
  await db.insert(roles).values(roleRows).onConflictDoNothing();

  const grants: Array<{ roleId: string; permissionId: string }> = [];
  for (const [roleCode, permCodes] of Object.entries(CORE_ROLE_PERMISSIONS)) {
    const role = roleRows.find((r) => r.code === roleCode);
    if (!role) continue;
    const granted = permCodes.includes("*")
      ? permRows
      : permRows.filter((p) => permCodes.includes(p.code));
    for (const perm of granted) {
      grants.push({ roleId: role.id, permissionId: perm.id });
    }
  }
  if (grants.length) await db.insert(rolePermissions).values(grants).onConflictDoNothing();

  await db
    .insert(componentCategories)
    .values(CORE_CATEGORIES.map((c) => ({ id: createId(), ...c })))
    .onConflictDoNothing();

  const admin = resolveInitialAdmin();
  const passwordHash = await bcrypt.hash(admin.password, 10);
  const adminId = createId();
  await db.insert(users).values({
    id: adminId,
    email: admin.email,
    passwordHash,
    fullName: admin.fullName,
    isActive: true,
    // Force a change when we auto-generated the password (no operator secret).
    mustChangePassword: admin.generated,
  });
  const adminRole = roleRows.find((r) => r.code === "ADMIN");
  if (adminRole) {
    await db.insert(userRoles).values({ userId: adminId, roleId: adminRole.id });
  }

  if (admin.generated) {
    // Printed ONCE. There is no weak default any more — capture this now.
    logger.warn(
      "\n" +
        "============================================================\n" +
        " INITIAL ADMIN ACCOUNT CREATED (auto-generated password)\n" +
        `   email:    ${admin.email}\n` +
        `   password: ${admin.password}\n` +
        " Log in, then change this password immediately.\n" +
        " Set SEED_ADMIN_PASSWORD in .env to control it instead.\n" +
        "============================================================",
    );
  }

  logger.log(
    `Core seed done: ${permRows.length} permissions, ${roleRows.length} roles, ` +
      `${grants.length} grants, ${CORE_CATEGORIES.length} categories, admin=${admin.email}`,
  );
  return true;
}
