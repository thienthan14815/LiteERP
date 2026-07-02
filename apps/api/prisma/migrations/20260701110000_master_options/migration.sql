-- CreateEnum
CREATE TYPE "MasterOptionType" AS ENUM ('SELLER', 'SALES_PLATFORM');

-- CreateTable
CREATE TABLE "master_options" (
    "id" TEXT NOT NULL,
    "type" "MasterOptionType" NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "tenant_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "master_options_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "master_options_type_tenant_id_name_key" ON "master_options"("type", "tenant_id", "name");

-- CreateIndex
CREATE INDEX "master_options_type_idx" ON "master_options"("type");
