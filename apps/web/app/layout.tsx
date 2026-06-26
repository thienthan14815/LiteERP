import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AuthProvider } from "@/features/auth/auth-provider";
import { QueryProvider } from "@/features/auth/query-provider";
import { I18nProvider } from "@/lib/i18n/provider";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "PC Refurbish — Quản lý cửa hàng",
  description: "Hệ thống quản lý cửa hàng mua bán máy tính cũ",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased font-sans">
        <I18nProvider>
          <QueryProvider>
            <AuthProvider>
              {children}
              <Toaster />
            </AuthProvider>
          </QueryProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
