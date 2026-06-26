"use client";

import Link from "next/link";
import {
  DollarSign,
  TrendingUp,
  Package,
  Monitor,
  Cpu,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  Wrench,
  ShieldCheck,
  ShoppingCart,
  XCircle,
  ShoppingBag,
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
import { useDashboard } from "@/features/reports/hooks";
import { formatVnd, formatNumber } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import { usePageMeta } from "@/lib/page-title-context";

interface KpiProps {
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  trend?: { dir: "up" | "down"; text: string };
}

function KpiCard({ icon: Icon, iconBg, iconColor, label, value, trend }: KpiProps) {
  return (
    <div className="card-soft p-5">
      <div className="flex items-start gap-4">
        <div className={cn("flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full", iconBg)}>
          <Icon className={cn("h-5 w-5", iconColor)} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-slate-500">{label}</p>
          <p className="mt-1 truncate text-2xl font-bold text-slate-900">{value}</p>
          {trend && (
            <div className="mt-1.5 flex items-center gap-1 text-xs">
              {trend.dir === "up" ? (
                <ArrowUp className="h-3 w-3 text-emerald-500" />
              ) : (
                <ArrowDown className="h-3 w-3 text-rose-500" />
              )}
              <span className={trend.dir === "up" ? "text-emerald-600" : "text-rose-600"}>
                {trend.text}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const CHART_DATA = [
  { date: "17/05", revenue: 12, profit: 4 },
  { date: "18/05", revenue: 15, profit: 5 },
  { date: "19/05", revenue: 11, profit: 4 },
  { date: "20/05", revenue: 14, profit: 5 },
  { date: "21/05", revenue: 12, profit: 4 },
  { date: "22/05", revenue: 13, profit: 4 },
  { date: "23/05", revenue: 15, profit: 5 },
];

const PIE_COLORS = ["#0ea5e9", "#f59e0b", "#10b981", "#ef4444"];

interface AlertItem {
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
  label: string;
  count: number;
  href: string;
  badgeColor: string;
}

interface RecentOrder {
  code: string;
  partner: string;
  total: string;
  status: { label: string; color: string };
  date: string;
}

const STATUS_STYLES = {
  confirmed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  processing: "bg-sky-50 text-sky-700 ring-sky-200",
  pending: "bg-amber-50 text-amber-700 ring-amber-200",
  cancelled: "bg-rose-50 text-rose-700 ring-rose-200",
  completed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  delivering: "bg-sky-50 text-sky-700 ring-sky-200",
};

const QUICK_ACTIONS = [
  { icon: PlusCircle, key: "quick.buy_machine", href: "/purchases/new", iconBg: "bg-sky-50", iconColor: "text-sky-600" },
  { icon: ShoppingCart, key: "quick.buy_component", href: "/purchases/new", iconBg: "bg-emerald-50", iconColor: "text-emerald-600" },
  { icon: CheckSquare, key: "quick.inspect", href: "/machines", iconBg: "bg-amber-50", iconColor: "text-amber-600" },
  { icon: Wrench, key: "quick.disassemble", href: "/machines", iconBg: "bg-rose-50", iconColor: "text-rose-600" },
  { icon: Hammer, key: "quick.assemble", href: "/assemblies/new", iconBg: "bg-purple-50", iconColor: "text-purple-600" },
  { icon: ShoppingBag, key: "quick.create_sale", href: "/sales/new", iconBg: "bg-orange-50", iconColor: "text-orange-600" },
  { icon: PackageOpen, key: "quick.import_component", href: "/components", iconBg: "bg-sky-50", iconColor: "text-sky-600" },
];

export default function DashboardPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useDashboard();
  usePageMeta("Dashboard", "Tổng quan hoạt động cửa hàng");

  const pieData = [
    { name: t("chart.status.pending"), value: 12, color: PIE_COLORS[0] },
    { name: t("chart.status.processing"), value: 18, color: PIE_COLORS[1] },
    { name: t("chart.status.completed"), value: 20, color: PIE_COLORS[2] },
    { name: t("chart.status.cancelled"), value: 6, color: PIE_COLORS[3] },
  ];
  const totalOrders = pieData.reduce((s, p) => s + p.value, 0);

  const alerts: AlertItem[] = [
    { icon: AlertTriangle, iconBg: "bg-rose-50", iconColor: "text-rose-500", label: t("alert.low_stock"), count: 23, href: "/components", badgeColor: "bg-rose-100 text-rose-700" },
    { icon: Monitor, iconBg: "bg-amber-50", iconColor: "text-amber-500", label: t("alert.waiting_test"), count: 7, href: "/machines", badgeColor: "bg-amber-100 text-amber-700" },
    { icon: ShieldCheck, iconBg: "bg-emerald-50", iconColor: "text-emerald-500", label: t("alert.warranty_overdue"), count: 5, href: "/warranties", badgeColor: "bg-emerald-100 text-emerald-700" },
    { icon: ShoppingCart, iconBg: "bg-amber-50", iconColor: "text-amber-500", label: t("alert.order_overdue"), count: 3, href: "/sales", badgeColor: "bg-amber-100 text-amber-700" },
    { icon: XCircle, iconBg: "bg-slate-100", iconColor: "text-slate-500", label: t("alert.defective"), count: 4, href: "/components", badgeColor: "bg-slate-100 text-slate-700" },
  ];

  const recentPurchases: RecentOrder[] = [
    { code: "PO-250523-001", partner: "Trần Minh Computer", total: "25.500.000 đ", status: { label: t("status.confirmed"), color: STATUS_STYLES.confirmed }, date: "23/05/2025" },
    { code: "PO-250522-002", partner: "Hoàng Long PC", total: "18.750.000 đ", status: { label: t("status.processing"), color: STATUS_STYLES.processing }, date: "22/05/2025" },
    { code: "PO-250521-003", partner: "An Phát Tech", total: "9.300.000 đ", status: { label: t("status.pending"), color: STATUS_STYLES.pending }, date: "21/05/2025" },
    { code: "PO-250520-004", partner: "Quang Minh Store", total: "15.200.000 đ", status: { label: t("status.cancelled"), color: STATUS_STYLES.cancelled }, date: "20/05/2025" },
  ];

  const recentSales: RecentOrder[] = [
    { code: "SO-250523-001", partner: "Nguyễn Văn B", total: "12.900.000 đ", status: { label: t("status.completed"), color: STATUS_STYLES.completed }, date: "23/05/2025" },
    { code: "SO-250522-002", partner: "Trần Thị C", total: "8.750.000 đ", status: { label: t("status.completed"), color: STATUS_STYLES.completed }, date: "22/05/2025" },
    { code: "SO-250522-003", partner: "Lê Văn D", total: "15.500.000 đ", status: { label: t("status.delivering"), color: STATUS_STYLES.delivering }, date: "22/05/2025" },
    { code: "SO-250521-004", partner: "Phạm Văn E", total: "7.250.000 đ", status: { label: t("status.cancelled"), color: STATUS_STYLES.cancelled }, date: "21/05/2025" },
  ];

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard
          icon={DollarSign}
          iconBg="bg-amber-50"
          iconColor="text-amber-500"
          label={t("kpi.revenue_today")}
          value={isLoading ? "—" : formatVnd(data?.revenue ?? 12540000)}
          trend={{ dir: "up", text: `18.6% ${t("kpi.vs_yesterday")}` }}
        />
        <KpiCard
          icon={TrendingUp}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-500"
          label={t("kpi.profit_today")}
          value={isLoading ? "—" : formatVnd(data?.profit ?? 3250000)}
          trend={{ dir: "up", text: `15.3% ${t("kpi.vs_yesterday")}` }}
        />
        <KpiCard
          icon={Package}
          iconBg="bg-orange-50"
          iconColor="text-orange-500"
          label={t("kpi.inventory_value")}
          value={isLoading ? "—" : formatVnd(data?.inventoryValue ?? 1235750000)}
          trend={{ dir: "up", text: `2.1% ${t("kpi.vs_yesterday")}` }}
        />
        <KpiCard
          icon={Monitor}
          iconBg="bg-purple-50"
          iconColor="text-purple-500"
          label={t("kpi.finished_pc")}
          value={isLoading ? "—" : formatNumber(data?.machineCount ?? 28)}
          trend={{ dir: "up", text: `4 ${t("kpi.new_assembled")}` }}
        />
        <KpiCard
          icon={Cpu}
          iconBg="bg-rose-50"
          iconColor="text-rose-500"
          label={t("kpi.component_stock")}
          value={isLoading ? "—" : formatNumber(data?.componentCount ?? 1256)}
          trend={{ dir: "down", text: `23 ${t("kpi.low_stock_alert")}` }}
        />
      </div>

      {/* Charts + alerts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Line chart */}
        <div className="card-soft p-6 lg:col-span-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900">{t("chart.revenue_profit")}</h3>
            <select className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-100">
              <option>{t("chart.range.7days")}</option>
              <option>{t("chart.range.30days")}</option>
            </select>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={CHART_DATA} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}M`} />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="revenue" name={t("chart.revenue")} stroke="#0ea5e9" strokeWidth={2.5} dot={{ r: 4, fill: "#0ea5e9" }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="profit" name={t("chart.profit")} stroke="#10b981" strokeWidth={2.5} dot={{ r: 4, fill: "#10b981" }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Donut chart */}
        <div className="card-soft p-6 lg:col-span-4">
          <h3 className="mb-4 text-base font-semibold text-slate-900">{t("chart.order_status")}</h3>
          <div className="flex items-center gap-4">
            <div className="relative h-44 w-44">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={2} dataKey="value">
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
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
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
                  <span className="flex-1 text-slate-600">{p.name}</span>
                  <span className="font-medium text-slate-900">
                    {p.value} ({((p.value / totalOrders) * 100).toFixed(1)}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Alerts */}
        <div className="card-soft p-6 lg:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900">{t("alert.title")}</h3>
            <Link href="/audit-logs" className="text-xs font-medium text-sky-600 hover:text-sky-700">
              {t("alert.view_all")}
            </Link>
          </div>
          <div className="space-y-2">
            {alerts.map((a, i) => {
              const Icon = a.icon;
              return (
                <Link key={i} href={a.href} className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-slate-50">
                  <div className={cn("flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg", a.iconBg)}>
                    <Icon className={cn("h-4 w-4", a.iconColor)} />
                  </div>
                  <span className="flex-1 truncate text-sm text-slate-700">{a.label}</span>
                  <span className={cn("flex h-6 min-w-[24px] items-center justify-center rounded-md px-2 text-xs font-semibold", a.badgeColor)}>
                    {a.count}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent orders tables */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <RecentOrdersCard title={t("recent.purchase")} viewAllHref="/purchases" partnerLabel={t("recent.supplier")} t={t} rows={recentPurchases} />
        <RecentOrdersCard title={t("recent.sale")} viewAllHref="/sales" partnerLabel={t("recent.customer")} t={t} rows={recentSales} />
      </div>

      {/* Quick actions */}
      <div className="card-soft p-6">
        <h3 className="mb-4 text-base font-semibold text-slate-900">{t("quick.title")}</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
          {QUICK_ACTIONS.map((a) => {
            const Icon = a.icon;
            return (
              <Link
                key={a.key}
                href={a.href}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 transition-colors hover:bg-slate-50"
              >
                <div className={cn("flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full", a.iconBg)}>
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

function RecentOrdersCard({
  title,
  viewAllHref,
  partnerLabel,
  rows,
  t,
}: {
  title: string;
  viewAllHref: string;
  partnerLabel: string;
  rows: RecentOrder[];
  t: (k: string) => string;
}) {
  return (
    <div className="card-soft">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <Link href={viewAllHref} className="text-xs font-medium text-sky-600 hover:text-sky-700">
          {t("alert.view_all")}
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500">
              <th className="px-5 py-3 font-medium">{t("recent.code")}</th>
              <th className="px-5 py-3 font-medium">{partnerLabel}</th>
              <th className="px-5 py-3 font-medium">{t("recent.total")}</th>
              <th className="px-5 py-3 font-medium">{t("recent.status")}</th>
              <th className="px-5 py-3 font-medium">{t("recent.date")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.code} className="hover:bg-slate-50">
                <td className="px-5 py-3 font-medium text-sky-600">{r.code}</td>
                <td className="px-5 py-3 text-slate-700">{r.partner}</td>
                <td className="px-5 py-3 text-slate-900">{r.total}</td>
                <td className="px-5 py-3">
                  <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset", r.status.color)}>
                    {r.status.label}
                  </span>
                </td>
                <td className="px-5 py-3 text-slate-500">{r.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
