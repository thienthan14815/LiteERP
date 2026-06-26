/* eslint-disable no-console */
import { PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";

const prisma = new PrismaClient();

// ----------------------------------------------------------------------------
// Roles
// ----------------------------------------------------------------------------
const ROLES: Array<{ code: string; name: string; description: string }> = [
  { code: "ADMIN", name: "Administrator", description: "Full system access" },
  { code: "MANAGER", name: "Manager", description: "Manage operations and view reports" },
  { code: "WAREHOUSE", name: "Warehouse", description: "Handle stock in/out and inventory checks" },
  { code: "TECHNICIAN", name: "Technician", description: "Inspect, disassemble, assemble machines" },
  { code: "SALES", name: "Sales", description: "Create sales orders, manage customers" },
  { code: "ACCOUNTANT", name: "Accountant", description: "View finance, expenses, reports" },
  { code: "VIEWER", name: "Viewer", description: "Read-only access" },
];

// ----------------------------------------------------------------------------
// Permissions (ARCHITECTURE.md section 9)
// ----------------------------------------------------------------------------
const PERMISSIONS: string[] = [
  "purchase:create",
  "purchase:update",
  "purchase:confirm",
  "purchase:cancel",
  "purchase:view",

  "machine:create",
  "machine:inspect",
  "machine:disassemble",
  "machine:update",
  "machine:view",

  "component:create",
  "component:update",
  "component:delete",
  "component:view",

  "inventory:adjust",
  "inventory:view",

  "assembly:create",
  "assembly:update",
  "assembly:complete",
  "assembly:cancel",
  "assembly:view",

  "finished_pc:update",
  "finished_pc:view",

  "sale:create",
  "sale:update",
  "sale:cancel",
  "sale:refund",
  "sale:view",

  "warranty:create",
  "warranty:update",
  "warranty:complete",
  "warranty:view",

  "customer:create",
  "customer:update",
  "customer:view",
  "supplier:create",
  "supplier:update",
  "supplier:view",

  "report:view",
  "report:export",

  "user:create",
  "user:update",
  "user:delete",
  "user:view",
  "role:assign",

  "audit:view",
  "setting:update",
];

// ----------------------------------------------------------------------------
// Role <-> permissions mapping
// ----------------------------------------------------------------------------
const ROLE_PERMISSIONS: Record<string, string[]> = {
  // Admin gets everything (resolved at runtime).
  ADMIN: ["*"],

  MANAGER: [
    "purchase:create", "purchase:update", "purchase:confirm", "purchase:cancel", "purchase:view",
    "machine:create", "machine:inspect", "machine:disassemble", "machine:update", "machine:view",
    "component:create", "component:update", "component:view",
    "inventory:adjust", "inventory:view",
    "assembly:create", "assembly:update", "assembly:complete", "assembly:cancel", "assembly:view",
    "finished_pc:update", "finished_pc:view",
    "sale:create", "sale:update", "sale:cancel", "sale:refund", "sale:view",
    "warranty:create", "warranty:update", "warranty:complete", "warranty:view",
    "customer:create", "customer:update", "customer:view",
    "supplier:create", "supplier:update", "supplier:view",
    "report:view", "report:export",
    "user:view",
    "audit:view",
  ],

  WAREHOUSE: [
    "inventory:adjust", "inventory:view",
    "component:create", "component:update", "component:view",
    "machine:view", "finished_pc:view",
    "supplier:view", "customer:view",
  ],

  TECHNICIAN: [
    "machine:inspect", "machine:disassemble", "machine:update", "machine:view",
    "component:create", "component:update", "component:view",
    "assembly:create", "assembly:update", "assembly:complete", "assembly:view",
    "finished_pc:update", "finished_pc:view",
    "inventory:view",
  ],

  SALES: [
    "sale:create", "sale:update", "sale:cancel", "sale:view",
    "customer:create", "customer:update", "customer:view",
    "finished_pc:view", "component:view", "inventory:view",
    "warranty:create", "warranty:view",
  ],

  ACCOUNTANT: [
    "report:view", "report:export",
    "purchase:view", "sale:view", "warranty:view",
    "component:view", "machine:view", "finished_pc:view",
    "inventory:view", "audit:view",
  ],

  VIEWER: [
    "purchase:view", "machine:view", "component:view",
    "inventory:view", "assembly:view", "finished_pc:view",
    "sale:view", "warranty:view", "report:view",
    "customer:view", "supplier:view",
  ],
};

// ----------------------------------------------------------------------------
// Component categories (12 — section 4 / 6 of quanlybanhang.md)
// ----------------------------------------------------------------------------
const CATEGORIES: Array<{ code: string; name: string; prefix: string; sortOrder: number }> = [
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

async function main() {
  console.log("Seeding database...");

  // 1. Permissions
  for (const code of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code },
      create: { code, description: code },
      update: {},
    });
  }
  console.log(`  -> ${PERMISSIONS.length} permissions`);

  // 2. Roles
  for (const r of ROLES) {
    await prisma.role.upsert({
      where: { code: r.code },
      create: { code: r.code, name: r.name, description: r.description, isSystem: true },
      update: { name: r.name, description: r.description, isSystem: true },
    });
  }
  console.log(`  -> ${ROLES.length} roles`);

  // 3. Role-permission mappings
  const allPerms = await prisma.permission.findMany();
  for (const [roleCode, permCodes] of Object.entries(ROLE_PERMISSIONS)) {
    const role = await prisma.role.findUniqueOrThrow({ where: { code: roleCode } });
    const grantedPerms = permCodes.includes("*")
      ? allPerms
      : allPerms.filter((p) => permCodes.includes(p.code));
    for (const perm of grantedPerms) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
        create: { roleId: role.id, permissionId: perm.id },
        update: {},
      });
    }
    console.log(`  -> role ${roleCode}: ${grantedPerms.length} permissions`);
  }

  // 4. Component categories
  for (const c of CATEGORIES) {
    await prisma.componentCategory.upsert({
      where: { code: c.code },
      create: c,
      update: { name: c.name, prefix: c.prefix, sortOrder: c.sortOrder },
    });
  }
  console.log(`  -> ${CATEGORIES.length} component categories`);

  // 5. Admin user
  const passwordHash = await argon2.hash("admin1234");
  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    create: {
      email: "admin@example.com",
      passwordHash,
      fullName: "System Administrator",
      isActive: true,
    },
    update: { passwordHash, fullName: "System Administrator", isActive: true },
  });
  const adminRole = await prisma.role.findUniqueOrThrow({ where: { code: "ADMIN" } });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: adminRole.id } },
    create: { userId: admin.id, roleId: adminRole.id },
    update: {},
  });
  console.log(`  -> admin user: ${admin.email}`);

  console.log("Seed completed.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
