"use client";

import * as React from "react";
import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ComponentCategoryCode,
  ComponentCondition,
  MachineStatus,
} from "@app/shared";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/tables/status-badge";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import { AttachmentUploader } from "@/components/forms/attachment-uploader";
import { Can } from "@/features/auth/can";
import { PERM } from "@/lib/permissions";
import {
  COMPONENT_CATEGORY_LABEL,
  COMPONENT_CONDITION_LABEL,
  MACHINE_STATUS_LABEL,
} from "@/lib/labels";
import { formatVnd, formatDateTime } from "@/lib/utils";
import {
  useDeleteMachine,
  useDisassembleMachine,
  useInspectMachine,
  useMachine,
  useMarkMachineReady,
  useUpdateMachine,
} from "@/features/inventory/hooks";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Pencil, Trash2 } from "lucide-react";

const DEFAULT_SLOTS: ComponentCategoryCode[] = [
  ComponentCategoryCode.CPU,
  ComponentCategoryCode.MB,
  ComponentCategoryCode.RAM,
  ComponentCategoryCode.SSD,
  ComponentCategoryCode.HDD,
  ComponentCategoryCode.GPU,
  ComponentCategoryCode.PSU,
  ComponentCategoryCode.CASE,
  ComponentCategoryCode.FAN,
  ComponentCategoryCode.WIFI,
  ComponentCategoryCode.BT,
  ComponentCategoryCode.OTHER,
];

const slotSchema = z.object({
  categoryCode: z.nativeEnum(ComponentCategoryCode),
  model: z.string().optional(),
  serial: z.string().optional(),
  condition: z.nativeEnum(ComponentCondition).optional(),
  // Số lượng linh kiện giống hệt nhau (dòng có serial phải để 1).
  quantity: z.coerce.number().int().min(1).default(1),
  // Giá vốn ban đầu cho MỖI linh kiện — định giá ngay tại bước kiểm tra.
  cost: z.coerce.number().min(0).default(0),
  notes: z.string().optional(),
});
const inspectSchema = z.object({
  slots: z.array(slotSchema),
  notes: z.string().optional(),
});
type InspectValues = z.infer<typeof inspectSchema>;

function MachineDetailBody() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id") ?? "";
  const router = useRouter();
  const { data: machine, isLoading, isError } = useMachine(id);
  const inspectMut = useInspectMachine(id);
  const disMut = useDisassembleMachine(id);
  const readyMut = useMarkMachineReady(id);
  const updateMut = useUpdateMachine(id);
  const deleteMut = useDeleteMachine();

  const [disOpen, setDisOpen] = React.useState(false);
  const [readyOpen, setReadyOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [editSerial, setEditSerial] = React.useState("");
  const [editPrice, setEditPrice] = React.useState<number | "">(0);
  const [editNotes, setEditNotes] = React.useState("");

  const inspectForm = useForm<InspectValues>({
    resolver: zodResolver(inspectSchema),
    defaultValues: { slots: [], notes: "" },
  });
  const { fields: inspectFields, append: appendSlot, remove: removeSlot } =
    useFieldArray({ control: inspectForm.control, name: "slots" });

  React.useEffect(() => {
    if (!machine) return;
    if (machine.inspection?.slots?.length) {
      inspectForm.reset({
        slots: machine.inspection.slots.map((s) => ({
          categoryCode: s.categoryCode,
          model: s.model ?? "",
          serial: s.serial ?? "",
          condition: s.condition ?? undefined,
          quantity: s.quantity && s.quantity > 0 ? s.quantity : 1,
          cost: Number(s.cost) || 0,
          notes: s.notes ?? "",
        })),
        notes: machine.notes ?? "",
      });
    } else if (inspectFields.length === 0) {
      inspectForm.reset({
        slots: DEFAULT_SLOTS.map((c) => ({
          categoryCode: c,
          model: "",
          serial: "",
          condition: ComponentCondition.GOOD,
          quantity: 1,
          cost: 0,
          notes: "",
        })),
        notes: "",
      });
    }
  }, [machine]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) {
    return (
      <div>
        <Skeleton className="mb-4 h-10 w-64" />
        <Skeleton className="h-72" />
      </div>
    );
  }
  if (isError || !machine) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Không tải được thông tin máy.
      </div>
    );
  }

  // Tổng giá vốn linh kiện = Σ (số lượng × đơn giá) — chỉ để đối chiếu với
  // giá mua máy, KHÔNG chặn lưu (giá vốn ban đầu do người dùng quyết định).
  const inspectSlots = inspectForm.watch("slots");
  const inspectTotal = inspectSlots.reduce(
    (sum, s) => sum + (Number(s.cost) || 0) * (Number(s.quantity) || 1),
    0,
  );
  const inspectMatches =
    Math.abs(inspectTotal - Number(machine.purchasePrice ?? 0)) < 1;

  const onInspect = async (values: InspectValues) => {
    try {
      await inspectMut.mutateAsync({
        slots: values.slots.filter((s) => !!s.categoryCode),
        notes: values.notes,
      });
      toast.success("Đã lưu kết quả kiểm tra");
    } catch (err: any) {
      toast.error(
        err?.response?.data?.error?.message ?? "Lưu thất bại",
      );
    }
  };

  const onDisassemble = async () => {
    try {
      await disMut.mutateAsync();
      toast.success("Đã tháo máy và nhập kho linh kiện");
    } catch (err: any) {
      toast.error(
        err?.response?.data?.error?.message ?? "Tháo máy thất bại",
      );
    }
  };

  const onMarkReady = async () => {
    try {
      const res = await readyMut.mutateAsync();
      toast.success(
        res?.finishedPc?.code
          ? `Đã lên kệ bán — mã ${res.finishedPc.code} trong mục "PC thành phẩm"`
          : "Đã chuyển sang sẵn sàng bán",
      );
    } catch (err: any) {
      toast.error(
        err?.response?.data?.error?.message ?? "Thao tác thất bại",
      );
    }
  };

  const canInspect =
    machine.status === MachineStatus.NEW ||
    machine.status === MachineStatus.CHECKED;
  const canDisassemble = machine.status === MachineStatus.CHECKED;
  // READY_FOR_SALE cũng bấm được: tự-chữa máy đã đổi trạng thái trước bản vá
  // nhưng chưa có bản ghi lên kệ (BE chặn tạo trùng nếu đã có).
  const canMarkReady =
    machine.status === MachineStatus.CHECKED ||
    machine.status === MachineStatus.READY_FOR_SALE;

  return (
    <div>
      <PageHeader
        title={`Máy ${machine.code}`}
        description={`Trạng thái: ${MACHINE_STATUS_LABEL[machine.status]}`}
        actions={
          <div className="flex gap-2">
            {machine.status !== MachineStatus.SOLD &&
              machine.status !== MachineStatus.SCRAP && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditSerial(machine.serial ?? "");
                    setEditPrice(Number(machine.purchasePrice ?? 0));
                    setEditNotes(machine.notes ?? "");
                    setEditOpen(true);
                  }}
                >
                  <Pencil className="mr-2 h-4 w-4" /> Sửa
                </Button>
              )}
            {machine.status !== MachineStatus.SOLD &&
              machine.status !== MachineStatus.SCRAP && (
                <Can permission={PERM.MACHINE_UPDATE}>
                  <Button
                    variant="destructive"
                    onClick={() => setDeleteOpen(true)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Xóa
                  </Button>
                </Can>
              )}
            <Button variant="outline" onClick={() => router.push("/machines")}>
              Quay lại
            </Button>
          </div>
        }
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Xóa máy ${machine.code}?`}
        description="Máy và hồ sơ khảo sát/hình ảnh của nó sẽ bị xóa vĩnh viễn. Không xóa được nếu máy đã tháo linh kiện nhập kho hoặc đã bán."
        confirmText="Xóa máy"
        destructive
        loading={deleteMut.isPending}
        onConfirm={async () => {
          try {
            await deleteMut.mutateAsync(machine.id);
            toast.success("Đã xóa máy");
            router.push("/machines");
          } catch (err: any) {
            toast.error(
              err?.response?.data?.error?.message ?? "Xóa máy thất bại",
            );
          }
        }}
      />

      {/* Dialog sửa metadata cơ bản */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sửa thông tin máy {machine.code}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="edit-serial">Serial</Label>
              <Input
                id="edit-serial"
                value={editSerial}
                onChange={(e) => setEditSerial(e.target.value)}
                placeholder="VD: ABC-12345"
              />
            </div>
            <div>
              <Label htmlFor="edit-price">Giá mua (TWD)</Label>
              <Input
                id="edit-price"
                type="number"
                min={0}
                value={editPrice}
                onChange={(e) =>
                  setEditPrice(e.target.value === "" ? "" : Number(e.target.value))
                }
              />
            </div>
            <div>
              <Label htmlFor="edit-notes">Ghi chú</Label>
              <Textarea
                id="edit-notes"
                rows={3}
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditOpen(false)}
              disabled={updateMut.isPending}
            >
              Hủy
            </Button>
            <Button
              onClick={async () => {
                try {
                  await updateMut.mutateAsync({
                    serial: editSerial.trim(),
                    purchasePrice: Number(editPrice || 0),
                    notes: editNotes,
                  });
                  toast.success("Đã lưu");
                  setEditOpen(false);
                } catch (err: any) {
                  toast.error(
                    err?.response?.data?.error?.message ?? "Không lưu được",
                  );
                }
              }}
              disabled={updateMut.isPending}
            >
              {updateMut.isPending ? "Đang lưu..." : "Lưu"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="mb-4">
        <CardContent className="grid gap-4 p-4 sm:grid-cols-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Trạng thái</p>
            <StatusBadge
              status={machine.status}
              label={MACHINE_STATUS_LABEL[machine.status]}
            />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Serial</p>
            <p>{machine.serial ?? "-"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Giá mua</p>
            <p className="font-semibold">{formatVnd(machine.purchasePrice)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Ngày nhập</p>
            <p>{formatDateTime(machine.createdAt)}</p>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Thông tin</TabsTrigger>
          <TabsTrigger value="inspect">Kiểm tra & định giá</TabsTrigger>
          <TabsTrigger value="disassemble">Tháo máy</TabsTrigger>
        </TabsList>

        <TabsContent value="info">
          <Card>
            <CardHeader>
              <CardTitle>Linh kiện trong máy</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {machine.components && machine.components.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mã</TableHead>
                      <TableHead>Loại</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead>Serial</TableHead>
                      <TableHead>Trạng thái</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {machine.components.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>{c.code}</TableCell>
                        <TableCell>
                          {COMPONENT_CATEGORY_LABEL[c.categoryCode]}
                        </TableCell>
                        <TableCell>{c.model ?? "-"}</TableCell>
                        <TableCell>{c.serial ?? "-"}</TableCell>
                        <TableCell>{c.status}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="p-6 text-sm text-muted-foreground">
                  Chưa có linh kiện nào.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inspect">
          <Can permission={PERM.MACHINE_INSPECT} fallback={
            <Card><CardContent className="p-6 text-sm text-muted-foreground">Bạn không có quyền kiểm tra.</CardContent></Card>
          }>
            <Card>
              <CardHeader>
                <CardTitle>Khai báo cấu hình & giá vốn ban đầu</CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...inspectForm}>
                  <form
                    onSubmit={inspectForm.handleSubmit(onInspect)}
                    className="space-y-3"
                  >
                    {inspectFields.map((field, idx) => (
                      <div
                        key={field.id}
                        className="grid gap-2 rounded-md border p-3 sm:grid-cols-12"
                      >
                        <FormField
                          control={inspectForm.control}
                          name={`slots.${idx}.categoryCode`}
                          render={({ field }) => (
                            <FormItem className="sm:col-span-2">
                              <FormLabel>Loại</FormLabel>
                              <Select
                                value={field.value}
                                onValueChange={field.onChange}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {Object.values(ComponentCategoryCode).map(
                                    (c) => (
                                      <SelectItem key={c} value={c}>
                                        {COMPONENT_CATEGORY_LABEL[c]}
                                      </SelectItem>
                                    ),
                                  )}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={inspectForm.control}
                          name={`slots.${idx}.model`}
                          render={({ field }) => (
                            <FormItem className="sm:col-span-2">
                              <FormLabel>Model</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={inspectForm.control}
                          name={`slots.${idx}.serial`}
                          render={({ field }) => (
                            <FormItem className="sm:col-span-2">
                              <FormLabel>Serial</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={inspectForm.control}
                          name={`slots.${idx}.condition`}
                          render={({ field }) => (
                            <FormItem className="sm:col-span-2">
                              <FormLabel>Tình trạng</FormLabel>
                              <Select
                                value={field.value}
                                onValueChange={field.onChange}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {Object.values(ComponentCondition).map(
                                    (c) => (
                                      <SelectItem key={c} value={c}>
                                        {COMPONENT_CONDITION_LABEL[c]}
                                      </SelectItem>
                                    ),
                                  )}
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={inspectForm.control}
                          name={`slots.${idx}.quantity`}
                          render={({ field }) => (
                            <FormItem className="sm:col-span-1">
                              <FormLabel>SL</FormLabel>
                              <FormControl>
                                <Input type="number" min={1} step={1} {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={inspectForm.control}
                          name={`slots.${idx}.cost`}
                          render={({ field }) => (
                            <FormItem className="sm:col-span-2">
                              <FormLabel>Giá vốn/cái</FormLabel>
                              <FormControl>
                                <Input type="number" min={0} {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="flex items-end sm:col-span-1 sm:justify-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeSlot(idx)}
                          >
                            Xóa
                          </Button>
                        </div>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        appendSlot({
                          categoryCode: ComponentCategoryCode.OTHER,
                          model: "",
                          serial: "",
                          condition: ComponentCondition.GOOD,
                          quantity: 1,
                          cost: 0,
                          notes: "",
                        })
                      }
                    >
                      Thêm hàng
                    </Button>
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted p-3 text-sm">
                      <span>
                        Tổng giá vốn linh kiện:{" "}
                        <strong>{formatVnd(inspectTotal)}</strong> / Giá mua
                        máy: <strong>{formatVnd(machine.purchasePrice)}</strong>
                      </span>
                      <span
                        className={
                          inspectMatches ? "text-green-700" : "text-amber-600"
                        }
                      >
                        {inspectMatches
                          ? "Khớp giá mua"
                          : `Chênh lệch ${formatVnd(
                              inspectTotal - Number(machine.purchasePrice ?? 0),
                            )}`}
                      </span>
                    </div>
                    <FormField
                      control={inspectForm.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Ghi chú</FormLabel>
                          <FormControl>
                            <Textarea rows={3} {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        disabled={!canInspect || inspectMut.isPending}
                      >
                        {inspectMut.isPending ? "Đang lưu..." : "Lưu kiểm tra & giá vốn"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </Can>
        </TabsContent>

        <TabsContent value="disassemble">
          <Card>
            <CardHeader>
              <CardTitle>Tháo máy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p className="text-muted-foreground">
                Sau khi tháo, các linh kiện sẽ được sinh và tự động nhập kho
                với giá vốn đã nhập ở bước Kiểm tra & định giá. Máy sẽ chuyển
                sang trạng thái "Đã tháo".
              </p>
              <div className="flex flex-wrap gap-2">
                <Can permission={PERM.MACHINE_MARK_READY}>
                  <Button
                    variant="secondary"
                    disabled={!canMarkReady}
                    onClick={() => setReadyOpen(true)}
                  >
                    Để nguyên — bán máy
                  </Button>
                </Can>
                <Can permission={PERM.MACHINE_DISASSEMBLE}>
                  <Button
                    variant="destructive"
                    disabled={!canDisassemble}
                    onClick={() => setDisOpen(true)}
                  >
                    Tháo máy
                  </Button>
                </Can>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Tệp đính kèm</CardTitle>
        </CardHeader>
        <CardContent>
          <AttachmentUploader relatedType="MACHINE" relatedId={machine.id} />
        </CardContent>
      </Card>

      <ConfirmDialog
        open={disOpen}
        onOpenChange={setDisOpen}
        title="Tháo máy?"
        description="Hành động này sẽ sinh các linh kiện và nhập kho. Không thể hoàn tác."
        confirmText="Tháo máy"
        destructive
        loading={disMut.isPending}
        onConfirm={onDisassemble}
      />

      <ConfirmDialog
        open={readyOpen}
        onOpenChange={setReadyOpen}
        title="Chuyển sang sẵn sàng bán?"
        description='Máy giữ nguyên cấu hình và được đưa lên kệ ở mục "PC thành phẩm" để bán như một máy hoàn chỉnh.'
        confirmText="Xác nhận"
        loading={readyMut.isPending}
        onConfirm={onMarkReady}
      />
    </div>
  );
}

export default function MachineDetailPage() {
  return (
    <Suspense fallback={<div>Đang tải...</div>}>
      <MachineDetailBody />
    </Suspense>
  );
}
