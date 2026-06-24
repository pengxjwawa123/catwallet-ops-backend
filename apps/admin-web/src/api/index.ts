import http from './http';
import type { LoginResponse, OpsUser, PagedData, Role, Permission, AuditLog, FeatureFlag, RemoteConfig, Announcement, Job, I18nEntry, I18nConfigResponse } from '@/utils/types';

// ── Auth ──────────────────────────────────────────────────────────────────────

export const authApi = {
  login: (username: string, password: string) =>
    http.post<unknown, LoginResponse>('/auth/login', { username, password }),

  verify2FA: (userId: string, token: string) =>
    http.post<unknown, LoginResponse>('/auth/2fa/verify', { userId, token }),

  refresh: (refreshToken: string) =>
    http.post<unknown, LoginResponse>('/auth/refresh', { refreshToken }),

  logout: (refreshToken: string) =>
    http.post('/auth/logout', { refreshToken }),

  setup2FA: () =>
    http.post<unknown, { otpauthUrl: string; secret: string }>('/auth/2fa/setup'),

  enable2FA: (token: string) =>
    http.post('/auth/2fa/enable', { token }),
};

// ── Ops Users ─────────────────────────────────────────────────────────────────

export const opsUsersApi = {
  list: (params: { page?: number; pageSize?: number }) =>
    http.get<unknown, PagedData<OpsUser>>('/ops-users', { params }),

  get: (id: string) =>
    http.get<unknown, OpsUser>(`/ops-users/${id}`),

  create: (data: { username: string; email?: string; password: string; roleName?: string }) =>
    http.post<unknown, OpsUser>('/ops-users', data),

  update: (id: string, data: { email?: string; roleName?: string }) =>
    http.put<unknown, OpsUser>(`/ops-users/${id}`, data),

  resetPassword: (id: string, password: string) =>
    http.patch(`/ops-users/${id}/password`, { password }),

  setStatus: (id: string, status: 'ACTIVE' | 'INACTIVE') =>
    http.patch(`/ops-users/${id}/status`, { status }),

  remove: (id: string) =>
    http.delete(`/ops-users/${id}`),
};

// ── RBAC ──────────────────────────────────────────────────────────────────────

export const rolesApi = {
  list: () =>
    http.get<unknown, Role[]>('/rbac/roles'),

  get: (id: string) =>
    http.get<unknown, Role>(`/rbac/roles/${id}`),

  create: (data: { name: string; description?: string }) =>
    http.post<unknown, Role>('/rbac/roles', data),

  update: (id: string, data: { description?: string }) =>
    http.put<unknown, Role>(`/rbac/roles/${id}`, data),

  remove: (id: string) =>
    http.delete(`/rbac/roles/${id}`),

  assignPermission: (id: string, permissionId: string) =>
    http.post(`/rbac/roles/${id}/permissions`, { permissionId }),

  removePermission: (id: string, permissionId: string) =>
    http.delete(`/rbac/roles/${id}/permissions/${permissionId}`),

  assignRoleToUser: (userId: string, roleId: string) =>
    http.post(`/rbac/roles/users/${userId}/assign`, { roleId }),

  removeRoleFromUser: (userId: string, roleId: string) =>
    http.delete(`/rbac/roles/users/${userId}/roles/${roleId}`),
};

export const permissionsApi = {
  list: () =>
    http.get<unknown, Permission[]>('/rbac/permissions'),

  create: (data: { name: string; description?: string }) =>
    http.post<unknown, Permission>('/rbac/permissions', data),

  remove: (id: string) =>
    http.delete(`/rbac/permissions/${id}`),
};

// ── Audit ─────────────────────────────────────────────────────────────────────

export const auditApi = {
  list: (params: {
    page?: number;
    pageSize?: number;
    actorId?: string;
    action?: string;
    target?: string;
    from?: string;
    to?: string;
  }) => http.get<unknown, PagedData<AuditLog>>('/audit-logs', { params }),
};

// ── Feature Flags ─────────────────────────────────────────────────────────────

export const featureFlagsApi = {
  list: (params: { page?: number; pageSize?: number }) =>
    http.get<unknown, PagedData<FeatureFlag>>('/feature-flags', { params }),

  get: (id: string) =>
    http.get<unknown, FeatureFlag>(`/feature-flags/${id}`),

  create: (data: { key: string; description?: string; payload?: unknown }) =>
    http.post<unknown, FeatureFlag>('/feature-flags', data),

  update: (id: string, data: Partial<{ key: string; description: string; payload: unknown }>) =>
    http.put<unknown, FeatureFlag>(`/feature-flags/${id}`, data),

  toggle: (id: string, status: 'ENABLED' | 'DISABLED') =>
    http.patch<unknown, FeatureFlag>(`/feature-flags/${id}/toggle`, { status }),

  remove: (id: string) =>
    http.delete(`/feature-flags/${id}`),
};

// ── Remote Configs ────────────────────────────────────────────────────────────

export const remoteConfigsApi = {
  list: (params: { page?: number; pageSize?: number }) =>
    http.get<unknown, PagedData<RemoteConfig>>('/remote-configs', { params }),

  get: (id: string) =>
    http.get<unknown, RemoteConfig>(`/remote-configs/${id}`),

  create: (data: { key: string; value: string; description?: string }) =>
    http.post<unknown, RemoteConfig>('/remote-configs', data),

  update: (id: string, data: Partial<{ key: string; value: string; description: string }>) =>
    http.put<unknown, RemoteConfig>(`/remote-configs/${id}`, data),

  remove: (id: string) =>
    http.delete(`/remote-configs/${id}`),
};

// ── Announcements ─────────────────────────────────────────────────────────────

export const announcementsApi = {
  list: (params: { page?: number; pageSize?: number; status?: string }) =>
    http.get<unknown, PagedData<Announcement>>('/announcements', { params }),

  get: (id: string) =>
    http.get<unknown, Announcement>(`/announcements/${id}`),

  create: (data: { title: string; content: string }) =>
    http.post<unknown, Announcement>('/announcements', data),

  update: (id: string, data: Partial<{ title: string; content: string }>) =>
    http.put<unknown, Announcement>(`/announcements/${id}`, data),

  publish: (id: string) =>
    http.patch(`/announcements/${id}/publish`),

  unpublish: (id: string) =>
    http.patch(`/announcements/${id}/unpublish`),

  archive: (id: string) =>
    http.patch(`/announcements/${id}/archive`),

  remove: (id: string) =>
    http.delete(`/announcements/${id}`),
};

// ── I18n ──────────────────────────────────────────────────────────────────────

export const i18nApi = {
  getConfig: (language?: string) =>
    http.post<unknown, I18nConfigResponse>('/i18n/config', { language }),

  list: (params: { page?: number; pageSize?: number }) =>
    http.get<unknown, PagedData<I18nEntry>>('/i18n', { params }),

  get: (id: string) =>
    http.get<unknown, I18nEntry>(`/i18n/${id}`),

  getByKey: (key: string) =>
    http.get<unknown, { key: string; translations: Record<string, string> }>(`/i18n/key/${encodeURIComponent(key)}`),

  upsertKey: (data: { key: string; translations: Record<string, string> }) =>
    http.post<unknown, I18nEntry[]>('/i18n/key', data),

  create: (data: { key: string; language: string; value: string }) =>
    http.post<unknown, I18nEntry>('/i18n', data),

  update: (id: string, data: { value?: string }) =>
    http.put<unknown, I18nEntry>(`/i18n/${id}`, data),

  removeByKey: (key: string) =>
    http.delete(`/i18n/key/${encodeURIComponent(key)}`),

  remove: (id: string) =>
    http.delete(`/i18n/${id}`),
};

// ── Jobs ──────────────────────────────────────────────────────────────────────

export const jobsApi = {
  list: (params: { page?: number; pageSize?: number; queue?: string; status?: string }) =>
    http.get<unknown, PagedData<Job>>('/jobs', { params }),

  get: (id: string) =>
    http.get<unknown, Job>(`/jobs/${id}`),

  enqueue: (data: { name: string; payload?: unknown }) =>
    http.post<unknown, Job>('/jobs', data),
};
