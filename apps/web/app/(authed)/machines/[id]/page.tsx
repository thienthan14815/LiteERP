"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
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
  useAllocateMachineCost,
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
import { Pencil } from "lucide-react";

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
  notes: z.string().optional(),
});
const inspectSchema = z.object({
  slots: z.array(slotSchema),
  notes: z.string().optional(),
});
type InspectValues = z.infer<typeof inspectSchema>;

const allocItemSchema = z.object({
  categoryCode: z.nativeEnum(ComponentCategoryCode),
  label: z.string().optional(),
  cost: z.coerce.number().nonnegative(),
});
const allocSchema = z.object({ items: z.array(allocItemSchema) });
type AllocValues = z.infer<typeof allocSchema>;

export default function MachineDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: machine, isLoading, isError } = useMachine(params.id);
  const inspectMut = useInspectMachine(params.id);
  const allocMut = useAllocateMachineCost(params.id);
  const disMut = useDisassembleMachine(params.id);
  const readyMut = useMarkMachineReady(params.id);
  const updateMut = useUpdateMachine(params.id);

  const [disOpen, setDisOpen] = React.useState(false);
  const [readyOpen, setReadyOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [editSerial, setEditSerial] = React.useState("");
  const [editPrice, setEditPrice] = React.useState<number | "">(0);
  const [editNotes, setEditNotes] = React.useState("");

  const inspectForm = useForm<InspectValues>({
    resolver: zodResolver(inspectSchema),
    defaultValues: { slots: [], notes: "" },
  });
  const { fields: inspectFields, append: appendSlot, remove: removeSlot } =
    useFieldArray({ control: inspectForm.control, name: "slots" });

  const allocForm = useForm<AllocValues>({
    resolver: zodResolver(allocSchema),
    defaultValues: { items: [] },
  });
  const { fields: allocFields, append: appendAlloc, remove: removeAlloc } =
    useFieldArray({ control: allocForm.control, name: "items" });

  React.useEffect(() => {
    if (!machine) return;
    if (machine.inspection?.slots?.length) {
      inspectForm.reset({
        slots: machine.inspection.slots.map((s) => ({
          categoryCode: s.categoryCode,
          model: s.model ?? "",
          serial: s.serial ?? "",
          condition: s.condition ?? undefined,
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
          notes: "",
        })),
        notes: "",
      });
    }

    if (machine.allocation?.items?.length) {
      allocForm.reset({
        items: machine.allocation.items.map((it) => ({
          categoryCode: it.categoryCode,
          label: it.label ?? "",
          cost: it.cost ?? 0,
        })),
      });
    } else if (machine.inspection?.slots?.length) {
      allocForm.reset({
        items: machine.inspection.slots.map((s) => ({
          categoryCode: s.categoryCode,
          label: s.model ?? "",
          cost: 0,
        })),
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

  const allocItems = allocForm.watch("items");
  const allocTotal = allocItems.reduce(
    (sum, it) => sum + (Number(it.cost) || 0),
    0,
  );
  // machine.purchasePrice là Prisma Decimal → JSON string; phải Number() trước khi trừ.
  const allocMatches = Math.abs(allocTotal - Number(machine.purchasePrice ?? 0)) < 1;

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

  const onAllocate = async (values: AllocValues) => {
    if (!allocMatches) {
      toast.error("Tổng giá vốn phân bổ phải bằng giá mua máy");
      return;
    }
    try {
      await allocMut.mutateAsync({ items: values.items });
      toast.success("Đã phân bổ giá vốn");
    } catch (err: any) {
      toast.error(
        err?.response?.data?.error?.message ?? "Phân bổ thất bại",
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
      await readyMut.mutateAsync();
      toast.success("Đã chuyển sang sẵn sàng bán");
    } catch (err: any) {
      toast.error(
        err?.response?.data?.error?.message ?? "Thao tác thất bại",
      );
    }
  };

  const canInspect =
    machine.status === MachineStatus.NEW ||
    machine.status === MachineStatus.CHECKED;
  const canAllocate = machine.status === MachineStatus.CHECKED;
  const canDisassemble = machine.status === MachineStatus.CHECKED;
  const canMarkReady = machine.status === MachineStatus.CHECKED;

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
            <Button variant="outline" onClick={() => router.push("/machines")}>
              Quay lại
            </Button>
          </div>
        }
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
          <TabsTrigger value="inspect">Kiểm tra</TabsTrigger>
          <TabsTrigger value="cost">Phân bổ giá vốn</TabsTrigger>
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
                <CardTitle>Khai báo cấu hình</CardTitle>
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
                            <FormItem className="sm:col-span-3">
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
                            <FormItem className="sm:col-span-3">
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
                        <div className="flex items-end sm:col-span-2 sm:justify-end">
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
                          notes: "",
                        })
                      }
                    >
                      Thêm hàng
                    </Button>
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
                        {inspectMut.isPending ? "Đang lưu..." : "Lưu kiểm tra"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </Can>
        </TabsContent>

        <TabsContent value="cost">
          <Can permission={PERM.MACHINE_ALLOCATE_COST} fallback={
            <Card><CardContent className="p-6 text-sm text-muted-foreground">Bạn không có quyền phân bổ giá vốn.</CardContent></Card>
          }>
            <Card>
              <CardHeader>
                <CardTitle>Phân bổ giá vốn</CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...allocForm}>
                  <form
                    onSubmit={allocForm.handleSubmit(onAllocate)}
                    className="space-y-3"
                  >
                    {allocFields.map((field, idx) => (
                      <div
                        key={field.id}
                        className="grid gap-2 rounded-md border p-3 sm:grid-cols-12"
                      >
                        <FormField
                          control={allocForm.control}
                          name={`items.${idx}.categoryCode`}
                          render={({ field }) => (
                            <FormItem className="sm:col-span-3">
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
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={allocForm.control}
                          name={`items.${idx}.label`}
                          render={({ field }) => (
                            <FormItem className="sm:col-span-5">
                              <FormLabel>Nhãn</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={allocForm.control}
                          name={`items.${idx}.cost`}
                          render={({ field }) => (
                            <FormItem className="sm:col-span-3">
                              <FormLabel>Giá vốn</FormLabel>
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
                            onClick={() => removeAlloc(idx)}
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
                        appendAlloc({
                          categoryCode: ComponentCategoryCode.OTHER,
                          label: "",
                          cost: 0,
                        })
                      }
                    >
                      Thêm dòng
                    </Button>
                    <div className="flex items-center justify-between rounded-md border bg-muted p-3 text-sm">
                      <span>
                        Tổng phân bổ: <strong>{formatVnd(allocTotal)}</strong> /
                        Giá mua: <strong>{formatVnd(machine.purchasePrice)}</strong>
                      </span>
                      <span
                        className={
                          allocMatches ? "text-green-700" : "text-destructive"
                        }
                      >
                        {allocMatches
                          ? "Khớp"
                          : `Chênh lệch ${formatVnd(allocTotal - machine.purchasePrice)}`}
                      </span>
                    </div>
                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        disabled={!canAllocate || !allocMatches || allocMut.isPending}
                      >
                        {allocMut.isPending ? "Đang lưu..." : "Lưu phân bổ"}
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
                Sau khi tháo, các linh kiện sẽ được sinh và tự động nhập kho.
                Máy sẽ chuyển sang trạng thái "Đã tháo".
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
        description="Máy sẽ giữ nguyên cấu hình và chuyển sang trạng thái sẵn sàng bán."
        confirmText="Xác nhận"
        loading={readyMut.isPending}
        onConfirm={onMarkReady}
      />
    </div>
  );
}
