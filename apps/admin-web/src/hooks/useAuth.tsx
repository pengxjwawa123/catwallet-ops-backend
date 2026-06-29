import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { storage, ACCESS_TOKEN_CHANGED } from '@/utils/storage';
import { parseJwt } from '@/utils/jwt';
import { authApi } from '@/api';

interface AuthState {
  accessToken: string | null;
  username: string | null;
  roles: string[];
  permissions: string[];
  superAdmin: boolean;
  permissionsLoaded: boolean;
}

interface AuthContextValue extends AuthState {
  setTokens: (access: string, refresh: string) => void;
  clearAuth: () => void;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function stateFromToken(token: string | null): AuthState {
  if (!token) {
    return {
      accessToken: null,
      username: null,
      roles: [],
      permissions: [],
      superAdmin: false,
      permissionsLoaded: true,
    };
  }
  const payload = parseJwt(token);
  const roles = payload?.roles ?? [];
  return {
    accessToken: token,
    username: payload?.username ?? null,
    roles,
    permissions: [],
    superAdmin: roles.includes('superadmin'),
    // Permissions are not in the JWT; they load via /auth/me. Until then the
    // menu/guards should treat permission state as not-yet-known.
    permissionsLoaded: false,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(() => stateFromToken(storage.getAccess()));

  // Load effective permissions from the backend whenever we hold a token.
  const loadPermissions = useCallback(async () => {
    try {
      const me = await authApi.me();
      setState((prev) => ({
        ...prev,
        username: me.username ?? prev.username,
        roles: me.roles ?? prev.roles,
        permissions: me.permissions ?? [],
        superAdmin: (me.roles ?? prev.roles).includes('superadmin'),
        permissionsLoaded: true,
      }));
    } catch {
      // Token invalid/expired (401) → http interceptor redirects to login.
      // Other errors (5xx/network) already surface a toast via the interceptor;
      // mark loaded so the UI stops waiting rather than hanging on a blank menu.
      setState((prev) => ({ ...prev, permissionsLoaded: true }));
    }
  }, []);

  useEffect(() => {
    if (state.accessToken) {
      void loadPermissions();
    }
    // Only re-run when the token identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.accessToken]);

  // Re-sync when the token changes outside this provider (notably the http
  // interceptor's silent refresh, which writes storage directly). Re-deriving
  // from the new token flips state.accessToken and retriggers loadPermissions,
  // so a mid-session role/permission change is reflected without a reload.
  useEffect(() => {
    const onTokenChanged = () => {
      const token = storage.getAccess();
      setState((prev) => {
        if (token === prev.accessToken) return prev;
        return stateFromToken(token);
      });
    };
    window.addEventListener(ACCESS_TOKEN_CHANGED, onTokenChanged);
    return () => window.removeEventListener(ACCESS_TOKEN_CHANGED, onTokenChanged);
  }, []);

  const setTokens = useCallback((access: string, refresh: string) => {
    storage.setAccess(access);
    storage.setRefresh(refresh);
    setState(stateFromToken(access));
  }, []);

  const clearAuth = useCallback(() => {
    storage.clear();
    setState({
      accessToken: null,
      username: null,
      roles: [],
      permissions: [],
      superAdmin: false,
      permissionsLoaded: true,
    });
  }, []);

  const hasPermission = useCallback(
    (permission: string) => state.superAdmin || state.permissions.includes(permission),
    [state.superAdmin, state.permissions],
  );

  return (
    <AuthContext.Provider value={{ ...state, setTokens, clearAuth, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
