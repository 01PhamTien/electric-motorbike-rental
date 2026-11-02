import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '../../services/api';

export type AppRole = 'CUSTOMER' | 'STAFF' | 'ADMIN';
export type CurrentUser = {
  id: number;
  fullName: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  role: AppRole;
  stationId: number | null;
  status: 'ACTIVE' | 'LOCKED';
  station?: { id: number; name: string } | null;
};

type AuthContextValue = {
  user: CurrentUser | null;
  loading: boolean;
  refreshUser: () => Promise<CurrentUser | null>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    localStorage.removeItem('accessToken');
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!localStorage.getItem('accessToken')) {
      setUser(null);
      setLoading(false);
      return null;
    }
    try {
      const response = await api.get<CurrentUser>('/users/me');
      if (response.data.status !== 'ACTIVE') {
        logout();
        return null;
      }
      setUser(response.data);
      return response.data;
    } catch {
      logout();
      return null;
    } finally {
      setLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  return <AuthContext.Provider value={{ user, loading, refreshUser, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth phải được sử dụng bên trong AuthProvider');
  return value;
}

export function roleHome(role?: AppRole | null) {
  if (role === 'ADMIN') return '/admin/dashboard';
  if (role === 'STAFF') return '/staff/workspace';
  if (role === 'CUSTOMER') return '/vehicles';
  return '/login';
}
