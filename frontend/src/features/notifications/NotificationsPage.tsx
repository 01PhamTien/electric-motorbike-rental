import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, ErrorState, LoadingState, SectionHeading } from '../../components/Brand';
import { api } from '../../services/api';

type Notice = { id:number; type:string; title:string; message:string; relatedBookingId:number|null; readAt:string|null; createdAt:string };
function errorText(error:unknown){return (error as any)?.response?.data?.message || 'Không thể tải thông báo.';}
export function NotificationsPage(){
  const [items,setItems]=useState<Notice[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [busyId,setBusyId]=useState<number|null>(null);
  const [markingAll,setMarkingAll]=useState(false);
  const [notice,setNotice]=useState('');
  const load=useCallback(async()=>{setLoading(true);setError('');try{const {data}=await api.get('/notifications');setItems(Array.isArray(data)?data:[]);}catch(e){setError(errorText(e));}finally{setLoading(false);}},[]);
  useEffect(()=>{void load();},[load]);
  async function markRead(id:number){if(busyId!==null)return;setBusyId(id);setError('');setNotice('');try{const {data}=await api.patch('/notifications/'+id+'/read');setItems(old=>old.map(n=>n.id===id?data:n));setNotice('Đã đánh dấu thông báo là đã đọc.');}catch(e){setError(errorText(e));}finally{setBusyId(null);}}
  async function markAll(){if(markingAll)return;setMarkingAll(true);setError('');setNotice('');try{await api.patch('/notifications/read-all');setItems(old=>old.map(n=>({...n,readAt:new Date().toISOString()})));setNotice('Đã đánh dấu tất cả thông báo là đã đọc.');}catch(e){setError(errorText(e));}finally{setMarkingAll(false);}}
  return <div className="container-page max-w-5xl py-10 sm:py-14">
    <div className="flex flex-wrap items-end justify-between gap-4"><SectionHeading eyebrow="CẬP NHẬT TỪ VOLTGO" title="Thông báo" description="Theo dõi trạng thái đơn thuê và các cập nhật quan trọng."/><button onClick={()=>void markAll()} disabled={!items.some(n=>!n.readAt)} className="btn-outline disabled:opacity-40">Đánh dấu đã đọc tất cả</button></div>
    {notice&&<p role="status" aria-live="polite" className="mt-6 rounded-xl border border-[#d7eee0] bg-[#f0faf4] p-4 text-sm font-semibold text-[#247653]">✓ {notice}</p>}
    {error&&<div className="mt-6"><ErrorState description={error} onRetry={()=>void load()}/></div>}
    {loading?<div className="mt-8"><LoadingState label="Đang tải thông báo..."/></div>:error?null:items.length===0?<div className="mt-8"><EmptyState title="Bạn chưa có thông báo" description="Các cập nhật về đơn thuê và hoạt động tài khoản sẽ xuất hiện tại đây."/></div>:<div className="mt-8 divide-y divide-slate-100 rounded-[24px] border border-[#e5eee8] bg-white shadow-[0_16px_45px_rgba(30,90,65,.05)]">{items.map(n=><article key={n.id} className={'flex flex-col gap-3 p-5 transition-colors sm:flex-row sm:items-start sm:justify-between '+(!n.readAt?'bg-[#f0faf4]':'hover:bg-[#fbfdfb]')}>
      <div className="min-w-0"><div className="flex items-center gap-2"><h2 className="font-bold text-slate-900">{n.title}</h2>{!n.readAt&&<span className="h-2 w-2 rounded-full bg-[#e05252]" aria-label="Chưa đọc"/>}</div><p className="mt-1 text-sm leading-6 text-slate-600">{n.message}</p><p className="mt-2 text-xs text-slate-400">{new Date(n.createdAt).toLocaleString('vi-VN')}</p></div>
      <div className="flex shrink-0 items-center gap-3">{n.relatedBookingId&&<Link className="text-sm font-bold text-[#159b70] hover:underline" to="/bookings/my">Xem đơn #{n.relatedBookingId}</Link>}{!n.readAt&&<button disabled={busyId===n.id||busyId!==null||markingAll} onClick={()=>void markRead(n.id)} className="text-sm font-semibold text-slate-600 hover:text-emerald-700 disabled:opacity-50">{busyId===n.id?'Đang lưu...':'Đã đọc'}</button>}</div>
    </article>)}</div>}
  </div>;
}
