// Canonical permission strings — must stay in sync with the backend
// (apps/api/prisma/seed.ts PERMISSIONS and the @RequirePermission decorators).
// Centralized here so frontend gating cannot drift from backend enforcement.

export const PERMISSIONS = {
  opsUser: {
    create: 'ops_user:create',
    read: 'ops_user:read',
    update: 'ops_user:update',
    delete: 'ops_user:delete',
  },
  rbac: {
    manage: 'rbac:manage',
  },
  role: {
    assign: 'role:assign',
  },
  audit: {
    read: 'audit:read',
  },
  featureFlag: {
    read: 'feature_flag:read',
    manage: 'feature_flag:manage',
  },
  remoteConfig: {
    read: 'remote_config:read',
    manage: 'remote_config:manage',
  },
  announcement: {
    read: 'announcement:read',
    manage: 'announcement:manage',
  },
  i18n: {
    read: 'i18n:read',
    manage: 'i18n:manage',
  },
  app: {
    upload: 'app:upload',
  },
  job: {
    read: 'job:read',
    manage: 'job:manage',
  },
} as const;

export type PermissionString =
  | typeof PERMISSIONS.opsUser[keyof typeof PERMISSIONS.opsUser]
  | typeof PERMISSIONS.rbac[keyof typeof PERMISSIONS.rbac]
  | typeof PERMISSIONS.role[keyof typeof PERMISSIONS.role]
  | typeof PERMISSIONS.audit[keyof typeof PERMISSIONS.audit]
  | typeof PERMISSIONS.featureFlag[keyof typeof PERMISSIONS.featureFlag]
  | typeof PERMISSIONS.remoteConfig[keyof typeof PERMISSIONS.remoteConfig]
  | typeof PERMISSIONS.announcement[keyof typeof PERMISSIONS.announcement]
  | typeof PERMISSIONS.i18n[keyof typeof PERMISSIONS.i18n]
  | typeof PERMISSIONS.app[keyof typeof PERMISSIONS.app]
  | typeof PERMISSIONS.job[keyof typeof PERMISSIONS.job];
