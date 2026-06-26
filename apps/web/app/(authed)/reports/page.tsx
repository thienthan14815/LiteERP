"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useInventoryAging,
  useInventoryValue,
  useProfitReport,
  useSalesByProduct,
  useTopCustomers,
} from "@/features/reports/hooks";
import { formatNumber, formatVnd, formatDate } from "@/lib/utils";

function firstDayOfMonthISO() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const PIE_COLORS = ["#2563eb", "#16a34a", "#f97316", "#dc2626", "#7c3aed", "#0ea5e9", "#facc15"];

export default function ReportsPage() {
  const [fromDraft, setFromDraft] = React.useState(firstDayOfMonthISO());
  const [toDraft, setToDraft] = React.useState(todayISO());
  const [from, setFrom] = React.useState(fromDraft);
  const [to, setTo] = React.useState(toDraft);

  const dateQuery = { fromDate: from, toDate: to };

  return (
    <div>
      <PageHeader
        title="Báo cáo"
        description="Lợi nhuận, bán hàng, khách hàng và tồn kho"
      />
      <Card className="mb-4">
        <CardContent className="grid gap-3 p-4 sm:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Từ ngày</label>
            <Input type="date" value={fromDraft} onChange={(e) => setFromDraft(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Đến ngày</label>
            <Input type="date" value={toDraft} onChange={(e) => setToDraft(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => { setFrom(fromDraft); setTo(toDraft); }}
            >
              Áp dụng
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="profit" className="space-y-4">
        <TabsList>
          <TabsTrigger value="profit">Lợi nhuận</TabsTrigger>
          <TabsTrigger value="sales-product">Theo sản phẩm</TabsTrigger>
          <TabsTrigger value="top-customers">Khách hàng</TabsTrigger>
          <TabsTrigger value="inventory-aging">Tồn kho lâu</TabsTrigger>
          <TabsTrigger value="inventory-value">Giá trị tồn</TabsTrigger>
        </TabsList>

        <TabsContent value="profit"><ProfitTab query={dateQuery} /></TabsContent>
        <TabsContent value="sales-product"><SalesByProductTab query={dateQuery} /></TabsContent>
        <TabsContent value="top-customers"><TopCustomersTab query={dateQuery} /></TabsContent>
        <TabsContent value="inventory-aging"><InventoryAgingTab /></TabsContent>
        <TabsContent value="inventory-value"><InventoryValueTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function ProfitTab({ query }: { query: { fromDate: string; toDate: string } }) {
  const { data, isLoading } = useProfitReport(query);
  if (isLoading) return <Skeleton className="h-72 w-full" />;
  if (!data) return null;
  return (
    <>
      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi title="Doanh thu" value={formatVnd(data.revenue)} />
        <Kpi title="Giá vốn" value={formatVnd(data.cost)} />
        <Kpi title="Lợi nhuận" value={formatVnd(data.profit)} />
        <Kpi title="Số đơn" value={formatNumber(data.salesCount)} />
      </div>
      <Card>
        <CardContent className="h-80 p-4">
          {data.dailyBreakdown.length === 0 ? (
            <p className="text-sm text-muted-foreground">Không có dữ liệu trong khoảng này</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.dailyBreakdown}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(v: number) => formatVnd(v)} />
                <Legend />
                <Line type="monotone" dataKey="revenue" name="Doanh thu" stroke="#2563eb" />
                <Line type="monotone" dataKey="cost" name="Giá vốn" stroke="#f97316" />
                <Line type="monotone" dataKey="profit" name="Lợi nhuận" stroke="#16a34a" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
      <p className="mt-2 text-xs text-muted-foreground">
        {formatDate(data.fromDate)} → {formatDate(data.toDate)}
      </p>
    </>
  );
}

function SalesByProductTab({ query }: { query: { fromDate: string; toDate: string } }) {
  const { data = [], isLoading } = useSalesByProduct(query);
  if (isLoading) return <Skeleton className="h-72 w-full" />;
  return (
    <Card>
      <CardContent className="h-96 p-4">
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Không có giao dịch</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(v: number) => formatVnd(v)} />
              <Legend />
              <Bar dataKey="revenue" name="Doanh thu" fill="#2563eb" />
              <Bar dataKey="profit" name="Lợi nhuận" fill="#16a34a" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

function TopCustomersTab({ query }: { query: { fromDate: string; toDate: string } }) {
  const { data = [], isLoading } = useTopCustomers({ ...query, limit: 10 });
  if (isLoading) return <Skeleton className="h-72 w-full" />;
  return (
    <Card>
      <CardContent className="p-0">
        {data.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Không có khách hàng</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Khách</TableHead>
                <TableHead>Liên hệ</TableHead>
                <TableHead className="text-right">Số đơn</TableHead>
                <TableHead className="text-right">Doanh thu</TableHead>
                <TableHead className="text-right">Lợi nhuận</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((c) => (
                <TableRow key={c.customerId}>
                  <TableCell><span className="font-medium">{c.name}</span><br /><span className="text-xs text-muted-foreground">{c.code}</span></TableCell>
                  <TableCell>{c.phone ?? "-"}</TableCell>
                  <TableCell className="text-right">{formatNumber(c.orderCount)}</TableCell>
                  <TableCell className="text-right">{formatVnd(c.revenue)}</TableCell>
                  <TableCell className="text-right">{formatVnd(c.profit)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function InventoryAgingTab() {
  const [days, setDays] = React.useState(30);
  const { data, isLoading } = useInventoryAging(days);
  if (isLoading) return <Skeleton className="h-72 w-full" />;
  if (!data) return null;
  return (
    <>
      <div className="mb-3 flex items-end gap-2">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Ngưỡng (ngày)</label>
          <Input
            type="number"
            value={days}
            onChange={(e) => setDays(Number(e.target.value) || 30)}
            min={1}
            max={365}
            className="w-32"
          />
        </div>
        <p className="text-sm text-muted-foreground">
          Tổng: {formatNumber(data.totalAging)} linh kiện
        </p>
      </div>
      <Card>
        <CardContent className="h-80 p-4">
          {data.byCategory.length === 0 ? (
            <p className="text-sm text-muted-foreground">Không có linh kiện tồn lâu</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.byCategory}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" name="Số lượng" fill="#dc2626" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function InventoryValueTab() {
  const { data, isLoading } = useInventoryValue();
  if (isLoading) return <Skeleton className="h-72 w-full" />;
  if (!data) return null;
  return (
    <>
      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <Kpi title="Tổng giá trị tồn" value={formatVnd(data.totalValue)} />
        <Kpi title="Số linh kiện" value={formatNumber(data.totalCount)} />
      </div>
      <Card>
        <CardContent className="h-80 p-4">
          {data.topCategories.length === 0 ? (
            <p className="text-sm text-muted-foreground">Kho trống</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.topCategories}
                  dataKey="value"
                  nameKey="name"
                  label={(entry) => entry.name}
                >
                  {data.topCategories.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatVnd(v)} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function Kpi({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
      <CardContent />
    </Card>
  );
}
