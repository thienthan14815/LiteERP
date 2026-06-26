// Permission check helper. Real implementation reads from AuthContext in Phase 1.

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
