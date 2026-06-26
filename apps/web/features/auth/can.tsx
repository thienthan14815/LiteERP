"use client";

import type { ReactNode } from "react";
import { useAuth } from "./use-auth";
import {
  hasPermission,
  hasAnyPermission,
  hasRole,
  type Role,
} from "@/lib/permissions";

interface CanProps {
  permission?: string | string[];
  anyPermission?: string[];
  role?: Role;
  fallback?: ReactNode;
  children: ReactNode;
}

export function Can({
  permission,
  anyPermission,
  role,
  fallback = null,
  children,
}: CanProps) {
  const { permissions, roles } = useAuth();

  if (permission && !hasPermission(permissions, permission)) {
    return <>{fallback}</>;
  }
  if (anyPermission && !hasAnyPermission(permissions, anyPermission)) {
    return <>{fallback}</>;
  }
  if (role && !hasRole(roles, role)) {
    return <>{fallback}</>;
  }
  return <>{children}</>;
}
