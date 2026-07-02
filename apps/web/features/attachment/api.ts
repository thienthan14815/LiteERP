import { apiClient } from "@/lib/api-client";

export interface Attachment {
  id: string;
  fileName: string;
  fileUrl: string;         // legacy S3 (rỗng cho Drive) — giữ compat
  fileType: string;
  mimeType: string;
  size: number;
  relatedType: string;
  relatedId: string;
  createdAt: string;
  // Drive-specific (null nếu là legacy S3 record)
  thumbnailUrl?: string | null;
  previewUrl?: string | null;
}

function unwrap<T>(p: any): T {
  return (p?.data ?? p) as T;
}

// Response từ endpoint /attachments/upload-drive — không có driveFileId (rule 3).
interface DriveAttachmentResponse {
  id: string;
  entityType: string;
  entityId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  thumbnailUrl: string | null;
  previewUrl: string | null;
  createdAt: string;
}

// Map relatedType (VN: Machine / Component / ...) sang DriveFolder enum backend.
function pickDriveFolder(relatedType: string): string {
  const t = relatedType.toUpperCase();
  if (t.includes("MACHINE") || t.includes("COMPONENT") || t.includes("FINISHED_PC")) return "PRODUCTS";
  if (t.includes("PURCHASE")) return "ORDERS";
  if (t.includes("SALES") || t === "SALE") return "ORDERS";
  if (t.includes("CUSTOMER")) return "CUSTOMERS";
  if (t.includes("SUPPLIER")) return "SUPPLIERS";
  if (t.includes("INVOICE")) return "INVOICES";
  return "RECEIPTS";
}

function toLegacyShape(r: DriveAttachmentResponse): Attachment {
  return {
    id: r.id,
    fileName: r.filename,
    fileUrl: "",                          // Drive không dùng cột này
    fileType: r.mimeType.split("/")[0] || "file",
    mimeType: r.mimeType,
    size: r.sizeBytes,
    relatedType: r.entityType,
    relatedId: r.entityId,
    createdAt: r.createdAt,
    thumbnailUrl: r.thumbnailUrl,
    previewUrl: r.previewUrl,
  };
}

export async function uploadToDrive(payload: {
  file: File;
  relatedType: string;
  relatedId: string;
}): Promise<Attachment> {
  const form = new FormData();
  form.append("entityType", payload.relatedType);
  form.append("entityId", payload.relatedId);
  form.append("folder", pickDriveFolder(payload.relatedType));
  form.append("file", payload.file);
  const { data } = await apiClient.post("/attachments/upload-drive", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return toLegacyShape(unwrap<DriveAttachmentResponse>(data));
}

export async function listAttachments(relatedType: string, relatedId: string): Promise<Attachment[]> {
  const { data } = await apiClient.get("/attachments", { params: { relatedType, relatedId } });
  const payload = unwrap<DriveAttachmentResponse[] | Attachment[]>(data);
  // Backend giờ trả shape { filename, sizeBytes, entityType, entityId, thumbnailUrl, previewUrl }.
  // Cần adapter về `Attachment` legacy để UI (fileName/size/relatedType) work.
  return (payload as any[]).map((row) => {
    // Nếu row đã có sẵn `fileName` (bản ghi cũ hoặc backend chưa update) → giữ nguyên
    if (row.fileName) return row as Attachment;
    return toLegacyShape(row as DriveAttachmentResponse);
  });
}

export async function downloadUrl(id: string): Promise<{ url: string; fileName: string; mimeType: string }> {
  const { data } = await apiClient.get(`/attachments/${id}/download-url`);
  return unwrap<{ url: string; fileName: string; mimeType: string }>(data);
}

export async function deleteAttachment(id: string): Promise<void> {
  await apiClient.delete(`/attachments/${id}`);
}
