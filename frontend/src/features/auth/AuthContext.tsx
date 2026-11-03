import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from '../../services/api';

export type AuthRole = 'CUSTOMER' | 'STAFF' | 'ADMIN';
type CurrentUser = { id: number; fullName: string; email: string; role: AuthRole; stationId: number | null };
type AuthContextValue = {
  user: CurrentUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => void;
};
const AuthContext = createContext<AuthContextValue | null>(null);

function isUser(data: unknown): data is CurrentUser {
  if (!data || typeof data !== 'object') return false;
  const value = data as Partial<CurrentUser>;
  return typeof value.id === 'number' && typeof value.email === 'string'
    && (value.role === 'ADMIN' || value.role === 'STAFF' || value.role === 'CUSTOMER');
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    if (!localStorage.getItem('accessToken')) {
      setUser(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await api.get('/users/me');
      if (!isUser(response.data)) throw new Error('Invalid user data');
      setUser(response.data);
    } catch {
      // No role or identity is trusted unless verified against the API.
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  const logout = useCallback(() => {
    localStorage.removeItem('accessToken');
    setUser(null);
    setLoading(false);
  }, []);
  return <AuthContext.Provider value={{ user, loading, refresh, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
