// Mirror of Prisma enums. Frontend imports from here so it does not depend on
// @prisma/client (which is server-only). Keep in sync with apps/api/prisma/schema.prisma.

export enum MachineStatus {
  NEW = "NEW",
  CHECKED = "CHECKED",
  DISASSEMBLED = "DISASSEMBLED",
  READY_FOR_SALE = "READY_FOR_SALE",
  SOLD = "SOLD",
  SCRAP = "SCRAP",
}

export enum ComponentStatus {
  IN_STOCK = "IN_STOCK",
  RESERVED = "RESERVED",
  ASSEMBLED = "ASSEMBLED",
  SOLD = "SOLD",
  DEFECTIVE = "DEFECTIVE",
  WARRANTY = "WARRANTY",
  RETURNED = "RETURNED",
  SCRAPPED = "SCRAPPED",
  LOST = "LOST",
}

export enum FinishedPcStatus {
  DRAFT = "DRAFT",
  ASSEMBLING = "ASSEMBLING",
  TESTING = "TESTING",
  READY_FOR_SALE = "READY_FOR_SALE",
  SOLD = "SOLD",
  WARRANTY = "WARRANTY",
  RETURNED = "RETURNED",
  DEFECTIVE = "DEFECTIVE",
  SCRAPPED = "SCRAPPED",
}

export enum StockTxnType {
  IN = "IN",
  OUT = "OUT",
  TRANSFER = "TRANSFER",
  ADJUSTMENT = "ADJUSTMENT",
  RETURN = "RETURN",
  SCRAP = "SCRAP",
}

export enum WarrantyStatus {
  RECEIVED = "RECEIVED",
  INSPECTING = "INSPECTING",
  REPAIRING = "REPAIRING",
  REPLACED = "REPLACED",
  COMPLETED = "COMPLETED",
  REJECTED = "REJECTED",
}

export enum PurchaseOrderStatus {
  DRAFT = "DRAFT",
  CONFIRMED = "CONFIRMED",
  CANCELLED = "CANCELLED",
}

export enum AssemblyStatus {
  DRAFT = "DRAFT",
  IN_PROGRESS = "IN_PROGRESS",
  TESTING = "TESTING",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}

export enum SalesOrderStatus {
  DRAFT = "DRAFT",
  CONFIRMED = "CONFIRMED",
  CANCELLED = "CANCELLED",
  REFUNDED = "REFUNDED",
}

export enum SalesItemType {
  FINISHED_PC = "FINISHED_PC",
  COMPONENT = "COMPONENT",
}

export enum PurchaseItemType {
  MACHINE = "MACHINE",
  COMPONENT = "COMPONENT",
}

export enum ComponentCondition {
  GOOD = "GOOD",
  NEEDS_REPAIR = "NEEDS_REPAIR",
  DEFECTIVE = "DEFECTIVE",
  LIQUIDATION = "LIQUIDATION",
}

export enum SupplierCategory {
  WHOLESALE = "WHOLESALE",
  RETAIL = "RETAIL",
}

export enum MasterOptionType {
  SELLER = "SELLER",
  SALES_PLATFORM = "SALES_PLATFORM",
}

export enum BackupKind {
  DAILY = "DAILY",
  WEEKLY = "WEEKLY",
  MONTHLY = "MONTHLY",
}

export enum ComponentCategoryCode {
  CPU = "CPU",
  MB = "MB",
  RAM = "RAM",
  SSD = "SSD",
  HDD = "HDD",
  GPU = "GPU",
  PSU = "PSU",
  CASE = "CASE",
  FAN = "FAN",
  WIFI = "WIFI",
  BT = "BT",
  OTHER = "OTHER",
}
