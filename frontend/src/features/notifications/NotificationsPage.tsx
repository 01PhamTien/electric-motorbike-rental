import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { SectionHeading } from '../../components/Brand';
import { api } from '../../services/api';

type Notice = { id:number; type:string; title:string; message:string; relatedBookingId:number|null; readAt:string|null; createdAt:string };
function errorText(error:unknown){return (error as any)?.response?.data?.message || 'Không thể tải thông báo.';}
export function NotificationsPage(){
  const [items,setItems]=useState<Notice[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const load=useCallback(async()=>{setLoading(true);setError('');try{const {data}=await api.get('/notifications');setItems(Array.isArray(data)?data:[]);}catch(e){setError(errorText(e));}finally{setLoading(false);}},[]);
  useEffect(()=>{void load();},[load]);
  async function markRead(id:number){try{const {data}=await api.patch('/notifications/'+id+'/read');setItems(old=>old.map(n=>n.id===id?data:n));}catch(e){setError(errorText(e));}}
  async function markAll(){try{await api.patch('/notifications/read-all');setItems(old=>old.map(n=>({...n,readAt:new Date().toISOString()})));}catch(e){setError(errorText(e));}}
  return <div className="container-page max-w-5xl py-10 sm:py-14">
    <div className="flex flex-wrap items-end justify-between gap-4"><SectionHeading eyebrow="CẬP NHẬT TỪ VOLTGO" title="Thông báo" description="Theo dõi trạng thái đơn thuê và các cập nhật quan trọng."/><button onClick={()=>void markAll()} disabled={!items.some(n=>!n.readAt)} className="btn-outline disabled:opacity-40">Đánh dấu đã đọc tất cả</button></div>
    {error&&<p role="alert" className="mt-6 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
    {loading?<p className="py-12 text-center text-slate-500">Đang tải thông báo…</p>:items.length===0?<div className="mt-8 rounded-2xl border border-dashed border-slate-300 p-12 text-center text-slate-500">Bạn chưa có thông báo nào.</div>:<div className="mt-8 divide-y divide-slate-100 rounded-[24px] border border-[#e5eee8] bg-white shadow-[0_16px_45px_rgba(30,90,65,.05)]">{items.map(n=><article key={n.id} className={'flex flex-col gap-3 p-5 transition-colors sm:flex-row sm:items-start sm:justify-between '+(!n.readAt?'bg-[#f0faf4]':'hover:bg-[#fbfdfb]')}>
      <div className="min-w-0"><div className="flex items-center gap-2"><h2 className="font-bold text-slate-900">{n.title}</h2>{!n.readAt&&<span className="h-2 w-2 rounded-full bg-[#e05252]" aria-label="Chưa đọc"/>}</div><p className="mt-1 text-sm leading-6 text-slate-600">{n.message}</p><p className="mt-2 text-xs text-slate-400">{new Date(n.createdAt).toLocaleString('vi-VN')}</p></div>
      <div className="flex shrink-0 items-center gap-3">{n.relatedBookingId&&<Link className="text-sm font-bold text-[#159b70] hover:underline" to="/bookings/my">Xem đơn #{n.relatedBookingId}</Link>}{!n.readAt&&<button onClick={()=>void markRead(n.id)} className="text-sm font-semibold text-slate-600 hover:text-emerald-700">Đã đọc</button>}</div>
    </article>)}</div>}
  </div>;
}
