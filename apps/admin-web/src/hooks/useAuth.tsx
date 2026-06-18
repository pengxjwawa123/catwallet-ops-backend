import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { storage } from '@/utils/storage';
import { parseJwt, getRoles, isSuperAdmin } from '@/utils/jwt';

interface AuthState {
  accessToken: string | null;
  username: string | null;
  roles: string[];
  superAdmin: boolean;
}

interface AuthContextValue extends AuthState {
  setTokens: (access: string, refresh: string) => void;
  clearAuth: () => void;
  hasPermission: (role: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    const token = storage.getAccess();
    if (!token) return { accessToken: null, username: null, roles: [], superAdmin: false };
    const payload = parseJwt(token);
    return {
      accessToken: token,
      username: payload?.username ?? null,
      roles: payload?.roles ?? [],
      superAdmin: payload?.roles?.includes('superadmin') ?? false,
    };
  });

  const setTokens = useCallback((access: string, refresh: string) => {
    storage.setAccess(access);
    storage.setRefresh(refresh);
    const payload = parseJwt(access);
    setState({
      accessToken: access,
      username: payload?.username ?? null,
      roles: payload?.roles ?? [],
      superAdmin: payload?.roles?.includes('superadmin') ?? false,
    });
  }, []);

  const clearAuth = useCallback(() => {
    storage.clear();
    setState({ accessToken: null, username: null, roles: [], superAdmin: false });
  }, []);

  const hasPermission = useCallback(
    (role: string) => state.superAdmin || state.roles.includes(role),
    [state.superAdmin, state.roles],
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
