import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, LoadingState, money, SectionHeading, timeText } from '../../components/Brand';
import { api } from '../../services/api';

type Booking = {
  id: number; status: string; pickupAt: string; returnAt: string;
  rentalAmount: string;
  customer?: { fullName: string; email: string };
  vehicle?: { code: string; model?: { name: string; brand: string }; station?: { name: string } };
};
const statuses: Record<string,string> = { PENDING:'Chờ xác nhận', CONFIRMED:'Đã xác nhận', RENTING:'Đang thuê', COMPLETED:'Hoàn thành', CANCELLED:'Đã hủy', EXPIRED:'Hết hạn' };
const apiError = (e: unknown) => {
  const m = (e as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  return Array.isArray(m) ? m.join(', ') : m || 'Thao tác chưa thành công. Vui lòng thử lại.';
};
export function OperationsPage() {
  const [items,setItems] = useState<Booking[]>([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const [filter,setFilter] = useState('ALL');
  const [busy,setBusy] = useState<number | null>(null);
  const [handover,setHandover] = useState<{ id: number; kind: 'pickup' | 'return' } | null>(null);
  const [battery,setBattery] = useState('80');
  const [odometer,setOdometer] = useState('');
  const [condition,setCondition] = useState('Xe hoạt động bình thường');
  const load = useCallback(async () => {
    setLoading(true);
    try { const { data } = await api.get('/bookings/operations'); setItems(Array.isArray(data) ? data : data?.items ?? []); setError(''); }
    catch(e) { setError(apiError(e)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); },[load]);
  const visible = filter === 'ALL' ? items : items.filter(item => item.status === filter);
  async function confirm(id: number) {
    if (!window.confirm('Xác nhận đơn thuê #' + id + '?')) return;
    setBusy(id);setError('');setNotice('');
    try { await api.patch('/bookings/' + id + '/confirm'); setNotice('Đã xác nhận đơn #' + id); await load(); }
    catch(e){setError(apiError(e));}
    finally{setBusy(null);}
  }
  async function submitHandover(event: React.FormEvent) {
    event.preventDefault();
    if (!handover) return;
    const percent = Number(battery), km = Number(odometer);
    if (!Number.isInteger(percent) || percent < 0 || percent > 100 || !Number.isFinite(km) || km < 0) { setError('Vui lòng nhập mức pin 0–100% và số km hợp lệ.'); return; }
    setBusy(handover.id);setError('');setNotice('');
    try {
      await api.post('/bookings/' + handover.id + '/' + handover.kind, { batteryPercent: percent, odometerKm: km, conditionNote: condition });
      setNotice(handover.kind === 'pickup' ? 'Đã bàn giao xe thành công.' : 'Đã ghi nhận nhận lại xe.');
      setHandover(null); await load();
    } catch(e) { setError(apiError(e)); } finally { setBusy(null); }
  }
  return <div className="container-page py-12 sm:py-16">
    <div className="flex flex-wrap items-end justify-between gap-6"><SectionHeading eyebrow="TRUNG TÂM VẬN HÀNH" title="Điều phối đơn thuê" description="Xác nhận đặt xe, ghi nhận bàn giao và nhận trả phương tiện. Danh sách giới hạn 100 đơn gần nhất theo quyền tài khoản."/><div className="flex flex-wrap gap-2"><Link to="/maintenance" className="btn-outline">Bảo dưỡng ↗</Link><Link to="/locations" className="btn-outline">Vị trí xe ↗</Link><Link to="/admin/dashboard" className="btn-outline">Báo cáo ↗</Link></div></div>
    <div className="mt-8 flex flex-wrap items-center justify-between gap-4"><div className="flex flex-wrap gap-2">{[{value:'ALL',label:'Tất cả'},...Object.entries(statuses).map(([value,label])=>({value,label}))].map(x => <button key={x.value} onClick={()=>setFilter(x.value)} className={'rounded-full px-4 py-2 text-xs font-extrabold '+(filter===x.value?'bg-[#10373b] text-white':'bg-white text-slate-600')}>{x.label}</button>)}</div><button className="btn-outline" onClick={()=>void load()}>↻ Làm mới</button></div>
    {notice && <div role="status" className="mt-6 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</div>}
    {error && <div role="alert" className="mt-6 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
    {loading ? <div className="mt-6"><LoadingState label="Đang tải danh sách đơn..." /></div> : !visible.length ? <div className="mt-6"><EmptyState title="Không có đơn thuê phù hợp" description="Đơn mới sẽ xuất hiện sau khi khách gửi yêu cầu đặt xe." /></div> : <div className="mt-6 grid gap-5">{visible.map(b => <article key={b.id} className="panel flex flex-wrap items-center justify-between gap-6 p-6"><div><p className="text-xs font-extrabold tracking-wider text-slate-400">ĐƠN #{b.id} · {statuses[b.status] || b.status}</p><h3 className="mt-2 text-lg font-extrabold">{b.vehicle?.model?.brand} {b.vehicle?.model?.name} <span className="text-slate-400">({b.vehicle?.code})</span></h3><p className="mt-2 text-sm text-slate-600">Khách: {b.customer?.fullName || b.customer?.email || '—'}</p><p className="mt-2 text-sm text-slate-500">{timeText(b.pickupAt)} → {timeText(b.returnAt)}</p><p className="mt-2 text-sm font-bold text-emerald-700">{money(b.rentalAmount)} · {b.vehicle?.station?.name}</p></div><div className="flex flex-wrap gap-2"><Link to={'/bookings/' + b.id + '/payments'} className="btn-outline">Thanh toán</Link>{b.status==='PENDING' && <button disabled={busy===b.id} onClick={()=>void confirm(b.id)} className="btn-primary">Xác nhận đơn</button>}{b.status==='CONFIRMED' && <button onClick={()=>{setHandover({id:b.id,kind:'pickup'});setError('');}} className="btn-dark">Bàn giao xe →</button>}{b.status==='RENTING' && <button onClick={()=>{setHandover({id:b.id,kind:'return'});setError('');}} className="btn-dark">Nhận trả xe →</button>}</div></article>)}</div>}
    {handover && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#071c21]/70 p-4" onMouseDown={e=>{if(e.target===e.currentTarget)setHandover(null);}}><form onSubmit={submitHandover} role="dialog" aria-modal="true" aria-labelledby="handover-title" className="w-full max-w-lg rounded-3xl bg-white p-7 shadow-2xl"><div className="flex justify-between"><div><p className="eyebrow">BIÊN BẢN XE</p><h2 id="handover-title" className="mt-2 text-2xl font-extrabold">{handover.kind==='pickup'?'Bàn giao xe':'Nhận xe trả'} · #{handover.id}</h2></div><button type="button" onClick={()=>setHandover(null)} className="self-start rounded-lg bg-slate-100 px-3 py-2" aria-label="Đóng">✕</button></div><div className="mt-7 grid gap-5"><label><span className="field-label">Pin hiện tại (%)</span><input type="number" min="0" max="100" step="1" required className="field" value={battery} onChange={e=>setBattery(e.target.value)}/></label><label><span className="field-label">Số km đồng hồ</span><input type="number" min="0" step="0.1" required className="field" value={odometer} onChange={e=>setOdometer(e.target.value)}/></label><label><span className="field-label">Ghi chú tình trạng xe</span><textarea maxLength={1000} required className="field min-h-28" value={condition} onChange={e=>setCondition(e.target.value)}/></label>{error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}<button disabled={busy===handover.id} className="btn-primary w-full">{busy===handover.id?'Đang lưu...':'Lưu biên bản →'}</button></div></form></div>}
  </div>;
}
