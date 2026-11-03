import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { EmptyState, LoadingState, money, SectionHeading, timeText } from '../../components/Brand';
import { api } from '../../services/api';

type BookingStatus = 'PENDING' | 'CONFIRMED' | 'RENTING' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';
type Booking = {
  id: number; status: BookingStatus; pickupAt: string; returnAt: string;
  rentalAmount: string; depositSnapshot: string; holdExpiresAt: string | null;
  cancelReason?: string | null;
  vehicle?: { code: string; model?: { brand: string; name: string }; station?: { name: string } };
};
const labels: Record<BookingStatus, string> = { PENDING: 'Chờ xác nhận', CONFIRMED: 'Đã xác nhận', RENTING: 'Đang thuê', COMPLETED: 'Hoàn thành', CANCELLED: 'Đã hủy', EXPIRED: 'Hết hạn' };
const badge: Record<BookingStatus, string> = { PENDING: 'bg-amber-50 text-amber-700', CONFIRMED: 'bg-blue-50 text-blue-700', RENTING: 'bg-emerald-50 text-emerald-700', COMPLETED: 'bg-slate-100 text-slate-700', CANCELLED: 'bg-rose-50 text-rose-700', EXPIRED: 'bg-slate-100 text-slate-600' };
function getError(error: unknown) { return (error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Không thể thực hiện thao tác. Vui lòng thử lại.'; }

export function MyBookingsPage() {
  const [items, setItems] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [filter, setFilter] = useState('ALL');
  const [params] = useSearchParams();
  const loggedIn = Boolean(localStorage.getItem('accessToken'));
  const load = useCallback(async () => {
    if (!loggedIn) { setLoading(false); return; }
    setLoading(true); setError('');
    try { const { data } = await api.get('/bookings/my'); setItems(Array.isArray(data) ? data : data?.items ?? []); }
    catch (err) { setError(getError(err)); }
    finally { setLoading(false); }
  }, [loggedIn]);
  useEffect(() => { void load(); }, [load]);
  const visible = filter === 'ALL' ? items : items.filter(b => b.status === filter);
  async function cancel(booking: Booking) {
    if (!window.confirm('Bạn có chắc muốn hủy đơn #' + booking.id + '?')) return;
    setBusyId(booking.id); setError('');
    try { await api.patch('/bookings/' + booking.id + '/cancel', { reason: 'Khách hàng chủ động hủy' }); await load(); }
    catch (err) { setError(getError(err)); }
    finally { setBusyId(null); }
  }
  return <div className="container-page py-12 sm:py-16">
    <div className="flex flex-wrap items-end justify-between gap-6"><SectionHeading eyebrow="HÀNH TRÌNH CỦA TÔI" title="Quản lý đơn thuê" description="Theo dõi lịch nhận và trả xe, trạng thái đặt chỗ và chi phí trong từng chuyến đi."/><Link to="/vehicles" className="btn-dark">+ Đặt xe mới</Link></div>
    {params.get('created') === '1' && <div role="status" className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm font-semibold text-emerald-800">✓ Đặt xe thành công! Đơn của bạn đã được gửi và đang chờ xác nhận.</div>}
    {!loggedIn ? <div className="mt-8"><EmptyState title="Đăng nhập để xem đơn thuê" description="Bạn cần đăng nhập để theo dõi đơn và lịch sử đặt xe." action={<Link className="btn-primary" to="/login?redirect=%2Fbookings%2Fmy">Đăng nhập →</Link>} /></div> : <>
      <div className="mt-8 flex flex-wrap gap-2">{[{value:'ALL',label:'Tất cả'},...Object.entries(labels).map(([value,label]) => ({value,label}))].map(item => <button key={item.value} onClick={() => setFilter(item.value)} className={'rounded-full px-4 py-2 text-xs font-bold transition ' + (filter === item.value ? 'bg-[#102f33] text-white' : 'bg-white text-slate-500 hover:bg-emerald-50')}>{item.label}</button>)}</div>
      {error && <div role="alert" className="mt-6 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error} <button onClick={() => void load()} className="ml-2 font-bold underline">Thử lại</button></div>}
      {loading ? <div className="mt-6"><LoadingState label="Đang tải đơn thuê..." /></div> : !visible.length ? <div className="mt-6"><EmptyState title="Chưa có đơn thuê phù hợp" description="Khám phá danh sách xe và bắt đầu hành trình mới tại Đà Nẵng." action={<Link to="/vehicles" className="btn-primary">Khám phá xe ↗</Link>} /></div> : <div className="mt-6 space-y-5">{visible.map(b => <article key={b.id} className="panel overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-6"><div><span className="text-xs font-bold uppercase tracking-widest text-slate-400">MÃ ĐƠN #{b.id}</span><h3 className="mt-2 text-xl font-extrabold">{b.vehicle?.model ? b.vehicle.model.brand + ' ' + b.vehicle.model.name : 'Xe máy điện'}</h3><p className="mt-1 text-xs text-slate-500">{b.vehicle?.code} · {b.vehicle?.station?.name}</p></div><span className={'rounded-full px-4 py-2 text-xs font-bold ' + (badge[b.status] || 'bg-slate-100')}>{labels[b.status] || b.status}</span></div><div className="grid gap-6 p-6 md:grid-cols-3"><div><p className="field-label">Nhận xe</p><p className="text-sm font-bold">{timeText(b.pickupAt)}</p></div><div><p className="field-label">Trả xe</p><p className="text-sm font-bold">{timeText(b.returnAt)}</p></div><div><p className="field-label">Tiền thuê</p><p className="text-xl font-extrabold text-emerald-700">{money(b.rentalAmount)}</p><p className="mt-1 text-xs text-slate-400">Đặt cọc: {money(b.depositSnapshot)}</p></div></div>{(b.status === 'PENDING' || b.status === 'CONFIRMED' || b.cancelReason) && <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 px-6 py-4"><p className="text-xs leading-6 text-slate-500">{b.status === 'PENDING' && b.holdExpiresAt ? 'Thời hạn giữ chỗ: ' + timeText(b.holdExpiresAt) : b.cancelReason ? 'Lý do: ' + b.cancelReason : 'Vui lòng theo dõi để nhận xe đúng lịch.'}</p>{['PENDING', 'CONFIRMED'].includes(b.status) && <button disabled={busyId === b.id} onClick={() => void cancel(b)} className="rounded-lg border border-rose-200 px-4 py-2 text-xs font-extrabold text-rose-700 hover:bg-rose-50">{busyId === b.id ? 'Đang hủy...' : 'Hủy đơn'}</button>}</div>}</article>)}</div>}
    </>}
  </div>;
}
