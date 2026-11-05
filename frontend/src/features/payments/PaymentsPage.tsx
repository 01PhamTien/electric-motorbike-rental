import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { EmptyState, LoadingState, money, SectionHeading, timeText } from '../../components/Brand';
import { useAuth } from '../auth/AuthContext';
import { api } from '../../services/api';

type Payment = { id: number; purpose: 'RENT'|'DEPOSIT'|'EXTRA'|'REFUND'; method: 'CASH'|'TRANSFER'; amount: string; note: string|null; createdAt: string };
type BookingFinance = { rentalAmount: string; depositSnapshot: string; status: string };
const purposes = { RENT:'Tiền thuê', DEPOSIT:'Tiền cọc', EXTRA:'Phụ phí', REFUND:'Hoàn cọc' };
const methods = { CASH:'Tiền mặt', TRANSFER:'Chuyển khoản' };
function getError(error: unknown) {
  const message = (error as {response?:{data?:{message?:string|string[]}}})?.response?.data?.message;
  return Array.isArray(message) ? message.join(', ') : message || 'Không thể hoàn tất thao tác.';
}
function newKey() { return 'voltgo-' + Date.now() + '-' + Math.random().toString(36).slice(2, 14); }
export function PaymentsPage() {
  const { id } = useParams();
  const [items,setItems] = useState<Payment[]>([]);
  const [booking,setBooking] = useState<BookingFinance|null>(null);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const [busy,setBusy] = useState(false);
  const [form,setForm] = useState<{purpose:Payment['purpose']; method:Payment['method']; amount:string;note:string;key:string}>({purpose:'RENT',method:'CASH',amount:'',note:'',key:newKey()});
  const { user } = useAuth();
  const staff = user?.role === 'ADMIN' || user?.role === 'STAFF';
  const load = useCallback(async() => {
    if (!id) return;
    setLoading(true);
    const [paymentResult, bookingResult] = await Promise.allSettled([
      api.get('/bookings/' + id + '/payments'), api.get('/bookings/' + id),
    ]);
    if (paymentResult.status === 'fulfilled') {
      const data = paymentResult.value.data;
      setItems(Array.isArray(data) ? data : data?.items ?? []);
      setError('');
    } else setError(getError(paymentResult.reason));
    if (bookingResult.status === 'fulfilled') setBooking(bookingResult.value.data);
    setLoading(false);
  },[id]);
  useEffect(() => { void load(); },[load]);
  const total = (purpose: Payment['purpose']) => items.filter(item => item.purpose === purpose).reduce((sum, item) => sum + Math.round(Number(item.amount) * 100), 0) / 100;
  const rentPaid = total('RENT');
  const depositPaid = total('DEPOSIT');
  const refunded = total('REFUND');
  const rentRemaining = booking ? Math.max(0, Number(booking.rentalAmount) - rentPaid) : null;
  const depositRemainingToCollect = booking ? Math.max(0, Number(booking.depositSnapshot) - depositPaid) : null;
  const depositAvailableToRefund = Math.max(0, depositPaid - refunded);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(form.amount);
    if (!id || !Number.isFinite(amount) || amount <= 0) { setError('Nhập số tiền lớn hơn 0.'); return; }
    if (!window.confirm('Xác nhận đã thực sự nhận/chi ' + money(amount) + ' cho đơn #' + id + '? Thao tác này ghi nhận giao dịch, không tự chuyển tiền.')) return;
    setBusy(true);setError('');setNotice('');
    try {
      await api.post('/bookings/' + id + '/payments', { purpose:form.purpose,method:form.method,amount,idempotencyKey:form.key,note:form.note || undefined });
      setNotice('Đã ghi nhận giao dịch thành công.');setForm({...form,amount:'',note:'',key:newKey()});await load();
    } catch(e) { setError(getError(e)); }
    finally { setBusy(false); }
  }
  return <div className="container-page py-12 sm:py-16"><div className="flex flex-wrap items-end justify-between gap-5"><SectionHeading eyebrow="THANH TOÁN VÀ ĐỐI SOÁT" title={'Giao dịch đơn #' + (id || '')} description="Lịch sử tiền thuê, tiền cọc, phụ phí và hoàn cọc đã được ghi nhận trong hệ thống."/><Link to={staff?'/operations':'/bookings/my'} className="btn-outline">← Quay lại đơn thuê</Link></div>
    <div className="mt-8 rounded-2xl border border-amber-100 bg-amber-50 p-5 text-sm leading-7 text-amber-900"><strong>Lưu ý:</strong> Đây là màn hình ghi nhận thanh toán thủ công. Hệ thống chưa xử lý chuyển khoản hoặc hoàn tiền tự động qua cổng thanh toán. Vui lòng đối chiếu giao dịch thật trước khi lưu.</div>
    {notice && <p role="status" className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700">{notice}</p>}
    {error && <p role="alert" className="mt-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
    {booking && <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><div className="panel p-5"><p className="field-label">Tiền thuê theo đơn</p><p className="mt-2 text-xl font-extrabold">{money(booking.rentalAmount)}</p><p className="mt-1 text-xs text-slate-500">Còn ghi nhận: {money(rentRemaining ?? 0)}</p></div><div className="panel p-5"><p className="field-label">Tiền cọc theo đơn</p><p className="mt-2 text-xl font-extrabold">{money(booking.depositSnapshot)}</p><p className="mt-1 text-xs text-slate-500">Còn thu: {money(depositRemainingToCollect ?? 0)}</p></div><div className="panel p-5"><p className="field-label">Đã thu tiền cọc</p><p className="mt-2 text-xl font-extrabold text-emerald-700">{money(depositPaid)}</p><p className="mt-1 text-xs text-slate-500">Đã hoàn: {money(refunded)}</p></div><div className="panel p-5"><p className="field-label">Cọc còn có thể hoàn</p><p className="mt-2 text-xl font-extrabold text-sky-700">{money(depositAvailableToRefund)}</p><p className="mt-1 text-xs text-slate-500">Chỉ hoàn sau khi trả xe</p></div></section>}
    <div className={'mt-8 grid gap-6 ' + (staff?'lg:grid-cols-[1.1fr_.9fr]':'')}>
      <section className="panel p-6"><div className="flex items-center justify-between gap-3"><h2 className="text-xl font-extrabold">Lịch sử giao dịch</h2><button className="text-sm font-bold text-emerald-700" onClick={()=>void load()}>↻ Làm mới</button></div>{loading ? <div className="mt-6"><LoadingState /></div> : !items.length ? <div className="mt-6"><EmptyState title="Chưa có giao dịch" description="Các khoản đã ghi nhận sẽ hiển thị tại đây." /></div> : <div className="mt-5 divide-y divide-slate-100">{items.map(p => <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-5"><div><p className="font-bold">{purposes[p.purpose] || p.purpose}</p><p className="mt-1 text-xs text-slate-500">{methods[p.method] || p.method} · {timeText(p.createdAt)}</p>{p.note && <p className="mt-1 text-xs text-slate-500">{p.note}</p>}</div><strong className={'text-lg '+(p.purpose==='REFUND'?'text-rose-600':'text-emerald-700')}>{p.purpose==='REFUND'?'-':'+'}{money(p.amount)}</strong></div>)}</div>}</section>
      {staff && <form onSubmit={submit} className="panel self-start p-6"><h2 className="text-xl font-extrabold">Ghi nhận giao dịch</h2><p className="mt-2 text-xs leading-6 text-slate-500">Chỉ lưu khi đã xác minh số tiền nhận/chi trong thực tế.</p><div className="mt-6 grid gap-5"><label><span className="field-label">Loại giao dịch</span><select className="field" value={form.purpose} onChange={e=>setForm({...form,purpose:e.target.value as Payment['purpose']})}>{Object.entries(purposes).map(([key,value])=><option key={key} value={key}>{value}</option>)}</select></label><label><span className="field-label">Phương thức</span><select className="field" value={form.method} onChange={e=>setForm({...form,method:e.target.value as Payment['method']})}>{Object.entries(methods).map(([key,value])=><option key={key} value={key}>{value}</option>)}</select></label><label><span className="field-label">Số tiền (VND)</span><input type="number" min="0.01" step="0.01" required className="field" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})}/></label><label><span className="field-label">Ghi chú</span><textarea className="field min-h-24" maxLength={255} value={form.note} onChange={e=>setForm({...form,note:e.target.value})}/></label><button disabled={busy} className="btn-primary w-full">{busy?'Đang lưu...':'Ghi nhận giao dịch →'}</button></div></form>}
    </div>
  </div>;
}
