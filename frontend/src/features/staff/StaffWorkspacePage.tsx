import { FormEvent, useEffect, useState } from 'react';
import { api } from '../../services/api';

type Booking = {
  id: number; status: string; pickupAt: string; returnAt: string;
  rentalAmount: string; depositSnapshot: string;
  customer?: { fullName?: string; phone?: string; email?: string };
  vehicle?: { code?: string; licensePlate?: string; model?: { name?: string }; station?: { name?: string } };
};
type HandoverKind = 'pickup' | 'return';
type SettlementSummary = {
  bookingId: number; status: string; currency: string;
  rental: { amountDue: number; collected: number; outstanding: number };
  deposit: { amountExpected: number; collected: number; deductions: number; refunded: number; refundable: number; deductionExceedsCollected: boolean };
  extras: { separatelyBillable: number; collected: number; outstanding: number; deductedFromDeposit: number };
  cashFlow: { totalCollected: number; totalRefunded: number; net: number };
  canRefundDeposit: boolean;
};
type HandoverForm = { batteryPercent: string; odometerKm: string; conditionNote: string; imageUrls: string };

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
  const [form, setForm] = useState<HandoverForm>({ batteryPercent: '90', odometerKm: '', conditionNote: '', imageUrls: '' });
  const [saving, setSaving] = useState(false);
  const [settlementBooking, setSettlementBooking] = useState<Booking | null>(null);
  const [settlement, setSettlement] = useState<SettlementSummary | null>(null);
  const [settlementLoading, setSettlementLoading] = useState(false);
  const [paymentPurpose, setPaymentPurpose] = useState<'RENT'|'DEPOSIT'|'EXTRA'|'REFUND'>('RENT');
  const [paymentMethod, setPaymentMethod] = useState<'CASH'|'TRANSFER'>('CASH');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [chargeCategory, setChargeCategory] = useState('DAMAGE');
  const [chargeAmount, setChargeAmount] = useState('');
  const [chargeReason, setChargeReason] = useState('');
  const [chargeToDeposit, setChargeToDeposit] = useState(true);
  const [chargeSaving, setChargeSaving] = useState(false);

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

  async function openSettlement(item: Booking) {
    setSettlementBooking(item); setSettlement(null); setSettlementLoading(true);
    setPaymentPurpose('RENT'); setPaymentAmount(''); setPaymentNote('');
    setError(''); setMessage('');
    try {
      const response = await api.get<SettlementSummary>(`/bookings/${item.id}/payments/summary`);
      setSettlement(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không tải được bảng quyết toán.');
      setSettlementBooking(null);
    } finally { setSettlementLoading(false); }
  }

  async function recordPayment(event: FormEvent) {
    event.preventDefault();
    if (!settlementBooking || !paymentAmount || Number(paymentAmount) <= 0) return;
    setPaymentSaving(true); setError(''); setMessage('');
    try {
      await api.post(`/bookings/${settlementBooking.id}/payments`, {
        purpose: paymentPurpose,
        method: paymentMethod,
        amount: Number(paymentAmount),
        idempotencyKey: crypto.randomUUID(),
        note: paymentNote.trim() || undefined,
      });
      const response = await api.get<SettlementSummary>(`/bookings/${settlementBooking.id}/payments/summary`);
      setSettlement(response.data);
      setPaymentAmount(''); setPaymentNote('');
      setMessage('Đã ghi nhận giao dịch và cập nhật quyết toán.');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không thể ghi nhận giao dịch.');
    } finally { setPaymentSaving(false); }
  }

  async function addSettlementCharge(event: FormEvent) {
    event.preventDefault();
    if (!settlementBooking || !chargeAmount || Number(chargeAmount) <= 0 || !chargeReason.trim()) return;
    setChargeSaving(true); setError(''); setMessage('');
    try {
      await api.post(`/bookings/${settlementBooking.id}/charges`, {
        category: chargeCategory.trim().toUpperCase(),
        amount: Number(chargeAmount),
        applyToDeposit: chargeToDeposit,
        reason: chargeReason.trim(),
      });
      const response = await api.get<SettlementSummary>(`/bookings/${settlementBooking.id}/payments/summary`);
      setSettlement(response.data);
      setChargeAmount(''); setChargeReason('');
      setMessage('Đã ghi nhận khoản phụ phí vào quyết toán.');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không thể ghi nhận phụ phí.');
    } finally { setChargeSaving(false); }
  }

  function suggestedAmount(purpose: 'RENT'|'DEPOSIT'|'EXTRA'|'REFUND') {
    if (!settlement) return 0;
    if (purpose === 'RENT') return settlement.rental.outstanding;
    if (purpose === 'DEPOSIT') return Math.max(0, settlement.deposit.amountExpected - settlement.deposit.collected);
    if (purpose === 'EXTRA') return settlement.extras.outstanding;
    return settlement.deposit.refundable;
  }

  function openHandover(item: Booking, action: HandoverKind) {
    setActive(item); setKind(action);
    setForm({ batteryPercent: action === 'pickup' ? '95' : '60', odometerKm: '', conditionNote: '', imageUrls: '' });
  }

  async function submitHandover(event: FormEvent) {
    event.preventDefault(); if (!active) return;
    setSaving(true); setError(''); setMessage('');
    try {
      await api.post(`/bookings/${active.id}/${kind}`, {
        batteryPercent: Number(form.batteryPercent),
        odometerKm: Number(form.odometerKm),
        conditionNote: form.conditionNote.trim(),
        imageUrls: form.imageUrls.split('\n').map(url => url.trim()).filter(Boolean),
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
    <header className="relative overflow-hidden rounded-3xl bg-slate-950 px-6 py-7 text-white shadow-lg sm:px-8">
      <div className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="relative flex flex-wrap items-end justify-between gap-4">
        <div><div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[11px] font-bold tracking-[0.15em] text-cyan-200">TRUNG TÂM VẬN HÀNH</div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Bàn làm việc nhân viên</h1>
          <p className="mt-2 text-sm text-slate-300">Xử lý đơn thuê, giao nhận xe và quyết toán tại điểm thuê được phân công.</p></div>
        <button onClick={() => void load()} disabled={loading} className="rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/15 disabled:opacity-50">{loading ? 'Đang tải...' : '↻ Làm mới dữ liệu'}</button>
      </div>
    </header>
    {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{Array.isArray(error) ? error.join(', ') : error}</div>}
    {message && <div role="status" className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">{message}</div>}

    <div className="grid gap-3 sm:grid-cols-3">
      {[['Chờ xác nhận',pending,'bg-amber-50 text-amber-700','!'],['Chờ giao xe',confirmed,'bg-blue-50 text-blue-700','↗'],['Đang thuê',renting,'bg-emerald-50 text-emerald-700','✓']].map(([label,value,tone,icon]) =>
        <article key={label} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div><p className="text-sm font-medium text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{value}</p><p className="mt-1 text-xs text-slate-400">Đơn tại điểm được phân công</p></div>
          <span className={`flex h-11 w-11 items-center justify-center rounded-xl text-xl font-bold ${tone}`}>{icon}</span>
        </article>)}
    </div>

    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5"><div><h2 className="font-bold text-slate-900">Đơn thuê cần xử lý</h2><p className="mt-1 text-xs text-slate-500">Danh sách công việc theo phạm vi điểm thuê của tài khoản</p></div><span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">{items.length} đơn</span></div>
      {loading ? <p className="p-5 text-sm text-slate-500">Đang tải danh sách...</p> :
       items.length === 0 ? <p className="p-5 text-sm text-slate-500">Chưa có đơn thuê tại điểm được phân công.</p> :
       <div className="divide-y">{items.map(item => <article key={item.id} className="space-y-4 p-5 transition hover:bg-slate-50/70">
         <div className="flex flex-wrap items-start justify-between gap-3">
           <div><p className="font-bold text-slate-950">Đơn thuê #{item.id} · {item.vehicle?.code || item.vehicle?.licensePlate || 'Xe'}</p>
             <p className="mt-1 text-sm text-slate-600">{item.vehicle?.model?.name || 'Mẫu xe'} · {item.vehicle?.station?.name || 'Điểm thuê'}</p>
             <p className="mt-1 text-sm text-slate-600">Khách: {item.customer?.fullName || item.customer?.email || '—'} {item.customer?.phone ? `· ${item.customer.phone}` : ''}</p>
           </div>
           <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">{statusText[item.status] || item.status}</span>
         </div>
         <div className="grid gap-2 rounded-xl bg-slate-50 p-4 text-sm text-slate-600 sm:grid-cols-2">
           <p>Nhận xe: {new Date(item.pickupAt).toLocaleString('vi-VN')}</p>
           <p>Trả dự kiến: {new Date(item.returnAt).toLocaleString('vi-VN')}</p>
           <p>Tiền thuê: {Number(item.rentalAmount).toLocaleString('vi-VN')} đ</p>
           <p>Tiền cọc: {Number(item.depositSnapshot).toLocaleString('vi-VN')} đ</p>
         </div>
         <div className="flex flex-wrap gap-2">
           {item.status === 'PENDING' && <button onClick={() => void confirmBooking(item)} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white">Xác nhận đơn</button>}
           {item.status === 'CONFIRMED' && <button onClick={() => openHandover(item,'pickup')} className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white">Lập biên bản giao xe</button>}
           {item.status === 'RENTING' && <button onClick={() => openHandover(item,'return')} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white">Lập biên bản nhận xe trả</button>}
           <button onClick={() => void openSettlement(item)} className="rounded-lg border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-800">Quyết toán / thanh toán</button>
         </div>
       </article>)}</div>}
    </div>

    {settlementBooking && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div><h2 className="text-lg font-bold">Quyết toán đơn #{settlementBooking.id}</h2>
            <p className="text-sm text-slate-500">{settlementBooking.vehicle?.code} · {statusText[settlementBooking.status] || settlementBooking.status}</p></div>
          <button type="button" onClick={()=>setSettlementBooking(null)} className="rounded-lg border px-3 py-1.5 text-sm">Đóng</button>
        </div>
        {settlementLoading ? <p className="py-8 text-center text-sm text-slate-500">Đang tải quyết toán...</p> : settlement && <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border p-4"><p className="text-sm text-slate-500">Tiền thuê</p><p className="mt-1 text-lg font-bold">{settlement.rental.amountDue.toLocaleString('vi-VN')} đ</p><p className="text-xs text-slate-500">Đã thu {settlement.rental.collected.toLocaleString('vi-VN')} đ · Còn {settlement.rental.outstanding.toLocaleString('vi-VN')} đ</p></div>
            <div className="rounded-xl border p-4"><p className="text-sm text-slate-500">Tiền cọc</p><p className="mt-1 text-lg font-bold">{settlement.deposit.collected.toLocaleString('vi-VN')} đ</p><p className="text-xs text-slate-500">Khấu trừ {settlement.deposit.deductions.toLocaleString('vi-VN')} đ · Đã hoàn {settlement.deposit.refunded.toLocaleString('vi-VN')} đ</p><p className="text-xs font-semibold text-green-700">Có thể hoàn {settlement.deposit.refundable.toLocaleString('vi-VN')} đ</p></div>
            <div className="rounded-xl border p-4"><p className="text-sm text-slate-500">Phụ phí thu riêng</p><p className="mt-1 text-lg font-bold">{settlement.extras.separatelyBillable.toLocaleString('vi-VN')} đ</p><p className="text-xs text-slate-500">Đã thu {settlement.extras.collected.toLocaleString('vi-VN')} đ · Còn {settlement.extras.outstanding.toLocaleString('vi-VN')} đ</p></div>
            <div className="rounded-xl border p-4"><p className="text-sm text-slate-500">Dòng tiền ròng</p><p className="mt-1 text-lg font-bold">{settlement.cashFlow.net.toLocaleString('vi-VN')} đ</p><p className="text-xs text-slate-500">Tổng thu {settlement.cashFlow.totalCollected.toLocaleString('vi-VN')} đ · Hoàn {settlement.cashFlow.totalRefunded.toLocaleString('vi-VN')} đ</p></div>
          </div>
          {settlement.deposit.deductionExceedsCollected && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Khoản khấu trừ đang lớn hơn tiền cọc đã thu. Cần kiểm tra trước khi hoàn tiền.</p>}
          {settlementBooking.status === 'COMPLETED' && <form onSubmit={addSettlementCharge} className="space-y-3 rounded-xl border p-4">
            <h3 className="font-semibold">Ghi nhận phụ phí / khấu trừ</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium">Loại khoản phí
                <select value={chargeCategory} onChange={e=>setChargeCategory(e.target.value)} className="mt-1 w-full rounded-lg border bg-white px-3 py-2">
                  <option value="DAMAGE">Hư hỏng</option><option value="LATE_RETURN">Trả xe muộn</option><option value="MISSING_ACCESSORY">Thiếu phụ kiện</option><option value="CLEANING">Vệ sinh</option><option value="OTHER">Khác</option>
                </select>
              </label>
              <label className="text-sm font-medium">Số tiền (VND)
                <input required type="number" min="0.01" step="0.01" value={chargeAmount} onChange={e=>setChargeAmount(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2"/>
              </label>
            </div>
            <label className="block text-sm font-medium">Lý do / mô tả
              <textarea required maxLength={500} value={chargeReason} onChange={e=>setChargeReason(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" rows={2}/>
            </label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={chargeToDeposit} onChange={e=>setChargeToDeposit(e.target.checked)}/> Khấu trừ khoản này từ tiền cọc (không thu EXTRA riêng)</label>
            <button disabled={chargeSaving} className="rounded-lg border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-800 disabled:opacity-50">{chargeSaving?'Đang lưu...':'Thêm khoản phụ phí'}</button>
          </form>}
          <form onSubmit={recordPayment} className="space-y-3 rounded-xl border bg-slate-50 p-4">
            <h3 className="font-semibold">Ghi nhận giao dịch</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium">Loại giao dịch
                <select value={paymentPurpose} onChange={e=>{const p=e.target.value as typeof paymentPurpose;setPaymentPurpose(p);setPaymentAmount(String(suggestedAmount(p)||''));}} className="mt-1 w-full rounded-lg border bg-white px-3 py-2">
                  <option value="RENT">Thu tiền thuê</option><option value="DEPOSIT">Thu tiền cọc</option><option value="EXTRA">Thu phụ phí</option><option value="REFUND" disabled={!settlement.canRefundDeposit}>Hoàn tiền cọc</option>
                </select>
              </label>
              <label className="text-sm font-medium">Phương thức
                <select value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value as typeof paymentMethod)} className="mt-1 w-full rounded-lg border bg-white px-3 py-2"><option value="CASH">Tiền mặt</option><option value="TRANSFER">Chuyển khoản</option></select>
              </label>
            </div>
            <label className="block text-sm font-medium">Số tiền (VND)
              <input required type="number" min="0.01" step="0.01" value={paymentAmount} onChange={e=>setPaymentAmount(e.target.value)} className="mt-1 w-full rounded-lg border bg-white px-3 py-2"/>
            </label>
            <label className="block text-sm font-medium">Ghi chú
              <input value={paymentNote} onChange={e=>setPaymentNote(e.target.value)} maxLength={255} className="mt-1 w-full rounded-lg border bg-white px-3 py-2" placeholder="Mã giao dịch hoặc ghi chú"/>
            </label>
            <p className="text-xs text-slate-500">Phụ phí được khấu trừ vào cọc không thu lại ở mục phụ phí. Hoàn cọc chỉ thực hiện sau khi đơn hoàn thành.</p>
            <button disabled={paymentSaving || Number(paymentAmount)<=0} className="w-full rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{paymentSaving?'Đang ghi nhận...':'Ghi nhận giao dịch'}</button>
          </form>
        </>}
      </div>
    </div>}

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
        <label className="block text-sm font-medium">Ảnh hiện trạng xe (mỗi URL một dòng)
          <textarea value={form.imageUrls} onChange={e=>setForm({...form,imageUrls:e.target.value})} className="mt-1 w-full rounded-lg border px-3 py-2" rows={3} placeholder="https://..."/>
          <span className="mt-1 block text-xs text-slate-500">Tối đa 10 ảnh. Nhập URL ảnh đã được tải lên kho lưu trữ; chưa phải chức năng tải file trực tiếp.</span>
        </label>
        <div className="flex justify-end gap-2"><button type="button" onClick={()=>setActive(null)} className="rounded-lg border px-4 py-2 text-sm">Hủy</button>
          <button disabled={saving} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Đang lưu...' : 'Lưu biên bản'}</button></div>
      </form>
    </div>}
  </section>;
}
