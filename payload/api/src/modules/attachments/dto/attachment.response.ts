// VN: Response DTO — KHÔNG bao giờ chứa driveFileId, fileUrl (S3 key), OAuth,
// SQL. Theo ARCHITECTURE_forSQL.md section Security. Frontend chỉ thấy
// thumbnailUrl và previewUrl.
export interface AttachmentResponse {
  id: string;
  entityType: string;
  entityId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  thumbnailUrl: string | null;
  previewUrl: string | null;
  createdAt: Date;
}
