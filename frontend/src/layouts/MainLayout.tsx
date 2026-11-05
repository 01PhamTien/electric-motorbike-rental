import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Brand } from '../components/Brand';
import { useAuth } from '../features/auth/AuthContext';
import { api } from '../services/api';

type NavItem={to:string;label:string;end?:boolean};
type NavGroup={title:string;items:NavItem[]};
const customerNav:NavItem[]=[
 {to:'/',label:'Trang chủ',end:true},{to:'/vehicles',label:'Khám phá xe'},{to:'/stations',label:'Điểm nhận xe'},{to:'/bookings/my',label:'Đơn thuê của tôi'}
];
const staffGroups:NavGroup[]=[
 {title:'CÔNG VIỆC',items:[{to:'/operations',label:'Tổng quan vận hành'},{to:'/my-schedule',label:'Lịch trực của tôi'},{to:'/locations',label:'Bản đồ & vị trí xe'}]},
 {title:'ĐIỀU PHỐI',items:[{to:'/maintenance',label:'Bảo dưỡng'},{to:'/vehicle-transfers',label:'Điều chuyển xe'},{to:'/batteries',label:'Kho pin & đổi pin'},{to:'/issues',label:'Sự cố'},{to:'/operating-costs',label:'Chi phí vận hành'}]}
];
const adminGroups:NavGroup[]=[
 {title:'TỔNG QUAN',items:[{to:'/admin',label:'Dashboard',end:true},{to:'/admin/dashboard',label:'Báo cáo & phân tích'}]},
 {title:'QUẢN LÝ HỆ THỐNG',items:[{to:'/admin/vehicles',label:'Đội xe'},{to:'/admin/models',label:'Dòng xe'},{to:'/admin/stations',label:'Trạm xe'},{to:'/admin/staff',label:'Nhân sự'},{to:'/admin/customers',label:'Khách hàng'},{to:'/admin/vouchers',label:'Voucher'}]},
 {title:'VẬN HÀNH',items:[{to:'/operations',label:'Đơn thuê & bàn giao'},{to:'/admin/staff-schedules',label:'Lịch phân ca'},{to:'/admin/staff-presence',label:'Nhân viên đang trực'},{to:'/maintenance',label:'Bảo dưỡng'},{to:'/vehicle-transfers',label:'Điều chuyển xe'},{to:'/batteries',label:'Kho pin & đổi pin'},{to:'/issues',label:'Sự cố'},{to:'/operating-costs',label:'Chi phí vận hành'},{to:'/locations',label:'Bản đồ vị trí xe'}]},
 {title:'KIỂM SOÁT',items:[{to:'/admin/audit-logs',label:'Nhật ký hệ thống'}]}
];

export function MainLayout(){
 const navigate=useNavigate(),location=useLocation();
 const [mobileOpen,setMobileOpen]=useState(false),[accountOpen,setAccountOpen]=useState(false),[unread,setUnread]=useState(0);
 const {user,loading,logout:endSession}=useAuth();
 const loggedIn=Boolean(user),role=user?.role,management=role==='ADMIN'||role==='STAFF';
 const groups=role==='ADMIN'?adminGroups:staffGroups;
 const homePath=role==='ADMIN'?'/admin':role==='STAFF'?'/operations':'/';
 const initials=(user?.fullName||'V').trim().split(/\s+/).slice(-2).map(x=>x[0]).join('').toUpperCase();
 const roleLabel=role==='ADMIN'?'Quản trị viên':role==='STAFF'?'Nhân viên vận hành':'Khách hàng';
 const closeMenus=()=>{setMobileOpen(false);setAccountOpen(false);};
 const logout=()=>{endSession();closeMenus();navigate('/login');};
 const loadUnread=useCallback(async()=>{
  if(!loggedIn){setUnread(0);return;}
  try{const {data}=await api.get('/notifications');setUnread(Array.isArray(data)?data.filter((n:{readAt?:string|null})=>!n.readAt).length:0);}
  catch{/* Notifications are optional; navigation remains available. */}
 },[loggedIn]);
 useEffect(()=>{void loadUnread();const id=window.setInterval(()=>void loadUnread(),60000);return()=>window.clearInterval(id);},[loadUnread]);
 useEffect(()=>{setMobileOpen(false);setAccountOpen(false);},[location.pathname]);
 const navClass=({isActive}:{isActive:boolean})=>'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition '+(isActive?'bg-[#e8f8ef] text-[#13865f] shadow-[inset_3px_0_0_#36c995]':'text-[#647873] hover:bg-[#f2f8f4] hover:text-[#315b4d]');
 const renderNav=(items:NavItem[])=><>{items.map(item=><NavLink key={item.to} to={item.to} end={Boolean(item.end)} className={navClass}><span className="h-1.5 w-1.5 rounded-full bg-current opacity-35 group-[.active]:opacity-100"/>{item.label}</NavLink>)}</>;
 const accountMenu=<div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl border border-[#e5eee8] bg-white p-2 shadow-[0_18px_50px_rgba(30,65,48,.13)]">
  <div className="border-b border-slate-100 px-3 py-3"><p className="truncate text-sm font-bold text-slate-900">{user?.fullName}</p><p className="mt-1 truncate text-xs text-slate-500">{user?.email}</p><p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-emerald-700">{roleLabel}</p></div>
  <Link to="/profile" onClick={closeMenus} className="mt-2 block rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Hồ sơ & bảo mật</Link>
  {role==='CUSTOMER'&&<Link to="/bookings/my" onClick={closeMenus} className="block rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Đơn thuê của tôi</Link>}
  {role==='STAFF'&&<Link to="/my-schedule" onClick={closeMenus} className="block rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Lịch trực của tôi</Link>}
  {role==='ADMIN'&&<Link to="/admin" onClick={closeMenus} className="block rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Trung tâm quản trị</Link>}
  <Link to="/notifications" onClick={closeMenus} className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Thông báo {unread>0&&<span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-600">{unread}</span>}</Link>
  <button type="button" onClick={logout} className="mt-2 w-full rounded-xl border-t border-slate-100 px-3 py-3 text-left text-sm font-bold text-rose-600 hover:bg-rose-50">Đăng xuất tài khoản</button>
 </div>;

 if(management){
  return <div className="min-h-screen bg-[#f7faf8] text-[#294442]">
   <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] flex-col border-r border-[#e6eee9] bg-white px-4 pb-5 pt-6 lg:flex">
    <Link to={homePath} className="mb-8 px-2"><Brand/></Link>
    <div className="mb-5 rounded-2xl bg-gradient-to-br from-[#effaf3] to-[#f8fcf9] p-4"><p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[#159b70]">{role==='ADMIN'?'ADMIN WORKSPACE':'STAFF WORKSPACE'}</p><p className="mt-2 text-sm font-bold text-[#31544b]">{role==='ADMIN'?'Quản trị toàn hệ thống':'Trung tâm vận hành'}</p><p className="mt-1 text-xs leading-5 text-[#738780]">{role==='ADMIN'?'Quản lý nguồn lực và hiệu quả VoltGo':'Theo dõi công việc và hoạt động tại trạm'}</p></div>
    <nav className="min-h-0 flex-1 space-y-6 overflow-y-auto pr-1" aria-label="Điều hướng nội bộ">
     {groups.map(group=><section key={group.title}><p className="mb-2 px-3 text-[10px] font-extrabold tracking-[.16em] text-[#9aa9a2]">{group.title}</p><div className="space-y-1">{renderNav(group.items)}</div></section>)}
    </nav>
    <div className="mt-4 rounded-2xl border border-[#e9f0eb] bg-[#fbfdfb] p-3"><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#36c995]"/><span className="text-xs font-semibold text-[#587168]">VoltGo · Hệ thống hoạt động</span></div><p className="mt-2 text-[10px] text-[#9aa9a2]">© {new Date().getFullYear()} VoltGo Mobility</p></div>
   </aside>
   {mobileOpen&&<div className="fixed inset-0 z-50 lg:hidden"><button aria-label="Đóng menu" onClick={()=>setMobileOpen(false)} className="absolute inset-0 bg-slate-900/25"/><aside className="absolute inset-y-0 left-0 flex w-[min(86vw,310px)] flex-col overflow-y-auto bg-white p-5 shadow-2xl"><div className="mb-7 flex items-center justify-between"><Brand/><button onClick={()=>setMobileOpen(false)} className="rounded-lg p-2 text-slate-500" aria-label="Đóng">✕</button></div>{groups.map(group=><section key={group.title} className="mb-6"><p className="mb-2 px-3 text-[10px] font-extrabold tracking-widest text-slate-400">{group.title}</p><div className="space-y-1">{renderNav(group.items)}</div></section>)}</aside></div>}
   <div className="min-h-screen lg:pl-[264px]">
    <header className="sticky top-0 z-30 border-b border-[#e8efeb] bg-white/90 backdrop-blur-xl">
     <div className="flex h-[72px] items-center justify-between gap-3 px-4 sm:px-7 lg:px-9">
      <div className="flex min-w-0 items-center gap-3">
       <button onClick={()=>setMobileOpen(true)} className="rounded-xl border border-[#e4eee8] bg-white p-2.5 text-[#4e6b60] lg:hidden" aria-label="Mở menu">☰</button>
       <div className="min-w-0"><p className="truncate text-[11px] font-semibold text-[#91a29a]">{role==='ADMIN'?'KHÔNG GIAN QUẢN TRỊ':'KHÔNG GIAN VẬN HÀNH'}</p><h1 className="truncate text-sm font-extrabold text-[#294442] sm:text-base">{location.pathname==='/admin'?'Tổng quan':groups.flatMap(g=>g.items).find(i=>i.to===location.pathname)?.label||'VoltGo Workspace'}</h1></div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
       <Link to="/notifications" aria-label={unread>0?'Thông báo, '+unread+' chưa đọc':'Thông báo'} title="Thông báo" className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-[#e5eee8] bg-white text-lg text-[#587168] hover:bg-[#effaf3]">♧{unread>0&&<span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full border-2 border-white bg-red-500"/>}</Link>
       <div className="relative"><button type="button" aria-expanded={accountOpen} onClick={()=>setAccountOpen(v=>!v)} className="flex h-10 items-center gap-2 rounded-xl border border-[#e5eee8] bg-white py-1 pl-1 pr-2.5 hover:bg-[#f6fbf7]"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#e5f8ed] text-xs font-extrabold text-[#13865f]">{initials||'V'}</span><span className="hidden max-w-36 text-left sm:block"><span className="block truncate text-xs font-bold text-slate-800">{user?.fullName}</span><span className="block text-[10px] text-slate-500">{roleLabel}</span></span><span className="text-[10px] text-slate-400">▾</span></button>{accountOpen&&accountMenu}</div>
      </div>
     </div>
    </header>
    <main className="min-h-[calc(100vh-72px)]"><Outlet/></main>
    <footer className="border-t border-[#e8efeb] bg-white/70 px-5 py-5 text-xs text-[#8a9a93] sm:px-9"><div className="flex flex-wrap justify-between gap-2"><span>© {new Date().getFullYear()} VoltGo · Cổng nội bộ</span><span>{role==='ADMIN'?'Quản trị toàn hệ thống':'Vận hành theo trạm'}</span></div></footer>
   </div>
  </div>;
 }

 return <div className="flex min-h-screen flex-col">
  <div className="bg-[#edf8f1] px-4 py-2 text-center text-[11px] font-semibold tracking-wide text-[#4d7668]">🌿 Khám phá Đà Nẵng theo cách xanh hơn · Thuê xe điện linh hoạt theo ngày</div>
  <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/95 shadow-[0_2px_14px_rgba(15,23,42,0.035)] backdrop-blur-xl">
   <div className="container-page flex min-h-[76px] items-center gap-4 py-3"><Link to={homePath} className="shrink-0"><Brand/></Link><nav className="ml-auto hidden flex-1 items-center justify-center gap-2 xl:flex">{renderNav(customerNav)}</nav>
    <div className="ml-auto flex shrink-0 items-center gap-2 xl:ml-0">
     {loggedIn&&!loading&&<><Link to="/notifications" aria-label="Thông báo" title="Thông báo" className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-lg text-slate-700 hover:bg-emerald-50">🔔{unread>0&&<span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full border-2 border-white bg-red-500"/>}</Link><div className="relative"><button type="button" aria-expanded={accountOpen} onClick={()=>setAccountOpen(v=>!v)} className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 py-1 pl-1 pr-3 hover:bg-emerald-50/50"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-xs font-extrabold text-emerald-800">{initials||'V'}</span><span className="hidden max-w-28 text-left sm:block"><span className="block truncate text-xs font-bold text-slate-800">{user?.fullName||'Tài khoản'}</span><span className="block text-[10px] text-slate-500">{roleLabel}</span></span><span className="text-[10px] text-slate-500">▾</span></button>{accountOpen&&accountMenu}</div></>}
     {!loggedIn&&!loading&&<><Link to="/login" className="rounded-xl px-3 py-2 text-sm font-bold text-slate-700">Đăng nhập</Link><Link to="/register" className="btn-dark">Đăng ký</Link></>}
     {loading&&<span className="text-xs text-slate-400">Đang tải...</span>}
     <button className="rounded-xl border border-slate-200 p-2.5 text-lg xl:hidden" aria-label="Mở menu" onClick={()=>setMobileOpen(v=>!v)}>☰</button>
    </div>
   </div>
   {mobileOpen&&<div className="border-t border-slate-100 bg-white px-4 py-4 xl:hidden"><nav className="container-page flex flex-col gap-1">{renderNav(customerNav)}{loggedIn&&<><Link to="/notifications" onClick={closeMenus} className="rounded-xl px-3 py-3 text-sm font-semibold">Thông báo</Link><Link to="/profile" onClick={closeMenus} className="rounded-xl px-3 py-3 text-sm font-semibold">Hồ sơ & bảo mật</Link><button onClick={logout} className="mt-2 rounded-xl border border-rose-100 px-3 py-3 text-left text-sm font-bold text-rose-600">Đăng xuất</button></>}</nav></div>}
  </header>
  <main className="flex-1"><Outlet/></main>
  <footer className="mt-16 border-t border-[#e4eee8] bg-[#f2f7f4] py-14 text-[#294442]"><div className="container-page grid gap-10 md:grid-cols-3"><div><Brand/><p className="mt-5 max-w-sm text-sm leading-7 text-[#6a7e78]">Nền tảng đặt thuê xe máy điện tại Đà Nẵng. Di chuyển linh hoạt, tận hưởng thành phố biển theo nhịp riêng.</p></div><div><h3 className="mb-5 text-sm font-extrabold">KHÁM PHÁ</h3><div className="grid gap-3 text-sm text-[#6a7e78]"><Link to="/vehicles">Danh sách xe điện</Link><Link to="/stations">Điểm nhận và trả xe</Link><Link to="/bookings/my">Theo dõi đơn thuê</Link></div></div><div><h3 className="mb-5 text-sm font-extrabold">THÔNG TIN</h3><p className="text-sm leading-7 text-[#6a7e78]">Khu vực phục vụ: Đà Nẵng, Việt Nam.<br/>Giá thuê, xe sẵn có và thông tin điểm nhận được lấy từ hệ thống theo thời gian truy cập.</p><Link to="/register" className="mt-4 inline-block font-semibold text-emerald-700">Bắt đầu hành trình ↗</Link></div></div><div className="container-page mt-12 flex flex-wrap justify-between gap-2 border-t border-[#dfe9e3] pt-6 text-xs text-[#7b8d87]"><span>© {new Date().getFullYear()} VoltGo. Built for Da Nang.</span><span>Điện hóa hành trình · Kết nối trải nghiệm</span></div></footer>
 </div>;
}
