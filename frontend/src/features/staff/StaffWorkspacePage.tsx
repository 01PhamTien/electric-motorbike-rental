import { FormEvent, useEffect, useState } from 'react';
import { api } from '../../services/api';

type Booking = {
  id: number; status: string; pickupAt: string; returnAt: string;
  rentalAmount: string; depositSnapshot: string;
  customer?: { fullName?: string; phone?: string; email?: string };
  vehicle?: { code?: string; licensePlate?: string; model?: { name?: string }; station?: { name?: string } };
};
type HandoverKind = 'pickup' | 'return';
type HandoverForm = { batteryPercent: string; odometerKm: string; conditionNote: string };

const statusText: Record<string,string> = {
  PENDING: 'Chờ xác nhận', CONFIRMED: 'Chờ giao xe', RENTING: 'Đang thuê',
  COMPLETED: 'Đã hoàn thành', CANCELLED: 'Đã hủy', EXPIRED: 'Hết hạn',
};

export function StaffWorkspacePage() {
  const [items, setItems] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [active, setActive] = useState<Booking | null>(null);
  const [kind, setKind] = useState<HandoverKind>('pickup');
  const [form, setForm] = useState<HandoverForm>({ batteryPercent: '90', odometerKm: '', conditionNote: '' });
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true); setError('');
    try {
      const response = await api.get<Booking[]>('/bookings/operations');
      setItems(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không tải được đơn vận hành. Hãy đăng nhập bằng tài khoản STAFF hoặc ADMIN.');
    } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  async function confirmBooking(item: Booking) {
    if (!window.confirm(`Xác nhận đơn thuê #${item.id}?`)) return;
    setError(''); setMessage('');
    try { await api.patch(`/bookings/${item.id}/confirm`); setMessage(`Đã xác nhận đơn #${item.id}.`); await load(); }
    catch (err: any) { setError(err.response?.data?.message || 'Không thể xác nhận đơn.'); }
  }

  function openHandover(item: Booking, action: HandoverKind) {
    setActive(item); setKind(action);
    setForm({ batteryPercent: action === 'pickup' ? '95' : '60', odometerKm: '', conditionNote: '' });
  }

  async function submitHandover(event: FormEvent) {
    event.preventDefault(); if (!active) return;
    setSaving(true); setError(''); setMessage('');
    try {
      await api.post(`/bookings/${active.id}/${kind}`, {
        batteryPercent: Number(form.batteryPercent),
        odometerKm: Number(form.odometerKm),
        conditionNote: form.conditionNote.trim(),
      });
      setMessage(kind === 'pickup' ? `Đã giao xe cho đơn #${active.id}.` : `Đã nhận xe trả cho đơn #${active.id}.`);
      setActive(null); await load();
    } catch (err: any) { setError(err.response?.data?.message || 'Không thể lưu biên bản giao nhận.'); }
    finally { setSaving(false); }
  }

  const pending = items.filter(x => x.status === 'PENDING').length;
  const confirmed = items.filter(x => x.status === 'CONFIRMED').length;
  const renting = items.filter(x => x.status === 'RENTING').length;

  return <section className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-sm font-semibold text-blue-700">KHU VỰC NHÂN VIÊN</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Bàn làm việc vận hành</h1>
        <p className="mt-1 text-sm text-slate-600">Danh sách đơn tại điểm thuê được phân công.</p></div>
      <button onClick={() => void load()} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50">Làm mới</button>
    </div>
    {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{Array.isArray(error) ? error.join(', ') : error}</div>}
    {message && <div role="status" className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">{message}</div>}

    <div className="grid gap-3 sm:grid-cols-3">
      {[['Chờ xác nhận',pending],['Chờ giao xe',confirmed],['Đang thuê',renting]].map(([label,value]) =>
        <div key={label} className="rounded-xl border bg-white p-4 shadow-sm"><p className="text-sm text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></div>)}
    </div>

    <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
      <div className="border-b p-5"><h2 className="font-semibold">Đơn thuê cần xử lý ({items.length})</h2></div>
      {loading ? <p className="p-5 text-sm text-slate-500">Đang tải danh sách...</p> :
       items.length === 0 ? <p className="p-5 text-sm text-slate-500">Chưa có đơn thuê tại điểm được phân công.</p> :
       <div className="divide-y">{items.map(item => <article key={item.id} className="space-y-3 p-5">
         <div className="flex flex-wrap items-start justify-between gap-3">
           <div><p className="font-semibold text-slate-900">Đơn thuê #{item.id} · {item.vehicle?.code || item.vehicle?.licensePlate || 'Xe'}</p>
             <p className="mt-1 text-sm text-slate-600">{item.vehicle?.model?.name || 'Mẫu xe'} · {item.vehicle?.station?.name || 'Điểm thuê'}</p>
             <p className="mt-1 text-sm text-slate-600">Khách: {item.customer?.fullName || item.customer?.email || '—'} {item.customer?.phone ? `· ${item.customer.phone}` : ''}</p>
           </div>
           <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">{statusText[item.status] || item.status}</span>
         </div>
         <div className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
           <p>Nhận xe: {new Date(item.pickupAt).toLocaleString('vi-VN')}</p>
           <p>Trả dự kiến: {new Date(item.returnAt).toLocaleString('vi-VN')}</p>
           <p>Tiền thuê: {Number(item.rentalAmount).toLocaleString('vi-VN')} đ</p>
           <p>Tiền cọc: {Number(item.depositSnapshot).toLocaleString('vi-VN')} đ</p>
         </div>
         <div className="flex flex-wrap gap-2">
           {item.status === 'PENDING' && <button onClick={() => void confirmBooking(item)} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white">Xác nhận đơn</button>}
           {item.status === 'CONFIRMED' && <button onClick={() => openHandover(item,'pickup')} className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white">Lập biên bản giao xe</button>}
           {item.status === 'RENTING' && <button onClick={() => openHandover(item,'return')} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white">Lập biên bản nhận xe trả</button>}
         </div>
       </article>)}</div>}
    </div>

    {active && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <form onSubmit={submitHandover} className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6 shadow-xl">
        <div><h2 className="text-lg font-bold">{kind === 'pickup' ? 'Biên bản giao xe' : 'Biên bản nhận xe trả'} · Đơn #{active.id}</h2>
          <p className="mt-1 text-sm text-slate-500">Nhập số liệu thực tế tại thời điểm bàn giao.</p></div>
        <label className="block text-sm font-medium">Pin còn lại (%)
          <input required type="number" min="0" max="100" value={form.batteryPercent} onChange={e=>setForm({...form,batteryPercent:e.target.value})} className="mt-1 w-full rounded-lg border px-3 py-2"/>
        </label>
        <label className="block text-sm font-medium">Công-tơ-mét (km)
          <input required type="number" min="0" step="0.1" value={form.odometerKm} onChange={e=>setForm({...form,odometerKm:e.target.value})} className="mt-1 w-full rounded-lg border px-3 py-2"/>
        </label>
        <label className="block text-sm font-medium">Tình trạng xe
          <textarea required maxLength={1000} value={form.conditionNote} onChange={e=>setForm({...form,conditionNote:e.target.value})} className="mt-1 w-full rounded-lg border px-3 py-2" rows={3} placeholder="Mô tả tình trạng xe, phụ kiện, hư hỏng nếu có..."/>
        </label>
        <div className="flex justify-end gap-2"><button type="button" onClick={()=>setActive(null)} className="rounded-lg border px-4 py-2 text-sm">Hủy</button>
          <button disabled={saving} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Đang lưu...' : 'Lưu biên bản'}</button></div>
      </form>
    </div>}
  </section>;
}
