import { Navigate, Outlet } from 'react-router-dom';
import { roleHome, useAuth, type AppRole } from './AuthContext';

export function RequireRole({ allowed }: { allowed: AppRole[] }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="flex min-h-[55vh] items-center justify-center">
      <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 text-sm text-slate-600 shadow-sm">
        Đang kiểm tra tài khoản và quyền truy cập...
      </div>
    </div>;
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!allowed.includes(user.role)) return <Navigate to={roleHome(user.role)} replace />;
  return <Outlet />;
}
