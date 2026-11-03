import type { ReactNode } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth, type AuthRole } from '../features/auth/AuthContext';

export function RoleRoute({ allowed, children }: { allowed: AuthRole[]; children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div role="status" className="container-page py-24 text-center text-slate-600">Đang xác minh quyền truy cập...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!allowed.includes(user.role)) {
    return <div className="container-page py-28 text-center">
      <p className="eyebrow">KHÔNG CÓ QUYỀN TRUY CẬP</p>
      <h1 className="mt-4 text-3xl font-extrabold">Khu vực dành cho nhân viên.</h1>
      <p className="mt-4 text-slate-500">Tài khoản của bạn chưa có quyền xem màn hình này.</p>
      <Link to="/" className="btn-primary mt-8">Về trang chủ</Link>
    </div>;
  }
  return <>{children}</>;
}
