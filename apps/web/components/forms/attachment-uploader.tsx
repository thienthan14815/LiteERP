"use client";

import * as React from "react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImageIcon, Loader2, Paperclip, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import {
  deleteAttachment,
  downloadUrl,
  listAttachments,
  uploadToDrive,
  type Attachment,
} from "@/features/attachment/api";
import { ATTACHMENT_LABEL } from "@/lib/labels";

interface Props {
  relatedType: string;
  relatedId: string;
  onUploaded?: (a: Attachment) => void;
  readonly?: boolean;
}

function isImage(a: Attachment): boolean {
  if (a.mimeType?.startsWith("image/")) return true;
  const ext = a.fileName?.toLowerCase().split(".").pop() ?? "";
  return ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "heic"].includes(ext);
}

export function AttachmentUploader({ relatedType, relatedId, onUploaded, readonly }: Props) {
  const qc = useQueryClient();
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);
  const [pendingDelete, setPendingDelete] = React.useState<string | null>(null);
  const [lightbox, setLightbox] = React.useState<Attachment | null>(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ["attachments", relatedType, relatedId],
    queryFn: () => listAttachments(relatedType, relatedId),
    enabled: !!relatedType && !!relatedId,
  });

  const delMut = useMutation({
    mutationFn: (id: string) => deleteAttachment(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["attachments", relatedType, relatedId] }),
  });

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const uploaded = await uploadToDrive({ file, relatedType, relatedId });
      toast.success(`Đã tải lên: ${file.name}`);
      onUploaded?.(uploaded);
      qc.invalidateQueries({ queryKey: ["attachments", relatedType, relatedId] });
    } catch (err: any) {
      const msg =
        err?.response?.data?.error?.message ?? err?.message ?? "lỗi";
      toast.error(`${ATTACHMENT_LABEL.uploadFailed}: ${msg}`);
    } finally {
      setUploading(false);
    }
  };

  const onPick = async (files: FileList | null) => {
    if (!files) return;
    for (const f of Array.from(files)) await upload(f);
  };

  const openExternal = async (a: Attachment) => {
    if (a.previewUrl) {
      window.open(a.previewUrl, "_blank", "noopener,noreferrer");
      return;
    }
    try {
      const r = await downloadUrl(a.id);
      window.open(r.url, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Không tải được liên kết");
    }
  };

  // ESC đóng lightbox.
  React.useEffect(() => {
    if (!lightbox) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && setLightbox(null);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [lightbox]);

  const images = data.filter(isImage);
  const others = data.filter((a) => !isImage(a));

  return (
    <div className="space-y-3">
      {!readonly && (
        <div
          className={`flex flex-col items-center justify-center rounded-md border border-dashed p-6 text-center text-sm ${dragging ? "border-primary bg-accent/40" : "text-muted-foreground"}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            onPick(e.dataTransfer.files);
          }}
        >
          {uploading ? (
            <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> {ATTACHMENT_LABEL.uploading}</span>
          ) : (
            <>
              <p>{ATTACHMENT_LABEL.dropHint}</p>
              <Button size="sm" variant="outline" className="mt-2" onClick={() => inputRef.current?.click()}>
                {ATTACHMENT_LABEL.uploadBtn}
              </Button>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => onPick(e.target.files)}
              />
            </>
          )}
        </div>
      )}

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Đang tải...</p>
      ) : data.length === 0 ? (
        <p className="text-xs text-muted-foreground">{ATTACHMENT_LABEL.noFiles}</p>
      ) : (
        <div className="space-y-4">
          {/* Ảnh: grid thumbnail có hover overlay xem/xoá */}
          {images.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                <ImageIcon className="mr-1 inline h-3.5 w-3.5" />
                Hình ảnh ({images.length})
              </p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                {images.map((a) => (
                  <div
                    key={a.id}
                    className="group relative aspect-square overflow-hidden rounded-md border bg-slate-50"
                  >
                    <button
                      type="button"
                      onClick={() => setLightbox(a)}
                      className="block h-full w-full"
                      title={a.fileName}
                    >
                      {a.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={a.thumbnailUrl}
                          alt={a.fileName}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-slate-400">
                          <ImageIcon className="h-8 w-8" />
                        </div>
                      )}
                    </button>
                    {/* Overlay bấm xoá — không đè full ảnh cho khỏi vướng click preview */}
                    {!readonly && (
                      <button
                        type="button"
                        onClick={() => setPendingDelete(a.id)}
                        className="absolute right-1 top-1 rounded-full bg-white/90 p-1 opacity-0 shadow transition-opacity group-hover:opacity-100"
                        title="Xoá"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Non-image: giữ list cũ */}
          {others.length > 0 && (
            <div>
              {images.length > 0 && (
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  <Paperclip className="mr-1 inline h-3.5 w-3.5" />
                  Tệp khác ({others.length})
                </p>
              )}
              <ul className="divide-y rounded-md border">
                {others.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between gap-2 p-2 text-sm"
                  >
                    <button
                      onClick={() => openExternal(a)}
                      className="flex items-center gap-2 hover:underline"
                    >
                      <Paperclip className="h-4 w-4" />
                      <span>{a.fileName}</span>
                      <span className="text-xs text-muted-foreground">
                        ({a.fileType})
                      </span>
                    </button>
                    {!readonly && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setPendingDelete(a.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Lightbox — click nền để đóng, click nội dung không đóng */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            onClick={() => setLightbox(null)}
            title="Đóng (Esc)"
          >
            <X className="h-5 w-5" />
          </button>
          <div
            className="relative flex max-h-full max-w-4xl flex-col items-center gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            {lightbox.thumbnailUrl ? (
              // Dùng thumbnail cỡ lớn hơn — Drive cho param sz=w1600 để nét
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={lightbox.thumbnailUrl.replace(/sz=w\d+/, "sz=w1600")}
                alt={lightbox.fileName}
                className="max-h-[80vh] max-w-full rounded shadow-2xl"
              />
            ) : (
              <div className="rounded bg-white p-8 text-slate-500">
                Không có preview
              </div>
            )}
            <div className="flex items-center gap-3 text-white">
              <span className="truncate text-sm">{lightbox.fileName}</span>
              <button
                onClick={() => openExternal(lightbox)}
                className="rounded bg-white/10 px-3 py-1 text-xs hover:bg-white/20"
              >
                Mở tab mới ↗
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title={ATTACHMENT_LABEL.deleteConfirm}
        destructive
        loading={delMut.isPending}
        onConfirm={async () => {
          if (!pendingDelete) return;
          await delMut.mutateAsync(pendingDelete);
          setPendingDelete(null);
        }}
      />
    </div>
  );
}
