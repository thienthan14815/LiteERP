"use client";

import * as React from "react";
import Link from "next/link";
import {
  DollarSign,
  TrendingUp,
  Package,
  Monitor,
  Cpu,
  AlertTriangle,
  Wrench,
  ShieldCheck,
  ShoppingCart,
  CheckSquare,
  Hammer,
  PackageOpen,
  PlusCircle,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { SalesOrderStatus, PurchaseOrderStatus } from "@app/shared";
import { useDashboard, useProfitReport } from "@/features/reports/hooks";
import { useSales } from "@/features/sale/hooks";
import { usePurchases } from "@/features/purchase/hooks";
import {
  SALES_ORDER_STATUS_LABEL,
  PURCHASE_ORDER_STATUS_LABEL,
} from "@/lib/labels";
import { formatVnd, formatNumber, formatDate, cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/provider";
import { usePageMeta } from "@/lib/page-title-context";

interface KpiProps {
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  hint?: string;
}

function KpiCard({ icon: Icon, iconBg, iconColor, label, value, hint }: KpiProps) {
  return (
    <div className="card-soft p-5">
      <div className="flex items-start gap-4">
        <div
          className={cn(
            "flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full",
            iconBg,
          )}
        >
          <Icon className={cn("h-5 w-5", iconColor)} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-slate-500">{label}</p>
          <p className="mt-1 truncate text-2xl font-bold text-slate-900">{value}</p>
          {hint && <p className="mt-1.5 truncate text-xs text-slate-500">{hint}</p>}
        </div>
      </div>
    </div>
  );
}

const PIE_COLORS = ["#0ea5e9", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#64748b"];

const SALES_STATUS_COLOR: Record<SalesOrderStatus, string> = {
  [SalesOrderStatus.DRAFT]: "#0ea5e9",
  [SalesOrderStatus.CONFIRMED]: "#10b981",
  [SalesOrderStatus.CANCELLED]: "#ef4444",
  [SalesOrderStatus.REFUNDED]: "#f59e0b",
};

const STATUS_BADGE_STYLE: Record<string, string> = {
  DRAFT: "bg-sky-50 text-sky-700 ring-sky-200",
  CONFIRMED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  CANCELLED: "bg-rose-50 text-rose-700 ring-rose-200",
  REFUNDED: "bg-amber-50 text-amber-700 ring-amber-200",
};

// Icon để phỏng đoán theo label attentionItem từ backend.
function pickAlertVisual(label: string) {
  const l = label.toLowerCase();
  if (l.includes("bảo hành") || l.includes("warranty")) {
    return { icon: ShieldCheck, iconBg: "bg-emerald-50", iconColor: "text-emerald-500", badge: "bg-emerald-100 text-emerald-700" };
  }
  if (l.includes("kiểm") || l.includes("test") || l.includes("máy")) {
    return { icon: Monitor, iconBg: "bg-amber-50", iconColor: "text-amber-500", badge: "bg-amber-100 text-amber-700" };
  }
  if (l.includes("lỗi") || l.includes("defective")) {
    return { icon: Wrench, iconBg: "bg-slate-100", iconColor: "text-slate-500", badge: "bg-slate-100 text-slate-700" };
  }
  if (l.includes("hết") || l.includes("low") || l.includes("sắp")) {
    return { icon: AlertTriangle, iconBg: "bg-rose-50", iconColor: "text-rose-500", badge: "bg-rose-100 text-rose-700" };
  }
  return { icon: AlertTriangle, iconBg: "bg-sky-50", iconColor: "text-sky-500", badge: "bg-sky-100 text-sky-700" };
}

const QUICK_ACTIONS = [
  { icon: PlusCircle, key: "quick.buy_machine", href: "/purchases/new", iconBg: "bg-sky-50", iconColor: "text-sky-600" },
  { icon: ShoppingCart, key: "quick.buy_component", href: "/purchases/new", iconBg: "bg-emerald-50", iconColor: "text-emerald-600" },
  { icon: CheckSquare, key: "quick.inspect", href: "/machines", iconBg: "bg-amber-50", iconColor: "text-amber-600" },
  { icon: Wrench, key: "quick.disassemble", href: "/machines", iconBg: "bg-rose-50", iconColor: "text-rose-600" },
  { icon: Hammer, key: "quick.assemble", href: "/assemblies/new", iconBg: "bg-purple-50", iconColor: "text-purple-600" },
  { icon: ShoppingCart, key: "quick.create_sale", href: "/sales/new", iconBg: "bg-orange-50", iconColor: "text-orange-600" },
  { icon: PackageOpen, key: "quick.import_component", href: "/components", iconBg: "bg-sky-50", iconColor: "text-sky-600" },
];

// Range 7 ngày gần nhất, ISO YYYY-MM-DD.
function last7Days(): { fromDate: string; toDate: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 6);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { fromDate: iso(from), toDate: iso(to) };
}

export default function DashboardPage() {
  const { t } = useTranslation();
  usePageMeta("Dashboard", "Tổng quan hoạt động cửa hàng");

  const { data: dashboard, isLoading: loadingDashboard } = useDashboard();
  const range = React.useMemo(last7Days, []);
  const { data: profit } = useProfitReport(range);
  const { data: salesList } = useSales({ page: 1, pageSize: 5 });
  const { data: purchaseList } = usePurchases({ page: 1, pageSize: 5 });
  // Fetch riêng 100 sale gần nhất để tính donut status distribution (nhẹ tải).
  const { data: salesForStatus } = useSales({ page: 1, pageSize: 100 });

  // Line chart: dailyBreakdown thật từ /reports/profit (7 ngày qua).
  const chartData = React.useMemo(() => {
    const daily = profit?.dailyBreakdown ?? [];
    return daily.map((d) => ({
      date: d.date.slice(5).replace("-", "/"), // MM/DD
      revenue: Number(d.revenue) / 1_000_000,
      profit: Number(d.profit) / 1_000_000,
    }));
  }, [profit]);

  // Donut chart: group sales theo status.
  const { pieData, totalOrders } = React.useMemo(() => {
    const items = salesForStatus?.items ?? [];
    const counts = new Map<SalesOrderStatus, number>();
    for (const s of items) {
      counts.set(s.status, (counts.get(s.status) ?? 0) + 1);
    }
    const data = Array.from(counts.entries())
      .map(([status, value]) => ({
        name: SALES_ORDER_STATUS_LABEL[status] ?? status,
        value,
        color: SALES_STATUS_COLOR[status] ?? PIE_COLORS[0],
      }))
      .sort((a, b) => b.value - a.value);
    return { pieData: data, totalOrders: items.length };
  }, [salesForStatus]);

  const attentionItems = dashboard?.attentionItems ?? [];

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard
          icon={DollarSign}
          iconBg="bg-amber-50"
          iconColor="text-amber-500"
          label={t("kpi.revenue_today")}
          value={loadingDashboard ? "—" : formatVnd(dashboard?.revenue ?? 0)}
          hint="Tháng hiện tại"
        />
        <KpiCard
          icon={TrendingUp}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-500"
          label={t("kpi.profit_today")}
          value={loadingDashboard ? "—" : formatVnd(dashboard?.profit ?? 0)}
          hint="Tháng hiện tại"
        />
        <KpiCard
          icon={Package}
          iconBg="bg-orange-50"
          iconColor="text-orange-500"
          label={t("kpi.inventory_value")}
          value={loadingDashboard ? "—" : formatVnd(dashboard?.inventoryValue ?? 0)}
          hint="Linh kiện IN_STOCK"
        />
        <KpiCard
          icon={Monitor}
          iconBg="bg-purple-50"
          iconColor="text-purple-500"
          label={t("kpi.finished_pc")}
          value={loadingDashboard ? "—" : formatNumber(dashboard?.machineCount ?? 0)}
          hint="Máy cũ nhập kho"
        />
        <KpiCard
          icon={Cpu}
          iconBg="bg-rose-50"
          iconColor="text-rose-500"
          label={t("kpi.component_stock")}
          value={loadingDashboard ? "—" : formatNumber(dashboard?.componentCount ?? 0)}
          hint="Tổng linh kiện các trạng thái"
        />
      </div>

      {/* Charts + alerts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Line chart — thật, 7 ngày gần nhất */}
        <div className="card-soft p-6 lg:col-span-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900">
              {t("chart.revenue_profit")}
            </h3>
            <span className="text-xs text-slate-500">7 ngày qua</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v}M`}
              />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
                formatter={(v: number) => `${v.toFixed(2)} triệu`}
              />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey="revenue"
                name={t("chart.revenue")}
                stroke="#0ea5e9"
                strokeWidth={2.5}
                dot={{ r: 4, fill: "#0ea5e9" }}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="profit"
                name={t("chart.profit")}
                stroke="#10b981"
                strokeWidth={2.5}
                dot={{ r: 4, fill: "#10b981" }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
          {chartData.length === 0 && (
            <p className="mt-4 text-center text-xs text-slate-400">Chưa có dữ liệu bán hàng 7 ngày qua</p>
          )}
        </div>

        {/* Donut chart — thật */}
        <div className="card-soft p-6 lg:col-span-4">
          <h3 className="mb-4 text-base font-semibold text-slate-900">
            {t("chart.order_status")}
          </h3>
          {pieData.length === 0 ? (
            <div className="flex h-44 items-center justify-center text-sm text-slate-400">
              Chưa có đơn bán nào
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <div className="relative h-44 w-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold text-slate-900">{totalOrders}</span>
                  <span className="text-xs text-slate-500">{t("chart.total_orders")}</span>
                </div>
              </div>
              <div className="flex-1 space-y-2.5">
                {pieData.map((p, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ background: p.color }}
                    />
                    <span className="flex-1 text-slate-600">{p.name}</span>
                    <span className="font-medium text-slate-900">
                      {p.value} ({((p.value / totalOrders) * 100).toFixed(1)}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Alerts — dùng attentionItems thật từ backend */}
        <div className="card-soft p-6 lg:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900">
              {t("alert.title")}
            </h3>
            <Link
              href="/audit-logs"
              className="text-xs font-medium text-sky-600 hover:text-sky-700"
            >
              {t("alert.view_all")}
            </Link>
          </div>
          {attentionItems.length === 0 ? (
            <p className="text-sm text-slate-400">Không có cảnh báo</p>
          ) : (
            <div className="space-y-2">
              {attentionItems.map((a, i) => {
                const v = pickAlertVisual(a.label);
                const Icon = v.icon;
                return (
                  <Link
                    key={i}
                    href={a.link}
                    className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-slate-50"
                  >
                    <div
                      className={cn(
                        "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg",
                        v.iconBg,
                      )}
                    >
                      <Icon className={cn("h-4 w-4", v.iconColor)} />
                    </div>
                    <span className="flex-1 truncate text-sm text-slate-700">
                      {a.label}
                    </span>
                    <span
                      className={cn(
                        "flex h-6 min-w-[24px] items-center justify-center rounded-md px-2 text-xs font-semibold",
                        v.badge,
                      )}
                    >
                      {a.count}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recent orders tables — dùng data thật */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card-soft">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h3 className="text-base font-semibold text-slate-900">
              {t("recent.purchase")}
            </h3>
            <Link
              href="/purchases"
              className="text-xs font-medium text-sky-600 hover:text-sky-700"
            >
              {t("alert.view_all")}
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500">
                  <th className="px-5 py-3 font-medium">{t("recent.code")}</th>
                  <th className="px-5 py-3 font-medium">{t("recent.supplier")}</th>
                  <th className="px-5 py-3 font-medium">{t("recent.total")}</th>
                  <th className="px-5 py-3 font-medium">{t("recent.status")}</th>
                  <th className="px-5 py-3 font-medium">{t("recent.date")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(purchaseList?.data ?? []).map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <Link
                        href={`/purchases/${p.id}`}
                        className="font-medium text-sky-600 hover:underline"
                      >
                        {p.code}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-slate-700">
                      {p.supplier?.name ?? p.supplierName ?? "-"}
                    </td>
                    <td className="px-5 py-3 text-slate-900">
                      {formatVnd(p.totalAmount)}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
                          STATUS_BADGE_STYLE[p.status] ??
                            "bg-slate-50 text-slate-700 ring-slate-200",
                        )}
                      >
                        {PURCHASE_ORDER_STATUS_LABEL[p.status as PurchaseOrderStatus] ?? p.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-500">
                      {formatDate(p.createdAt)}
                    </td>
                  </tr>
                ))}
                {(purchaseList?.data ?? []).length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-6 text-center text-sm text-slate-400">
                      Chưa có phiếu mua nào
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card-soft">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h3 className="text-base font-semibold text-slate-900">
              {t("recent.sale")}
            </h3>
            <Link
              href="/sales"
              className="text-xs font-medium text-sky-600 hover:text-sky-700"
            >
              {t("alert.view_all")}
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500">
                  <th className="px-5 py-3 font-medium">{t("recent.code")}</th>
                  <th className="px-5 py-3 font-medium">{t("recent.customer")}</th>
                  <th className="px-5 py-3 font-medium">{t("recent.total")}</th>
                  <th className="px-5 py-3 font-medium">{t("recent.status")}</th>
                  <th className="px-5 py-3 font-medium">{t("recent.date")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(salesList?.items ?? []).map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <Link
                        href={`/sales/${s.id}`}
                        className="font-medium text-sky-600 hover:underline"
                      >
                        {s.code}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-slate-700">
                      {s.customer?.name ?? "-"}
                    </td>
                    <td className="px-5 py-3 text-slate-900">
                      {formatVnd(s.totalAmount)}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
                          STATUS_BADGE_STYLE[s.status] ??
                            "bg-slate-50 text-slate-700 ring-slate-200",
                        )}
                      >
                        {SALES_ORDER_STATUS_LABEL[s.status] ?? s.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-500">
                      {formatDate(s.createdAt)}
                    </td>
                  </tr>
                ))}
                {(salesList?.items ?? []).length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-6 text-center text-sm text-slate-400">
                      Chưa có đơn bán nào
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="card-soft p-6">
        <h3 className="mb-4 text-base font-semibold text-slate-900">
          {t("quick.title")}
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
          {QUICK_ACTIONS.map((a) => {
            const Icon = a.icon;
            return (
              <Link
                key={a.key}
                href={a.href}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 transition-colors hover:bg-slate-50"
              >
                <div
                  className={cn(
                    "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full",
                    a.iconBg,
                  )}
                >
                  <Icon className={cn("h-4 w-4", a.iconColor)} />
                </div>
                <span className="text-xs font-medium text-slate-700">{t(a.key)}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
