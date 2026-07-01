// VN: Cấu trúc thư mục Google Drive (app-storage/uploads/... + backup) — theo
// ARCHITECTURE_forSQL.md section "Google Drive Structure". Enum là hợp đồng
// duy nhất giữa Service Layer và DriveService — không dùng string tự do.
export enum DriveFolder {
  ORDERS = "ORDERS",
  PRODUCTS = "PRODUCTS",
  SUPPLIERS = "SUPPLIERS",
  CUSTOMERS = "CUSTOMERS",
  INVOICES = "INVOICES",
  RECEIPTS = "RECEIPTS",
  BACKUP = "BACKUP",
}

// VN: Map DriveFolder -> tên subfolder trên Drive. Backup có nhánh riêng
// (app-storage/backup); các loại còn lại nằm trong app-storage/uploads/<x>.
export const DRIVE_FOLDER_PATH: Record<DriveFolder, string[]> = {
  [DriveFolder.ORDERS]: ["uploads", "orders"],
  [DriveFolder.PRODUCTS]: ["uploads", "products"],
  [DriveFolder.SUPPLIERS]: ["uploads", "suppliers"],
  [DriveFolder.CUSTOMERS]: ["uploads", "customers"],
  [DriveFolder.INVOICES]: ["uploads", "invoices"],
  [DriveFolder.RECEIPTS]: ["uploads", "receipts"],
  [DriveFolder.BACKUP]: ["backup"],
};
