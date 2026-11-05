import { useEffect, useState } from 'react';
import { SectionHeading } from '../../components/Brand';
import { api } from '../../services/api';

type MySchedule={id:number;startAt:string;endAt:string;status:string;note:string|null;station?:{name:string;address:string}};
const statusText:Record<string,string>={PLANNED:'Sắp diễn ra',IN_PROGRESS:'Đang trong ca',COMPLETED:'Đã hoàn thành',CANCELLED:'Đã hủy'};
export function MySchedulePage(){
 const [items,setItems]=useState<MySchedule[]>([]);const [loading,setLoading]=useState(true);const [error,setError]=useState('');
 useEffect(()=>{let active=true;api.get<MySchedule[]>('/staff/schedules/me').then(({data})=>{if(active)setItems(Array.isArray(data)?data:[]);}).catch(e=>{if(active)setError(e?.response?.data?.message||'Không thể tải lịch trực.');}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[]);
 return <section className="container-page space-y-7 py-12 sm:py-16">
  <SectionHeading eyebrow="LỊCH LÀM VIỆC CỦA TÔI" title="Ca trực sắp tới" description="Theo dõi thời gian và điểm thuê được ADMIN phân công. Lịch hiển thị trong 60 ngày tới."/>
  {error&&<p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
  {loading?<p className="py-12 text-center text-sm text-slate-500">Đang tải lịch trực...</p>:items.length===0?<div className="rounded-2xl border border-dashed border-slate-300 p-12 text-center text-sm text-slate-500">Bạn chưa có ca trực sắp tới. Hãy liên hệ ADMIN nếu cần cập nhật lịch.</div>:
   <div className="grid gap-4 md:grid-cols-2">{items.map(x=><article key={x.id} className="panel p-5"><div className="flex items-start justify-between gap-3"><h2 className="font-bold text-slate-900">{x.station?.name||'Điểm thuê được phân công'}</h2><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">{statusText[x.status]||x.status}</span></div><p className="mt-4 text-sm font-semibold text-slate-800">{new Date(x.startAt).toLocaleString('vi-VN',{dateStyle:'medium',timeStyle:'short'})}</p><p className="mt-1 text-sm text-slate-500">Đến {new Date(x.endAt).toLocaleString('vi-VN',{dateStyle:'medium',timeStyle:'short'})}</p>{x.station?.address&&<p className="mt-3 text-xs text-slate-500">{x.station.address}</p>}{x.note&&<p className="mt-3 border-t border-slate-100 pt-3 text-sm text-slate-600">{x.note}</p>}</article>)}</div>}
 </section>;
}
