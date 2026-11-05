import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { SectionHeading } from '../../components/Brand';
import { api } from '../../services/api';

type Staff={id:number;fullName:string;status:string;stationId:number|null};
type Station={id:number;name:string;isActive:boolean};
type Schedule={id:number;staffId:number;stationId:number;startAt:string;endAt:string;status:'PLANNED'|'IN_PROGRESS'|'COMPLETED'|'CANCELLED';note:string|null;staff?:Staff;station?:Station};
const blank={staffId:'',stationId:'',startAt:'',endAt:'',note:''};
const statusText:Record<string,string>={PLANNED:'Đã lên lịch',IN_PROGRESS:'Đang diễn ra',COMPLETED:'Hoàn thành',CANCELLED:'Đã hủy'};
const errorText=(e:unknown)=>{const m=(e as {response?:{data?:{message?:string|string[]}}})?.response?.data?.message;return Array.isArray(m)?m.join(', '):m||'Không thể xử lý lịch làm việc.';};
const localDate=(d:Date)=>{const offset=d.getTimezoneOffset();return new Date(d.getTime()-offset*60000).toISOString().slice(0,10);};
const localDateTime=(s:string)=>{const d=new Date(s);return d.toLocaleString('vi-VN',{dateStyle:'short',timeStyle:'short'});};
export function StaffSchedulesPage(){
 const [items,setItems]=useState<Schedule[]>([]);const [staff,setStaff]=useState<Staff[]>([]);const [stations,setStations]=useState<Station[]>([]);
 const [form,setForm]=useState(blank);const [from,setFrom]=useState(localDate(new Date()));const [to,setTo]=useState(localDate(new Date(Date.now()+7*86400000)));
 const [loading,setLoading]=useState(true);const [saving,setSaving]=useState(false);const [error,setError]=useState('');const [notice,setNotice]=useState('');
 const load=useCallback(async()=>{
  setLoading(true);setError('');
  try{const params:Record<string,string>={};if(from)params.from=from;if(to)params.to=to;
   const [schedules,people,places]=await Promise.all([api.get<Schedule[]>('/admin/staff-schedules',{params}),api.get<Staff[]>('/users/staff'),api.get<Station[]>('/stations')]);
   setItems(Array.isArray(schedules.data)?schedules.data:[]);setStaff((people.data||[]).filter(x=>x.status==='ACTIVE'));setStations((places.data||[]).filter(x=>x.isActive));
  }catch(e){setError(errorText(e));}finally{setLoading(false);}
 },[from,to]);
 useEffect(()=>{void load();},[load]);
 async function submit(e:FormEvent){e.preventDefault();setSaving(true);setError('');setNotice('');
  try{await api.post('/admin/staff-schedules',{staffId:Number(form.staffId),stationId:Number(form.stationId),startAt:new Date(form.startAt).toISOString(),endAt:new Date(form.endAt).toISOString(),note:form.note.trim()||undefined});setForm(blank);setNotice('Đã phân ca cho nhân viên.');await load();}
  catch(e){setError(errorText(e));}finally{setSaving(false);}
 }
 async function setStatus(item:Schedule,status:Schedule['status']){setError('');setNotice('');try{await api.patch('/admin/staff-schedules/'+item.id,{status});setNotice('Đã cập nhật trạng thái ca.');await load();}catch(e){setError(errorText(e));}}
 return <section className="container-page space-y-7 py-12 sm:py-16">
  <header className="flex flex-wrap items-end justify-between gap-4"><SectionHeading eyebrow="QUẢN TRỊ NHÂN SỰ" title="Lịch làm việc & phân ca" description="Phân công nhân viên theo trạm, kiểm soát thời gian trực và tránh xếp trùng ca."/><button type="button" onClick={()=>void load()} disabled={loading} className="btn-outline">↻ Làm mới</button></header>
  {error&&<p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}{notice&&<p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}
  <form onSubmit={submit} className="panel grid gap-4 p-6 sm:grid-cols-2">
   <div className="sm:col-span-2"><h2 className="font-bold text-slate-900">Tạo ca làm việc</h2><p className="mt-1 text-xs text-slate-500">Một nhân viên không thể được phân hai ca có thời gian chồng lấn.</p></div>
   <label className="text-sm font-medium">Nhân viên<select required className="field mt-2" value={form.staffId} onChange={e=>setForm({...form,staffId:e.target.value})}><option value="">Chọn nhân viên</option>{staff.map(x=><option key={x.id} value={x.id}>{x.fullName}</option>)}</select></label>
   <label className="text-sm font-medium">Điểm thuê<select required className="field mt-2" value={form.stationId} onChange={e=>setForm({...form,stationId:e.target.value})}><option value="">Chọn điểm thuê</option>{stations.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
   <label className="text-sm font-medium">Bắt đầu<input required type="datetime-local" className="field mt-2" value={form.startAt} onChange={e=>setForm({...form,startAt:e.target.value})}/></label>
   <label className="text-sm font-medium">Kết thúc<input required type="datetime-local" min={form.startAt||undefined} className="field mt-2" value={form.endAt} onChange={e=>setForm({...form,endAt:e.target.value})}/></label>
   <label className="text-sm font-medium sm:col-span-2">Ghi chú<textarea maxLength={500} className="field mt-2 min-h-20" value={form.note} onChange={e=>setForm({...form,note:e.target.value})} placeholder="Ví dụ: Ca sáng, phụ trách bàn giao xe và kiểm kê pin..."/></label>
   <div className="sm:col-span-2"><button disabled={saving||staff.length===0||stations.length===0} className="btn-primary">{saving?'Đang lưu...':'Phân ca nhân viên'}</button></div>
  </form>
  <div className="panel p-5"><div className="grid gap-3 sm:grid-cols-3 sm:items-end"><label className="text-sm font-medium">Từ ngày<input type="date" className="field mt-2" value={from} onChange={e=>setFrom(e.target.value)}/></label><label className="text-sm font-medium">Đến ngày<input type="date" min={from||undefined} className="field mt-2" value={to} onChange={e=>setTo(e.target.value)}/></label><p className="text-sm text-slate-500">{items.length} ca trong khoảng thời gian</p></div></div>
  <div className="overflow-hidden panel"><div className="border-b border-slate-100 p-5"><h2 className="font-bold">Danh sách ca làm việc</h2></div>
   {loading?<p className="p-6 text-sm text-slate-500">Đang tải lịch làm việc...</p>:items.length===0?<p className="p-8 text-center text-sm text-slate-500">Chưa có ca làm việc trong khoảng thời gian này.</p>:
   <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-4">Nhân viên</th><th className="px-5 py-4">Điểm thuê</th><th className="px-5 py-4">Thời gian</th><th className="px-5 py-4">Ghi chú</th><th className="px-5 py-4">Trạng thái</th><th className="px-5 py-4">Thao tác</th></tr></thead><tbody className="divide-y divide-slate-100">{items.map(x=><tr key={x.id} className="align-top"><td className="px-5 py-4 font-semibold">{x.staff?.fullName||'Nhân viên #'+x.staffId}</td><td className="px-5 py-4">{x.station?.name||'Trạm #'+x.stationId}</td><td className="whitespace-nowrap px-5 py-4 text-xs text-slate-600">{localDateTime(x.startAt)}<br/>→ {localDateTime(x.endAt)}</td><td className="max-w-xs px-5 py-4 text-xs text-slate-500">{x.note||'—'}</td><td className="px-5 py-4"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold">{statusText[x.status]}</span></td><td className="px-5 py-4">{x.status==='PLANNED'?<div className="flex gap-2"><button type="button" onClick={()=>void setStatus(x,'IN_PROGRESS')} className="text-xs font-bold text-emerald-700">Bắt đầu</button><button type="button" onClick={()=>void setStatus(x,'CANCELLED')} className="text-xs font-bold text-rose-600">Hủy</button></div>:x.status==='IN_PROGRESS'?<button type="button" onClick={()=>void setStatus(x,'COMPLETED')} className="text-xs font-bold text-emerald-700">Hoàn tất</button>:<span className="text-xs text-slate-400">—</span>}</td></tr>)}</tbody></table></div>}
  </div>
 </section>;
}
