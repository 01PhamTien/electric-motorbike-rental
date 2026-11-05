import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { SectionHeading, money } from '../../components/Brand';
import { api } from '../../services/api';

type AdminOverview = {
  bookings: { total: number; byStatus: Record<string, number> };
  fleet: { total: number; active: number; maintenance: number; inactive: number };
  finance: { recognizedRevenue: number; netCashIn: number; depositHeldNow: number };
  customers: { uniqueInPeriod: number; newInPeriod: number; returningInPeriod: number };
};
const groups = [
  { title: 'Quản lý hệ thống', description: 'Danh mục và tài khoản nền tảng', items: [
    { to: '/admin/vehicles', icon: '🛵', name: 'Đội xe', info: 'Hồ sơ xe, giá thuê, tiền cọc và trạng thái khai thác' },
    { to: '/admin/models', icon: '⚙️', name: 'Dòng xe', info: 'Hãng xe, mẫu xe và thông số kỹ thuật' },
    { to: '/admin/stations', icon: '📍', name: 'Trạm xe', info: 'Địa điểm, thông tin và trạng thái hoạt động' },
    { to: '/admin/staff', icon: '👥', name: 'Nhân viên', info: 'Tài khoản, vai trò và phân công trạm' },
    { to: '/admin/customers', icon: '🪪', name: 'Khách hàng', info: 'Hồ sơ và trạng thái tài khoản khách thuê' },
    { to: '/admin/vouchers', icon: '🎟️', name: 'Voucher', info: 'Mã giảm giá, giới hạn và lịch sử sử dụng' },
  ] },
  { title: 'Điều hành vận hành', description: 'Theo dõi hoạt động hằng ngày trên toàn hệ thống', items: [
    { to: '/operations', icon: '📋', name: 'Đơn thuê', info: 'Xác nhận, bàn giao và nhận trả xe' },
    { to: '/vehicle-transfers', icon: '🔀', name: 'Điều chuyển xe', info: 'Luân chuyển xe và biên bản giữa các trạm' },
    { to: '/maintenance', icon: '🔧', name: 'Bảo dưỡng', info: 'Lịch bảo trì, sửa chữa và tình trạng xe' },
    { to: '/batteries', icon: '🔋', name: 'Kho pin & đổi pin', info: 'Serial, tình trạng pin và lịch sử thay pin' },
    { to: '/operating-costs', icon: '🧾', name: 'Chi phí vận hành', info: 'Điện sạc, vệ sinh, bảo hiểm và chi phí khác' },
    { to: '/locations', icon: '🧭', name: 'Vị trí xe', info: 'Theo dõi vị trí và phân bố phương tiện' },
  ] },
];
const statusLabels: Record<string,string> = { PENDING:'Chờ xác nhận', CONFIRMED:'Đã xác nhận', RENTING:'Đang thuê', COMPLETED:'Hoàn thành', CANCELLED:'Đã hủy', EXPIRED:'Hết hạn' };
function currentMonthRange() {
  const now = new Date();
  const date = (d: Date) => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  return { from: date(new Date(now.getFullYear(),now.getMonth(),1)), to: date(now) };
}
function errorText(error: unknown) {
  const message=(error as {response?:{data?:{message?:string|string[]}}})?.response?.data?.message;
  return Array.isArray(message)?message.join(', '):message||'Không thể tải số liệu tổng quan.';
}

export function AdminHomePage() {
  const [overview,setOverview]=useState<AdminOverview|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [range]=useState(currentMonthRange);
  async function load() {
    setLoading(true);setError('');
    try {
      const {data}=await api.get('/reports/overview',{params:range});
      setOverview(data);
    } catch(e) { setError(errorText(e)); }
    finally { setLoading(false); }
  }
  useEffect(()=>{void load();},[]);
  const metrics=overview?[
    {label:'Doanh thu ghi nhận',value:money(overview.finance.recognizedRevenue),detail:'Trong tháng hiện tại',tone:'text-emerald-700'},
    {label:'Dòng tiền ròng',value:money(overview.finance.netCashIn),detail:'Đã trừ hoàn tiền trong kỳ',tone:'text-sky-700'},
    {label:'Tiền cọc đang giữ',value:money(overview.finance.depositHeldNow),detail:'Số dư cọc toàn hệ thống',tone:'text-amber-700'},
    {label:'Đơn thuê trong tháng',value:overview.bookings.total.toLocaleString('vi-VN'),detail:'Tổng đơn được tạo trong kỳ',tone:'text-slate-900'},
  ]:[];
  return <section className="container-page space-y-10 py-10 sm:py-14">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <SectionHeading eyebrow="TRUNG TÂM QUẢN TRỊ" title="Điều hành VoltGo" description="Tổng quan hoạt động, hiệu quả kinh doanh và các phân hệ quản lý toàn hệ thống."/>
      <div className="flex gap-2"><button onClick={()=>void load()} disabled={loading} className="btn-outline">↻ Làm mới</button><Link to="/admin/dashboard" className="btn-dark">Báo cáo chi tiết ↗</Link></div>
    </div>
    <section aria-label="Tổng quan kinh doanh">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-lg font-extrabold">Tình hình tháng này</h2><p className="mt-1 text-xs text-slate-500">{range.from} đến {range.to} · Dữ liệu từ hệ thống báo cáo</p></div></div>
      {error&&<div role="alert" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{error} Các phân hệ quản lý vẫn có thể truy cập bên dưới.</div>}
      {loading?<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[1,2,3,4].map(x=><div key={x} className="panel h-32 animate-pulse bg-slate-50"/>)}</div>:overview?<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(m=><article key={m.label} className="panel p-5"><p className="text-sm font-semibold text-slate-500">{m.label}</p><p className={'mt-4 text-2xl font-extrabold '+m.tone}>{m.value}</p><p className="mt-2 text-xs text-slate-400">{m.detail}</p></article>)}</div>:null}
      {overview&&<div className="mt-4 grid gap-4 lg:grid-cols-2">
        <article className="panel p-5"><div className="flex items-center justify-between gap-3"><h3 className="font-extrabold">Tình trạng đội xe</h3><Link to="/admin/vehicles" className="text-xs font-bold text-emerald-700">Quản lý xe ↗</Link></div><div className="mt-4 grid grid-cols-4 gap-2 text-center">{[{label:'Tổng xe',value:overview.fleet.total},{label:'Hoạt động',value:overview.fleet.active},{label:'Bảo dưỡng',value:overview.fleet.maintenance},{label:'Ngưng',value:overview.fleet.inactive}].map(x=><div key={x.label} className="rounded-xl bg-slate-50 p-3"><strong className="block text-xl">{x.value}</strong><span className="mt-1 block text-[11px] text-slate-500">{x.label}</span></div>)}</div></article>
        <article className="panel p-5"><div className="flex items-center justify-between gap-3"><h3 className="font-extrabold">Trạng thái đơn thuê</h3><Link to="/operations" className="text-xs font-bold text-emerald-700">Điều phối đơn ↗</Link></div><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">{Object.entries(overview.bookings.byStatus).map(([status,count])=><div key={status} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2"><span className="text-xs text-slate-600">{statusLabels[status]||status}</span><strong>{count}</strong></div>)}</div><p className="mt-3 text-xs text-slate-500">{overview.customers.uniqueInPeriod} khách có đơn · {overview.customers.newInPeriod} khách mới · {overview.customers.returningInPeriod} khách quay lại</p></article>
      </div>}
    </section>
    {groups.map(group=><section key={group.title} className="space-y-4"><div><h2 className="text-xl font-extrabold">{group.title}</h2><p className="mt-1 text-sm text-slate-500">{group.description}</p></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{group.items.map(item=><Link to={item.to} key={item.to} className="panel group flex min-h-36 gap-4 p-5 transition hover:-translate-y-1 hover:border-emerald-300 hover:shadow-lg"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-2xl" aria-hidden="true">{item.icon}</span><div className="min-w-0"><h3 className="font-extrabold text-slate-900 group-hover:text-emerald-700">{item.name} <span aria-hidden="true">↗</span></h3><p className="mt-2 text-sm leading-6 text-slate-500">{item.info}</p></div></Link>)}</div></section>)}
    <section className="rounded-2xl bg-[#10383b] p-6 text-white sm:p-8"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-extrabold uppercase tracking-[.18em] text-emerald-300">PHÂN TÍCH & KIỂM SOÁT</p><h2 className="mt-2 text-xl font-extrabold">Báo cáo và nhật ký hệ thống</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-50/75">Theo dõi hiệu quả kinh doanh, chi phí, mức khai thác đội xe và lịch sử thao tác quản trị.</p></div><div className="flex flex-wrap gap-2"><Link to="/admin/dashboard" className="rounded-xl bg-emerald-300 px-4 py-3 text-sm font-extrabold text-slate-950">Mở báo cáo ↗</Link><Link to="/admin/audit-logs" className="rounded-xl border border-white/20 px-4 py-3 text-sm font-bold text-white">Nhật ký hoạt động ↗</Link></div></div></section>
  </section>;
}
