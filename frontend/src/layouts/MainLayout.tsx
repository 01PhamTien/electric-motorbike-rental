import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Brand } from '../components/Brand';
import { useAuth } from '../features/auth/AuthContext';

const customerNav = [
  { to: '/', label: 'Trang chủ', end: true },
  { to: '/vehicles', label: 'Khám phá xe' },
  { to: '/stations', label: 'Điểm nhận xe' },
  { to: '/bookings/my', label: 'Đơn thuê của tôi' },
];

const staffNav = [
  { to: '/operations', label: 'Vận hành' },
  { to: '/locations', label: 'Bản đồ & vị trí xe' },
  { to: '/maintenance', label: 'Bảo dưỡng' },
  { to: '/vehicle-transfers', label: 'Điều chuyển xe' },
  { to: '/batteries', label: 'Kho pin & đổi pin' },
  { to: '/issues', label: 'Sự cố' },
  { to: '/operating-costs', label: 'Chi phí vận hành' },
];

const adminNav = [
  { to: '/admin', label: 'Tổng quan', end: true },
  { to: '/admin/vehicles', label: 'Quản lý xe' },
  { to: '/admin/stations', label: 'Quản lý trạm' },
  { to: '/admin/models', label: 'Dòng xe' },
  { to: '/admin/customers', label: 'Khách hàng' },
  { to: '/admin/staff', label: 'Nhân viên' },
  { to: '/admin/vouchers', label: 'Voucher' },
  { to: '/admin/dashboard', label: 'Báo cáo' },
  { to: '/admin/audit-logs', label: 'Nhật ký hoạt động' },
  { to: '/operations', label: 'Vận hành đơn thuê' },
  { to: '/maintenance', label: 'Bảo dưỡng' },
  { to: '/vehicle-transfers', label: 'Điều chuyển xe' },
  { to: '/batteries', label: 'Kho pin & đổi pin' },
  { to: '/operating-costs', label: 'Chi phí vận hành' },
];

export function MainLayout() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, loading, logout: endSession } = useAuth();
  const loggedIn = Boolean(user);
  const role = user?.role;
  const management = role === 'ADMIN' || role === 'STAFF';
  const visibleNav = role === 'ADMIN' ? adminNav : role === 'STAFF' ? staffNav : customerNav;
  const homePath = role === 'ADMIN' ? '/admin' : role === 'STAFF' ? '/operations' : '/';
  const closeMenu = () => setMenuOpen(false);
  const logout = () => { endSession(); closeMenu(); navigate('/login'); };

  return <div className="flex min-h-screen flex-col">
    {!management && <div className="bg-[#09292d] px-4 py-2 text-center text-[11px] font-semibold tracking-wide text-emerald-100">🌿 Khám phá Đà Nẵng theo cách xanh hơn · Thuê xe điện linh hoạt theo ngày</div>}
    <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/95 backdrop-blur-xl">
      <div className="container-page flex min-h-[80px] items-center justify-between gap-4 py-3">
        <Link to={homePath} aria-label="VoltGo - Trang chính"><Brand /></Link>
        <nav className="hidden items-center gap-5 xl:flex" aria-label={management ? 'Điều hướng quản lý' : 'Điều hướng khách hàng'}>
          {visibleNav.map(item => <NavLink key={item.to} to={item.to} end={Boolean('end' in item && item.end)} className={({ isActive }) => 'text-sm font-bold transition hover:text-emerald-700 ' + (isActive ? 'text-emerald-700' : 'text-slate-600')}>{item.label}</NavLink>)}
        </nav>
        <div className="hidden items-center gap-3 lg:flex">
          {loggedIn && <><Link to="/notifications" className="text-xs font-bold text-slate-600 hover:text-emerald-700">Thông báo</Link><Link to="/profile" className="text-xs font-bold text-slate-600 hover:text-emerald-700">Tài khoản</Link></>}
          {loading ? <span className="text-xs text-slate-400">Đang tải...</span> : loggedIn ? <button onClick={logout} className="btn-outline">Đăng xuất</button> : <><Link to="/login" className="px-3 text-sm font-bold text-slate-700">Đăng nhập</Link><Link to="/register" className="btn-dark">Đăng ký ngay <span aria-hidden="true">↗</span></Link></>}
        </div>
        <button className="rounded-xl border border-slate-200 p-3 text-xl lg:hidden" aria-label={menuOpen ? 'Đóng menu' : 'Mở menu'} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? '✕' : '☰'}</button>
      </div>
      {menuOpen && <div className="border-t border-slate-100 bg-white px-5 py-4 lg:hidden"><nav aria-label="Điều hướng di động" className="container-page flex flex-col gap-1">
        {visibleNav.map(item => <NavLink key={item.to} to={item.to} end={'end' in item ? item.end : false} onClick={closeMenu} className="rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-emerald-50">{item.label}</NavLink>)}
        {loggedIn && <><Link to="/notifications" onClick={closeMenu} className="rounded-xl px-4 py-3 text-sm text-slate-700">Thông báo</Link><Link to="/profile" onClick={closeMenu} className="rounded-xl px-4 py-3 text-sm text-slate-700">Tài khoản</Link></>}
        {loading ? <span className="p-3 text-xs text-slate-400">Đang tải...</span> : loggedIn ? <button onClick={logout} className="btn-outline mt-2">Đăng xuất</button> : <Link to="/login" onClick={closeMenu} className="btn-primary mt-2">Đăng nhập</Link>}
      </nav></div>}
    </header>
    <main className="flex-1"><Outlet /></main>
    {management ? <footer className="mt-12 border-t border-slate-200 bg-slate-50 py-6"><div className="container-page flex flex-wrap justify-between gap-2 text-xs text-slate-500"><span>© {new Date().getFullYear()} VoltGo · Cổng vận hành nội bộ</span><span>{role === 'ADMIN' ? 'Quản trị toàn hệ thống' : 'Quản lý vận hành theo trạm'}</span></div></footer> : <footer className="mt-16 bg-[#0b252a] py-14 text-white">
      <div className="container-page grid gap-10 md:grid-cols-3">
        <div><Brand light /><p className="mt-5 max-w-sm text-sm leading-7 text-slate-300">Nền tảng đặt thuê xe máy điện tại Đà Nẵng. Di chuyển linh hoạt, tận hưởng thành phố biển theo nhịp riêng.</p></div>
        <div><h3 className="mb-5 text-sm font-extrabold">KHÁM PHÁ</h3><div className="grid gap-3 text-sm text-slate-300"><Link to="/vehicles">Danh sách xe điện</Link><Link to="/stations">Điểm nhận và trả xe</Link><Link to="/bookings/my">Theo dõi đơn thuê</Link></div></div>
        <div><h3 className="mb-5 text-sm font-extrabold">THÔNG TIN</h3><p className="text-sm leading-7 text-slate-300">Khu vực phục vụ: Đà Nẵng, Việt Nam.<br/>Giá thuê, xe sẵn có và thông tin điểm nhận được lấy từ hệ thống theo thời gian truy cập.</p><Link to="/register" className="mt-4 inline-block font-semibold text-emerald-300">Bắt đầu hành trình ↗</Link></div>
      </div>
      <div className="container-page mt-12 flex flex-wrap justify-between gap-2 border-t border-white/10 pt-6 text-xs text-slate-400"><span>© {new Date().getFullYear()} VoltGo. Built for Da Nang.</span><span>Điện hóa hành trình · Kết nối trải nghiệm</span></div>
    </footer>}
  </div>;
}
