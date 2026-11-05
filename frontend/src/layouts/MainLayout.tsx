import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Brand } from '../components/Brand';
import { useAuth } from '../features/auth/AuthContext';
import { api } from '../services/api';

type NavItem = { to:string; label:string; end?:boolean };
const customerNav:NavItem[]=[
  {to:'/',label:'Trang chủ',end:true},{to:'/vehicles',label:'Khám phá xe'},{to:'/stations',label:'Điểm nhận xe'},{to:'/bookings/my',label:'Đơn thuê của tôi'}
];
const staffNav:NavItem[]=[
  {to:'/operations',label:'Vận hành'},{to:'/my-schedule',label:'Lịch trực'},{to:'/locations',label:'Bản đồ xe'},{to:'/maintenance',label:'Bảo dưỡng'},{to:'/vehicle-transfers',label:'Điều chuyển'},
  {to:'/batteries',label:'Kho pin & đổi pin'},{to:'/issues',label:'Sự cố'},{to:'/operating-costs',label:'Chi phí vận hành'}
];
const adminNav:NavItem[]=[
  {to:'/admin',label:'Tổng quan',end:true},{to:'/admin/vehicles',label:'Đội xe'},{to:'/admin/stations',label:'Trạm xe'},{to:'/admin/staff',label:'Nhân sự'},
  {to:'/operations',label:'Vận hành'},{to:'/admin/staff-schedules',label:'Lịch phân ca'},{to:'/admin/staff-presence',label:'Nhân viên đang trực'},
  {to:'/admin/models',label:'Dòng xe'},{to:'/admin/customers',label:'Khách hàng'},{to:'/admin/vouchers',label:'Voucher'},
  {to:'/admin/dashboard',label:'Báo cáo'},{to:'/admin/audit-logs',label:'Nhật ký'},{to:'/maintenance',label:'Bảo dưỡng'},
  {to:'/vehicle-transfers',label:'Điều chuyển xe'},{to:'/batteries',label:'Kho pin & đổi pin'},{to:'/operating-costs',label:'Chi phí vận hành'},{to:'/issues',label:'Sự cố'}
];

export function MainLayout(){
  const navigate=useNavigate();
  const [menuOpen,setMenuOpen]=useState(false);
  const [moreOpen,setMoreOpen]=useState(false);
  const [accountOpen,setAccountOpen]=useState(false);
  const [mobileMoreOpen,setMobileMoreOpen]=useState(false);
  const [unread,setUnread]=useState(0);
  const {user,loading,logout:endSession}=useAuth();
  const loggedIn=Boolean(user);
  const role=user?.role;
  const management=role==='ADMIN'||role==='STAFF';
  const allNav=role==='ADMIN'?adminNav:role==='STAFF'?staffNav:customerNav;
  const primaryCount=role==='ADMIN'?5:role==='STAFF'?5:4;
  const primaryNav=allNav.slice(0,primaryCount);
  const moreNav=allNav.slice(primaryCount);
  const homePath=role==='ADMIN'?'/admin':role==='STAFF'?'/operations':'/';
  const initials=(user?.fullName||'V').trim().split(/\\s+/).slice(-2).map(x=>x[0]).join('').toUpperCase();
  const closeMenus=()=>{setMenuOpen(false);setMoreOpen(false);setAccountOpen(false);setMobileMoreOpen(false);};
  const logout=()=>{endSession();closeMenus();navigate('/login');};
  const loadUnread=useCallback(async()=>{
    if(!loggedIn){setUnread(0);return;}
    try{const {data}=await api.get('/notifications');setUnread(Array.isArray(data)?data.filter((n:{readAt?:string|null})=>!n.readAt).length:0);}
    catch{/* Keep navigation usable if notifications are temporarily unavailable. */}
  },[loggedIn]);
  useEffect(()=>{void loadUnread();const id=window.setInterval(()=>void loadUnread(),60000);return()=>window.clearInterval(id);},[loadUnread]);
  const roleLabel=role==='ADMIN'?'Quản trị viên':role==='STAFF'?'Nhân viên vận hành':'Khách hàng';
  const navClass=({isActive}:{isActive:boolean})=>'whitespace-nowrap rounded-xl px-3 py-2 text-[13px] font-bold transition '+(isActive?'bg-emerald-50 text-emerald-800':'text-slate-600 hover:bg-slate-50 hover:text-emerald-800');
  const navLinks=(items:NavItem[],mobile=false)=><>{items.map(item=><NavLink key={item.to} to={item.to} end={Boolean(item.end)} onClick={mobile?closeMenus:undefined} className={navClass}>{item.label}</NavLink>)}</>;

  return <div className="flex min-h-screen flex-col">
    {!management&&<div className="bg-[#edf8f1] px-4 py-2 text-center text-[11px] font-semibold tracking-wide text-[#4d7668]">🌿 Khám phá Đà Nẵng theo cách xanh hơn · Thuê xe điện linh hoạt theo ngày</div>}
    <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/95 shadow-[0_2px_14px_rgba(15,23,42,0.035)] backdrop-blur-xl">
      <div className="container-page flex min-h-[76px] items-center gap-4 py-3">
        <Link to={homePath} aria-label="VoltGo - Trang chính" className="shrink-0"><Brand/></Link>
        <nav className="ml-auto hidden min-w-0 flex-1 items-center justify-center gap-1 xl:flex" aria-label={management?'Điều hướng nội bộ':'Điều hướng khách hàng'}>
          {navLinks(primaryNav)}
          {moreNav.length>0&&<div className="relative">
            <button type="button" aria-expanded={moreOpen} onClick={()=>{setMoreOpen(v=>!v);setAccountOpen(false);}} className={'rounded-xl px-3 py-2 text-[13px] font-bold '+(moreOpen?'bg-slate-100 text-slate-900':'text-slate-600 hover:bg-slate-50')}>Danh mục <span className="ml-1 text-[10px]">▾</span></button>
            {moreOpen&&<div className="absolute right-0 top-full z-50 mt-2 grid min-w-56 gap-1 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">{moreNav.map(item=><NavLink key={item.to} to={item.to} end={Boolean(item.end)} onClick={()=>setMoreOpen(false)} className={navClass}>{item.label}</NavLink>)}</div>}
          </div>}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-2 xl:ml-0">
          {loggedIn&&!loading&&<>
            <Link to="/notifications" aria-label={unread>0?'Thông báo, '+unread+' chưa đọc':'Thông báo'} title="Thông báo" className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-lg text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800">
              <span aria-hidden="true">🔔</span>
              {unread>0&&<><span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full border-2 border-white bg-red-500"/><span className="sr-only">{unread} thông báo chưa đọc</span></>}
            </Link>
            <div className="relative">
              <button type="button" aria-expanded={accountOpen} onClick={()=>{setAccountOpen(v=>!v);setMoreOpen(false);}} className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white py-1 pl-1 pr-3 transition hover:border-emerald-200 hover:bg-emerald-50/50">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-xs font-extrabold text-emerald-800">{initials||'V'}</span>
                <span className="hidden max-w-28 text-left sm:block"><span className="block truncate text-xs font-bold text-slate-800">{user?.fullName||'Tài khoản'}</span><span className="block text-[10px] text-slate-500">{roleLabel}</span></span>
                <span className="text-[10px] text-slate-500">▾</span>
              </button>
              {accountOpen&&<div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                <div className="border-b border-slate-100 px-3 py-3"><p className="truncate text-sm font-bold text-slate-900">{user?.fullName}</p><p className="mt-1 truncate text-xs text-slate-500">{user?.email}</p><p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-emerald-700">{roleLabel}</p></div>
                <Link to="/profile" onClick={closeMenus} className="mt-2 block rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Hồ sơ & bảo mật</Link>
                {role==='CUSTOMER'&&<Link to="/bookings/my" onClick={closeMenus} className="block rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Đơn thuê của tôi</Link>}
                {role==='STAFF'&&<Link to="/my-schedule" onClick={closeMenus} className="block rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Lịch trực của tôi</Link>}
                {role==='ADMIN'&&<Link to="/admin" onClick={closeMenus} className="block rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Trung tâm quản trị</Link>}
                <Link to="/notifications" onClick={closeMenus} className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Thông báo {unread>0&&<span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-600">{unread}</span>}</Link>
                <button type="button" onClick={logout} className="mt-2 w-full rounded-xl border-t border-slate-100 px-3 py-3 text-left text-sm font-bold text-rose-600 hover:bg-rose-50">Đăng xuất tài khoản</button>
              </div>}
            </div>
          </>}
          {!loggedIn&&!loading&&<><Link to="/login" className="rounded-xl px-3 py-2 text-sm font-bold text-slate-700">Đăng nhập</Link><Link to="/register" className="btn-dark">Đăng ký</Link></>}
          {loading&&<span className="text-xs text-slate-400">Đang tải...</span>}
          <button className="rounded-xl border border-slate-200 p-2.5 text-lg xl:hidden" aria-label={menuOpen?'Đóng menu':'Mở menu'} aria-expanded={menuOpen} onClick={()=>setMenuOpen(v=>!v)}>{menuOpen?'✕':'☰'}</button>
        </div>
      </div>
      {menuOpen&&<div className="border-t border-slate-100 bg-white px-4 py-4 xl:hidden"><nav aria-label="Điều hướng di động" className="container-page flex flex-col gap-1">
        {navLinks(primaryNav,true)}
        {moreNav.length>0&&<><button type="button" onClick={()=>setMobileMoreOpen(v=>!v)} aria-expanded={mobileMoreOpen} className="rounded-xl px-3 py-3 text-left text-sm font-bold text-slate-700 hover:bg-slate-50">Các chức năng khác <span className="float-right">▾</span></button>{mobileMoreOpen&&<div className="ml-3 flex flex-col gap-1 border-l-2 border-emerald-100 pl-2">{navLinks(moreNav,true)}</div>}</>}
        {loggedIn&&<><Link to="/notifications" onClick={closeMenus} className="rounded-xl px-3 py-3 text-sm font-semibold text-slate-700">Thông báo {unread>0&&<span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-600">{unread}</span>}</Link><Link to="/profile" onClick={closeMenus} className="rounded-xl px-3 py-3 text-sm font-semibold text-slate-700">Hồ sơ & bảo mật</Link><button onClick={logout} className="mt-2 rounded-xl border border-rose-100 px-3 py-3 text-left text-sm font-bold text-rose-600">Đăng xuất tài khoản</button></>}
        {!loggedIn&&<Link to="/login" onClick={closeMenus} className="btn-primary mt-2">Đăng nhập</Link>}
      </nav></div>}
    </header>
    <main className="flex-1"><Outlet/></main>
    {management?<footer className="mt-12 border-t border-slate-200 bg-slate-50 py-6"><div className="container-page flex flex-wrap justify-between gap-2 text-xs text-slate-500"><span>© {new Date().getFullYear()} VoltGo · Cổng vận hành nội bộ</span><span>{role==='ADMIN'?'Quản trị toàn hệ thống':'Quản lý vận hành theo trạm'}</span></div></footer>:<footer className="mt-16 border-t border-[#e4eee8] bg-[#f2f7f4] py-14 text-[#294442]">
      <div className="container-page grid gap-10 md:grid-cols-3"><div><Brand light/><p className="mt-5 max-w-sm text-sm leading-7 text-[#6a7e78]">Nền tảng đặt thuê xe máy điện tại Đà Nẵng. Di chuyển linh hoạt, tận hưởng thành phố biển theo nhịp riêng.</p></div><div><h3 className="mb-5 text-sm font-extrabold">KHÁM PHÁ</h3><div className="grid gap-3 text-sm text-slate-300"><Link to="/vehicles">Danh sách xe điện</Link><Link to="/stations">Điểm nhận và trả xe</Link><Link to="/bookings/my">Theo dõi đơn thuê</Link></div></div><div><h3 className="mb-5 text-sm font-extrabold">THÔNG TIN</h3><p className="text-sm leading-7 text-slate-300">Khu vực phục vụ: Đà Nẵng, Việt Nam.<br/>Giá thuê, xe sẵn có và thông tin điểm nhận được lấy từ hệ thống theo thời gian truy cập.</p><Link to="/register" className="mt-4 inline-block font-semibold text-emerald-300">Bắt đầu hành trình ↗</Link></div></div>
      <div className="container-page mt-12 flex flex-wrap justify-between gap-2 border-t border-[#dfe9e3] pt-6 text-xs text-[#7b8d87]"><span>© {new Date().getFullYear()} VoltGo. Built for Da Nang.</span><span>Điện hóa hành trình · Kết nối trải nghiệm</span></div>
    </footer>}
  </div>;
}
