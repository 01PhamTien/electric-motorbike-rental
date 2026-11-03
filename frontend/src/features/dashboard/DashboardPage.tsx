import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LoadingState, SectionHeading } from '../../components/Brand';
import { api } from '../../services/api';

type Overview = {
  generatedAt: string;
  bookings: { total: number; byStatus: Record<string, number> };
  fleet: { total: number; active: number; maintenance: number; inactive: number };
  notes?: string[];
};
const statusLabels: Record<string,string> = { PENDING:'Chờ xác nhận', CONFIRMED:'Đã xác nhận', RENTING:'Đang thuê', COMPLETED:'Hoàn thành', CANCELLED:'Đã hủy', EXPIRED:'Hết hạn' };

export function DashboardPage() {
  const [data,setData] = useState<Overview | null>(null);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  async function load() {
    setLoading(true);setError('');
    try { const { data } = await api.get('/reports/overview'); setData(data); }
    catch(err: unknown) { const message = (err as {response?:{data?:{message?:string}}})?.response?.data?.message; setError(message || 'Không thể tải báo cáo. API chỉ cho tài khoản quản trị viên.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  const metrics = data ? [
    {label:'Tổng số xe',value:data.fleet.total,detail:'Số xe trong hệ thống',icon:'▣'},
    {label:'Xe sẵn sàng',value:data.fleet.active,detail:'Sẵn sàng khai thác',icon:'⚡'},
    {label:'Đang bảo trì',value:data.fleet.maintenance,detail:'Cần được kiểm tra',icon:'⚙'},
    {label:'Tổng đơn thuê',value:data.bookings.total,detail:'Đơn trong hệ thống',icon:'▤'},
  ] : [];
  const statuses = data ? Object.entries(data.bookings.byStatus) : [];
  const max = Math.max(1,...statuses.map(([,n]) => n));
  return <div className="container-page py-12 sm:py-16">
    <div className="flex flex-wrap items-end justify-between gap-6"><SectionHeading eyebrow="QUẢN TRỊ VOLTGO" title="Tổng quan vận hành" description="Theo dõi tình trạng đội xe và đơn thuê với dữ liệu trực tiếp từ hệ thống."/><div className="flex flex-wrap gap-3"><Link to="/operations" className="btn-outline">Quản lý đơn thuê ↗</Link><button onClick={() => void load()} className="btn-dark">↻ Làm mới</button></div></div>
    {error && <div role="alert" className="mt-7 rounded-xl border border-rose-100 bg-rose-50 p-5 text-sm text-rose-700">{error}</div>}
    {loading ? <div className="mt-8"><LoadingState label="Đang tải báo cáo..." /></div> : data && <>
      <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(m => <article key={m.label} className="panel p-6"><div className="flex items-center justify-between"><p className="text-sm font-semibold text-slate-500">{m.label}</p><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-xl text-emerald-800">{m.icon}</span></div><p className="mt-5 text-4xl font-extrabold tracking-tight text-[#102d31]">{m.value.toLocaleString('vi-VN')}</p><p className="mt-2 text-xs text-slate-400">{m.detail}</p></article>)}</div>
      <div className="mt-7 grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
        <section className="panel p-7"><div className="flex items-center justify-between gap-4"><div><h2 className="text-xl font-extrabold">Đơn thuê theo trạng thái</h2><p className="mt-2 text-sm text-slate-500">Phân bổ các đơn theo trạng thái hiện tại.</p></div><span className="tag">{data.bookings.total} đơn</span></div><div className="mt-9 space-y-6">{statuses.length ? statuses.map(([status,count]) => <div key={status}><div className="mb-2 flex items-center justify-between text-sm"><span className="font-semibold text-slate-600">{statusLabels[status] || status}</span><strong>{count.toLocaleString('vi-VN')}</strong></div><div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{width:((count/max)*100)+'%'}} /></div></div>) : <p className="text-sm text-slate-400">Chưa có dữ liệu đơn thuê.</p>}</div></section>
        <section className="rounded-[22px] bg-[#10383b] p-7 text-white"><p className="text-xs font-extrabold uppercase tracking-[.16em] text-emerald-300">HIỆU SUẤT ĐỘI XE</p><h2 className="mt-3 text-2xl font-extrabold">Sẵn sàng đón chuyến mới.</h2><div className="mt-7 flex items-center gap-5"><div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-full border-[10px] border-emerald-400/80 bg-[#19474a]"><strong className="text-2xl">{data.fleet.total ? Math.round(data.fleet.active/data.fleet.total*100) : 0}%</strong></div><p className="text-sm leading-7 text-emerald-50/80">Tỷ lệ xe đang ở trạng thái hoạt động trên tổng đội xe.</p></div><div className="mt-8 grid grid-cols-2 gap-3"><div className="rounded-xl bg-white/10 p-4"><p className="text-xs text-emerald-100/70">Đang bảo trì</p><strong className="mt-2 block text-2xl">{data.fleet.maintenance}</strong></div><div className="rounded-xl bg-white/10 p-4"><p className="text-xs text-emerald-100/70">Ngừng khai thác</p><strong className="mt-2 block text-2xl">{data.fleet.inactive}</strong></div></div></section>
      </div>
      <div className="mt-7 rounded-2xl border border-amber-100 bg-amber-50 p-5 text-sm leading-7 text-amber-900"><strong>Lưu ý dữ liệu:</strong> Báo cáo hiển thị các chỉ số vận hành, chưa phải báo cáo doanh thu/đối soát thanh toán. Giá thuê và cọc không được cộng như doanh thu đã thu.</div>
      <p className="mt-6 text-xs text-slate-400">Dữ liệu tạo lúc: {new Date(data.generatedAt).toLocaleString('vi-VN')}</p>
    </>}
  </div>;
}
