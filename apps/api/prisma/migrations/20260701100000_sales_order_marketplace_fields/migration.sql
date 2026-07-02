-- Add marketplace-style metadata to sales_orders
ALTER TABLE "sales_orders"
  ADD COLUMN "order_name"  TEXT,
  ADD COLUMN "seller_name" TEXT,
  ADD COLUMN "platform"    TEXT,
  ADD COLUMN "sales_url"   TEXT;
