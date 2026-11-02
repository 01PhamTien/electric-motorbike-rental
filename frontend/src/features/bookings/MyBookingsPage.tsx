import { useCallback, useEffect, useState } from 'react';
import { api } from '../../services/api';

type Booking = {
  id: number; status: string; pickupAt: string; returnAt: string;
  rentalAmount: string; depositSnapshot: string; holdExpiresAt?: string | null;
  cancelReason?: string | null;
  vehicle?: { code?: string; licensePlate?: string; model?: { brand?: string; name?: string }; station?: { name?: string } };
};
const statusText: Record<string,string> = {
  PENDING:'Chờ xác nhận', CONFIRMED:'Đã xác nhận', RENTING:'Đang thuê',
  COMPLETED:'Hoàn thành', CANCELLED:'Đã hủy', EXPIRED:'Hết hạn giữ chỗ',
};
const money=(v:string|number)=>Number(v).toLocaleString('vi-VN')+' đ';

export function MyBookingsPage() {
  const [items,setItems]=useState<Booking[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState<number|null>(null);

  const load=useCallback(async()=>{
    setLoading(true);setError('');
    try { const response=await api.get<Booking[]>('/bookings/my');setItems(response.data); }
    catch(err:any){setError(err.response?.data?.message||'Không tải được đơn thuê. Hãy đăng nhập bằng tài khoản khách hàng.');}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{void load();},[load]);

  async function cancel(item:Booking){
    if(!window.confirm(`Bạn chắc chắn muốn yêu cầu hủy đơn #${item.id}?`))return;
    setBusy(item.id);setError('');setMessage('');
    try {await api.patch(`/bookings/${item.id}/cancel`,{reason:'Khách hàng yêu cầu hủy'});setMessage(`Đã hủy đơn #${item.id}.`);await load();}
    catch(err:any){setError(err.response?.data?.message||'Không thể hủy đơn ở trạng thái hiện tại.');}
    finally{setBusy(null);}
  }

  return <section className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold text-blue-700">TÀI KHOẢN KHÁCH HÀNG</p>
      <h1 className="mt-1 text-2xl font-bold">Đơn thuê của tôi</h1><p className="mt-1 text-sm text-slate-500">Theo dõi trạng thái, lịch nhận và trả xe.</p></div>
      <button onClick={()=>void load()} className="rounded-lg border px-4 py-2 text-sm">Làm mới</button></div>
    {error&&<div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{Array.isArray(error)?error.join(', '):error}</div>}
    {message&&<div role="status" className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">{message}</div>}
    {loading?<p className="py-8 text-center text-sm text-slate-500">Đang tải đơn thuê...</p>:
      items.length===0?<div className="rounded-xl border bg-white p-8 text-center"><p className="font-semibold">Bạn chưa có đơn thuê nào</p><a href="/vehicles" className="mt-2 inline-block text-sm font-semibold text-blue-700 underline">Tìm xe để đặt thuê</a></div>:
      <div className="space-y-3">{items.map(item=><article key={item.id} className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-bold">Đơn #{item.id} · {item.vehicle?.model?.brand||''} {item.vehicle?.model?.name||item.vehicle?.code||''}</h2>
          <p className="mt-1 text-sm text-slate-500">{item.vehicle?.station?.name||'Điểm thuê'} · {item.vehicle?.licensePlate||''}</p></div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">{statusText[item.status]||item.status}</span></div>
        <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2"><p><span className="text-slate-500">Nhận xe:</span> {new Date(item.pickupAt).toLocaleString('vi-VN')}</p>
          <p><span className="text-slate-500">Trả xe:</span> {new Date(item.returnAt).toLocaleString('vi-VN')}</p>
          <p><span className="text-slate-500">Tiền thuê dự kiến:</span> <strong>{money(item.rentalAmount)}</strong></p>
          <p><span className="text-slate-500">Tiền cọc:</span> <strong>{money(item.depositSnapshot)}</strong></p></div>
        {item.status==='PENDING'&&item.holdExpiresAt&&<p className="mt-3 text-xs text-amber-700">Hạn giữ chỗ: {new Date(item.holdExpiresAt).toLocaleString('vi-VN')}</p>}
        {['PENDING','CONFIRMED'].includes(item.status)&&<div className="mt-4"><button disabled={busy===item.id} onClick={()=>void cancel(item)} className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-50">{busy===item.id?'Đang xử lý...':'Hủy đơn thuê'}</button></div>}
        {item.cancelReason&&<p className="mt-2 text-xs text-slate-500">Lý do hủy: {item.cancelReason}</p>}
      </article>)}</div>}
  </section>;
}
