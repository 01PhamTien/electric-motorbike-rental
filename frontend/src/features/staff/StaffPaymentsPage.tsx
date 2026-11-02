import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../services/api';

type Booking = {
  id: number; status: string; rentalAmount: string; depositSnapshot: string;
  pickupAt: string; returnAt: string;
  customer?: { fullName?: string; email?: string };
  vehicle?: { code?: string; licensePlate?: string; station?: { name?: string } };
};
type Purpose = 'RENT' | 'DEPOSIT' | 'REFUND';
type Method = 'CASH' | 'TRANSFER';
type Payment = {
  id: number; bookingId: number; purpose: 'RENT' | 'DEPOSIT' | 'EXTRA' | 'REFUND';
  method: Method; amount: string; note?: string | null; createdAt: string;
};
type PaymentForm = { purpose: Purpose; method: Method; amount: string; note: string };
type Charge = { id:number; category:string; amount:string; applyToDeposit:boolean; reason:string; createdAt:string };

const purposeText: Record<string,string> = { RENT: 'Thu tiền thuê', DEPOSIT: 'Thu tiền cọc', EXTRA: 'Phụ phí', REFUND: 'Hoàn tiền cọc' };
const methodText: Record<string,string> = { CASH: 'Tiền mặt', TRANSFER: 'Chuyển khoản' };
const statusText: Record<string,string> = { PENDING:'Chờ xác nhận', CONFIRMED:'Đã xác nhận', RENTING:'Đang thuê', COMPLETED:'Hoàn thành', CANCELLED:'Đã hủy', EXPIRED:'Hết hạn' };
const money=(value:string|number)=>Number(value).toLocaleString('vi-VN')+' đ';
const sum=(payments:Payment[], purpose:string)=>payments.filter(p=>p.purpose===purpose).reduce((n,p)=>n+Number(p.amount),0);

export function StaffPaymentsPage() {
  const [bookings,setBookings]=useState<Booking[]>([]);
  const [payments,setPayments]=useState<Record<number,Payment[]>>({});
  const [charges,setCharges]=useState<Record<number,Charge[]>>({});
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const [active,setActive]=useState<Booking|null>(null);
  const [form,setForm]=useState<PaymentForm>({purpose:'RENT',method:'CASH',amount:'',note:''});
  const [saving,setSaving]=useState(false);

  const load=useCallback(async()=>{
    setLoading(true);setError('');
    try {
      const response=await api.get<Booking[]>('/bookings/operations');
      const rows=response.data;
      setBookings(rows);
      const ledger=await Promise.all(rows.map(async booking=>{
        const [p,c]=await Promise.all([
          api.get<Payment[]>('/bookings/'+booking.id+'/payments').catch(()=>({data:[]} as any)),
          api.get<Charge[]>('/bookings/'+booking.id+'/charges').catch(()=>({data:[]} as any)),
        ]);
        return [booking.id,p.data,c.data] as const;
      }));
      setPayments(Object.fromEntries(ledger.map(([id,p])=>[id,p])));
      setCharges(Object.fromEntries(ledger.map(([id,_p,c])=>[id,c])));
    } catch(err:any) {
      setError(err.response?.data?.message||'Không tải được dữ liệu thanh toán. Hãy đăng nhập bằng tài khoản STAFF hoặc ADMIN.');
    } finally { setLoading(false); }
  },[]);
  useEffect(()=>{void load();},[load]);

  const summary=useMemo(()=>{
    const all=Object.values(payments).flat();
    return {rent:sum(all,'RENT'),deposit:sum(all,'DEPOSIT'),refund:sum(all,'REFUND')};
  },[payments]);

  function openForm(booking:Booking,purpose:Purpose) {
    const list=payments[booking.id]||[];
    const collected=sum(list,purpose==='REFUND'?'DEPOSIT':purpose);
    const refunded=sum(list,'REFUND');
    const ceiling=purpose==='RENT'?Number(booking.rentalAmount):purpose==='DEPOSIT'?Number(booking.depositSnapshot):collected-refunded;
    const remaining=Math.max(0,Math.round((ceiling-(purpose==='REFUND'?refunded:collected))*100)/100);
    setActive(booking);
    setForm({purpose,method:'CASH',amount:remaining>0?String(remaining):'',note:''});
    setError('');setMessage('');
  }

  async function submit(event:FormEvent) {
    event.preventDefault();if(!active)return;
    const amount=Number(form.amount);
    if(!Number.isFinite(amount)||amount<=0){setError('Nhập số tiền hợp lệ lớn hơn 0.');return;}
    setSaving(true);setError('');setMessage('');
    try {
      await api.post('/bookings/'+active.id+'/payments',{
        purpose:form.purpose,method:form.method,amount,
        idempotencyKey:crypto.randomUUID(),
        note:form.note.trim()||undefined,
      });
      setMessage('Đã ghi nhận '+purposeText[form.purpose].toLowerCase()+' cho đơn #'+active.id+'.');
      setActive(null);await load();
    } catch(err:any) {
      setError(err.response?.data?.message||'Không thể ghi nhận giao dịch.');
    } finally {setSaving(false);}
  }

  return <section className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-sm font-semibold text-blue-700">THU NGÂN VÀ ĐỐI SOÁT</p>
        <h1 className="mt-1 text-2xl font-bold">Thanh toán và tiền cọc</h1>
        <p className="mt-1 text-sm text-slate-500">Ghi nhận tiền thuê, tiền cọc và hoàn cọc theo từng đơn thuê.</p></div>
      <button onClick={()=>void load()} className="rounded-lg border px-4 py-2 text-sm">Làm mới</button>
    </div>
    {error&&<div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{Array.isArray(error)?error.join(', '):error}</div>}
    {message&&<div role="status" className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">{message}</div>}
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-xl border bg-white p-4"><p className="text-sm text-slate-500">Tổng tiền thuê đã thu</p><p className="mt-1 text-xl font-bold">{money(summary.rent)}</p></div>
      <div className="rounded-xl border bg-white p-4"><p className="text-sm text-slate-500">Tổng tiền cọc đã nhận</p><p className="mt-1 text-xl font-bold">{money(summary.deposit)}</p></div>
      <div className="rounded-xl border bg-white p-4"><p className="text-sm text-slate-500">Tổng tiền cọc đã hoàn</p><p className="mt-1 text-xl font-bold">{money(summary.refund)}</p></div>
    </div>
    <div className="overflow-hidden rounded-xl border bg-white">
      <div className="border-b p-4"><h2 className="font-semibold">Danh sách đơn thuê ({bookings.length})</h2></div>
      {loading?<p className="p-5 text-sm text-slate-500">Đang tải dữ liệu...</p>:
      bookings.length===0?<p className="p-5 text-sm text-slate-500">Không có đơn thuê tại điểm được phân công.</p>:
      <div className="divide-y">{bookings.map(booking=>{
        const list=payments[booking.id]||[];
        const rent=sum(list,'RENT'),deposit=sum(list,'DEPOSIT'),refund=sum(list,'REFUND');
        const rentLeft=Math.max(0,Number(booking.rentalAmount)-rent);
        const depositLeft=Math.max(0,Number(booking.depositSnapshot)-deposit);
        const chargeList=charges[booking.id]||[];
        const depositDeductions=chargeList.filter(c=>c.applyToDeposit).reduce((n,c)=>n+Number(c.amount),0);
        const refundable=Math.max(0,deposit-depositDeductions-refund);
        const blocked=['CANCELLED','EXPIRED'].includes(booking.status);
        return <article key={booking.id} className="space-y-3 p-4">
          <div className="flex flex-wrap justify-between gap-2"><div><h3 className="font-semibold">Đơn #{booking.id} · {booking.vehicle?.code||booking.vehicle?.licensePlate||'Xe'}</h3>
            <p className="text-sm text-slate-500">{booking.customer?.fullName||booking.customer?.email||'Khách hàng'} · {booking.vehicle?.station?.name||'Điểm thuê'}</p></div>
            <span className="h-fit rounded-full bg-slate-100 px-3 py-1 text-xs">{statusText[booking.status]||booking.status}</span></div>
          <div className="grid gap-2 text-sm sm:grid-cols-3">
            <div className="rounded-lg bg-slate-50 p-3"><p className="text-slate-500">Tiền thuê</p><p className="font-semibold">{money(rent)} / {money(booking.rentalAmount)}</p><p className="text-xs text-slate-500">Còn: {money(rentLeft)}</p></div>
            <div className="rounded-lg bg-slate-50 p-3"><p className="text-slate-500">Tiền cọc</p><p className="font-semibold">{money(deposit)} / {money(booking.depositSnapshot)}</p><p className="text-xs text-slate-500">Còn phải thu: {money(depositLeft)}</p></div>
            <div className="rounded-lg bg-slate-50 p-3"><p className="text-slate-500">Cọc đã hoàn</p><p className="font-semibold">{money(refund)}</p><p className="text-xs text-slate-500">Khấu trừ: {money(depositDeductions)} · Còn hoàn: {money(refundable)}</p></div>
          </div>
          <div className="flex flex-wrap gap-2">
            {!blocked&&rentLeft>0.009&&<button onClick={()=>openForm(booking,'RENT')} className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white">Thu tiền thuê</button>}
            {!blocked&&depositLeft>0.009&&<button onClick={()=>openForm(booking,'DEPOSIT')} className="rounded-lg bg-indigo-700 px-3 py-2 text-sm font-semibold text-white">Thu tiền cọc</button>}
            {booking.status==='COMPLETED'&&<button onClick={async()=>{const amount=window.prompt('Số tiền phụ phí / khấu trừ (VNĐ):');if(!amount)return;const reason=window.prompt('Lý do và căn cứ:');if(!reason)return;try{await api.post('/bookings/'+booking.id+'/charges',{category:'DAMAGE_OR_EXTRA',amount:Number(amount),applyToDeposit:true,reason});setMessage('Đã ghi nhận khoản khấu trừ cho đơn #'+booking.id);await load();}catch(err:any){setError(err.response?.data?.message||'Không thể ghi nhận khoản khấu trừ.');}}} className="rounded-lg border border-amber-300 px-3 py-2 text-sm font-semibold text-amber-800">Ghi nhận khấu trừ cọc</button>}
            {booking.status==='COMPLETED'&&refundable>0.009&&<button onClick={()=>openForm(booking,'REFUND')} className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white">Hoàn tiền cọc</button>}
          </div>
          {list.length>0&&<details className="text-sm"><summary className="cursor-pointer font-medium text-slate-700">Lịch sử giao dịch ({list.length})</summary>
            <div className="mt-2 divide-y rounded-lg border">{list.map(payment=><div key={payment.id} className="flex flex-wrap justify-between gap-2 p-3">
              <div><p className="font-medium">{purposeText[payment.purpose]||payment.purpose} · {methodText[payment.method]}</p><p className="text-xs text-slate-500">{new Date(payment.createdAt).toLocaleString('vi-VN')} {payment.note?'· '+payment.note:''}</p></div>
              <strong>{money(payment.amount)}</strong>
            </div>)}</div>
          </details>}
        </article>;
      })}</div>}
    </div>
    {active&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-xl">
        <div><h2 className="text-lg font-bold">{purposeText[form.purpose]} · Đơn #{active.id}</h2><p className="mt-1 text-sm text-slate-500">Ghi nhận giao dịch thực tế do nhân viên xác nhận.</p></div>
        <label className="block text-sm font-medium">Số tiền (VNĐ)<input required type="number" min="0.01" step="0.01" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} className="mt-1 w-full rounded-lg border px-3 py-2"/></label>
        <label className="block text-sm font-medium">Phương thức<select value={form.method} onChange={e=>setForm({...form,method:e.target.value as Method})} className="mt-1 w-full rounded-lg border bg-white px-3 py-2"><option value="CASH">Tiền mặt</option><option value="TRANSFER">Chuyển khoản</option></select></label>
        <label className="block text-sm font-medium">Ghi chú (không bắt buộc)<textarea maxLength={255} rows={2} value={form.note} onChange={e=>setForm({...form,note:e.target.value})} className="mt-1 w-full rounded-lg border px-3 py-2"/></label>
        <div className="flex justify-end gap-2"><button type="button" onClick={()=>setActive(null)} className="rounded-lg border px-4 py-2 text-sm">Đóng</button><button disabled={saving} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving?'Đang lưu...':'Xác nhận giao dịch'}</button></div>
      </form>
    </div>}
  </section>;
}
