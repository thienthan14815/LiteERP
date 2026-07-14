// Drizzle schema — 1:1 mirror of apps/api/prisma/schema.prisma.
//
// Column snake_case names come from Prisma's @map directive; keeping them
// identical means the existing SQLite database file works unchanged after
// the migration off Prisma.
//
// SQLite quirks that shape this file:
//   - No native Decimal type: stored as TEXT (like Prisma) and marshalled at
//     the service layer.
//   - No native Boolean type: stored as INTEGER 0/1 via mode: "boolean".
//   - No native DateTime type: stored as INTEGER millis via mode: "timestamp_ms"
//     for parity with Prisma's storage.
//   - Enum columns are plain TEXT — the canonical enum values live in
//     packages/shared/src/types/enums.ts.

import { relations, sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  real,
  primaryKey,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

// Prisma stores DateTime as INTEGER millis when using SQLite (verified against
// the seeded DB: typeof(created_at) = integer). Reuse that mode so old rows
// deserialise unchanged.
const timestamp = (name: string) =>
  integer(name, { mode: "timestamp_ms" });
const boolCol = (name: string) => integer(name, { mode: "boolean" });
// Prisma Decimal on SQLite lands in NUMERIC-affinity columns as plain numbers
// (verified: typeof(cost_price) = integer). Money amounts here are VND and fit
// exactly in a double, so JS number round-trips cleanly.
const decimal = (name: string) => real(name);

// ---------------------------------------------------------------------------
// AUTH & RBAC
// ---------------------------------------------------------------------------

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  fullName: text("full_name").notNull(),
  phone: text("phone"),
  isActive: boolCol("is_active").notNull().default(true),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").notNull().default(sql`(unixepoch() * 1000)`),
  updatedAt: timestamp("updated_at").notNull().default(sql`(unixepoch() * 1000)`),
});

export const roles = sqliteTable("roles", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  isSystem: boolCol("is_system").notNull().default(false),
  createdAt: timestamp("created_at").notNull().default(sql`(unixepoch() * 1000)`),
  updatedAt: timestamp("updated_at").notNull().default(sql`(unixepoch() * 1000)`),
});

export const permissions = sqliteTable("permissions", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().default(sql`(unixepoch() * 1000)`),
});

export const userRoles = sqliteTable(
  "user_roles",
  {
    userId: text("user_id").notNull(),
    roleId: text("role_id").notNull(),
    createdAt: timestamp("created_at").notNull().default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({ pk: primaryKey({ columns: [t.userId, t.roleId] }) }),
);

export const rolePermissions = sqliteTable(
  "role_permissions",
  {
    roleId: text("role_id").notNull(),
    permissionId: text("permission_id").notNull(),
    createdAt: timestamp("created_at").notNull().default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({ pk: primaryKey({ columns: [t.roleId, t.permissionId] }) }),
);

// ---------------------------------------------------------------------------
// PARTIES
// ---------------------------------------------------------------------------

export const suppliers = sqliteTable(
  "suppliers",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    phone: text("phone"),
    email: text("email"),
    address: text("address"),
    taxCode: text("tax_code"),
    notes: text("notes"),
    fbUrl: text("fb_url"),
    marketplaceUrl: text("marketplace_url"),
    category: text("category"),
    tenantId: text("tenant_id"),
    branchId: text("branch_id"),
    createdById: text("created_by_id"),
    createdAt: timestamp("created_at").notNull().default(sql`(unixepoch() * 1000)`),
    updatedAt: timestamp("updated_at").notNull().default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    nameIdx: index("suppliers_name_idx").on(t.name),
    categoryIdx: index("suppliers_category_idx").on(t.category),
    tenantIdx: index("suppliers_tenant_idx").on(t.tenantId),
    branchIdx: index("suppliers_branch_idx").on(t.branchId),
  }),
);

export const customers = sqliteTable(
  "customers",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    phone: text("phone"),
    email: text("email"),
    address: text("address"),
    taxCode: text("tax_code"),
    notes: text("notes"),
    tenantId: text("tenant_id"),
    branchId: text("branch_id"),
    createdById: text("created_by_id"),
    createdAt: timestamp("created_at").notNull().default(sql`(unixepoch() * 1000)`),
    updatedAt: timestamp("updated_at").notNull().default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    nameIdx: index("customers_name_idx").on(t.name),
    phoneIdx: index("customers_phone_idx").on(t.phone),
    tenantIdx: index("customers_tenant_idx").on(t.tenantId),
    branchIdx: index("customers_branch_idx").on(t.branchId),
  }),
);

// ---------------------------------------------------------------------------
// PURCHASING
// ---------------------------------------------------------------------------

export const purchaseOrders = sqliteTable(
  "purchase_orders",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull().unique(),
    supplierId: text("supplier_id"),
    status: text("status").notNull().default("DRAFT"),
    totalAmount: decimal("total_amount").notNull().default(0),
    otherCost: decimal("other_cost").notNull().default(0),
    notes: text("notes"),
    confirmedAt: timestamp("confirmed_at"),
    cancelledAt: timestamp("cancelled_at"),
    tenantId: text("tenant_id"),
    branchId: text("branch_id"),
    createdById: text("created_by_id"),
    createdAt: timestamp("created_at").notNull().default(sql`(unixepoch() * 1000)`),
    updatedAt: timestamp("updated_at").notNull().default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    statusIdx: index("purchase_orders_status_idx").on(t.status),
    createdAtIdx: index("purchase_orders_created_at_idx").on(t.createdAt),
    supplierIdx: index("purchase_orders_supplier_idx").on(t.supplierId),
    tenantIdx: index("purchase_orders_tenant_idx").on(t.tenantId),
    branchIdx: index("purchase_orders_branch_idx").on(t.branchId),
  }),
);

export const purchaseItems = sqliteTable(
  "purchase_items",
  {
    id: text("id").primaryKey(),
    purchaseOrderId: text("purchase_order_id").notNull(),
    itemType: text("item_type").notNull(),
    description: text("description").notNull(),
    model: text("model"),
    serial: text("serial"),
    quantity: integer("quantity").notNull().default(1),
    unitPrice: decimal("unit_price").notNull(),
    totalPrice: decimal("total_price").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().default(sql`(unixepoch() * 1000)`),
    updatedAt: timestamp("updated_at").notNull().default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    poIdx: index("purchase_items_po_idx").on(t.purchaseOrderId),
    typeIdx: index("purchase_items_type_idx").on(t.itemType),
  }),
);

// ---------------------------------------------------------------------------
// MACHINES
// ---------------------------------------------------------------------------

export const machines = sqliteTable(
  "machines",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull().unique(),
    serial: text("serial"),
    status: text("status").notNull().default("NEW"),
    purchaseItemId: text("purchase_item_id"),
    cost: decimal("cost").notNull().default(0),
    repairCost: decimal("repair_cost").notNull().default(0),
    cleaningCost: decimal("cleaning_cost").notNull().default(0),
    notes: text("notes"),
    inspectedAt: timestamp("inspected_at"),
    disassembledAt: timestamp("disassembled_at"),
    soldAt: timestamp("sold_at"),
    tenantId: text("tenant_id"),
    branchId: text("branch_id"),
    createdById: text("created_by_id"),
    createdAt: timestamp("created_at").notNull().default(sql`(unixepoch() * 1000)`),
    updatedAt: timestamp("updated_at").notNull().default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    statusIdx: index("machines_status_idx").on(t.status),
    serialIdx: index("machines_serial_idx").on(t.serial),
    createdAtIdx: index("machines_created_at_idx").on(t.createdAt),
    tenantIdx: index("machines_tenant_idx").on(t.tenantId),
    branchIdx: index("machines_branch_idx").on(t.branchId),
  }),
);

export const machineComponents = sqliteTable(
  "machine_components",
  {
    id: text("id").primaryKey(),
    machineId: text("machine_id").notNull(),
    categoryId: text("category_id").notNull(),
    model: text("model"),
    serial: text("serial"),
    condition: text("condition").notNull().default("GOOD"),
    allocatedCost: decimal("allocated_cost").notNull().default(0),
    notes: text("notes"),
    componentId: text("component_id").unique(),
    createdAt: timestamp("created_at").notNull().default(sql`(unixepoch() * 1000)`),
    updatedAt: timestamp("updated_at").notNull().default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    machineIdx: index("machine_components_machine_idx").on(t.machineId),
    categoryIdx: index("machine_components_category_idx").on(t.categoryId),
  }),
);

// ---------------------------------------------------------------------------
// COMPONENTS
// ---------------------------------------------------------------------------

export const componentCategories = sqliteTable("component_categories", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  prefix: text("prefix").notNull().unique(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().default(sql`(unixepoch() * 1000)`),
  updatedAt: timestamp("updated_at").notNull().default(sql`(unixepoch() * 1000)`),
});

export const components = sqliteTable(
  "components",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull().unique(),
    serialNumber: text("serial_number"),
    categoryId: text("category_id").notNull(),
    model: text("model"),
    status: text("status").notNull().default("IN_STOCK"),
    condition: text("condition").notNull().default("GOOD"),
    costPrice: decimal("cost_price").notNull().default(0),
    location: text("location"),
    notes: text("notes"),
    sourceMachineId: text("source_machine_id"),
    currentFinishedPcId: text("current_finished_pc_id"),
    tenantId: text("tenant_id"),
    branchId: text("branch_id"),
    createdById: text("created_by_id"),
    createdAt: timestamp("created_at").notNull().default(sql`(unixepoch() * 1000)`),
    updatedAt: timestamp("updated_at").notNull().default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    tenantSerialUnique: uniqueIndex("components_tenant_serial_uk").on(t.tenantId, t.serialNumber),
    codeIdx: index("components_code_idx").on(t.code),
    statusIdx: index("components_status_idx").on(t.status),
    categoryIdx: index("components_category_idx").on(t.categoryId),
    sourceMachineIdx: index("components_source_machine_idx").on(t.sourceMachineId),
    finishedPcIdx: index("components_finished_pc_idx").on(t.currentFinishedPcId),
    tenantIdx: index("components_tenant_idx").on(t.tenantId),
    branchIdx: index("components_branch_idx").on(t.branchId),
  }),
);

// ---------------------------------------------------------------------------
// ASSEMBLY
// ---------------------------------------------------------------------------

export const assemblyOrders = sqliteTable(
  "assembly_orders",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull().unique(),
    status: text("status").notNull().default("DRAFT"),
    repairCost: decimal("repair_cost").notNull().default(0),
    cleaningCost: decimal("cleaning_cost").notNull().default(0),
    assemblyCost: decimal("assembly_cost").notNull().default(0),
    notes: text("notes"),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    tenantId: text("tenant_id"),
    branchId: text("branch_id"),
    createdById: text("created_by_id"),
    createdAt: timestamp("created_at").notNull().default(sql`(unixepoch() * 1000)`),
    updatedAt: timestamp("updated_at").notNull().default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    statusIdx: index("assembly_orders_status_idx").on(t.status),
    createdAtIdx: index("assembly_orders_created_at_idx").on(t.createdAt),
    tenantIdx: index("assembly_orders_tenant_idx").on(t.tenantId),
    branchIdx: index("assembly_orders_branch_idx").on(t.branchId),
  }),
);

export const assemblyItems = sqliteTable(
  "assembly_items",
  {
    id: text("id").primaryKey(),
    assemblyOrderId: text("assembly_order_id").notNull(),
    componentId: text("component_id").notNull(),
    unitCost: decimal("unit_cost").notNull().default(0),
    createdAt: timestamp("created_at").notNull().default(sql`(unixepoch() * 1000)`),
    updatedAt: timestamp("updated_at").notNull().default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    aoComponentUnique: uniqueIndex("assembly_items_ao_component_uk").on(t.assemblyOrderId, t.componentId),
    componentIdx: index("assembly_items_component_idx").on(t.componentId),
  }),
);

// ---------------------------------------------------------------------------
// FINISHED PCs
// ---------------------------------------------------------------------------

export const finishedPcs = sqliteTable(
  "finished_pcs",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull().unique(),
    assemblyOrderId: text("assembly_order_id"),
    status: text("status").notNull().default("DRAFT"),
    costPrice: decimal("cost_price").notNull().default(0),
    suggestedPrice: decimal("suggested_price").notNull().default(0),
    soldPrice: decimal("sold_price"),
    notes: text("notes"),
    readyAt: timestamp("ready_at"),
    soldAt: timestamp("sold_at"),
    tenantId: text("tenant_id"),
    branchId: text("branch_id"),
    createdById: text("created_by_id"),
    createdAt: timestamp("created_at").notNull().default(sql`(unixepoch() * 1000)`),
    updatedAt: timestamp("updated_at").notNull().default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    statusIdx: index("finished_pcs_status_idx").on(t.status),
    createdAtIdx: index("finished_pcs_created_at_idx").on(t.createdAt),
    tenantIdx: index("finished_pcs_tenant_idx").on(t.tenantId),
    branchIdx: index("finished_pcs_branch_idx").on(t.branchId),
  }),
);

export const finishedPcComponents = sqliteTable(
  "finished_pc_components",
  {
    id: text("id").primaryKey(),
    finishedPcId: text("finished_pc_id").notNull(),
    componentId: text("component_id").notNull(),
    installedAt: timestamp("installed_at").notNull().default(sql`(unixepoch() * 1000)`),
    removedAt: timestamp("removed_at"),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().default(sql`(unixepoch() * 1000)`),
    updatedAt: timestamp("updated_at").notNull().default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    finishedPcIdx: index("finished_pc_components_pc_idx").on(t.finishedPcId),
    componentIdx: index("finished_pc_components_component_idx").on(t.componentId),
    removedAtIdx: index("finished_pc_components_removed_at_idx").on(t.removedAt),
  }),
);

// ---------------------------------------------------------------------------
// SALES
// ---------------------------------------------------------------------------

export const salesOrders = sqliteTable(
  "sales_orders",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull().unique(),
    orderName: text("order_name"),
    sellerName: text("seller_name"),
    platform: text("platform"),
    salesUrl: text("sales_url"),
    customerId: text("customer_id"),
    status: text("status").notNull().default("DRAFT"),
    totalAmount: decimal("total_amount").notNull().default(0),
    discount: decimal("discount").notNull().default(0),
    notes: text("notes"),
    confirmedAt: timestamp("confirmed_at"),
    cancelledAt: timestamp("cancelled_at"),
    refundedAt: timestamp("refunded_at"),
    tenantId: text("tenant_id"),
    branchId: text("branch_id"),
    createdById: text("created_by_id"),
    createdAt: timestamp("created_at").notNull().default(sql`(unixepoch() * 1000)`),
    updatedAt: timestamp("updated_at").notNull().default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    statusIdx: index("sales_orders_status_idx").on(t.status),
    createdAtIdx: index("sales_orders_created_at_idx").on(t.createdAt),
    customerIdx: index("sales_orders_customer_idx").on(t.customerId),
    tenantIdx: index("sales_orders_tenant_idx").on(t.tenantId),
    branchIdx: index("sales_orders_branch_idx").on(t.branchId),
  }),
);

export const salesItems = sqliteTable(
  "sales_items",
  {
    id: text("id").primaryKey(),
    salesOrderId: text("sales_order_id").notNull(),
    itemType: text("item_type").notNull(),
    finishedPcId: text("finished_pc_id"),
    componentId: text("component_id"),
    quantity: integer("quantity").notNull().default(1),
    unitPrice: decimal("unit_price").notNull(),
    unitCost: decimal("unit_cost").notNull().default(0),
    totalPrice: decimal("total_price").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().default(sql`(unixepoch() * 1000)`),
    updatedAt: timestamp("updated_at").notNull().default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    soIdx: index("sales_items_so_idx").on(t.salesOrderId),
    typeIdx: index("sales_items_type_idx").on(t.itemType),
    finishedPcIdx: index("sales_items_pc_idx").on(t.finishedPcId),
    componentIdx: index("sales_items_component_idx").on(t.componentId),
  }),
);

// ---------------------------------------------------------------------------
// STOCK LEDGER
// ---------------------------------------------------------------------------

export const stockTransactions = sqliteTable(
  "stock_transactions",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull(),
    componentId: text("component_id").notNull(),
    quantity: integer("quantity").notNull().default(1),
    reason: text("reason").notNull(),
    refType: text("ref_type"),
    refId: text("ref_id"),
    notes: text("notes"),
    tenantId: text("tenant_id"),
    branchId: text("branch_id"),
    createdById: text("created_by_id"),
    createdAt: timestamp("created_at").notNull().default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    componentIdx: index("stock_transactions_component_idx").on(t.componentId),
    createdAtIdx: index("stock_transactions_created_at_idx").on(t.createdAt),
    typeIdx: index("stock_transactions_type_idx").on(t.type),
    refIdx: index("stock_transactions_ref_idx").on(t.refType, t.refId),
    tenantIdx: index("stock_transactions_tenant_idx").on(t.tenantId),
    branchIdx: index("stock_transactions_branch_idx").on(t.branchId),
  }),
);

// ---------------------------------------------------------------------------
// WARRANTY
// ---------------------------------------------------------------------------

export const warrantyCases = sqliteTable(
  "warranty_cases",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull().unique(),
    customerId: text("customer_id"),
    finishedPcId: text("finished_pc_id"),
    status: text("status").notNull().default("RECEIVED"),
    description: text("description").notNull(),
    resolution: text("resolution"),
    receivedAt: timestamp("received_at").notNull().default(sql`(unixepoch() * 1000)`),
    completedAt: timestamp("completed_at"),
    tenantId: text("tenant_id"),
    branchId: text("branch_id"),
    createdById: text("created_by_id"),
    createdAt: timestamp("created_at").notNull().default(sql`(unixepoch() * 1000)`),
    updatedAt: timestamp("updated_at").notNull().default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    statusIdx: index("warranty_cases_status_idx").on(t.status),
    createdAtIdx: index("warranty_cases_created_at_idx").on(t.createdAt),
    customerIdx: index("warranty_cases_customer_idx").on(t.customerId),
    finishedPcIdx: index("warranty_cases_pc_idx").on(t.finishedPcId),
    tenantIdx: index("warranty_cases_tenant_idx").on(t.tenantId),
    branchIdx: index("warranty_cases_branch_idx").on(t.branchId),
  }),
);

export const warrantyItems = sqliteTable(
  "warranty_items",
  {
    id: text("id").primaryKey(),
    warrantyCaseId: text("warranty_case_id").notNull(),
    removedComponentId: text("removed_component_id"),
    replacementComponentId: text("replacement_component_id"),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().default(sql`(unixepoch() * 1000)`),
    updatedAt: timestamp("updated_at").notNull().default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    caseIdx: index("warranty_items_case_idx").on(t.warrantyCaseId),
  }),
);

// ---------------------------------------------------------------------------
// EXPENSES, ATTACHMENTS, AUDIT, MISC
// ---------------------------------------------------------------------------

export const expenses = sqliteTable(
  "expenses",
  {
    id: text("id").primaryKey(),
    category: text("category").notNull(),
    amount: decimal("amount").notNull(),
    description: text("description").notNull(),
    refType: text("ref_type"),
    refId: text("ref_id"),
    incurredAt: timestamp("incurred_at").notNull().default(sql`(unixepoch() * 1000)`),
    tenantId: text("tenant_id"),
    branchId: text("branch_id"),
    createdById: text("created_by_id"),
    createdAt: timestamp("created_at").notNull().default(sql`(unixepoch() * 1000)`),
    updatedAt: timestamp("updated_at").notNull().default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    categoryIdx: index("expenses_category_idx").on(t.category),
    incurredAtIdx: index("expenses_incurred_at_idx").on(t.incurredAt),
    refIdx: index("expenses_ref_idx").on(t.refType, t.refId),
    tenantIdx: index("expenses_tenant_idx").on(t.tenantId),
    branchIdx: index("expenses_branch_idx").on(t.branchId),
  }),
);

export const masterOptions = sqliteTable(
  "master_options",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull(),
    name: text("name").notNull(),
    notes: text("notes"),
    tenantId: text("tenant_id"),
    createdAt: timestamp("created_at").notNull().default(sql`(unixepoch() * 1000)`),
    updatedAt: timestamp("updated_at").notNull().default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    typeTenantNameUnique: uniqueIndex("master_options_type_tenant_name_uk").on(t.type, t.tenantId, t.name),
    typeIdx: index("master_options_type_idx").on(t.type),
  }),
);

export const attachments = sqliteTable(
  "attachments",
  {
    id: text("id").primaryKey(),
    fileName: text("file_name").notNull(),
    fileUrl: text("file_url").notNull(),
    fileType: text("file_type").notNull(),
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull(),
    relatedType: text("related_type").notNull(),
    relatedId: text("related_id").notNull(),
    driveFileId: text("drive_file_id"),
    tenantId: text("tenant_id"),
    branchId: text("branch_id"),
    createdById: text("created_by_id"),
    createdAt: timestamp("created_at").notNull().default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    relatedIdx: index("attachments_related_idx").on(t.relatedType, t.relatedId),
    fileTypeIdx: index("attachments_file_type_idx").on(t.fileType),
    driveFileIdx: index("attachments_drive_file_idx").on(t.driveFileId),
    tenantIdx: index("attachments_tenant_idx").on(t.tenantId),
    branchIdx: index("attachments_branch_idx").on(t.branchId),
  }),
);

export const refreshTokens = sqliteTable(
  "refresh_tokens",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    revokedAt: timestamp("revoked_at"),
    createdAt: timestamp("created_at").notNull().default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    userIdx: index("refresh_tokens_user_idx").on(t.userId),
    expiresIdx: index("refresh_tokens_expires_idx").on(t.expiresAt),
  }),
);

export const codeCounters = sqliteTable("code_counters", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  last: integer("last").notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().default(sql`(unixepoch() * 1000)`),
});

export const backupRecords = sqliteTable(
  "backup_records",
  {
    id: text("id").primaryKey(),
    driveFileId: text("drive_file_id").notNull().unique(),
    filename: text("filename").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    kind: text("kind").notNull().default("DAILY"),
    createdAt: timestamp("created_at").notNull().default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    createdAtIdx: index("backup_records_created_at_idx").on(t.createdAt),
    kindIdx: index("backup_records_kind_idx").on(t.kind),
  }),
);

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    actorUserId: text("actor_user_id"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    beforeJson: text("before_json"),
    afterJson: text("after_json"),
    ip: text("ip"),
    userAgent: text("user_agent"),
    tenantId: text("tenant_id"),
    branchId: text("branch_id"),
    createdAt: timestamp("created_at").notNull().default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    entityIdx: index("audit_logs_entity_idx").on(t.entityType, t.entityId),
    actorIdx: index("audit_logs_actor_idx").on(t.actorUserId),
    actionIdx: index("audit_logs_action_idx").on(t.action),
    createdAtIdx: index("audit_logs_created_at_idx").on(t.createdAt),
    tenantIdx: index("audit_logs_tenant_idx").on(t.tenantId),
    branchIdx: index("audit_logs_branch_idx").on(t.branchId),
  }),
);

// ---------------------------------------------------------------------------
// RELATIONS — power db.query.<table>.findMany({ with: {...} }), the drizzle
// equivalent of Prisma's `include`. Relation keys intentionally match the
// Prisma relation field names so migrated code reads the same.
// ---------------------------------------------------------------------------

export const usersRelations = relations(users, ({ many }) => ({
  userRoles: many(userRoles),
}));

export const rolesRelations = relations(roles, ({ many }) => ({
  userRoles: many(userRoles),
  rolePermissions: many(rolePermissions),
}));

export const permissionsRelations = relations(permissions, ({ many }) => ({
  rolePermissions: many(rolePermissions),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, { fields: [userRoles.userId], references: [users.id] }),
  role: one(roles, { fields: [userRoles.roleId], references: [roles.id] }),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, { fields: [rolePermissions.roleId], references: [roles.id] }),
  permission: one(permissions, {
    fields: [rolePermissions.permissionId],
    references: [permissions.id],
  }),
}));

export const suppliersRelations = relations(suppliers, ({ many }) => ({
  purchaseOrders: many(purchaseOrders),
}));

export const customersRelations = relations(customers, ({ many }) => ({
  salesOrders: many(salesOrders),
  warrantyCases: many(warrantyCases),
}));

export const purchaseOrdersRelations = relations(purchaseOrders, ({ one, many }) => ({
  supplier: one(suppliers, {
    fields: [purchaseOrders.supplierId],
    references: [suppliers.id],
  }),
  items: many(purchaseItems),
}));

export const purchaseItemsRelations = relations(purchaseItems, ({ one, many }) => ({
  purchaseOrder: one(purchaseOrders, {
    fields: [purchaseItems.purchaseOrderId],
    references: [purchaseOrders.id],
  }),
  machines: many(machines),
}));

export const machinesRelations = relations(machines, ({ one, many }) => ({
  purchaseItem: one(purchaseItems, {
    fields: [machines.purchaseItemId],
    references: [purchaseItems.id],
  }),
  machineComponents: many(machineComponents),
  sourcedComponents: many(components, { relationName: "componentSourceMachine" }),
}));

export const machineComponentsRelations = relations(machineComponents, ({ one }) => ({
  machine: one(machines, {
    fields: [machineComponents.machineId],
    references: [machines.id],
  }),
  category: one(componentCategories, {
    fields: [machineComponents.categoryId],
    references: [componentCategories.id],
  }),
  component: one(components, {
    fields: [machineComponents.componentId],
    references: [components.id],
  }),
}));

export const componentCategoriesRelations = relations(componentCategories, ({ many }) => ({
  components: many(components),
  machineComponents: many(machineComponents),
}));

export const componentsRelations = relations(components, ({ one, many }) => ({
  category: one(componentCategories, {
    fields: [components.categoryId],
    references: [componentCategories.id],
  }),
  sourceMachine: one(machines, {
    fields: [components.sourceMachineId],
    references: [machines.id],
    relationName: "componentSourceMachine",
  }),
  currentFinishedPc: one(finishedPcs, {
    fields: [components.currentFinishedPcId],
    references: [finishedPcs.id],
    relationName: "componentCurrentFinishedPc",
  }),
  assemblyItems: many(assemblyItems),
  finishedPcLinks: many(finishedPcComponents),
  salesItems: many(salesItems),
  stockTransactions: many(stockTransactions),
  warrantyItemsAdded: many(warrantyItems, { relationName: "warrantyItemReplacement" }),
  warrantyItemsRemoved: many(warrantyItems, { relationName: "warrantyItemRemoved" }),
}));

export const assemblyOrdersRelations = relations(assemblyOrders, ({ many }) => ({
  items: many(assemblyItems),
  finishedPcs: many(finishedPcs),
}));

export const assemblyItemsRelations = relations(assemblyItems, ({ one }) => ({
  assemblyOrder: one(assemblyOrders, {
    fields: [assemblyItems.assemblyOrderId],
    references: [assemblyOrders.id],
  }),
  component: one(components, {
    fields: [assemblyItems.componentId],
    references: [components.id],
  }),
}));

export const finishedPcsRelations = relations(finishedPcs, ({ one, many }) => ({
  assemblyOrder: one(assemblyOrders, {
    fields: [finishedPcs.assemblyOrderId],
    references: [assemblyOrders.id],
  }),
  componentLinks: many(finishedPcComponents),
  currentComponents: many(components, { relationName: "componentCurrentFinishedPc" }),
  salesItems: many(salesItems),
  warrantyCases: many(warrantyCases),
}));

export const finishedPcComponentsRelations = relations(finishedPcComponents, ({ one }) => ({
  finishedPc: one(finishedPcs, {
    fields: [finishedPcComponents.finishedPcId],
    references: [finishedPcs.id],
  }),
  component: one(components, {
    fields: [finishedPcComponents.componentId],
    references: [components.id],
  }),
}));

export const salesOrdersRelations = relations(salesOrders, ({ one, many }) => ({
  customer: one(customers, {
    fields: [salesOrders.customerId],
    references: [customers.id],
  }),
  items: many(salesItems),
}));

export const salesItemsRelations = relations(salesItems, ({ one }) => ({
  salesOrder: one(salesOrders, {
    fields: [salesItems.salesOrderId],
    references: [salesOrders.id],
  }),
  finishedPc: one(finishedPcs, {
    fields: [salesItems.finishedPcId],
    references: [finishedPcs.id],
  }),
  component: one(components, {
    fields: [salesItems.componentId],
    references: [components.id],
  }),
}));

export const stockTransactionsRelations = relations(stockTransactions, ({ one }) => ({
  component: one(components, {
    fields: [stockTransactions.componentId],
    references: [components.id],
  }),
}));

export const warrantyCasesRelations = relations(warrantyCases, ({ one, many }) => ({
  customer: one(customers, {
    fields: [warrantyCases.customerId],
    references: [customers.id],
  }),
  finishedPc: one(finishedPcs, {
    fields: [warrantyCases.finishedPcId],
    references: [finishedPcs.id],
  }),
  items: many(warrantyItems),
}));

export const warrantyItemsRelations = relations(warrantyItems, ({ one }) => ({
  warrantyCase: one(warrantyCases, {
    fields: [warrantyItems.warrantyCaseId],
    references: [warrantyCases.id],
  }),
  removedComponent: one(components, {
    fields: [warrantyItems.removedComponentId],
    references: [components.id],
    relationName: "warrantyItemRemoved",
  }),
  replacementComponent: one(components, {
    fields: [warrantyItems.replacementComponentId],
    references: [components.id],
    relationName: "warrantyItemReplacement",
  }),
}));

// ---------------------------------------------------------------------------
// Row-inferred types (mirror Prisma's generated types)
// ---------------------------------------------------------------------------

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Role = typeof roles.$inferSelect;
export type Permission = typeof permissions.$inferSelect;
export type Supplier = typeof suppliers.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type PurchaseItem = typeof purchaseItems.$inferSelect;
export type Machine = typeof machines.$inferSelect;
export type MachineComponent = typeof machineComponents.$inferSelect;
export type ComponentCategory = typeof componentCategories.$inferSelect;
export type Component = typeof components.$inferSelect;
export type AssemblyOrder = typeof assemblyOrders.$inferSelect;
export type AssemblyItem = typeof assemblyItems.$inferSelect;
export type FinishedPc = typeof finishedPcs.$inferSelect;
export type FinishedPcComponent = typeof finishedPcComponents.$inferSelect;
export type SalesOrder = typeof salesOrders.$inferSelect;
export type SalesItem = typeof salesItems.$inferSelect;
export type StockTransaction = typeof stockTransactions.$inferSelect;
export type WarrantyCase = typeof warrantyCases.$inferSelect;
export type WarrantyItem = typeof warrantyItems.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type MasterOption = typeof masterOptions.$inferSelect;
export type Attachment = typeof attachments.$inferSelect;
export type RefreshToken = typeof refreshTokens.$inferSelect;
export type CodeCounter = typeof codeCounters.$inferSelect;
export type BackupRecord = typeof backupRecords.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;

// Handy bundle for services that want all-tables in one namespace. Relations
// must be included so drizzle's relational query API (db.query.*) works.
export const schema = {
  users, roles, permissions, userRoles, rolePermissions,
  suppliers, customers,
  purchaseOrders, purchaseItems,
  machines, machineComponents,
  componentCategories, components,
  assemblyOrders, assemblyItems,
  finishedPcs, finishedPcComponents,
  salesOrders, salesItems,
  stockTransactions,
  warrantyCases, warrantyItems,
  expenses, masterOptions, attachments,
  refreshTokens, codeCounters, backupRecords, auditLogs,
  usersRelations, rolesRelations, permissionsRelations,
  userRolesRelations, rolePermissionsRelations,
  suppliersRelations, customersRelations,
  purchaseOrdersRelations, purchaseItemsRelations,
  machinesRelations, machineComponentsRelations,
  componentCategoriesRelations, componentsRelations,
  assemblyOrdersRelations, assemblyItemsRelations,
  finishedPcsRelations, finishedPcComponentsRelations,
  salesOrdersRelations, salesItemsRelations,
  stockTransactionsRelations,
  warrantyCasesRelations, warrantyItemsRelations,
};
