-- CreateEnum
CREATE TYPE "MachineStatus" AS ENUM ('NEW', 'CHECKED', 'DISASSEMBLED', 'READY_FOR_SALE', 'SOLD', 'SCRAP');

-- CreateEnum
CREATE TYPE "ComponentStatus" AS ENUM ('IN_STOCK', 'RESERVED', 'ASSEMBLED', 'SOLD', 'DEFECTIVE', 'WARRANTY', 'RETURNED', 'SCRAPPED', 'LOST');

-- CreateEnum
CREATE TYPE "FinishedPcStatus" AS ENUM ('DRAFT', 'ASSEMBLING', 'TESTING', 'READY_FOR_SALE', 'SOLD', 'WARRANTY', 'RETURNED', 'DEFECTIVE', 'SCRAPPED');

-- CreateEnum
CREATE TYPE "StockTxnType" AS ENUM ('IN', 'OUT', 'TRANSFER', 'ADJUSTMENT', 'RETURN', 'SCRAP');

-- CreateEnum
CREATE TYPE "WarrantyStatus" AS ENUM ('RECEIVED', 'INSPECTING', 'REPAIRING', 'REPLACED', 'COMPLETED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AssemblyStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'TESTING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SalesOrderStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "SalesItemType" AS ENUM ('FINISHED_PC', 'COMPONENT');

-- CreateEnum
CREATE TYPE "PurchaseItemType" AS ENUM ('MACHINE', 'COMPONENT');

-- CreateEnum
CREATE TYPE "ComponentCondition" AS ENUM ('GOOD', 'NEEDS_REPAIR', 'DEFECTIVE', 'LIQUIDATION');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "phone" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "tax_code" TEXT,
    "notes" TEXT,
    "tenant_id" TEXT,
    "branch_id" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "tax_code" TEXT,
    "notes" TEXT,
    "tenant_id" TEXT,
    "branch_id" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "supplier_id" TEXT,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "total_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "other_cost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "confirmed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "tenant_id" TEXT,
    "branch_id" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_items" (
    "id" TEXT NOT NULL,
    "purchase_order_id" TEXT NOT NULL,
    "item_type" "PurchaseItemType" NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(18,2) NOT NULL,
    "total_price" DECIMAL(18,2) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "machines" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "serial" TEXT,
    "status" "MachineStatus" NOT NULL DEFAULT 'NEW',
    "purchase_item_id" TEXT,
    "cost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "repair_cost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "cleaning_cost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "inspected_at" TIMESTAMP(3),
    "disassembled_at" TIMESTAMP(3),
    "sold_at" TIMESTAMP(3),
    "tenant_id" TEXT,
    "branch_id" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "machines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "machine_components" (
    "id" TEXT NOT NULL,
    "machine_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "model" TEXT,
    "serial" TEXT,
    "condition" "ComponentCondition" NOT NULL DEFAULT 'GOOD',
    "allocated_cost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "component_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "machine_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "component_categories" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "component_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "components" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "serial_number" TEXT,
    "category_id" TEXT NOT NULL,
    "model" TEXT,
    "status" "ComponentStatus" NOT NULL DEFAULT 'IN_STOCK',
    "condition" "ComponentCondition" NOT NULL DEFAULT 'GOOD',
    "cost_price" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "location" TEXT,
    "notes" TEXT,
    "source_machine_id" TEXT,
    "current_finished_pc_id" TEXT,
    "tenant_id" TEXT,
    "branch_id" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assembly_orders" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "AssemblyStatus" NOT NULL DEFAULT 'DRAFT',
    "repair_cost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "cleaning_cost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "assembly_cost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "tenant_id" TEXT,
    "branch_id" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assembly_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assembly_items" (
    "id" TEXT NOT NULL,
    "assembly_order_id" TEXT NOT NULL,
    "component_id" TEXT NOT NULL,
    "unit_cost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assembly_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finished_pcs" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "assembly_order_id" TEXT,
    "status" "FinishedPcStatus" NOT NULL DEFAULT 'DRAFT',
    "cost_price" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "suggested_price" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "sold_price" DECIMAL(18,2),
    "notes" TEXT,
    "ready_at" TIMESTAMP(3),
    "sold_at" TIMESTAMP(3),
    "tenant_id" TEXT,
    "branch_id" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finished_pcs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finished_pc_components" (
    "id" TEXT NOT NULL,
    "finished_pc_id" TEXT NOT NULL,
    "component_id" TEXT NOT NULL,
    "installed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removed_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finished_pc_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_orders" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "customer_id" TEXT,
    "status" "SalesOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "total_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "confirmed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "refunded_at" TIMESTAMP(3),
    "tenant_id" TEXT,
    "branch_id" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_items" (
    "id" TEXT NOT NULL,
    "sales_order_id" TEXT NOT NULL,
    "item_type" "SalesItemType" NOT NULL,
    "finished_pc_id" TEXT,
    "component_id" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(18,2) NOT NULL,
    "unit_cost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total_price" DECIMAL(18,2) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_transactions" (
    "id" TEXT NOT NULL,
    "type" "StockTxnType" NOT NULL,
    "component_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "reason" TEXT NOT NULL,
    "ref_type" TEXT,
    "ref_id" TEXT,
    "notes" TEXT,
    "tenant_id" TEXT,
    "branch_id" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warranty_cases" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "customer_id" TEXT,
    "finished_pc_id" TEXT,
    "status" "WarrantyStatus" NOT NULL DEFAULT 'RECEIVED',
    "description" TEXT NOT NULL,
    "resolution" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "tenant_id" TEXT,
    "branch_id" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warranty_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warranty_items" (
    "id" TEXT NOT NULL,
    "warranty_case_id" TEXT NOT NULL,
    "removed_component_id" TEXT,
    "replacement_component_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warranty_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "description" TEXT NOT NULL,
    "ref_type" TEXT,
    "ref_id" TEXT,
    "incurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenant_id" TEXT,
    "branch_id" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_type" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "related_type" TEXT NOT NULL,
    "related_id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "branch_id" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "code_counters" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "last" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "code_counters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "before_json" JSONB,
    "after_json" JSONB,
    "ip" TEXT,
    "user_agent" TEXT,
    "tenant_id" TEXT,
    "branch_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_code_key" ON "suppliers"("code");

-- CreateIndex
CREATE INDEX "suppliers_name_idx" ON "suppliers"("name");

-- CreateIndex
CREATE INDEX "suppliers_tenant_id_idx" ON "suppliers"("tenant_id");

-- CreateIndex
CREATE INDEX "suppliers_branch_id_idx" ON "suppliers"("branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "customers_code_key" ON "customers"("code");

-- CreateIndex
CREATE INDEX "customers_name_idx" ON "customers"("name");

-- CreateIndex
CREATE INDEX "customers_phone_idx" ON "customers"("phone");

-- CreateIndex
CREATE INDEX "customers_tenant_id_idx" ON "customers"("tenant_id");

-- CreateIndex
CREATE INDEX "customers_branch_id_idx" ON "customers"("branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_code_key" ON "purchase_orders"("code");

-- CreateIndex
CREATE INDEX "purchase_orders_status_idx" ON "purchase_orders"("status");

-- CreateIndex
CREATE INDEX "purchase_orders_created_at_idx" ON "purchase_orders"("created_at");

-- CreateIndex
CREATE INDEX "purchase_orders_supplier_id_idx" ON "purchase_orders"("supplier_id");

-- CreateIndex
CREATE INDEX "purchase_orders_tenant_id_idx" ON "purchase_orders"("tenant_id");

-- CreateIndex
CREATE INDEX "purchase_orders_branch_id_idx" ON "purchase_orders"("branch_id");

-- CreateIndex
CREATE INDEX "purchase_items_purchase_order_id_idx" ON "purchase_items"("purchase_order_id");

-- CreateIndex
CREATE INDEX "purchase_items_item_type_idx" ON "purchase_items"("item_type");

-- CreateIndex
CREATE UNIQUE INDEX "machines_code_key" ON "machines"("code");

-- CreateIndex
CREATE INDEX "machines_status_idx" ON "machines"("status");

-- CreateIndex
CREATE INDEX "machines_serial_idx" ON "machines"("serial");

-- CreateIndex
CREATE INDEX "machines_created_at_idx" ON "machines"("created_at");

-- CreateIndex
CREATE INDEX "machines_tenant_id_idx" ON "machines"("tenant_id");

-- CreateIndex
CREATE INDEX "machines_branch_id_idx" ON "machines"("branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "machine_components_component_id_key" ON "machine_components"("component_id");

-- CreateIndex
CREATE INDEX "machine_components_machine_id_idx" ON "machine_components"("machine_id");

-- CreateIndex
CREATE INDEX "machine_components_category_id_idx" ON "machine_components"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "component_categories_code_key" ON "component_categories"("code");

-- CreateIndex
CREATE UNIQUE INDEX "component_categories_prefix_key" ON "component_categories"("prefix");

-- CreateIndex
CREATE UNIQUE INDEX "components_code_key" ON "components"("code");

-- CreateIndex
CREATE INDEX "components_code_idx" ON "components"("code");

-- CreateIndex
CREATE INDEX "components_status_idx" ON "components"("status");

-- CreateIndex
CREATE INDEX "components_category_id_idx" ON "components"("category_id");

-- CreateIndex
CREATE INDEX "components_source_machine_id_idx" ON "components"("source_machine_id");

-- CreateIndex
CREATE INDEX "components_current_finished_pc_id_idx" ON "components"("current_finished_pc_id");

-- CreateIndex
CREATE INDEX "components_tenant_id_idx" ON "components"("tenant_id");

-- CreateIndex
CREATE INDEX "components_branch_id_idx" ON "components"("branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "components_tenant_id_serial_number_key" ON "components"("tenant_id", "serial_number");

-- CreateIndex
CREATE UNIQUE INDEX "assembly_orders_code_key" ON "assembly_orders"("code");

-- CreateIndex
CREATE INDEX "assembly_orders_status_idx" ON "assembly_orders"("status");

-- CreateIndex
CREATE INDEX "assembly_orders_created_at_idx" ON "assembly_orders"("created_at");

-- CreateIndex
CREATE INDEX "assembly_orders_tenant_id_idx" ON "assembly_orders"("tenant_id");

-- CreateIndex
CREATE INDEX "assembly_orders_branch_id_idx" ON "assembly_orders"("branch_id");

-- CreateIndex
CREATE INDEX "assembly_items_component_id_idx" ON "assembly_items"("component_id");

-- CreateIndex
CREATE UNIQUE INDEX "assembly_items_assembly_order_id_component_id_key" ON "assembly_items"("assembly_order_id", "component_id");

-- CreateIndex
CREATE UNIQUE INDEX "finished_pcs_code_key" ON "finished_pcs"("code");

-- CreateIndex
CREATE INDEX "finished_pcs_status_idx" ON "finished_pcs"("status");

-- CreateIndex
CREATE INDEX "finished_pcs_created_at_idx" ON "finished_pcs"("created_at");

-- CreateIndex
CREATE INDEX "finished_pcs_tenant_id_idx" ON "finished_pcs"("tenant_id");

-- CreateIndex
CREATE INDEX "finished_pcs_branch_id_idx" ON "finished_pcs"("branch_id");

-- CreateIndex
CREATE INDEX "finished_pc_components_finished_pc_id_idx" ON "finished_pc_components"("finished_pc_id");

-- CreateIndex
CREATE INDEX "finished_pc_components_component_id_idx" ON "finished_pc_components"("component_id");

-- CreateIndex
CREATE INDEX "finished_pc_components_removed_at_idx" ON "finished_pc_components"("removed_at");

-- CreateIndex
CREATE UNIQUE INDEX "sales_orders_code_key" ON "sales_orders"("code");

-- CreateIndex
CREATE INDEX "sales_orders_status_idx" ON "sales_orders"("status");

-- CreateIndex
CREATE INDEX "sales_orders_created_at_idx" ON "sales_orders"("created_at");

-- CreateIndex
CREATE INDEX "sales_orders_customer_id_idx" ON "sales_orders"("customer_id");

-- CreateIndex
CREATE INDEX "sales_orders_tenant_id_idx" ON "sales_orders"("tenant_id");

-- CreateIndex
CREATE INDEX "sales_orders_branch_id_idx" ON "sales_orders"("branch_id");

-- CreateIndex
CREATE INDEX "sales_items_sales_order_id_idx" ON "sales_items"("sales_order_id");

-- CreateIndex
CREATE INDEX "sales_items_item_type_idx" ON "sales_items"("item_type");

-- CreateIndex
CREATE INDEX "sales_items_finished_pc_id_idx" ON "sales_items"("finished_pc_id");

-- CreateIndex
CREATE INDEX "sales_items_component_id_idx" ON "sales_items"("component_id");

-- CreateIndex
CREATE INDEX "stock_transactions_component_id_idx" ON "stock_transactions"("component_id");

-- CreateIndex
CREATE INDEX "stock_transactions_created_at_idx" ON "stock_transactions"("created_at");

-- CreateIndex
CREATE INDEX "stock_transactions_type_idx" ON "stock_transactions"("type");

-- CreateIndex
CREATE INDEX "stock_transactions_ref_type_ref_id_idx" ON "stock_transactions"("ref_type", "ref_id");

-- CreateIndex
CREATE INDEX "stock_transactions_tenant_id_idx" ON "stock_transactions"("tenant_id");

-- CreateIndex
CREATE INDEX "stock_transactions_branch_id_idx" ON "stock_transactions"("branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "warranty_cases_code_key" ON "warranty_cases"("code");

-- CreateIndex
CREATE INDEX "warranty_cases_status_idx" ON "warranty_cases"("status");

-- CreateIndex
CREATE INDEX "warranty_cases_created_at_idx" ON "warranty_cases"("created_at");

-- CreateIndex
CREATE INDEX "warranty_cases_customer_id_idx" ON "warranty_cases"("customer_id");

-- CreateIndex
CREATE INDEX "warranty_cases_finished_pc_id_idx" ON "warranty_cases"("finished_pc_id");

-- CreateIndex
CREATE INDEX "warranty_cases_tenant_id_idx" ON "warranty_cases"("tenant_id");

-- CreateIndex
CREATE INDEX "warranty_cases_branch_id_idx" ON "warranty_cases"("branch_id");

-- CreateIndex
CREATE INDEX "warranty_items_warranty_case_id_idx" ON "warranty_items"("warranty_case_id");

-- CreateIndex
CREATE INDEX "expenses_category_idx" ON "expenses"("category");

-- CreateIndex
CREATE INDEX "expenses_incurred_at_idx" ON "expenses"("incurred_at");

-- CreateIndex
CREATE INDEX "expenses_ref_type_ref_id_idx" ON "expenses"("ref_type", "ref_id");

-- CreateIndex
CREATE INDEX "expenses_tenant_id_idx" ON "expenses"("tenant_id");

-- CreateIndex
CREATE INDEX "expenses_branch_id_idx" ON "expenses"("branch_id");

-- CreateIndex
CREATE INDEX "attachments_related_type_related_id_idx" ON "attachments"("related_type", "related_id");

-- CreateIndex
CREATE INDEX "attachments_file_type_idx" ON "attachments"("file_type");

-- CreateIndex
CREATE INDEX "attachments_tenant_id_idx" ON "attachments"("tenant_id");

-- CreateIndex
CREATE INDEX "attachments_branch_id_idx" ON "attachments"("branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "code_counters_key_key" ON "code_counters"("key");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_user_id_idx" ON "audit_logs"("actor_user_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_idx" ON "audit_logs"("tenant_id");

-- CreateIndex
CREATE INDEX "audit_logs_branch_id_idx" ON "audit_logs"("branch_id");

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machines" ADD CONSTRAINT "machines_purchase_item_id_fkey" FOREIGN KEY ("purchase_item_id") REFERENCES "purchase_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machines" ADD CONSTRAINT "machines_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machine_components" ADD CONSTRAINT "machine_components_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "machines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machine_components" ADD CONSTRAINT "machine_components_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "component_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machine_components" ADD CONSTRAINT "machine_components_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "components"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "components" ADD CONSTRAINT "components_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "component_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "components" ADD CONSTRAINT "components_source_machine_id_fkey" FOREIGN KEY ("source_machine_id") REFERENCES "machines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "components" ADD CONSTRAINT "components_current_finished_pc_id_fkey" FOREIGN KEY ("current_finished_pc_id") REFERENCES "finished_pcs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "components" ADD CONSTRAINT "components_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assembly_orders" ADD CONSTRAINT "assembly_orders_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assembly_items" ADD CONSTRAINT "assembly_items_assembly_order_id_fkey" FOREIGN KEY ("assembly_order_id") REFERENCES "assembly_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assembly_items" ADD CONSTRAINT "assembly_items_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "components"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finished_pcs" ADD CONSTRAINT "finished_pcs_assembly_order_id_fkey" FOREIGN KEY ("assembly_order_id") REFERENCES "assembly_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finished_pcs" ADD CONSTRAINT "finished_pcs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finished_pc_components" ADD CONSTRAINT "finished_pc_components_finished_pc_id_fkey" FOREIGN KEY ("finished_pc_id") REFERENCES "finished_pcs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finished_pc_components" ADD CONSTRAINT "finished_pc_components_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "components"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_items" ADD CONSTRAINT "sales_items_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_items" ADD CONSTRAINT "sales_items_finished_pc_id_fkey" FOREIGN KEY ("finished_pc_id") REFERENCES "finished_pcs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_items" ADD CONSTRAINT "sales_items_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "components"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "components"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranty_cases" ADD CONSTRAINT "warranty_cases_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranty_cases" ADD CONSTRAINT "warranty_cases_finished_pc_id_fkey" FOREIGN KEY ("finished_pc_id") REFERENCES "finished_pcs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranty_cases" ADD CONSTRAINT "warranty_cases_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranty_items" ADD CONSTRAINT "warranty_items_warranty_case_id_fkey" FOREIGN KEY ("warranty_case_id") REFERENCES "warranty_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranty_items" ADD CONSTRAINT "warranty_items_removed_component_id_fkey" FOREIGN KEY ("removed_component_id") REFERENCES "components"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranty_items" ADD CONSTRAINT "warranty_items_replacement_component_id_fkey" FOREIGN KEY ("replacement_component_id") REFERENCES "components"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
