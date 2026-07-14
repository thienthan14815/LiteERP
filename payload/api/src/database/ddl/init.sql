-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "phone" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("user_id", "role_id"),
    CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("role_id", "permission_id"),
    CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "tax_code" TEXT,
    "notes" TEXT,
    "fb_url" TEXT,
    "marketplace_url" TEXT,
    "category" TEXT,
    "tenant_id" TEXT,
    "branch_id" TEXT,
    "created_by_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "suppliers_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "customers_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "supplier_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "total_amount" DECIMAL NOT NULL DEFAULT 0,
    "other_cost" DECIMAL NOT NULL DEFAULT 0,
    "notes" TEXT,
    "confirmed_at" DATETIME,
    "cancelled_at" DATETIME,
    "tenant_id" TEXT,
    "branch_id" TEXT,
    "created_by_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "purchase_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "purchase_orders_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "purchase_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "purchase_order_id" TEXT NOT NULL,
    "item_type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "model" TEXT,
    "serial" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DECIMAL NOT NULL,
    "total_price" DECIMAL NOT NULL,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "purchase_items_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "machines" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "serial" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "purchase_item_id" TEXT,
    "cost" DECIMAL NOT NULL DEFAULT 0,
    "repair_cost" DECIMAL NOT NULL DEFAULT 0,
    "cleaning_cost" DECIMAL NOT NULL DEFAULT 0,
    "notes" TEXT,
    "inspected_at" DATETIME,
    "disassembled_at" DATETIME,
    "sold_at" DATETIME,
    "tenant_id" TEXT,
    "branch_id" TEXT,
    "created_by_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "machines_purchase_item_id_fkey" FOREIGN KEY ("purchase_item_id") REFERENCES "purchase_items" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "machines_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "machine_components" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "machine_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "model" TEXT,
    "serial" TEXT,
    "condition" TEXT NOT NULL DEFAULT 'GOOD',
    "allocated_cost" DECIMAL NOT NULL DEFAULT 0,
    "notes" TEXT,
    "component_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "machine_components_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "machines" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "machine_components_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "component_categories" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "machine_components_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "components" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "component_categories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "components" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "serial_number" TEXT,
    "category_id" TEXT NOT NULL,
    "model" TEXT,
    "status" TEXT NOT NULL DEFAULT 'IN_STOCK',
    "condition" TEXT NOT NULL DEFAULT 'GOOD',
    "cost_price" DECIMAL NOT NULL DEFAULT 0,
    "location" TEXT,
    "notes" TEXT,
    "source_machine_id" TEXT,
    "current_finished_pc_id" TEXT,
    "tenant_id" TEXT,
    "branch_id" TEXT,
    "created_by_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "components_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "component_categories" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "components_source_machine_id_fkey" FOREIGN KEY ("source_machine_id") REFERENCES "machines" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "components_current_finished_pc_id_fkey" FOREIGN KEY ("current_finished_pc_id") REFERENCES "finished_pcs" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "components_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "assembly_orders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "repair_cost" DECIMAL NOT NULL DEFAULT 0,
    "cleaning_cost" DECIMAL NOT NULL DEFAULT 0,
    "assembly_cost" DECIMAL NOT NULL DEFAULT 0,
    "notes" TEXT,
    "started_at" DATETIME,
    "completed_at" DATETIME,
    "tenant_id" TEXT,
    "branch_id" TEXT,
    "created_by_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "assembly_orders_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "assembly_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assembly_order_id" TEXT NOT NULL,
    "component_id" TEXT NOT NULL,
    "unit_cost" DECIMAL NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "assembly_items_assembly_order_id_fkey" FOREIGN KEY ("assembly_order_id") REFERENCES "assembly_orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "assembly_items_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "components" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "finished_pcs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "assembly_order_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "cost_price" DECIMAL NOT NULL DEFAULT 0,
    "suggested_price" DECIMAL NOT NULL DEFAULT 0,
    "sold_price" DECIMAL,
    "notes" TEXT,
    "ready_at" DATETIME,
    "sold_at" DATETIME,
    "tenant_id" TEXT,
    "branch_id" TEXT,
    "created_by_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "finished_pcs_assembly_order_id_fkey" FOREIGN KEY ("assembly_order_id") REFERENCES "assembly_orders" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "finished_pcs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "finished_pc_components" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "finished_pc_id" TEXT NOT NULL,
    "component_id" TEXT NOT NULL,
    "installed_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removed_at" DATETIME,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "finished_pc_components_finished_pc_id_fkey" FOREIGN KEY ("finished_pc_id") REFERENCES "finished_pcs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "finished_pc_components_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "components" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sales_orders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "order_name" TEXT,
    "seller_name" TEXT,
    "platform" TEXT,
    "sales_url" TEXT,
    "customer_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "total_amount" DECIMAL NOT NULL DEFAULT 0,
    "discount" DECIMAL NOT NULL DEFAULT 0,
    "notes" TEXT,
    "confirmed_at" DATETIME,
    "cancelled_at" DATETIME,
    "refunded_at" DATETIME,
    "tenant_id" TEXT,
    "branch_id" TEXT,
    "created_by_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "sales_orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "sales_orders_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sales_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sales_order_id" TEXT NOT NULL,
    "item_type" TEXT NOT NULL,
    "finished_pc_id" TEXT,
    "component_id" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DECIMAL NOT NULL,
    "unit_cost" DECIMAL NOT NULL DEFAULT 0,
    "total_price" DECIMAL NOT NULL,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "sales_items_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "sales_items_finished_pc_id_fkey" FOREIGN KEY ("finished_pc_id") REFERENCES "finished_pcs" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "sales_items_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "components" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "stock_transactions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "component_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "reason" TEXT NOT NULL,
    "ref_type" TEXT,
    "ref_id" TEXT,
    "notes" TEXT,
    "tenant_id" TEXT,
    "branch_id" TEXT,
    "created_by_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stock_transactions_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "components" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "stock_transactions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "warranty_cases" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "customer_id" TEXT,
    "finished_pc_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "description" TEXT NOT NULL,
    "resolution" TEXT,
    "received_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" DATETIME,
    "tenant_id" TEXT,
    "branch_id" TEXT,
    "created_by_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "warranty_cases_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "warranty_cases_finished_pc_id_fkey" FOREIGN KEY ("finished_pc_id") REFERENCES "finished_pcs" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "warranty_cases_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "warranty_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "warranty_case_id" TEXT NOT NULL,
    "removed_component_id" TEXT,
    "replacement_component_id" TEXT,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "warranty_items_warranty_case_id_fkey" FOREIGN KEY ("warranty_case_id") REFERENCES "warranty_cases" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "warranty_items_removed_component_id_fkey" FOREIGN KEY ("removed_component_id") REFERENCES "components" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "warranty_items_replacement_component_id_fkey" FOREIGN KEY ("replacement_component_id") REFERENCES "components" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "category" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "description" TEXT NOT NULL,
    "ref_type" TEXT,
    "ref_id" TEXT,
    "incurred_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenant_id" TEXT,
    "branch_id" TEXT,
    "created_by_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "expenses_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "master_options" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "tenant_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "file_name" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_type" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "related_type" TEXT NOT NULL,
    "related_id" TEXT NOT NULL,
    "drive_file_id" TEXT,
    "tenant_id" TEXT,
    "branch_id" TEXT,
    "created_by_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "attachments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" DATETIME NOT NULL,
    "revoked_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "code_counters" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "last" INTEGER NOT NULL DEFAULT 0,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "backup_records" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "drive_file_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'DAILY',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actor_user_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "before_json" TEXT,
    "after_json" TEXT,
    "ip" TEXT,
    "user_agent" TEXT,
    "tenant_id" TEXT,
    "branch_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
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
CREATE INDEX "suppliers_category_idx" ON "suppliers"("category");

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
CREATE INDEX "master_options_type_idx" ON "master_options"("type");

-- CreateIndex
CREATE UNIQUE INDEX "master_options_type_tenant_id_name_key" ON "master_options"("type", "tenant_id", "name");

-- CreateIndex
CREATE INDEX "attachments_related_type_related_id_idx" ON "attachments"("related_type", "related_id");

-- CreateIndex
CREATE INDEX "attachments_file_type_idx" ON "attachments"("file_type");

-- CreateIndex
CREATE INDEX "attachments_drive_file_id_idx" ON "attachments"("drive_file_id");

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
CREATE UNIQUE INDEX "backup_records_drive_file_id_key" ON "backup_records"("drive_file_id");

-- CreateIndex
CREATE INDEX "backup_records_created_at_idx" ON "backup_records"("created_at");

-- CreateIndex
CREATE INDEX "backup_records_kind_idx" ON "backup_records"("kind");

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
