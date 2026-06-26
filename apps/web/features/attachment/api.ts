import { apiClient } from "@/lib/api-client";

export interface Attachment {
  id: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  mimeType: string;
  size: number;
  relatedType: string;
  relatedId: string;
  createdAt: string;
}

interface UploadUrlResp {
  attachmentId: string;
  uploadUrl: string;
  key: string;
  expiresIn: number;
}

function unwrap<T>(p: any): T {
  return (p?.data ?? p) as T;
}

export async function createUploadUrl(payload: {
  fileName: string;
  mimeType: string;
  relatedType: string;
  relatedId: string;
}): Promise<UploadUrlResp> {
  const { data } = await apiClient.post("/attachments/upload-url", payload);
  return unwrap<UploadUrlResp>(data);
}

export async function confirmUpload(id: string, size: number): Promise<Attachment> {
  const { data } = await apiClient.post(`/attachments/${id}/confirm`, { size });
  return unwrap<Attachment>(data);
}

export async function listAttachments(relatedType: string, relatedId: string): Promise<Attachment[]> {
  const { data } = await apiClient.get("/attachments", { params: { relatedType, relatedId } });
  return unwrap<Attachment[]>(data);
}

export async function downloadUrl(id: string): Promise<{ url: string; fileName: string; mimeType: string }> {
  const { data } = await apiClient.get(`/attachments/${id}/download-url`);
  return unwrap<{ url: string; fileName: string; mimeType: string }>(data);
}

export async function deleteAttachment(id: string): Promise<void> {
  await apiClient.delete(`/attachments/${id}`);
}
