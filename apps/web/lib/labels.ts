import {
  MachineStatus,
  ComponentStatus,
  FinishedPcStatus,
  StockTxnType,
  WarrantyStatus,
  PurchaseOrderStatus,
  AssemblyStatus,
  SalesOrderStatus,
  SalesItemType,
  PurchaseItemType,
  ComponentCondition,
  ComponentCategoryCode,
} from "@app/shared";

export const MACHINE_STATUS_LABEL: Record<MachineStatus, string> = {
  [MachineStatus.NEW]: "Mới",
  [MachineStatus.CHECKED]: "Đã kiểm tra",
  [MachineStatus.DISASSEMBLED]: "Đã tháo",
  [MachineStatus.READY_FOR_SALE]: "Sẵn sàng bán",
  [MachineStatus.SOLD]: "Đã bán",
  [MachineStatus.SCRAP]: "Thanh lý",
};

export const COMPONENT_STATUS_LABEL: Record<ComponentStatus, string> = {
  [ComponentStatus.IN_STOCK]: "Trong kho",
  [ComponentStatus.RESERVED]: "Đã giữ",
  [ComponentStatus.ASSEMBLED]: "Đã lắp",
  [ComponentStatus.SOLD]: "Đã bán",
  [ComponentStatus.DEFECTIVE]: "Lỗi",
  [ComponentStatus.WARRANTY]: "Bảo hành",
  [ComponentStatus.RETURNED]: "Trả lại",
  [ComponentStatus.SCRAPPED]: "Thanh lý",
  [ComponentStatus.LOST]: "Mất",
};

export const FINISHED_PC_STATUS_LABEL: Record<FinishedPcStatus, string> = {
  [FinishedPcStatus.DRAFT]: "Nháp",
  [FinishedPcStatus.ASSEMBLING]: "Đang lắp",
  [FinishedPcStatus.TESTING]: "Đang test",
  [FinishedPcStatus.READY_FOR_SALE]: "Sẵn sàng bán",
  [FinishedPcStatus.SOLD]: "Đã bán",
  [FinishedPcStatus.WARRANTY]: "Bảo hành",
  [FinishedPcStatus.RETURNED]: "Trả lại",
  [FinishedPcStatus.DEFECTIVE]: "Lỗi",
  [FinishedPcStatus.SCRAPPED]: "Thanh lý",
};

export const STOCK_TXN_TYPE_LABEL: Record<StockTxnType, string> = {
  [StockTxnType.IN]: "Nhập",
  [StockTxnType.OUT]: "Xuất",
  [StockTxnType.TRANSFER]: "Chuyển",
  [StockTxnType.ADJUSTMENT]: "Điều chỉnh",
  [StockTxnType.RETURN]: "Trả lại",
  [StockTxnType.SCRAP]: "Thanh lý",
};

export const WARRANTY_STATUS_LABEL: Record<WarrantyStatus, string> = {
  [WarrantyStatus.RECEIVED]: "Đã nhận",
  [WarrantyStatus.INSPECTING]: "Đang kiểm tra",
  [WarrantyStatus.REPAIRING]: "Đang sửa",
  [WarrantyStatus.REPLACED]: "Đã thay",
  [WarrantyStatus.COMPLETED]: "Hoàn thành",
  [WarrantyStatus.REJECTED]: "Từ chối",
};

export const PURCHASE_ORDER_STATUS_LABEL: Record<PurchaseOrderStatus, string> = {
  [PurchaseOrderStatus.DRAFT]: "Nháp",
  [PurchaseOrderStatus.CONFIRMED]: "Đã xác nhận",
  [PurchaseOrderStatus.CANCELLED]: "Đã hủy",
};

export const ASSEMBLY_STATUS_LABEL: Record<AssemblyStatus, string> = {
  [AssemblyStatus.DRAFT]: "Nháp",
  [AssemblyStatus.IN_PROGRESS]: "Đang lắp",
  [AssemblyStatus.TESTING]: "Đang test",
  [AssemblyStatus.COMPLETED]: "Hoàn thành",
  [AssemblyStatus.CANCELLED]: "Đã hủy",
};

export const SALES_ORDER_STATUS_LABEL: Record<SalesOrderStatus, string> = {
  [SalesOrderStatus.DRAFT]: "Nháp",
  [SalesOrderStatus.CONFIRMED]: "Đã xác nhận",
  [SalesOrderStatus.CANCELLED]: "Đã hủy",
  [SalesOrderStatus.REFUNDED]: "Hoàn tiền",
};

export const SALES_ITEM_TYPE_LABEL: Record<SalesItemType, string> = {
  [SalesItemType.FINISHED_PC]: "Máy tính",
  [SalesItemType.COMPONENT]: "Linh kiện",
};

export const PURCHASE_ITEM_TYPE_LABEL: Record<PurchaseItemType, string> = {
  [PurchaseItemType.MACHINE]: "Máy",
  [PurchaseItemType.COMPONENT]: "Linh kiện",
};

export const COMPONENT_CONDITION_LABEL: Record<ComponentCondition, string> = {
  [ComponentCondition.GOOD]: "Tốt",
  [ComponentCondition.NEEDS_REPAIR]: "Cần sửa",
  [ComponentCondition.DEFECTIVE]: "Lỗi",
  [ComponentCondition.LIQUIDATION]: "Thanh lý",
};

export const ATTACHMENT_LABEL = {
  uploadBtn: "Tải lên",
  dropHint: "Kéo thả tệp vào đây hoặc bấm để chọn",
  uploading: "Đang tải lên...",
  uploadFailed: "Tải lên thất bại",
  deleteConfirm: "Xóa tệp đính kèm này?",
  noFiles: "Chưa có tệp đính kèm",
} as const;

export const COMPONENT_CATEGORY_LABEL: Record<ComponentCategoryCode, string> = {
  [ComponentCategoryCode.CPU]: "CPU",
  [ComponentCategoryCode.MB]: "Mainboard",
  [ComponentCategoryCode.RAM]: "RAM",
  [ComponentCategoryCode.SSD]: "SSD",
  [ComponentCategoryCode.HDD]: "HDD",
  [ComponentCategoryCode.GPU]: "VGA",
  [ComponentCategoryCode.PSU]: "Nguồn",
  [ComponentCategoryCode.CASE]: "Case",
  [ComponentCategoryCode.FAN]: "Fan",
  [ComponentCategoryCode.WIFI]: "WiFi",
  [ComponentCategoryCode.BT]: "Bluetooth",
  [ComponentCategoryCode.OTHER]: "Khác",
};

export function statusBadgeVariant(
  status: string,
):
  | "default"
  | "secondary"
  | "success"
  | "warning"
  | "destructive"
  | "outline" {
  switch (status) {
    case "CONFIRMED":
    case "COMPLETED":
    case "READY":
    case "READY_FOR_SALE":
    case "IN_STOCK":
      return "success";
    case "DRAFT":
    case "NEW":
    case "RECEIVED":
      return "secondary";
    case "INSPECTING":
    case "ASSEMBLING":
    case "IN_PROGRESS":
    case "TESTING":
    case "RESERVED":
      return "warning";
    case "CANCELLED":
    case "DEFECTIVE":
    case "SCRAP":
    case "SCRAPPED":
    case "REJECTED":
    case "LOST":
      return "destructive";
    case "SOLD":
      return "default";
    default:
      return "outline";
  }
}
