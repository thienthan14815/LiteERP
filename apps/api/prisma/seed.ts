/* eslint-disable no-console */
import "dotenv/config";
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
// Permissions (canonical set — Phase 1 + Phase 2 seeded so RBAC checks pass)
// ----------------------------------------------------------------------------
const PERMISSIONS: string[] = [
  "dashboard:view",

  "user:view",
  "user:create",
  "user:update",
  "user:delete",

  "role:view",
  "role:create",
  "role:update",
  "role:delete",

  "supplier:view",
  "supplier:create",
  "supplier:update",
  "supplier:delete",

  "customer:view",
  "customer:create",
  "customer:update",
  "customer:delete",

  "purchase:view",
  "purchase:create",
  "purchase:update",
  "purchase:confirm",
  "purchase:cancel",

  "machine:view",
  "machine:inspect",
  "machine:allocate_cost",
  "machine:disassemble",
  "machine:mark_ready",

  "component:view",
  "component:update",
  "component:scrap",

  "inventory:view",
  "inventory:adjust",

  "assembly:view",
  "assembly:create",
  "assembly:update",
  "assembly:complete",
  "assembly:cancel",

  "finished_pc:view",
  "finished_pc:update",

  "sale:view",
  "sale:create",
  "sale:update",
  "sale:cancel",

  "warranty:view",
  "warranty:create",
  "warranty:update",

  "attachment:view",
  "attachment:create",
  "attachment:delete",

  "report:view",

  "audit:view",

  "setting:view",
  "setting:update",
];

// ----------------------------------------------------------------------------
// Role <-> permissions mapping
// ----------------------------------------------------------------------------
const VIEW_ONLY_PERMS = PERMISSIONS.filter((p) => p.endsWith(":view"));

const ROLE_PERMISSIONS: Record<string, string[]> = {
  // Admin gets everything (resolved at runtime via "*" wildcard in PermissionsGuard).
  ADMIN: ["*"],

  MANAGER: [
    "dashboard:view",
    "user:view",
    "role:view",
    "supplier:view", "supplier:create", "supplier:update",
    "customer:view", "customer:create", "customer:update",
    "purchase:view", "purchase:create", "purchase:update", "purchase:confirm", "purchase:cancel",
    "machine:view", "machine:inspect", "machine:allocate_cost", "machine:disassemble", "machine:mark_ready",
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
    "machine:view", "machine:inspect", "machine:allocate_cost", "machine:disassemble", "machine:mark_ready",
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

  VIEWER: VIEW_ONLY_PERMS,
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

  // 1. Permissions — also prune any legacy codes that are no longer in the canonical set.
  for (const code of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code },
      create: { code, description: code },
      update: {},
    });
  }
  await prisma.permission.deleteMany({ where: { code: { notIn: PERMISSIONS } } });
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

  // 6. Sample business data (idempotent — upsert theo code)
  await seedSampleData();

  console.log("Seed completed.");
}

async function seedSampleData() {
  // Suppliers — dùng field mới (fbUrl / marketplaceUrl / category)
  const suppliers: Array<{
    code: string;
    name: string;
    fbUrl?: string;
    marketplaceUrl?: string;
    category?: "WHOLESALE" | "RETAIL";
  }> = [
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
    {
      code: "SUP000003",
      name: "Cá nhân thu mua máy cũ",
      category: "RETAIL",
    },
  ];
  for (const s of suppliers) {
    await prisma.supplier.upsert({ where: { code: s.code }, create: s, update: s });
  }
  console.log(`  -> ${suppliers.length} suppliers`);

  // Customers
  const customers = [
    { code: "CUS000001", name: "Khách lẻ", phone: "0900000000" },
    { code: "CUS000002", name: "Công ty XYZ", phone: "0913456789", email: "kt@xyz.vn" },
    { code: "CUS000003", name: "Nguyễn Văn A", phone: "0908765432" },
  ];
  for (const c of customers) {
    await prisma.customer.upsert({ where: { code: c.code }, create: c, update: c });
  }
  console.log(`  -> ${customers.length} customers`);

  // Sample components — gắn vào category đã seed
  const cpuCat = await prisma.componentCategory.findUniqueOrThrow({ where: { code: "CPU" } });
  const ramCat = await prisma.componentCategory.findUniqueOrThrow({ where: { code: "RAM" } });
  const ssdCat = await prisma.componentCategory.findUniqueOrThrow({ where: { code: "SSD" } });
  const gpuCat = await prisma.componentCategory.findUniqueOrThrow({ where: { code: "GPU" } });
  const psuCat = await prisma.componentCategory.findUniqueOrThrow({ where: { code: "PSU" } });
  const mbCat = await prisma.componentCategory.findUniqueOrThrow({ where: { code: "MB" } });

  const components = [
    { code: "CPU000001", categoryId: cpuCat.id, model: "Intel Core i5-9400F", costPrice: 1500000 },
    { code: "CPU000002", categoryId: cpuCat.id, model: "Intel Core i7-9700K", costPrice: 3200000 },
    { code: "RAM000001", categoryId: ramCat.id, model: "Kingston DDR4 8GB 2666MHz", costPrice: 450000 },
    { code: "RAM000002", categoryId: ramCat.id, model: "Corsair Vengeance 16GB DDR4 3200", costPrice: 1100000 },
    { code: "SSD000001", categoryId: ssdCat.id, model: "Samsung 870 EVO 500GB", costPrice: 1200000 },
    { code: "SSD000002", categoryId: ssdCat.id, model: "WD Blue SN570 1TB NVMe", costPrice: 1800000 },
    { code: "GPU000001", categoryId: gpuCat.id, model: "NVIDIA GTX 1660 Super 6GB", costPrice: 3500000 },
    { code: "PSU000001", categoryId: psuCat.id, model: "Corsair CV550 550W 80+ Bronze", costPrice: 1100000 },
    { code: "MB0000001", categoryId: mbCat.id, model: "ASUS PRIME B365M-A", costPrice: 1800000 },
  ];
  for (const c of components) {
    await prisma.component.upsert({
      where: { code: c.code },
      create: {
        code: c.code,
        categoryId: c.categoryId,
        model: c.model,
        costPrice: c.costPrice,
        status: "IN_STOCK",
        condition: "GOOD",
      },
      update: { model: c.model, costPrice: c.costPrice },
    });
  }
  console.log(`  -> ${components.length} sample components (status=IN_STOCK)`);

  // Bump CodeCounter cho các prefix đã hardcode ở trên — tránh CodeGenerator
  // sinh trùng code khi user tạo record mới (vd "SUPPLIER_CODE_TAKEN").
  const counters = [
    { key: "SUP", last: 3 },
    { key: "CUS", last: 3 },
    { key: "CPU", last: 2 },
    { key: "RAM", last: 2 },
    { key: "SSD", last: 2 },
    { key: "GPU", last: 1 },
    { key: "PSU", last: 1 },
    { key: "MB",  last: 1 },
  ];
  for (const c of counters) {
    // Không overwrite nếu counter đã cao hơn (user có thể đã tạo thêm record).
    const existing = await prisma.codeCounter.findUnique({ where: { key: c.key } });
    if (!existing) {
      await prisma.codeCounter.create({ data: c });
    } else if (existing.last < c.last) {
      await prisma.codeCounter.update({ where: { key: c.key }, data: { last: c.last } });
    }
  }
  console.log(`  -> synced ${counters.length} code counters`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
