"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingCart,
  HardDrive,
  Boxes,
  Wrench,
  MonitorSmartphone,
  Receipt,
  ShieldCheck,
  BarChart3,
  ScrollText,
  Settings,
  Menu,
  LogOut,
  User as UserIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
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

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  permission: string;
}

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: PERM.DASHBOARD_VIEW },
  { href: "/purchases", label: "Mua hàng", icon: ShoppingCart, permission: PERM.PURCHASE_VIEW },
  { href: "/machines", label: "Máy", icon: HardDrive, permission: PERM.MACHINE_VIEW },
  { href: "/components", label: "Kho linh kiện", icon: Boxes, permission: PERM.COMPONENT_VIEW },
  { href: "/assemblies", label: "Lắp ráp", icon: Wrench, permission: PERM.ASSEMBLY_VIEW },
  { href: "/finished-pcs", label: "Máy thành phẩm", icon: MonitorSmartphone, permission: PERM.FINISHED_PC_VIEW },
  { href: "/sales", label: "Bán hàng", icon: Receipt, permission: PERM.SALE_VIEW },
  { href: "/warranties", label: "Bảo hành", icon: ShieldCheck, permission: PERM.WARRANTY_VIEW },
  { href: "/reports", label: "Báo cáo", icon: BarChart3, permission: PERM.REPORT_VIEW },
  { href: "/audit-logs", label: "Nhật ký", icon: ScrollText, permission: PERM.AUDIT_VIEW },
  { href: "/settings", label: "Cài đặt", icon: Settings, permission: PERM.SETTING_VIEW },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 border-r bg-muted/40 md:flex md:flex-col">
        <SidebarContent />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <SidebarContent onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>
    </div>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void } = {}) {
  const pathname = usePathname();
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center border-b px-4">
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className="text-lg font-semibold tracking-tight"
        >
          Refurb ERP
        </Link>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-2">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href || pathname?.startsWith(`${item.href}/`);
          return (
            <Can key={item.href} permission={item.permission}>
              <Link
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            </Can>
          );
        })}
      </nav>
    </div>
  );
}

function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={onMenuClick}
        aria-label="Mở menu"
      >
        <Menu className="h-5 w-5" />
      </Button>
      <div className="flex-1" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="flex items-center gap-2">
            <UserIcon className="h-4 w-4" />
            <span className="hidden text-sm font-medium sm:inline">
              {user?.fullName ?? user?.email ?? "Người dùng"}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>
            <div className="flex flex-col">
              <span className="font-medium">{user?.fullName ?? "—"}</span>
              <span className="text-xs text-muted-foreground">{user?.email}</span>
              {user?.roles?.length ? (
                <span className="mt-1 text-xs text-muted-foreground">
                  {user.roles.join(", ")}
                </span>
              ) : null}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" /> Đăng xuất
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
