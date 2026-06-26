import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AuthProvider } from "@/features/auth/auth-provider";
import { QueryProvider } from "@/features/auth/query-provider";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "Hệ thống quản lý máy tính cũ",
  description: "Quản lý cửa hàng mua bán máy tính cũ",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <QueryProvider>
          <AuthProvider>
            {children}
            <Toaster />
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
