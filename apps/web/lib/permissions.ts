import type { ReactNode } from "react";

export const PERM = {
  DASHBOARD_VIEW: "dashboard:view",

  USER_VIEW: "user:view",
  USER_CREATE: "user:create",
  USER_UPDATE: "user:update",
  USER_DELETE: "user:delete",

  ROLE_VIEW: "role:view",
  ROLE_CREATE: "role:create",
  ROLE_UPDATE: "role:update",
  ROLE_DELETE: "role:delete",

  SUPPLIER_VIEW: "supplier:view",
  SUPPLIER_CREATE: "supplier:create",
  SUPPLIER_UPDATE: "supplier:update",
  SUPPLIER_DELETE: "supplier:delete",

  CUSTOMER_VIEW: "customer:view",
  CUSTOMER_CREATE: "customer:create",
  CUSTOMER_UPDATE: "customer:update",
  CUSTOMER_DELETE: "customer:delete",

  PURCHASE_VIEW: "purchase:view",
  PURCHASE_CREATE: "purchase:create",
  PURCHASE_UPDATE: "purchase:update",
  PURCHASE_CONFIRM: "purchase:confirm",
  PURCHASE_CANCEL: "purchase:cancel",

  MACHINE_VIEW: "machine:view",
  MACHINE_INSPECT: "machine:inspect",
  MACHINE_ALLOCATE_COST: "machine:allocate_cost",
  MACHINE_DISASSEMBLE: "machine:disassemble",
  MACHINE_MARK_READY: "machine:mark_ready",

  COMPONENT_VIEW: "component:view",
  COMPONENT_UPDATE: "component:update",
  COMPONENT_SCRAP: "component:scrap",

  INVENTORY_VIEW: "inventory:view",
  INVENTORY_ADJUST: "inventory:adjust",

  ASSEMBLY_VIEW: "assembly:view",
  ASSEMBLY_CREATE: "assembly:create",
  ASSEMBLY_UPDATE: "assembly:update",
  ASSEMBLY_COMPLETE: "assembly:complete",
  ASSEMBLY_CANCEL: "assembly:cancel",

  FINISHED_PC_VIEW: "finished_pc:view",
  FINISHED_PC_UPDATE: "finished_pc:update",

  SALE_VIEW: "sale:view",
  SALE_CREATE: "sale:create",
  SALE_UPDATE: "sale:update",
  SALE_CANCEL: "sale:cancel",

  WARRANTY_VIEW: "warranty:view",
  WARRANTY_CREATE: "warranty:create",
  WARRANTY_UPDATE: "warranty:update",

  REPORT_VIEW: "report:view",

  AUDIT_VIEW: "audit:view",

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
