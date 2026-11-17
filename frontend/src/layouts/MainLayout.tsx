import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AppIcon } from '../components/AppIcon';
import { Brand } from '../components/Brand';
import { useAuth } from '../features/auth/AuthContext';
import { api } from '../services/api';

type NavItem={to:string;label:string;icon:string;end?:boolean};
type NavGroup={title:string;items:NavItem[]};
const customerNav:NavItem[]=[
 {to:'/',label:'Trang chủ',icon:'home',end:true},{to:'/vehicles',label:'Khám phá xe',icon:'bike'},{to:'/stations',label:'Điểm nhận xe',icon:'map'},{to:'/bookings/my',label:'Đơn thuê của tôi',icon:'clipboard'},{to:'/battery-swap',label:'Đổi pin nhanh',icon:'battery'}
];
const staffGroups:NavGroup[]=[
 {title:'CÔNG VIỆC',items:[{to:'/operations',label:'Tổng quan vận hành',icon:'clipboard'},{to:'/my-schedule',label:'Lịch trực của tôi',icon:'calendar'},{to:'/locations',label:'Bản đồ & vị trí xe',icon:'map'}]},
 {title:'ĐIỀU PHỐI',items:[{to:'/maintenance',label:'Bảo dưỡng',icon:'wrench'},{to:'/vehicle-transfers',label:'Điều chuyển xe',icon:'truck'},{to:'/batteries',label:'Kho pin',icon:'battery'},{to:'/battery-swap/requests',label:'Yêu cầu đổi pin',icon:'battery'},{to:'/issues',label:'Sự cố',icon:'alert'},{to:'/operating-costs',label:'Chi phí vận hành',icon:'receipt'}]}
];
const adminGroups:NavGroup[]=[
 {title:'TỔNG QUAN',items:[{to:'/admin',label:'Dashboard',icon:'chart',end:true},{to:'/admin/dashboard',label:'Báo cáo & phân tích',icon:'receipt'}]},
 {title:'QUẢN LÝ HỆ THỐNG',items:[{to:'/admin/vehicles',label:'Đội xe',icon:'bike'},{to:'/admin/models',label:'Dòng xe',icon:'car'},{to:'/admin/stations',label:'Trạm xe',icon:'store'},{to:'/admin/staff',label:'Nhân sự',icon:'users'},{to:'/admin/customers',label:'Khách hàng',icon:'user'},{to:'/admin/vouchers',label:'Voucher',icon:'ticket'}]},
 {title:'VẬN HÀNH',items:[{to:'/operations',label:'Đơn thuê & bàn giao',icon:'clipboard'},{to:'/admin/staff-schedules',label:'Lịch phân ca',icon:'calendar'},{to:'/admin/staff-presence',label:'Nhân viên đang trực',icon:'users'},{to:'/maintenance',label:'Bảo dưỡng',icon:'wrench'},{to:'/vehicle-transfers',label:'Điều chuyển xe',icon:'truck'},{to:'/batteries',label:'Kho pin & đổi pin',icon:'battery'},{to:'/issues',label:'Sự cố',icon:'alert'},{to:'/operating-costs',label:'Chi phí vận hành',icon:'receipt'},{to:'/locations',label:'Bản đồ vị trí xe',icon:'map'}]},
 {title:'KIỂM SOÁT',items:[{to:'/admin/audit-logs',label:'Nhật ký hệ thống',icon:'shield'}]}
];
const routeTitles:[string,string][]=[
 ['/operations/bookings/','Thanh toán đơn thuê'],['/bookings/my','Đơn thuê của tôi'],['/bookings/','Chi tiết đơn thuê'],['/admin/staff-schedules','Lịch phân ca'],['/admin/staff-presence','Nhân viên đang trực'],['/admin/audit-logs','Nhật ký hệ thống'],['/admin/dashboard','Báo cáo & phân tích'],['/admin/vehicles','Quản lý đội xe'],['/admin/models','Quản lý dòng xe'],['/admin/stations','Quản lý trạm xe'],['/admin/staff','Quản lý nhân sự'],['/admin/customers','Quản lý khách hàng'],['/admin/vouchers','Quản lý voucher'],['/operations','Tổng quan vận hành'],['/my-schedule','Lịch trực của tôi'],['/locations','Bản đồ & vị trí xe'],['/maintenance','Bảo dưỡng'],['/vehicle-transfers','Điều chuyển xe'],['/battery-swap/requests','Yêu cầu đổi pin'],['/batteries','Kho pin'],['/issues','Quản lý sự cố'],['/operating-costs','Chi phí vận hành'],['/notifications','Thông báo'],['/profile','Hồ sơ & bảo mật'],['/vehicles','Khám phá xe'],['/stations','Điểm nhận xe'],['/bookings/my','Đơn thuê của tôi'],['/battery-swap','Đổi pin nhanh'],['/admin','Dashboard']
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
 const pageTitle=routeTitles.find(([path])=>path==='/admin'?location.pathname==='/admin':location.pathname===path||location.pathname.startsWith(path))?.[1]||'Không gian làm việc';
 const navClass=({isActive}:{isActive:boolean})=>'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition '+(isActive?'bg-[#edf6ef] text-[#176b4e]':'text-[#64776d] hover:bg-[#f5f8f5] hover:text-[#203b34]');
 const renderNav=(items:NavItem[])=><>{items.map(item=><NavLink key={item.to} to={item.to} end={Boolean(item.end)} className={navClass}><AppIcon name={item.icon} size={17} className="shrink-0 opacity-80"/><span>{item.label}</span></NavLink>)}</>;
 const accountMenu=<div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl border border-[#e5ece6] bg-white p-2 shadow-[0_16px_44px_rgba(30,65,48,.12)]">
  <div className="border-b border-[#edf1ed] px-3 py-3"><p className="truncate text-sm font-bold text-[#203b34]">{user?.fullName}</p><p className="mt-1 truncate text-xs text-[#78877f]">{user?.email}</p><p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-[#16865f]">{roleLabel}</p></div>
  <Link to="/profile" onClick={closeMenus} className="mt-2 flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-[#40594d] hover:bg-[#f5f8f5]"><AppIcon name="user" size={16}/>Hồ sơ & bảo mật</Link>
  {role==='CUSTOMER'&&<Link to="/bookings/my" onClick={closeMenus} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-[#40594d] hover:bg-[#f5f8f5]"><AppIcon name="clipboard" size={16}/>Đơn thuê của tôi</Link>}
  {role==='STAFF'&&<Link to="/my-schedule" onClick={closeMenus} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-[#40594d] hover:bg-[#f5f8f5]"><AppIcon name="calendar" size={16}/>Lịch trực của tôi</Link>}
  {role==='ADMIN'&&<Link to="/admin" onClick={closeMenus} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-[#40594d] hover:bg-[#f5f8f5]"><AppIcon name="chart" size={16}/>Trung tâm quản trị</Link>}
  <Link to="/notifications" onClick={closeMenus} className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold text-[#40594d] hover:bg-[#f5f8f5]"><span className="flex items-center gap-2"><AppIcon name="bell" size={16}/>Thông báo</span>{unread>0&&<span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-600">{unread}</span>}</Link>
  <button type="button" onClick={logout} className="mt-2 flex w-full items-center gap-2 border-t border-[#edf1ed] px-3 py-3 text-left text-sm font-bold text-rose-600 hover:bg-rose-50"><AppIcon name="logout" size={16}/>Đăng xuất tài khoản</button>
 </div>;

 if(management){
  return <div className="min-h-screen bg-[#f7f9f7] text-[#203b34]">
   <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col border-r border-[#e7ede8] bg-white px-4 pb-5 pt-6 lg:flex">
    <div className="mb-8 px-2"><Brand to={homePath}/></div>
    <div className="mb-6 rounded-2xl border border-[#e7eee8] bg-[#f8fbf8] p-4"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#16865f]">{role==='ADMIN'?'ADMIN WORKSPACE':'STAFF WORKSPACE'}</p><p className="mt-2 text-sm font-bold text-[#29483b]">{role==='ADMIN'?'Quản trị toàn hệ thống':'Trung tâm vận hành'}</p><p className="mt-1 text-xs leading-5 text-[#7a8980]">{role==='ADMIN'?'Quản lý nguồn lực và hiệu quả VoltGo':'Theo dõi công việc và hoạt động tại trạm'}</p></div>
    <nav className="min-h-0 flex-1 space-y-6 overflow-y-auto pr-1" aria-label="Điều hướng nội bộ">
     {groups.map(group=><section key={group.title}><p className="mb-2 px-3 text-[10px] font-bold tracking-[.15em] text-[#a0aca4]">{group.title}</p><div className="space-y-1">{renderNav(group.items)}</div></section>)}
    </nav>
    <div className="mt-4 border-t border-[#edf1ed] px-2 pt-4"><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#26966c]"/><span className="text-xs font-semibold text-[#587064]">VoltGo · Hệ thống hoạt động</span></div><p className="mt-2 text-[10px] text-[#a0aca4]">© {new Date().getFullYear()} VoltGo Mobility</p></div>
   </aside>
   {mobileOpen&&<div className="fixed inset-0 z-50 lg:hidden"><button aria-label="Đóng menu" onClick={()=>setMobileOpen(false)} className="absolute inset-0 bg-[#152b22]/30"/><aside className="absolute inset-y-0 left-0 flex w-[min(86vw,310px)] flex-col overflow-y-auto bg-white p-5 shadow-2xl"><div className="mb-7 flex items-center justify-between"><Brand to={homePath}/><button onClick={()=>setMobileOpen(false)} className="rounded-xl p-2 text-[#63756a]" aria-label="Đóng"><AppIcon name="close"/></button></div>{groups.map(group=><section key={group.title} className="mb-6"><p className="mb-2 px-3 text-[10px] font-bold tracking-widest text-[#a0aca4]">{group.title}</p><div className="space-y-1">{renderNav(group.items)}</div></section>)}</aside></div>}
   <div className="min-h-screen lg:pl-[248px]">
    <header className="sticky top-0 z-30 border-b border-[#e7ede8] bg-white/90 backdrop-blur-xl">
     <div className="flex h-[68px] items-center justify-between gap-3 px-4 sm:px-7 lg:px-9">
      <div className="flex min-w-0 items-center gap-3">
       <button onClick={()=>setMobileOpen(true)} className="rounded-xl border border-[#e5ece6] bg-white p-2.5 text-[#52695c] lg:hidden" aria-label="Mở menu"><AppIcon name="menu"/></button>
       <div className="min-w-0"><p className="truncate text-[10px] font-bold tracking-[.14em] text-[#9aa79f]">{role==='ADMIN'?'KHÔNG GIAN QUẢN TRỊ':'KHÔNG GIAN VẬN HÀNH'}</p><h1 className="truncate text-sm font-bold text-[#203b34] sm:text-base">{pageTitle}</h1></div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
       <Link to="/notifications" aria-label={unread>0?'Thông báo, '+unread+' chưa đọc':'Thông báo'} title="Thông báo" className="relative flex h-10 w-10 items-center justify-center rounded-xl text-[#52695c] hover:bg-[#f3f7f3]"><AppIcon name="bell" size={19}/>{unread>0&&<span className="absolute right-2 top-2 h-2 w-2 rounded-full border-2 border-white bg-rose-500"/>}</Link>
       <div className="relative"><button type="button" aria-expanded={accountOpen} onClick={()=>setAccountOpen(v=>!v)} className="flex h-10 items-center gap-2 rounded-xl border border-[#e7ede8] bg-white py-1 pl-1 pr-2.5 hover:bg-[#f7faf7]"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#edf6ef] text-xs font-bold text-[#176b4e]">{initials||'V'}</span><span className="hidden max-w-36 text-left sm:block"><span className="block truncate text-xs font-bold text-[#29483b]">{user?.fullName}</span><span className="block text-[10px] text-[#87958c]">{roleLabel}</span></span><AppIcon name="chevron" size={14} className="text-[#94a198]"/></button>{accountOpen&&accountMenu}</div>
      </div>
     </div>
    </header>
    <main className="min-h-[calc(100vh-68px)]"><Outlet/></main>
    <footer className="border-t border-[#e7ede8] bg-white/70 px-5 py-5 text-xs text-[#91a097] sm:px-9"><div className="flex flex-wrap justify-between gap-2"><span>© {new Date().getFullYear()} VoltGo · Cổng nội bộ</span><span>{role==='ADMIN'?'Quản trị toàn hệ thống':'Vận hành theo trạm'}</span></div></footer>
   </div>
  </div>;
 }

 return <div className="flex min-h-screen flex-col">
  <div className="border-b border-[#e8efe9] bg-[#f5f9f5] px-4 py-2 text-center text-[11px] font-medium tracking-wide text-[#62796c]">Di chuyển xanh hơn · Thuê xe điện linh hoạt theo ngày</div>
  <header className="sticky top-0 z-40 border-b border-[#e8ede9] bg-white/95 backdrop-blur-xl">
   <div className="container-page flex min-h-[72px] items-center gap-4 py-3"><div className="shrink-0"><Brand to={homePath}/></div><nav className="ml-auto hidden flex-1 items-center justify-center gap-1 xl:flex">{customerNav.map(item=><NavLink key={item.to} to={item.to} end={Boolean(item.end)} className={({isActive})=>'rounded-xl px-3 py-2 text-[13px] font-semibold transition '+(isActive?'bg-[#edf6ef] text-[#176b4e]':'text-[#65766d] hover:bg-[#f6f9f6] hover:text-[#203b34]')}>{item.label}</NavLink>)}</nav>
    <div className="ml-auto flex shrink-0 items-center gap-2 xl:ml-0">
     {loggedIn&&!loading&&<><Link to="/notifications" aria-label="Thông báo" title="Thông báo" className="relative flex h-10 w-10 items-center justify-center rounded-xl text-[#52695c] hover:bg-[#f3f7f3]"><AppIcon name="bell" size={19}/>{unread>0&&<span className="absolute right-2 top-2 h-2 w-2 rounded-full border-2 border-white bg-rose-500"/>}</Link><div className="relative"><button type="button" aria-expanded={accountOpen} onClick={()=>setAccountOpen(v=>!v)} className="flex h-10 items-center gap-2 rounded-xl border border-[#e7ede8] py-1 pl-1 pr-2.5 hover:bg-[#f7faf7]"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#edf6ef] text-xs font-bold text-[#176b4e]">{initials||'V'}</span><span className="hidden max-w-28 text-left sm:block"><span className="block truncate text-xs font-bold text-[#29483b]">{user?.fullName||'Tài khoản'}</span><span className="block text-[10px] text-[#87958c]">{roleLabel}</span></span><AppIcon name="chevron" size={14} className="text-[#94a198]"/></button>{accountOpen&&accountMenu}</div></>}
     {!loggedIn&&!loading&&<><Link to="/login" className="rounded-xl px-3 py-2 text-sm font-semibold text-[#4e6559] hover:bg-[#f6f9f6]">Đăng nhập</Link><Link to="/register" className="btn-primary !min-h-10 !px-4 !py-2">Đăng ký</Link></>}
     {loading&&<span className="text-xs text-[#98a59d]">Đang tải...</span>}
     <button className="rounded-xl border border-[#e7ede8] p-2.5 text-[#52695c] xl:hidden" aria-label="Mở menu" aria-expanded={mobileOpen} onClick={()=>setMobileOpen(v=>!v)}><AppIcon name={mobileOpen?'close':'menu'}/></button>
    </div>
   </div>
   {mobileOpen&&<div className="border-t border-[#e8ede9] bg-white px-4 py-4 xl:hidden"><nav className="container-page flex flex-col gap-1">{renderNav(customerNav)}{!loggedIn&&!loading&&<div className="mt-3 grid grid-cols-2 gap-2 border-t border-[#edf1ed] pt-3"><Link to="/login" onClick={closeMenus} className="btn-outline">Đăng nhập</Link><Link to="/register" onClick={closeMenus} className="btn-primary">Đăng ký</Link></div>}{loggedIn&&<><Link to="/notifications" onClick={closeMenus} className="rounded-xl px-3 py-3 text-sm font-semibold text-[#40594d]">Thông báo</Link><Link to="/profile" onClick={closeMenus} className="rounded-xl px-3 py-3 text-sm font-semibold text-[#40594d]">Hồ sơ & bảo mật</Link><button onClick={logout} className="mt-2 flex items-center gap-2 rounded-xl border border-rose-100 px-3 py-3 text-left text-sm font-bold text-rose-600"><AppIcon name="logout" size={16}/>Đăng xuất</button></>}</nav></div>}
  </header>
  <main className="flex-1"><Outlet/></main>
  <footer className="mt-16 border-t border-[#e7ede8] bg-white py-12 text-[#29483b]"><div className="container-page grid gap-9 md:grid-cols-3"><div><Brand/><p className="mt-4 max-w-sm text-sm leading-7 text-[#74847b]">Nền tảng đặt thuê xe máy điện. Di chuyển linh hoạt, tận hưởng hành trình theo nhịp riêng.</p></div><div><h3 className="mb-4 text-xs font-bold uppercase tracking-[.14em] text-[#29483b]">Khám phá</h3><div className="grid gap-3 text-sm text-[#74847b]"><Link to="/vehicles">Danh sách xe điện</Link><Link to="/stations">Điểm nhận và trả xe</Link><Link to="/bookings/my">Theo dõi đơn thuê</Link></div></div><div><h3 className="mb-4 text-xs font-bold uppercase tracking-[.14em] text-[#29483b]">Thông tin</h3><p className="text-sm leading-7 text-[#74847b]">Giá thuê, xe sẵn có và thông tin điểm nhận được lấy từ hệ thống theo thời gian truy cập.</p><Link to="/register" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#16865f]">Bắt đầu hành trình <span aria-hidden="true">↗</span></Link></div></div><div className="container-page mt-10 flex flex-wrap justify-between gap-2 border-t border-[#edf1ed] pt-5 text-xs text-[#94a198]"><span>© {new Date().getFullYear()} VoltGo</span><span>Điện hóa hành trình · Kết nối trải nghiệm</span></div></footer>
 </div>;
}
