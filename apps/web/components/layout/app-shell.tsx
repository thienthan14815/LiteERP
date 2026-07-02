"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  Home,
  ShoppingCart,
  Monitor,
  Cpu,
  Warehouse,
  Wrench,
  MonitorSmartphone,
  Receipt,
  ShieldCheck,
  BarChart3,
  Wallet,
  Settings,
  History,
  Menu,
  Bell,
  Search,
  LogOut,
  ChevronDown,
  User as UserIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/features/auth/use-auth";
import { Can } from "@/features/auth/can";
import { PERM } from "@/lib/permissions";
import { useTranslation } from "@/lib/i18n/provider";
import { usePageTitle } from "@/lib/page-title-context";
import { LanguageSwitcher } from "./language-switcher";

interface NavItem {
  href: string;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string;
  hasChevron?: boolean;
}

const NAV: NavItem[] = [
  { href: "/dashboard", labelKey: "nav.home", icon: Home, permission: PERM.DASHBOARD_VIEW },
  { href: "/purchases", labelKey: "nav.purchase", icon: ShoppingCart, permission: PERM.PURCHASE_VIEW },
  { href: "/machines", labelKey: "nav.machine", icon: Monitor, permission: PERM.MACHINE_VIEW, hasChevron: true },
  { href: "/components", labelKey: "nav.component", icon: Cpu, permission: PERM.COMPONENT_VIEW, hasChevron: true },
  { href: "/components/summary", labelKey: "nav.inventory", icon: Warehouse, permission: PERM.COMPONENT_VIEW, hasChevron: true },
  { href: "/assemblies", labelKey: "nav.assembly", icon: Wrench, permission: PERM.ASSEMBLY_VIEW },
  { href: "/finished-pcs", labelKey: "nav.finished_pc", icon: MonitorSmartphone, permission: PERM.FINISHED_PC_VIEW },
  { href: "/sales", labelKey: "nav.sale", icon: Receipt, permission: PERM.SALE_VIEW, hasChevron: true },
  { href: "/warranties", labelKey: "nav.warranty", icon: ShieldCheck, permission: PERM.WARRANTY_VIEW, hasChevron: true },
  { href: "/reports", labelKey: "nav.report", icon: BarChart3, permission: PERM.REPORT_VIEW, hasChevron: true },
  { href: "/dashboard", labelKey: "nav.expense", icon: Wallet, permission: PERM.DASHBOARD_VIEW },
  { href: "/settings", labelKey: "nav.setting", icon: Settings },
  { href: "/audit-logs", labelKey: "nav.audit", icon: History },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="hidden w-[250px] shrink-0 border-r border-slate-200 bg-white md:flex md:flex-col">
        <SidebarContent />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[250px] p-0">
          <SidebarContent onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>
    </div>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void } = {}) {
  const pathname = usePathname();
  const { t } = useTranslation();
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-3 border-b border-slate-200/60 px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-white shadow-sm">
          <Monitor className="h-[18px] w-[18px]" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold text-slate-900">{t("app.name")}</span>
          <span className="text-[11px] text-slate-500">{t("app.tagline")}</span>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {NAV.map((item, idx) => {
          const Icon = item.icon;
          const active =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname?.startsWith(`${item.href}/`));
          const node = (
            <Link
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-sky-50 text-sky-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
              )}
            >
              {active && (
                <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-r-full bg-sky-500" />
              )}
              <Icon
                className={cn(
                  "h-[18px] w-[18px] flex-shrink-0",
                  active ? "text-sky-700" : "text-slate-400 group-hover:text-slate-600",
                )}
              />
              <span className="flex-1 truncate">{t(item.labelKey)}</span>
              {item.hasChevron && (
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform",
                    active ? "text-sky-500" : "text-slate-300",
                  )}
                />
              )}
            </Link>
          );
          return item.permission ? (
            <Can key={`${item.href}-${idx}`} permission={item.permission}>
              {node}
            </Can>
          ) : (
            <div key={`${item.href}-${idx}`}>{node}</div>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-slate-200/60 p-4">
        <button
          type="button"
          className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-left transition-colors hover:bg-slate-100"
        >
          <div className="text-[10px] uppercase tracking-wider text-slate-400">
            {t("branch.current")}
          </div>
          <div className="mt-0.5 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">{t("branch.main")}</span>
            <ChevronDown className="h-4 w-4 text-slate-400" />
          </div>
        </button>
      </div>
    </div>
  );
}

function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const { title, subtitle } = usePageTitle();

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const initials = (user?.fullName ?? user?.email ?? "?")
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-slate-200 bg-white px-4 md:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="text-slate-600"
        onClick={onMenuClick}
        aria-label="Menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <div className="hidden flex-col leading-tight md:flex">
        <span className="text-lg font-semibold text-slate-900">{title}</span>
        <span className="text-xs text-slate-500">{subtitle}</span>
      </div>

      <div className="ml-auto flex flex-1 items-center justify-end gap-3 md:ml-8">
        <div className="relative hidden flex-1 max-w-md md:block">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder={t("topbar.search")}
            className="h-10 w-full rounded-full border border-transparent bg-slate-100 pl-10 pr-4 text-sm text-slate-700 placeholder:text-slate-400 focus:border-sky-200 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-100"
          />
        </div>

        <LanguageSwitcher />

        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 rounded-full text-slate-600 hover:bg-slate-100"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white">
            5
          </span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-full pl-1 pr-2 py-1 transition-colors hover:bg-slate-50">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-sky-600 text-sm font-semibold text-white shadow-sm">
                {initials !== "?" ? initials : <UserIcon className="h-4 w-4" />}
              </div>
              <div className="hidden flex-col items-start leading-tight sm:flex">
                <span className="text-sm font-medium text-slate-900">
                  {user?.fullName ?? user?.email?.split("@")[0] ?? "User"}
                </span>
                <span className="text-xs text-slate-500">
                  {user?.roles?.[0]?.name ?? user?.roles?.[0]?.code ?? "—"}
                </span>
              </div>
              <ChevronDown className="hidden h-4 w-4 text-slate-400 sm:block" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="font-medium">{user?.fullName ?? "—"}</span>
                <span className="text-xs text-slate-500">{user?.email}</span>
                {user?.roles?.length ? (
                  <span className="mt-1 text-xs text-slate-500">
                    {user.roles.map((r) => r.name ?? r.code).join(", ")}
                  </span>
                ) : null}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => router.push("/settings")}>
              <UserIcon className="mr-2 h-4 w-4" /> {t("topbar.profile")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => router.push("/settings")}>
              <Settings className="mr-2 h-4 w-4" /> {t("nav.setting")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" /> {t("topbar.logout")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
