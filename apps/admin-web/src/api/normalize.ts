import type { OpsUser, Role } from '../utils/types';

/**
 * The API returns RBAC relations using Prisma's relation names
 * (userRoles[].opsRole, rolePermissions[].opsPermission). The UI components
 * expect flattened `roles` / `permissions`. Normalize here so a backend shape
 * change is isolated to one place and the components stay simple.
 */

export function normalizeRole(raw: any): Role {
  return {
    ...raw,
    permissions:
      raw?.permissions ??
      (Array.isArray(raw?.rolePermissions)
        ? raw.rolePermissions
            .map((rp: any) => rp.opsPermission)
            .filter(Boolean)
        : []),
  };
}

export function normalizeOpsUser(raw: any): OpsUser {
  return {
    ...raw,
    roles:
      raw?.roles ??
      (Array.isArray(raw?.userRoles)
        ? raw.userRoles.map((ur: any) => ur.opsRole).filter(Boolean)
        : []),
  };
}
