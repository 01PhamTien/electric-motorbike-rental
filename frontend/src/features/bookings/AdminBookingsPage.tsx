import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../services/api';

type Booking = {
  id: number; status: string; pickupAt: string; returnAt: string;
  rentalAmount: string; dailyRateSnapshot: string; depositSnapshot: string;
  holdExpiresAt?: string | null; cancelReason?: string | null; createdAt: string;
  customer?: { fullName?: string; email?: string; phone?: string };
  vehicle?: { code?: string; licensePlate?: string; model?: { brand?: string; name?: string }; station?: { name?: string } };
};
type History = { id: number; fromStatus: string; toStatus: string; reason?: string | null; createdAt: string };
const labels: Record<string, string> = {
  PENDING: 'Chờ xác nhận', CONFIRMED: 'Đã xác nhận', RENTING: 'Đang thuê',
  COMPLETED: 'Hoàn thành', CANCELLED: 'Đã hủy', EXPIRED: 'Hết hạn giữ chỗ',
};
const money = (value: string | number) => Number(value).toLocaleString('vi-VN', { maximumFractionDigits: 0 }) + ' đ';
const date = (value: string) => new Date(value).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
const badge = (status: string) => ({
  PENDING: 'bg-amber-50 text-amber-700', CONFIRMED: 'bg-blue-50 text-blue-700',
  RENTING: 'bg-violet-50 text-violet-700', COMPLETED: 'bg-emerald-50 text-emerald-700',
  CANCELLED: 'bg-rose-50 text-rose-700', EXPIRED: 'bg-slate-100 text-slate-600',
}[status] || 'bg-slate-100 text-slate-600');

export function AdminBookingsPage() {
  const [items, setItems] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState<number | null>(null);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selected, setSelected] = useState<Booking | null>(null);
  const [history, setHistory] = useState<History[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await api.get<Booking[]>('/bookings/operations');
      setItems(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không tải được danh sách đơn thuê. Hãy đăng nhập bằng ADMIN.');
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => items.filter(item => {
    const text = [item.id, item.customer?.fullName, item.customer?.email, item.customer?.phone,
      item.vehicle?.code, item.vehicle?.licensePlate, item.vehicle?.model?.brand,
      item.vehicle?.model?.name, item.vehicle?.station?.name].join(' ').toLowerCase();
    return text.includes(keyword.toLowerCase()) && (statusFilter === 'ALL' || item.status === statusFilter);
  }), [items, keyword, statusFilter]);

  async function confirmBooking(item: Booking) {
    if (!window.confirm('Xác nhận đơn thuê #' + item.id + '?')) return;
    setBusy(item.id); setError(''); setMessage('');
    try {
      await api.patch('/bookings/' + item.id + '/confirm');
      setMessage('Đã xác nhận đơn thuê #' + item.id + '.');
      await load();
    } catch (err: any) { setError(err.response?.data?.message || 'Không thể xác nhận đơn thuê.'); }
    finally { setBusy(null); }
  }

  async function cancelBooking(item: Booking) {
    const reason = window.prompt('Nhập lý do hủy đơn #' + item.id + ':');
    if (reason === null) return;
    if (!reason.trim()) { setError('Vui lòng nhập lý do hủy đơn.'); return; }
    setBusy(item.id); setError(''); setMessage('');
    try {
      await api.patch('/bookings/' + item.id + '/cancel', { reason: reason.trim() });
      setMessage('Đã hủy đơn thuê #' + item.id + '.');
      await load();
      if (selected?.id === item.id) setSelected({ ...item, status: 'CANCELLED', cancelReason: reason.trim() });
    } catch (err: any) { setError(err.response?.data?.message || 'Không thể hủy đơn thuê.'); }
    finally { setBusy(null); }
  }

  async function openDetails(item: Booking) {
    setSelected(item); setHistory([]); setHistoryLoading(true); setError('');
    try {
      const response = await api.get<History[]>('/bookings/' + item.id + '/history');
      setHistory(response.data);
    } catch (err: any) { setError(err.response?.data?.message || 'Không tải được lịch sử đơn thuê.'); }
    finally { setHistoryLoading(false); }
  }

  const count = (status: string) => items.filter(item => item.status === status).length;

  return <section className="space-y-6">
    <header className="relative overflow-hidden rounded-3xl bg-slate-950 px-6 py-7 text-white shadow-lg sm:px-8">
      <div className="pointer-events-none absolute -right-14 -top-20 h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="relative flex flex-wrap items-end justify-between gap-4">
        <div><span className="inline-flex rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[11px] font-bold tracking-[0.15em] text-cyan-200">ĐIỀU HÀNH TOÀN HỆ THỐNG</span>
          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">Quản lý đơn thuê</h1>
          <p className="mt-2 text-sm text-slate-300">Theo dõi đơn đặt xe, xác nhận hoặc hủy đơn và xem lịch sử xử lý.</p></div>
        <button onClick={() => void load()} disabled={loading} className="rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/15 disabled:opacity-50">{loading ? 'Đang tải...' : '↻ Làm mới'}</button>
      </div>
    </header>

    {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{Array.isArray(error) ? error.join(', ') : error}</div>}
    {message && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{message}</div>}

    <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {Object.entries(labels).map(([status, label]) => <article key={status} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold text-slate-900">{count(status)}</p></article>)}
    </div>

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 p-5"><div><h2 className="font-bold text-slate-900">Danh sách đơn thuê</h2><p className="mt-1 text-xs text-slate-500">{filtered.length} / {items.length} đơn</p></div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <input value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="Tìm mã đơn, khách, biển số..." className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"><option value="ALL">Mọi trạng thái</option>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        </div></div>
      {loading ? <p className="p-5 text-sm text-slate-500">Đang tải đơn thuê...</p> : filtered.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">Không có đơn thuê phù hợp.</p> :
        <div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Đơn / Khách hàng</th><th className="px-5 py-3">Phương tiện</th><th className="px-5 py-3">Thời gian thuê</th><th className="px-5 py-3">Tổng tiền thuê</th><th className="px-5 py-3">Trạng thái</th><th className="px-5 py-3">Thao tác</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{filtered.map(item => <tr key={item.id} className="transition hover:bg-slate-50/70">
            <td className="px-5 py-4"><p className="font-bold text-slate-900">Đơn #{item.id}</p><p className="mt-1 text-xs text-slate-600">{item.customer?.fullName || 'Khách hàng'}</p><p className="text-xs text-slate-400">{item.customer?.phone || item.customer?.email || ''}</p></td>
            <td className="px-5 py-4"><p className="font-semibold text-slate-800">{item.vehicle?.model?.brand} {item.vehicle?.model?.name}</p><p className="mt-1 text-xs text-slate-500">{item.vehicle?.code} · {item.vehicle?.licensePlate}</p><p className="text-xs text-slate-400">{item.vehicle?.station?.name}</p></td>
            <td className="px-5 py-4"><p className="text-xs text-slate-500">Nhận: {date(item.pickupAt)}</p><p className="mt-1 text-xs text-slate-500">Trả: {date(item.returnAt)}</p></td>
            <td className="px-5 py-4"><p className="font-bold text-slate-900">{money(item.rentalAmount)}</p><p className="mt-1 text-xs text-slate-400">Cọc {money(item.depositSnapshot)}</p></td>
            <td className="px-5 py-4"><span className={'rounded-full px-2.5 py-1 text-xs font-bold ' + badge(item.status)}>{labels[item.status] || item.status}</span>{item.status === 'PENDING' && item.holdExpiresAt && <p className="mt-1 text-[11px] text-slate-400">Giữ chỗ đến {date(item.holdExpiresAt)}</p>}</td>
            <td className="px-5 py-4"><div className="flex items-center gap-2"><button onClick={() => void openDetails(item)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Chi tiết</button>
              {item.status === 'PENDING' && <button disabled={busy === item.id} onClick={() => void confirmBooking(item)} className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Xác nhận</button>}
              {['PENDING', 'CONFIRMED'].includes(item.status) && <button disabled={busy === item.id} onClick={() => void cancelBooking(item)} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50">Hủy</button>}</div></td>
          </tr>)}</tbody>
        </table></div>}
    </section>

    {selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" onClick={e => { if (e.target === e.currentTarget) setSelected(null); }}>
      <section className="max-h-[90vh] w-full max-w-2xl space-y-5 overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold tracking-wider text-blue-700">CHI TIẾT ĐƠN THUÊ</p><h2 className="mt-1 text-xl font-bold text-slate-900">Đơn #{selected.id}</h2></div><button onClick={() => setSelected(null)} className="rounded-lg border px-3 py-1.5 text-sm">Đóng</button></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Khách hàng</p><p className="mt-1 font-semibold">{selected.customer?.fullName || '—'}</p><p className="text-sm text-slate-500">{selected.customer?.phone || selected.customer?.email || '—'}</p></div>
          <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Phương tiện</p><p className="mt-1 font-semibold">{selected.vehicle?.model?.brand} {selected.vehicle?.model?.name}</p><p className="text-sm text-slate-500">{selected.vehicle?.code} · {selected.vehicle?.licensePlate}</p></div>
          <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Thời gian nhận / trả</p><p className="mt-1 text-sm font-semibold">{date(selected.pickupAt)}</p><p className="text-sm font-semibold">{date(selected.returnAt)}</p></div>
          <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Giá thuê / Tiền cọc</p><p className="mt-1 font-semibold">{money(selected.rentalAmount)}</p><p className="text-sm text-slate-500">Cọc: {money(selected.depositSnapshot)}</p></div>
        </div>
        {selected.cancelReason && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">Lý do hủy: {selected.cancelReason}</p>}
        <div><h3 className="font-bold text-slate-900">Lịch sử trạng thái</h3>
          {historyLoading ? <p className="mt-3 text-sm text-slate-500">Đang tải lịch sử...</p> : history.length === 0 ? <p className="mt-3 text-sm text-slate-500">Chưa có lịch sử trạng thái.</p> :
            <ol className="mt-3 space-y-3 border-l-2 border-slate-100 pl-4">{history.map(entry => <li key={entry.id}><p className="text-sm font-semibold text-slate-800">{labels[entry.toStatus] || entry.toStatus}</p><p className="mt-0.5 text-xs text-slate-500">{date(entry.createdAt)} · {entry.reason || 'Cập nhật trạng thái'}</p></li>)}</ol>}
        </div>
      </section>
    </div>}
  </section>;
}
