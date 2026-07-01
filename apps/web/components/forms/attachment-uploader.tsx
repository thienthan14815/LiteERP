"use client";

import * as React from "react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Paperclip, Trash2 } from "lucide-react";
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

export function AttachmentUploader({ relatedType, relatedId, onUploaded, readonly }: Props) {
  const qc = useQueryClient();
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);
  const [pendingDelete, setPendingDelete] = React.useState<string | null>(null);

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
      // Dùng flow Drive 1-bước (multipart) — thay S3 3-bước cũ.
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

  const open = async (a: Attachment) => {
    // File Drive: dùng thẳng previewUrl (backend không cần sinh signed URL nữa).
    if (a.previewUrl) {
      window.open(a.previewUrl, "_blank", "noopener,noreferrer");
      return;
    }
    // File legacy S3: fallback endpoint cũ.
    try {
      const r = await downloadUrl(a.id);
      window.open(r.url, "_blank", "noopener,noreferrer");
    } catch (err: any) {
      toast.error("Không tải được liên kết");
    }
  };

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
        <ul className="divide-y rounded-md border">
          {data.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2 p-2 text-sm">
              <button onClick={() => open(a)} className="flex items-center gap-2 hover:underline">
                <Paperclip className="h-4 w-4" />
                <span>{a.fileName}</span>
                <span className="text-xs text-muted-foreground">({a.fileType})</span>
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
