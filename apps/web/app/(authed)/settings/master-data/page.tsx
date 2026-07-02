"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import { EmptyState } from "@/components/tables/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/use-auth";
import { isAdmin } from "@/lib/permissions";
import { usePageMeta } from "@/lib/page-title-context";
import {
  createMasterOption,
  deleteMasterOption,
  listMasterOptions,
  updateMasterOption,
  type MasterOption,
  type MasterOptionType,
} from "@/features/master-option/api";
import {
  createCustomerRow,
  createSupplierRow,
  deleteCustomerRow,
  deleteSupplierRow,
  listAllCustomers,
  listAllSuppliers,
  updateCustomerRow,
  updateSupplierRow,
  type CustomerInput,
  type CustomerRow,
  type SupplierCategory,
  type SupplierInput,
  type SupplierRow,
} from "@/features/master-data/api";

export default function MasterDataSettingsPage() {
  usePageMeta("Danh mục", "Quản lý người bán, nền tảng, khách hàng, nhà cung cấp");
  const { roles, isLoading } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (!isLoading && !isAdmin(roles)) router.replace("/dashboard");
  }, [roles, isLoading, router]);
  if (!isAdmin(roles)) return null;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Danh mục"
        description="Quản lý các mục dùng trong dropdown khi tạo phiếu"
        actions={
          <Button asChild variant="outline">
            <Link href="/settings">Quay lại cài đặt</Link>
          </Button>
        }
      />
      <Tabs defaultValue="seller">
        <TabsList>
          <TabsTrigger value="seller">Người bán</TabsTrigger>
          <TabsTrigger value="platform">Nền tảng bán</TabsTrigger>
          <TabsTrigger value="customer">Khách hàng</TabsTrigger>
          <TabsTrigger value="supplier">Nhà cung cấp</TabsTrigger>
        </TabsList>
        <TabsContent value="seller">
          <MasterOptionTable
            type="SELLER"
            title="Người bán"
            entityLabel="người bán"
          />
        </TabsContent>
        <TabsContent value="platform">
          <MasterOptionTable
            type="SALES_PLATFORM"
            title="Nền tảng bán"
            entityLabel="nền tảng"
          />
        </TabsContent>
        <TabsContent value="customer">
          <CustomerTable />
        </TabsContent>
        <TabsContent value="supplier">
          <SupplierTable />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ============ MasterOption (Seller / Platform) ============ */

function MasterOptionTable({
  type,
  title,
  entityLabel,
}: {
  type: MasterOptionType;
  title: string;
  entityLabel: string;
}) {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ["master-options", type],
    queryFn: () => listMasterOptions(type),
  });
  const [editing, setEditing] = React.useState<MasterOption | null>(null);
  const [openCreate, setOpenCreate] = React.useState(false);
  const [pendingDelete, setPendingDelete] = React.useState<MasterOption | null>(null);

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["master-options", type] });

  const createMut = useMutation({
    mutationFn: (v: { name: string; notes?: string }) =>
      createMasterOption({ type, ...v }),
    onSuccess: () => {
      invalidate();
      setOpenCreate(false);
      toast.success(`Đã thêm ${entityLabel}`);
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.error?.message ?? "Thêm thất bại"),
  });
  const updateMut = useMutation({
    mutationFn: (v: { id: string; name: string; notes?: string }) =>
      updateMasterOption(v.id, { name: v.name, notes: v.notes }),
    onSuccess: () => {
      invalidate();
      setEditing(null);
      toast.success("Đã cập nhật");
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.error?.message ?? "Cập nhật thất bại"),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteMasterOption(id),
    onSuccess: () => {
      invalidate();
      setPendingDelete(null);
      toast.success("Đã xóa");
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.error?.message ?? "Xóa thất bại"),
  });

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <Button size="sm" onClick={() => setOpenCreate(true)}>
            <Plus className="mr-2 h-4 w-4" /> Thêm {entityLabel}
          </Button>
        </div>
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : data.length === 0 ? (
          <EmptyState title={`Chưa có ${entityLabel} nào`} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tên</TableHead>
                <TableHead>Ghi chú</TableHead>
                <TableHead className="w-32 text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">{o.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {o.notes ?? "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditing(o)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPendingDelete(o)}
                    >
                      <Trash2 className="h-4 w-4 text-rose-600" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <MasterOptionDialog
        open={openCreate}
        onOpenChange={setOpenCreate}
        title={`Thêm ${entityLabel}`}
        submitting={createMut.isPending}
        onSubmit={(v) => createMut.mutate(v)}
      />
      <MasterOptionDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        title={`Sửa ${entityLabel}`}
        initial={editing ?? undefined}
        submitting={updateMut.isPending}
        onSubmit={(v) =>
          editing && updateMut.mutate({ id: editing.id, ...v })
        }
      />
      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title={`Xóa "${pendingDelete?.name}"?`}
        description={`${entityLabel} này sẽ không còn xuất hiện trong dropdown.`}
        destructive
        loading={deleteMut.isPending}
        onConfirm={() => {
          if (pendingDelete) deleteMut.mutate(pendingDelete.id);
        }}
      />
    </Card>
  );
}

function MasterOptionDialog({
  open,
  onOpenChange,
  title,
  initial,
  submitting,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  initial?: MasterOption;
  submitting: boolean;
  onSubmit: (v: { name: string; notes?: string }) => void;
}) {
  const [name, setName] = React.useState("");
  const [notes, setNotes] = React.useState("");
  React.useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setNotes(initial?.notes ?? "");
    }
  }, [open, initial]);

  const submit = () => {
    if (!name.trim()) return toast.error("Vui lòng nhập tên");
    onSubmit({ name: name.trim(), notes: notes.trim() || undefined });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Tên</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div>
            <Label>Ghi chú</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Hủy
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "Đang lưu..." : "Lưu"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============ Customer ============ */

function CustomerTable() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ["customers", "all"],
    queryFn: listAllCustomers,
  });
  const [editing, setEditing] = React.useState<CustomerRow | null>(null);
  const [openCreate, setOpenCreate] = React.useState(false);
  const [pendingDelete, setPendingDelete] = React.useState<CustomerRow | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["customers"] });

  const createMut = useMutation({
    mutationFn: (v: CustomerInput) => createCustomerRow(v),
    onSuccess: () => {
      invalidate();
      setOpenCreate(false);
      toast.success("Đã thêm khách hàng");
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.error?.message ?? "Thêm thất bại"),
  });
  const updateMut = useMutation({
    mutationFn: (v: { id: string; payload: CustomerInput }) =>
      updateCustomerRow(v.id, v.payload),
    onSuccess: () => {
      invalidate();
      setEditing(null);
      toast.success("Đã cập nhật");
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.error?.message ?? "Cập nhật thất bại"),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteCustomerRow(id),
    onSuccess: () => {
      invalidate();
      setPendingDelete(null);
      toast.success("Đã xóa");
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.error?.message ?? "Xóa thất bại"),
  });

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Khách hàng</h3>
          <Button size="sm" onClick={() => setOpenCreate(true)}>
            <Plus className="mr-2 h-4 w-4" /> Thêm khách hàng
          </Button>
        </div>
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : data.length === 0 ? (
          <EmptyState title="Chưa có khách hàng nào" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã</TableHead>
                <TableHead>Tên</TableHead>
                <TableHead>SĐT</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="w-32 text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs">{c.code}</TableCell>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.phone ?? "-"}</TableCell>
                  <TableCell>{c.email ?? "-"}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(c)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setPendingDelete(c)}>
                      <Trash2 className="h-4 w-4 text-rose-600" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <CustomerDialog
        open={openCreate}
        onOpenChange={setOpenCreate}
        title="Thêm khách hàng"
        submitting={createMut.isPending}
        onSubmit={(v) => createMut.mutate(v)}
      />
      <CustomerDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        title="Sửa khách hàng"
        initial={editing ?? undefined}
        submitting={updateMut.isPending}
        onSubmit={(v) => editing && updateMut.mutate({ id: editing.id, payload: v })}
      />
      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title={`Xóa "${pendingDelete?.name}"?`}
        description="Chỉ xóa được khách hàng chưa có đơn/warranty liên kết."
        destructive
        loading={deleteMut.isPending}
        onConfirm={() => {
          if (pendingDelete) deleteMut.mutate(pendingDelete.id);
        }}
      />
    </Card>
  );
}

function CustomerDialog({
  open,
  onOpenChange,
  title,
  initial,
  submitting,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  initial?: CustomerRow;
  submitting: boolean;
  onSubmit: (v: CustomerInput) => void;
}) {
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [notes, setNotes] = React.useState("");

  React.useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setPhone(initial?.phone ?? "");
      setEmail(initial?.email ?? "");
      setAddress(initial?.address ?? "");
      setNotes(initial?.notes ?? "");
    }
  }, [open, initial]);

  const submit = () => {
    if (!name.trim()) return toast.error("Vui lòng nhập tên");
    onSubmit({
      name: name.trim(),
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      address: address.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Tên</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div>
            <Label>SĐT</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label>Địa chỉ</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div>
            <Label>Ghi chú</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Hủy
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "Đang lưu..." : "Lưu"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============ Supplier ============ */

const SUPPLIER_CATEGORY_LABEL: Record<SupplierCategory, string> = {
  WHOLESALE: "Sỉ",
  RETAIL: "Lẻ",
};

function SupplierTable() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ["suppliers", "all"],
    queryFn: listAllSuppliers,
  });
  const [editing, setEditing] = React.useState<SupplierRow | null>(null);
  const [openCreate, setOpenCreate] = React.useState(false);
  const [pendingDelete, setPendingDelete] = React.useState<SupplierRow | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["suppliers"] });

  const createMut = useMutation({
    mutationFn: (v: SupplierInput) => createSupplierRow(v),
    onSuccess: () => {
      invalidate();
      setOpenCreate(false);
      toast.success("Đã thêm nhà cung cấp");
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.error?.message ?? "Thêm thất bại"),
  });
  const updateMut = useMutation({
    mutationFn: (v: { id: string; payload: SupplierInput }) =>
      updateSupplierRow(v.id, v.payload),
    onSuccess: () => {
      invalidate();
      setEditing(null);
      toast.success("Đã cập nhật");
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.error?.message ?? "Cập nhật thất bại"),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteSupplierRow(id),
    onSuccess: () => {
      invalidate();
      setPendingDelete(null);
      toast.success("Đã xóa");
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.error?.message ?? "Xóa thất bại"),
  });

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Nhà cung cấp</h3>
          <Button size="sm" onClick={() => setOpenCreate(true)}>
            <Plus className="mr-2 h-4 w-4" /> Thêm nhà cung cấp
          </Button>
        </div>
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : data.length === 0 ? (
          <EmptyState title="Chưa có nhà cung cấp nào" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã</TableHead>
                <TableHead>Tên</TableHead>
                <TableHead>Phân loại</TableHead>
                <TableHead>Facebook</TableHead>
                <TableHead className="w-32 text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-xs">{s.code}</TableCell>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>
                    {s.category ? SUPPLIER_CATEGORY_LABEL[s.category] : "-"}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {s.fbUrl ?? "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(s)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setPendingDelete(s)}>
                      <Trash2 className="h-4 w-4 text-rose-600" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <SupplierDialog
        open={openCreate}
        onOpenChange={setOpenCreate}
        title="Thêm nhà cung cấp"
        submitting={createMut.isPending}
        onSubmit={(v) => createMut.mutate(v)}
      />
      <SupplierDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        title="Sửa nhà cung cấp"
        initial={editing ?? undefined}
        submitting={updateMut.isPending}
        onSubmit={(v) => editing && updateMut.mutate({ id: editing.id, payload: v })}
      />
      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title={`Xóa "${pendingDelete?.name}"?`}
        description="Chỉ xóa được nhà cung cấp chưa có phiếu mua liên kết."
        destructive
        loading={deleteMut.isPending}
        onConfirm={() => {
          if (pendingDelete) deleteMut.mutate(pendingDelete.id);
        }}
      />
    </Card>
  );
}

function SupplierDialog({
  open,
  onOpenChange,
  title,
  initial,
  submitting,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  initial?: SupplierRow;
  submitting: boolean;
  onSubmit: (v: SupplierInput) => void;
}) {
  const [name, setName] = React.useState("");
  const [category, setCategory] = React.useState<SupplierCategory | "">("");
  const [fbUrl, setFbUrl] = React.useState("");
  const [marketplaceUrl, setMarketplaceUrl] = React.useState("");
  const [notes, setNotes] = React.useState("");

  React.useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setCategory(initial?.category ?? "");
      setFbUrl(initial?.fbUrl ?? "");
      setMarketplaceUrl(initial?.marketplaceUrl ?? "");
      setNotes(initial?.notes ?? "");
    }
  }, [open, initial]);

  const submit = () => {
    if (!name.trim()) return toast.error("Vui lòng nhập tên");
    onSubmit({
      name: name.trim(),
      category: category || undefined,
      fbUrl: fbUrl.trim() || undefined,
      marketplaceUrl: marketplaceUrl.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Tên</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div>
            <Label>Phân loại</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as SupplierCategory | "")}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="WHOLESALE">Sỉ</SelectItem>
                <SelectItem value="RETAIL">Lẻ</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Facebook URL</Label>
            <Input value={fbUrl} onChange={(e) => setFbUrl(e.target.value)} />
          </div>
          <div>
            <Label>Marketplace URL</Label>
            <Input value={marketplaceUrl} onChange={(e) => setMarketplaceUrl(e.target.value)} />
          </div>
          <div>
            <Label>Ghi chú</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Hủy
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "Đang lưu..." : "Lưu"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
