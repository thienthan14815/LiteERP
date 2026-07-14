"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import {
  Download,
  History,
  Loader2,
  RotateCcw,
  Trash2,
  Upload,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import { useAuth } from "@/features/auth/use-auth";
import { isAdmin } from "@/lib/permissions";
import { usePageMeta } from "@/lib/page-title-context";
import { formatDateTime } from "@/lib/utils";
import {
  useBackups,
  useDeleteBackup,
  useRestoreBackup,
  useRunBackup,
} from "@/features/backup/hooks";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const KIND_LABEL: Record<string, string> = {
  DAILY: "Hàng ngày",
  WEEKLY: "Hàng tuần",
  MONTHLY: "Hàng tháng",
};

export default function SettingsPage() {
  usePageMeta("Cài đặt", "Quản lý hệ thống");
  const { roles, isLoading } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (!isLoading && !isAdmin(roles)) router.replace("/dashboard");
  }, [roles, isLoading, router]);

  if (!isAdmin(roles)) return null;

  return (
    <div className="space-y-4">
      <PageHeader title="Cài đặt" description="Quản lý người dùng và hệ thống" />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Người dùng</CardTitle>
            <CardDescription>Tạo, sửa, vô hiệu hóa người dùng</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/settings/users">Quản lý người dùng</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Vai trò</CardTitle>
            <CardDescription>Quản lý vai trò và quyền</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/settings/roles">Quản lý vai trò</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Danh mục</CardTitle>
            <CardDescription>
              Người bán, nền tảng bán, khách hàng, nhà cung cấp
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/settings/master-data">Quản lý danh mục</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <BackupSection />
    </div>
  );
}

function BackupSection() {
  const { data: backups = [], isLoading: loadingList } = useBackups();
  const runMut = useRunBackup();
  const delMut = useDeleteBackup();
  const restoreMut = useRestoreBackup();

  const [pendingDelete, setPendingDelete] = React.useState<string | null>(null);
  const [pendingRestore, setPendingRestore] = React.useState<File | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const onRun = async () => {
    try {
      const r = await runMut.mutateAsync();
      toast.success("Đã tạo bản backup", {
        description: `${r.filename} · ${formatBytes(r.sizeBytes)} · retention giữ ${r.retention.kept} / xoá ${r.retention.deleted}`,
      });
    } catch (err: any) {
      toast.error(
        err?.response?.data?.error?.message ?? "Không tạo được backup",
      );
    }
  };

  const onDelete = async (id: string) => {
    try {
      await delMut.mutateAsync(id);
      toast.success("Đã xoá bản backup");
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? "Không xoá được");
    }
  };

  const validateAndConfirmRestore = async (file: File) => {
    const lname = file.name.toLowerCase();
    // Đuôi hợp lệ khớp backend: .zip (chứa .sqlite) hoặc .sqlite/.db thuần.
    if (!lname.endsWith(".zip") && !lname.endsWith(".sqlite") && !lname.endsWith(".db")) {
      toast.error("Chỉ nhận file .zip hoặc .sqlite/.db");
      return;
    }
    if (file.size > 200 * 1024 * 1024) {
      toast.error("File quá lớn (tối đa 200 MB)");
      return;
    }
    // Đọc NGAY vào bộ nhớ: trên Android WebView, File chọn qua bộ chọn hệ
    // thống (content://) hay bị Chrome coi là "đã thay đổi" giữa lúc chọn và
    // lúc upload → hủy request với net::ERR_UPLOAD_FILE_CHANGED (bug thật
    // trên Fold5 2026-07-07). File dựng từ bytes trong RAM thì bất biến.
    try {
      const buf = await file.arrayBuffer();
      setPendingRestore(
        new File([buf], file.name, { type: file.type || "application/zip" }),
      );
    } catch {
      toast.error("Không đọc được file — hãy chọn lại");
    }
  };

  const doRestore = async () => {
    if (!pendingRestore) return;
    try {
      const r = await restoreMut.mutateAsync(pendingRestore);
      toast.success("Đã phục hồi dữ liệu", {
        description: `${r.restoredFrom} · ${formatBytes(r.sizeBytes)} · ${(r.durationMs / 1000).toFixed(1)}s`,
        duration: 8000,
      });
      setPendingRestore(null);
      // Hard reload để mọi state stale-cache biến mất — bao gồm token nếu bản
      // backup có user khác.
      setTimeout(() => window.location.reload(), 1500);
    } catch (err: any) {
      toast.error(
        err?.response?.data?.error?.message ?? "Phục hồi thất bại",
      );
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Backup */}
      <Card>
        <CardHeader>
          <CardTitle>Sao lưu dữ liệu</CardTitle>
          <CardDescription>
            Đóng gói toàn bộ database vào 1 file .zip và tải lên Google Drive.
            Tự chạy 03:00 hàng ngày. Giữ TẤT CẢ bản backup (không tự xoá).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={onRun} disabled={runMut.isPending}>
            {runMut.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            {runMut.isPending ? "Đang sao lưu..." : "Sao lưu ngay"}
          </Button>

          <div>
            <p className="mb-2 flex items-center gap-2 text-sm font-medium">
              <History className="h-4 w-4" /> Lịch sử ({backups.length})
            </p>
            {loadingList ? (
              <p className="text-sm text-muted-foreground">Đang tải...</p>
            ) : backups.length === 0 ? (
              <p className="text-sm text-muted-foreground">Chưa có bản backup nào</p>
            ) : (
              <ul className="max-h-72 space-y-1 overflow-y-auto rounded-md border p-2">
                {backups.map((b) => (
                  <li
                    key={b.id}
                    className="flex items-center justify-between gap-2 rounded p-2 text-xs hover:bg-slate-50"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-slate-700">
                        {b.filename}
                      </div>
                      <div className="text-muted-foreground">
                        {formatDateTime(b.createdAt)} · {formatBytes(b.sizeBytes)} ·{" "}
                        <span className="font-medium">
                          {KIND_LABEL[b.kind] ?? b.kind}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPendingDelete(b.id)}
                      className="shrink-0 text-rose-600 hover:text-rose-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Restore */}
      <Card>
        <CardHeader>
          <CardTitle>Phục hồi dữ liệu</CardTitle>
          <CardDescription>
            Kéo thả file .zip hoặc .sqlite vào đây. Toàn bộ dữ liệu hiện tại sẽ
            bị<strong> ghi đè</strong>. Không thể hoàn tác.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className={`flex flex-col items-center justify-center rounded-md border-2 border-dashed p-8 text-center ${
              dragging ? "border-primary bg-accent/40" : "border-muted"
            } ${restoreMut.isPending ? "opacity-50" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              if (restoreMut.isPending) return;
              const f = e.dataTransfer.files?.[0];
              if (f) validateAndConfirmRestore(f);
            }}
          >
            {restoreMut.isPending ? (
              <div className="flex flex-col items-center gap-2 text-sm">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span>Đang phục hồi... không đóng trang.</span>
              </div>
            ) : (
              <>
                <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
                <p className="text-sm">Kéo thả file backup vào đây</p>
                <p className="text-xs text-muted-foreground">
                  .zip hoặc .sqlite — tối đa 200 MB
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Chọn file
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".zip,.sqlite,.db,application/zip"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) validateAndConfirmRestore(f);
                    e.target.value = ""; // cho phép chọn lại cùng file
                  }}
                />
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title="Xoá bản backup này?"
        description="File trên Google Drive và bản ghi trong DB sẽ bị xoá vĩnh viễn."
        destructive
        loading={delMut.isPending}
        onConfirm={async () => {
          if (!pendingDelete) return;
          await onDelete(pendingDelete);
          setPendingDelete(null);
        }}
      />

      <ConfirmDialog
        open={pendingRestore !== null}
        onOpenChange={(o) => !o && !restoreMut.isPending && setPendingRestore(null)}
        title="⚠️ Phục hồi sẽ GHI ĐÈ toàn bộ dữ liệu"
        description={
          pendingRestore
            ? `File: ${pendingRestore.name} (${formatBytes(pendingRestore.size)}). Toàn bộ dữ liệu hiện tại sẽ bị drop và load lại từ file này. Không thể hoàn tác.`
            : ""
        }
        destructive
        loading={restoreMut.isPending}
        confirmText="Phục hồi (ghi đè)"
        onConfirm={doRestore}
      />
    </div>
  );
}
