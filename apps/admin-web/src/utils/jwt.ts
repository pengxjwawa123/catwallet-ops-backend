import type { JwtPayload } from './types';

export function parseJwt(token: string): JwtPayload | null {
  try {
    const base64 = token.split('.')[1];
    const json = atob(base64.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

export function hasRole(token: string | null, role: string): boolean {
  if (!token) return false;
  const payload = parseJwt(token);
  return payload?.roles?.includes(role) ?? false;
}

export function isSuperAdmin(token: string | null): boolean {
  return hasRole(token, 'superadmin');
}

export function getRoles(token: string | null): string[] {
  if (!token) return [];
  return parseJwt(token)?.roles ?? [];
}
