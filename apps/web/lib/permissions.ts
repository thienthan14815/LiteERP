import type { ReactNode } from "react";

export const PERM = {
  DASHBOARD_VIEW: "dashboard:view",

  PURCHASE_READ: "purchase:read",
  PURCHASE_CREATE: "purchase:create",
  PURCHASE_UPDATE: "purchase:update",
  PURCHASE_CONFIRM: "purchase:confirm",
  PURCHASE_CANCEL: "purchase:cancel",

  MACHINE_READ: "machine:read",
  MACHINE_INSPECT: "machine:inspect",
  MACHINE_ALLOCATE_COST: "machine:allocate_cost",
  MACHINE_DISASSEMBLE: "machine:disassemble",
  MACHINE_MARK_READY: "machine:mark_ready",

  COMPONENT_READ: "component:read",
  COMPONENT_CREATE: "component:create",
  COMPONENT_UPDATE: "component:update",
  COMPONENT_DELETE: "component:delete",
  COMPONENT_SCRAP: "component:scrap",

  ASSEMBLY_READ: "assembly:read",
  ASSEMBLY_CREATE: "assembly:create",
  ASSEMBLY_COMPLETE: "assembly:complete",

  FINISHED_PC_READ: "finished-pc:read",

  SALE_READ: "sale:read",
  SALE_CREATE: "sale:create",
  SALE_CANCEL: "sale:cancel",

  WARRANTY_READ: "warranty:read",
  WARRANTY_CREATE: "warranty:create",
  WARRANTY_UPDATE: "warranty:update",

  REPORT_VIEW: "report:view",

  SETTING_VIEW: "setting:view",
  SETTING_UPDATE: "setting:update",
  ADMIN_ALL: "*",
} as const;

export type Permission = (typeof PERM)[keyof typeof PERM];

export const ROLE = {
  ADMIN: "ADMIN",
  MANAGER: "MANAGER",
  WAREHOUSE: "WAREHOUSE",
  TECHNICIAN: "TECHNICIAN",
  SALES: "SALES",
  ACCOUNTANT: "ACCOUNTANT",
  VIEWER: "VIEWER",
} as const;

export type Role = (typeof ROLE)[keyof typeof ROLE];

export function hasPermission(
  userPermissions: string[] | undefined,
  required: string | string[],
): boolean {
  if (!userPermissions) return false;
  if (userPermissions.includes("*")) return true;
  const list = Array.isArray(required) ? required : [required];
  return list.every((perm) => userPermissions.includes(perm));
}

export function hasAnyPermission(
  userPermissions: string[] | undefined,
  required: string[],
): boolean {
  if (!userPermissions) return false;
  if (userPermissions.includes("*")) return true;
  return required.some((perm) => userPermissions.includes(perm));
}

export function hasRole(userRoles: string[] | undefined, role: Role): boolean {
  if (!userRoles) return false;
  return userRoles.includes(role);
}

export function isAdmin(userRoles: string[] | undefined): boolean {
  return hasRole(userRoles, ROLE.ADMIN);
}

export interface CanProps {
  permission?: string | string[];
  anyPermission?: string[];
  role?: Role;
  permissions: string[];
  roles?: string[];
  fallback?: ReactNode;
  children: ReactNode;
}
