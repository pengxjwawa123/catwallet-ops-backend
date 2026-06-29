// Unified API response shapes

export interface ApiResponse<T> {
  data: T;
  timestamp: string;
}

export interface ApiError {
  code: string;
  message: string;
  timestamp: string;
  path: string;
}

export interface PagedData<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Auth
export interface LoginResponse {
  accessToken?: string;
  refreshToken?: string;
  requires2FA?: boolean;
  userId?: string;
}

export interface JwtPayload {
  sub: string;
  username: string;
  roles: string[];
}

export interface MeResponse {
  userId: string;
  username: string;
  roles: string[];
  permissions: string[];
}

// Ops Users
export interface OpsUser {
  id: string;
  username: string;
  email?: string;
  status: 'ACTIVE' | 'INACTIVE';
  roles: Role[];
  twoFactorEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

// RBAC
export interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: Permission[];
  createdAt: string;
}

export interface Permission {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
}

// Audit
export interface AuditLog {
  id: string;
  actorId: string;
  actorUsername?: string;
  action: string;
  target: string;
  targetId?: string;
  before?: unknown;
  after?: unknown;
  ip?: string;
  userAgent?: string;
  createdAt: string;
}

// Feature Flags
export interface FeatureFlag {
  id: string;
  key: string;
  description?: string;
  status: 'ENABLED' | 'DISABLED';
  payload?: unknown;
  createdAt: string;
  updatedAt: string;
}

// Remote Configs
export interface RemoteConfig {
  id: string;
  key: string;
  value: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

// Announcements
export interface Announcement {
  id: string;
  title: string;
  content: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;
}

// I18n
export interface I18nConfigItem {
  id: number;
  platformSource: string;
  configKey: string;
  lang: string;
  value: string;
  version: number;
  createTime: string;
  updateTime: string;
}

export interface I18nOpLog {
  id: string;
  action: string;
  operator?: string;
  key?: string;
  detail?: unknown;
  createdAt: string;
}

// Jobs
export interface Job {
  id: string;
  name: string;
  queue: string;
  status: string;
  payload?: unknown;
  result?: unknown;
  failReason?: string;
  createdAt: string;
  updatedAt: string;
}
