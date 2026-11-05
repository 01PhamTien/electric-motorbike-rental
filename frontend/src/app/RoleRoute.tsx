import type { ReactNode } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth, type AuthRole } from '../features/auth/AuthContext';

export function RoleRoute({ allowed, children }: { allowed: AuthRole[]; children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div role="status" className="container-page py-24 text-center text-slate-600">Đang xác minh quyền truy cập...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!allowed.includes(user.role)) {
    const workspace = user.role === 'ADMIN' ? '/admin' : user.role === 'STAFF' ? '/operations' : '/';
    const workspaceLabel = user.role === 'ADMIN' ? 'Trung tâm quản trị' : user.role === 'STAFF' ? 'Khu vực vận hành' : 'Trang chủ';
    return <section className="container-page flex min-h-[58vh] items-center justify-center py-16">
      <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white px-7 py-12 text-center shadow-sm sm:px-12">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-2xl text-amber-700" aria-hidden="true">!</div>
        <p className="mt-6 text-xs font-extrabold tracking-[0.2em] text-emerald-700">KHU VỰC RIÊNG THEO VAI TRÒ</p>
        <h1 className="mt-3 text-2xl font-extrabold text-slate-900 sm:text-3xl">Tài khoản hiện tại không có quyền vào trang này.</h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-slate-500">Đây là chức năng dành cho vai trò khác. Bạn vẫn có thể sử dụng các chức năng thuộc khu vực làm việc của mình bằng menu phía trên.</p>
        <Link to={workspace} className="btn-primary mt-8 inline-flex">{workspaceLabel}</Link>
      </div>
    </section>;
  }
  return <>{children}</>;
}
