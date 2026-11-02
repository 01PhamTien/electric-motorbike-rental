import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../services/api';

type StatusHistory = { id: number; fromStatus: string; toStatus: string; reason?: string | null; createdAt: string; performedById?: number | null };
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
  const [keyword,setKeyword]=useState('');
  const [statusFilter,setStatusFilter]=useState('ALL');
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState<number|null>(null);
  const [historyByBooking,setHistoryByBooking]=useState<Record<number,StatusHistory[]>>({});
  const [historyLoading,setHistoryLoading]=useState<number|null>(null);

  const load=useCallback(async()=>{
    setLoading(true);setError('');
    try { const response=await api.get<Booking[]>('/bookings/my');setItems(response.data); }
    catch(err:any){setError(err.response?.data?.message||'Không tải được đơn thuê. Hãy đăng nhập bằng tài khoản khách hàng.');}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{void load();},[load]);

  const filteredItems=useMemo(()=>items.filter(item=>{
    const text=[item.id,item.vehicle?.code,item.vehicle?.licensePlate,item.vehicle?.model?.brand,item.vehicle?.model?.name,item.vehicle?.station?.name].join(' ').toLowerCase();
    return text.includes(keyword.trim().toLowerCase())&&(statusFilter==='ALL'||item.status===statusFilter);
  }),[items,keyword,statusFilter]);
  const statusTone:Record<string,string>={
    PENDING:'bg-amber-50 text-amber-700 ring-amber-200',CONFIRMED:'bg-blue-50 text-blue-700 ring-blue-200',
    RENTING:'bg-violet-50 text-violet-700 ring-violet-200',COMPLETED:'bg-emerald-50 text-emerald-700 ring-emerald-200',
    CANCELLED:'bg-rose-50 text-rose-700 ring-rose-200',EXPIRED:'bg-slate-100 text-slate-600 ring-slate-200',
  };

  async function toggleHistory(item: Booking) {
    if (historyByBooking[item.id]) {
      setHistoryByBooking(current => { const next = { ...current }; delete next[item.id]; return next; });
      return;
    }
    setHistoryLoading(item.id);
    setError('');
    try {
      const response = await api.get<StatusHistory[]>('/bookings/' + item.id + '/history');
      setHistoryByBooking(current => ({ ...current, [item.id]: response.data }));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không tải được lịch sử trạng thái đơn.');
    } finally { setHistoryLoading(null); }
  }

  async function cancel(item:Booking){
    if(!window.confirm(`Bạn chắc chắn muốn yêu cầu hủy đơn #${item.id}?`))return;
    setBusy(item.id);setError('');setMessage('');
    try {await api.patch(`/bookings/${item.id}/cancel`,{reason:'Khách hàng yêu cầu hủy'});setMessage(`Đã hủy đơn #${item.id}.`);await load();}
    catch(err:any){setError(err.response?.data?.message||'Không thể hủy đơn ở trạng thái hiện tại.');}
    finally{setBusy(null);}
  }

  return <section className="space-y-6">
    <header className="relative overflow-hidden rounded-3xl bg-slate-950 px-6 py-7 text-white shadow-lg sm:px-8">
      <div className="pointer-events-none absolute -right-14 -top-20 h-64 w-64 rounded-full bg-blue-500/15 blur-3xl" />
      <div className="relative flex flex-wrap items-end justify-between gap-4">
        <div><span className="inline-flex rounded-full border border-blue-300/20 bg-blue-300/10 px-3 py-1 text-[11px] font-bold tracking-[0.15em] text-blue-200">KHÔNG GIAN KHÁCH HÀNG</span>
          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">Đơn thuê của tôi</h1>
          <p className="mt-2 text-sm text-slate-300">Theo dõi lịch trình, trạng thái xác nhận và lịch sử từng lần thuê xe.</p></div>
        <div className="flex gap-2"><a href="/vehicles" className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-500">Tìm xe</a>
          <button onClick={()=>void load()} disabled={loading} className="rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/15 disabled:opacity-50">{loading?'Đang tải...':'↻ Làm mới'}</button></div>
      </div>
    </header>
    {error&&<div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{Array.isArray(error)?error.join(', '):error}</div>}
    {message&&<div role="status" className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">{message}</div>}
    {!loading&&items.length>0&&<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
        <input value={keyword} onChange={event=>setKeyword(event.target.value)} placeholder="Tìm mã đơn, tên xe, biển số..." aria-label="Tìm đơn thuê" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"/>
        <select value={statusFilter} onChange={event=>setStatusFilter(event.target.value)} aria-label="Lọc trạng thái đơn thuê" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm">
          <option value="ALL">Tất cả trạng thái</option><option value="PENDING">Chờ xác nhận</option><option value="CONFIRMED">Đã xác nhận</option><option value="RENTING">Đang thuê</option><option value="COMPLETED">Hoàn thành</option><option value="CANCELLED">Đã hủy</option><option value="EXPIRED">Đã hết hạn</option>
        </select>
      </div>
      <p className="mt-3 text-xs text-slate-500">Đang hiển thị <strong className="text-slate-700">{filteredItems.length}</strong> / {items.length} đơn thuê</p>
    </div>}
    {loading?<p className="py-8 text-center text-sm text-slate-500">Đang tải đơn thuê...</p>:
      items.length===0?<div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-xl font-black text-blue-700">EV</div><p className="mt-4 font-bold text-slate-900">Bạn chưa có đơn thuê nào</p><p className="mt-1 text-sm text-slate-500">Khám phá đội xe và tạo đơn thuê đầu tiên của bạn.</p><a href="/vehicles" className="mt-5 inline-flex rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white hover:bg-blue-800">Khám phá xe điện</a></div>:
      filteredItems.length===0?<div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center"><p className="font-semibold text-slate-800">Không tìm thấy đơn thuê phù hợp</p><p className="mt-1 text-sm text-slate-500">Thử thay đổi từ khóa hoặc trạng thái lọc.</p></div>:
      <div className="space-y-3">{filteredItems.map(item=><article key={item.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 bg-slate-50/70 p-5"><div><p className="mb-1 text-[11px] font-bold tracking-[0.12em] text-blue-700">MÃ ĐƠN #{item.id}</p><h2 className="font-bold text-slate-950"> {item.vehicle?.model?.brand||''} {item.vehicle?.model?.name||item.vehicle?.code||''}</h2>
          <p className="mt-1 text-sm text-slate-500">{item.vehicle?.station?.name||'Điểm thuê'} · {item.vehicle?.licensePlate||''}</p></div>
          <span className={'rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset '+(statusTone[item.status]||'bg-slate-100 text-slate-600 ring-slate-200')}>{statusText[item.status]||item.status}</span></div>
        <div className="grid gap-3 p-5 text-sm sm:grid-cols-2"><p><span className="text-slate-500">Nhận xe:</span> {new Date(item.pickupAt).toLocaleString('vi-VN')}</p>
          <p><span className="text-slate-500">Trả xe:</span> {new Date(item.returnAt).toLocaleString('vi-VN')}</p>
          <p><span className="text-slate-500">Tiền thuê dự kiến:</span> <strong>{money(item.rentalAmount)}</strong></p>
          <p><span className="text-slate-500">Tiền cọc:</span> <strong>{money(item.depositSnapshot)}</strong></p></div>
        {item.status==='PENDING'&&item.holdExpiresAt&&<p className="mt-3 text-xs text-amber-700">Hạn giữ chỗ: {new Date(item.holdExpiresAt).toLocaleString('vi-VN')}</p>}
        {['PENDING','CONFIRMED'].includes(item.status)&&<div className="mt-4"><button disabled={busy===item.id} onClick={()=>void cancel(item)} className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-50">{busy===item.id?'Đang xử lý...':'Hủy đơn thuê'}</button></div>}
        {item.cancelReason&&<p className="mt-2 text-xs text-slate-500">Lý do hủy: {item.cancelReason}</p>}
        <div className="mx-5 mb-5 border-t border-slate-100 pt-4">
          <button type="button" disabled={historyLoading===item.id} onClick={()=>void toggleHistory(item)} className="text-sm font-semibold text-blue-700 underline disabled:opacity-50">
            {historyLoading===item.id?'Đang tải lịch sử...':historyByBooking[item.id]?'Ẩn lịch sử trạng thái':'Xem lịch sử trạng thái'}
          </button>
          {historyByBooking[item.id]&&<ol className="mt-3 space-y-2 border-l-2 border-slate-200 pl-4">
            {historyByBooking[item.id].map(entry=><li key={entry.id} className="relative text-sm">
              <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-blue-600"/>
              <p className="font-semibold">{statusText[entry.toStatus]||entry.toStatus}</p>
              <p className="text-xs text-slate-500">{new Date(entry.createdAt).toLocaleString('vi-VN')}{entry.reason?' · '+entry.reason:''}</p>
            </li>)}
          </ol>}
        </div>
      </article>)}</div>}
  </section>;
}
