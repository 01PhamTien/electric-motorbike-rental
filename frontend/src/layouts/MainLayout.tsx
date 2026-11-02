import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { roleHome, useAuth, type AppRole } from '../features/auth/AuthContext';

const roleLabels: Record<AppRole, string> = {
  CUSTOMER: 'Khách hàng',
  STAFF: 'Nhân viên',
  ADMIN: 'Quản trị viên',
};

export function MainLayout() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  function signOut() {
    logout();
    navigate('/login', { replace: true });
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${isActive
      ? 'bg-blue-50 text-blue-700'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'}`;

  return <div className="min-h-screen bg-slate-50">
    <header className="sticky top-0 z-[1000] border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-8">
        <button type="button" onClick={() => navigate(user ? roleHome(user.role) : '/vehicles')} className="flex items-center gap-3 rounded-lg p-1 text-left">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-700 text-lg font-black text-white">EV</span>
          <span><span className="block text-base font-extrabold tracking-tight text-slate-900">EV RENTAL</span><span className="block text-[11px] font-medium tracking-wide text-slate-500">ĐÀ NẴNG · ELECTRIC MOBILITY</span></span>
        </button>

        <nav className="order-3 flex w-full flex-wrap items-center gap-1 border-t border-slate-100 pt-2 lg:order-2 lg:w-auto lg:border-0 lg:pt-0">
          <NavLink to="/vehicles" className={linkClass}>Xe điện</NavLink>
          <NavLink to="/stations" className={linkClass}>Điểm thuê</NavLink>
          {user?.role === 'CUSTOMER' && <NavLink to="/bookings/my" className={linkClass}>Đơn thuê của tôi</NavLink>}
          {(user?.role === 'STAFF' || user?.role === 'ADMIN') && <>
            <NavLink to="/staff/workspace" className={linkClass}>Vận hành</NavLink>
            <NavLink to="/staff/payments" className={linkClass}>Thanh toán</NavLink>
            <NavLink to="/maintenance" className={linkClass}>Bảo dưỡng</NavLink>
            <NavLink to="/locations" className={linkClass}>Vị trí xe</NavLink>
          </>}
          {user?.role === 'ADMIN' && <>
            <NavLink to="/admin/dashboard" className={linkClass}>Báo cáo</NavLink>
            <NavLink to="/admin/staff" className={linkClass}>Nhân viên</NavLink>
            <NavLink to="/admin/vehicles" className={linkClass}>Đội xe</NavLink>
            <NavLink to="/admin/vehicle-models" className={linkClass}>Dòng xe</NavLink>
            <NavLink to="/admin/stations" className={linkClass}>Điểm thuê</NavLink>
          </>}
        </nav>

        <div className="order-2 flex items-center gap-2 lg:order-3">
          {user ? <>
            <div className="hidden text-right sm:block">
              <p className="max-w-40 truncate text-sm font-semibold text-slate-800">{user.fullName}</p>
              <p className="text-xs text-slate-500">{roleLabels[user.role]}{user.role === 'STAFF' && user.station?.name ? ` · ${user.station.name}` : ''}</p>
            </div>
            <button onClick={signOut} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Đăng xuất</button>
          </> : <>
            <button onClick={() => navigate('/login')} className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">Đăng nhập</button>
            <button onClick={() => navigate('/register')} className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800">Đăng ký</button>
          </>}
        </div>
      </div>
    </header>
    <main className="mx-auto min-h-[calc(100vh-150px)] max-w-[1440px] px-4 py-6 lg:px-8 lg:py-8"><Outlet /></main>
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-slate-500 lg:px-8">
        <span>© {new Date().getFullYear()} EV Rental Đà Nẵng</span>
        <span>Hệ thống quản lý và cho thuê xe máy điện</span>
      </div>
    </footer>
  </div>;
}
