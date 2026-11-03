import type { ReactNode } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { getSessionRole, type SessionRole } from '../services/session';

export function RoleRoute({ allowed, children }: { allowed: Exclude<SessionRole, null>[]; children: ReactNode }) {
  if (!localStorage.getItem('accessToken')) return <Navigate to="/login" replace />;
  const role = getSessionRole();
  if (!role || !allowed.includes(role)) {
    return <div className="container-page py-28 text-center"><p className="eyebrow">KHÔNG CÓ QUYỀN TRUY CẬP</p><h1 className="mt-4 text-3xl font-extrabold">Khu vực dành cho nhân viên.</h1><p className="mt-4 text-slate-500">Tài khoản của bạn chưa có quyền xem màn hình này.</p><Link to="/" className="btn-primary mt-8">Về trang chủ</Link></div>;
  }
  return <>{children}</>;
}
