import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { roleHome, useAuth, type AppRole } from '../features/auth/AuthContext';

const roleLabels: Record<AppRole, string> = {
  CUSTOMER: 'Khách hàng',
  STAFF: 'Nhân viên vận hành',
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
    `group inline-flex shrink-0 items-center rounded-xl px-3.5 py-2.5 text-[13px] font-semibold transition-all duration-150 ${
      isActive
        ? 'bg-blue-700 text-white shadow-sm shadow-blue-950/15'
        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-950'
    }`;

  return <div className="flex min-h-screen flex-col bg-[#f5f7fb]">
    <header className="sticky top-0 z-[1000] border-b border-slate-200/80 bg-white/95 shadow-[0_4px_20px_rgba(15,23,42,0.035)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <button type="button" onClick={() => navigate(user ? roleHome(user.role) : '/vehicles')} className="group flex shrink-0 items-center gap-3 text-left">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-lg font-black tracking-tight text-white shadow-lg shadow-blue-700/20 transition group-hover:-translate-y-0.5">EV</span>
          <span><span className="block text-[15px] font-black tracking-[0.08em] text-slate-950">EV RENTAL</span><span className="mt-0.5 block text-[9px] font-bold tracking-[0.19em] text-slate-400">ELECTRIC MOBILITY</span></span>
        </button>

        <div className="flex min-w-0 items-center gap-3">
          {user ? <>
            <button type="button" onClick={() => navigate('/profile')} className="flex min-w-0 items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition hover:bg-slate-50" title="Hồ sơ cá nhân">
              {user.avatarUrl
                ? <img src={((import.meta.env.VITE_API_URL || 'http://localhost:3000/api').split('/api')[0] + user.avatarUrl)} alt="" className="h-9 w-9 shrink-0 rounded-full border border-slate-200 object-cover" />
                : <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-black text-blue-700">{user.fullName.charAt(0).toUpperCase()}</span>}
              <span className="hidden min-w-0 text-right sm:block">
                <span className="block max-w-48 truncate text-sm font-bold text-slate-800">{user.fullName}</span>
                <span className="mt-0.5 block text-[11px] font-medium text-slate-500">{roleLabels[user.role]}{user.role === 'STAFF' && user.station?.name ? ` · ${user.station.name}` : ''}</span>
              </span>
            </button>
            <span className="hidden h-9 w-px bg-slate-200 sm:block" />
            <button onClick={signOut} className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700">Đăng xuất</button>
          </> : <>
            <button onClick={() => navigate('/login')} className="rounded-xl px-3 py-2.5 text-xs font-bold text-slate-600 transition hover:bg-slate-100">Đăng nhập</button>
            <button onClick={() => navigate('/register')} className="rounded-xl bg-blue-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-blue-800">Đăng ký</button>
          </>}
        </div>
      </div>

      <div className="border-t border-slate-100 bg-white">
        <nav aria-label="Điều hướng chính" className="mx-auto flex max-w-[1600px] items-center gap-1 overflow-x-auto px-4 py-2 [scrollbar-width:thin] sm:px-6 lg:px-8">
          <NavLink to="/vehicles" className={linkClass}>Xe điện</NavLink>
          <NavLink to="/stations" className={linkClass}>Điểm thuê</NavLink>
          {user?.role === 'CUSTOMER' && <NavLink to="/bookings/my" className={linkClass}>Đơn thuê của tôi</NavLink>}
          {(user?.role === 'STAFF' || user?.role === 'ADMIN') && <>
            <span className="mx-1 h-5 w-px shrink-0 bg-slate-200" />
            <span className="shrink-0 px-2 text-[10px] font-black tracking-[0.14em] text-slate-400">VẬN HÀNH</span>
            <NavLink to="/staff/workspace" className={linkClass}>Bàn giao xe</NavLink>
            <NavLink to="/staff/payments" className={linkClass}>Thanh toán</NavLink>
            <NavLink to="/maintenance" className={linkClass}>Bảo dưỡng</NavLink>
            <NavLink to="/locations" className={linkClass}>Vị trí xe</NavLink>
          </>}
          {user?.role === 'ADMIN' && <>
            <span className="mx-1 h-5 w-px shrink-0 bg-slate-200" />
            <span className="shrink-0 px-2 text-[10px] font-black tracking-[0.14em] text-slate-400">QUẢN TRỊ</span>
            <NavLink to="/admin/dashboard" className={linkClass}>Tổng quan</NavLink>
            <NavLink to="/admin/bookings" className={linkClass}>Đơn thuê</NavLink>
            <NavLink to="/admin/vehicles" className={linkClass}>Đội xe</NavLink>
            <NavLink to="/admin/vehicle-models" className={linkClass}>Dòng xe</NavLink>
            <NavLink to="/admin/stations" className={linkClass}>Điểm thuê</NavLink>
            <NavLink to="/admin/staff" className={linkClass}>Nhân viên</NavLink>
          </>}
        </nav>
      </div>
    </header>

    <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-9">
      <div className="min-h-[calc(100vh-250px)]"><Outlet /></div>
    </main>

    <footer className="mt-auto border-t border-slate-200/80 bg-white">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-5 text-xs text-slate-400 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-900 text-[9px] font-black text-white">EV</span><span>© {new Date().getFullYear()} EV Rental Đà Nẵng</span></div>
        <span className="font-medium">Di chuyển xanh · Trải nghiệm thông minh</span>
      </div>
    </footer>
  </div>;
}
