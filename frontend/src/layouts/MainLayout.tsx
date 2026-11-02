import { Link, Outlet, useNavigate } from 'react-router-dom';

export function MainLayout() {
  const navigate = useNavigate();
  function logout() { localStorage.removeItem('accessToken'); navigate('/login'); }
  return <div><header className="border-b bg-white">
    <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4">
      <Link to="/" className="font-bold">EV Rental Đà Nẵng</Link>
      <nav className="flex flex-wrap items-center gap-4 text-sm">
        <Link to="/stations">Điểm thuê</Link>
        <Link to="/vehicles">Xe</Link>
        <Link to="/bookings/my">Đơn của tôi</Link>
        <Link to="/locations">Vị trí mô phỏng</Link>
        <Link to="/admin/dashboard">Dashboard</Link>
        <Link to="/admin/staff">Nhân viên</Link>
        <Link to="/staff/workspace">Vận hành Staff</Link>
        <Link to="/staff/payments">Thanh toán</Link>
        <Link to="/maintenance">Bảo dưỡng</Link>
        <button onClick={logout} className="rounded bg-slate-100 px-3 py-1.5">Đăng xuất</button>
      </nav>
    </div>
  </header>
  <main className="mx-auto max-w-7xl px-4 py-8"><Outlet /></main></div>;
}
