"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { PageHeader } from "@/components/layout/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/use-auth";
import { isAdmin } from "@/lib/permissions";
import { usePageMeta } from "@/lib/page-title-context";

export default function SettingsPage() {
  usePageMeta("Cài đặt", "Quản lý hệ thống");
  const { roles, isLoading } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (!isLoading && !isAdmin(roles)) router.replace("/dashboard");
  }, [roles, isLoading, router]);

  if (!isAdmin(roles)) return null;

  return (
    <div>
      <PageHeader title="Cài đặt" description="Quản lý người dùng và phân quyền" />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Người dùng</CardTitle>
            <CardDescription>Tạo, sửa, vô hiệu hóa người dùng</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/settings/users">Quản lý người dùng</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Vai trò</CardTitle>
            <CardDescription>Quản lý vai trò và quyền</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/settings/roles">Quản lý vai trò</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
