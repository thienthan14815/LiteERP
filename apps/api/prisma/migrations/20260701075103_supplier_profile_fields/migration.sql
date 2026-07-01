-- CreateEnum
CREATE TYPE "SupplierCategory" AS ENUM ('WHOLESALE', 'RETAIL');

-- AlterTable
ALTER TABLE "suppliers" ADD COLUMN     "category" "SupplierCategory",
ADD COLUMN     "fb_url" TEXT,
ADD COLUMN     "marketplace_url" TEXT;

-- CreateIndex
CREATE INDEX "suppliers_category_idx" ON "suppliers"("category");
