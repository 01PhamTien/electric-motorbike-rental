import { useCallback, useEffect, useState } from 'react';
import { SectionHeading } from '../../components/Brand';
import { api } from '../../services/api';

type AuditEntry={id:number;actorId:number|null;action:string;targetType:string;targetId:number|null;details:string|null;createdAt:string};
type ShiftEntry=AuditEntry & {actor?:{id:number;fullName:string;stationId:number|null;station?:{id:number;name:string}|null}|null};
type Staff={id:number;fullName:string;stationId:number|null};
type Station={id:number;name:string};

const errorText=(e:unknown)=>{const m=(e as {response?:{data?:{message?:string|string[]}}})?.response?.data?.message;return Array.isArray(m)?m.join(', '):m||'Không thể tải dữ liệu.';};
function detailText(raw:string|null) {
  if (!raw) return '—';
  try {
    const value=JSON.parse(raw) as {summary?:string;pendingTasks?:string;checklist?:string[];vehicleCount?:number;batteryCount?:number};
    return [value.summary,value.pendingTasks?('Tồn đọng: '+value.pendingTasks):'',Array.isArray(value.checklist)&&value.checklist.length?('Checklist: '+value.checklist.join(', ')):'',value.vehicleCount!==undefined?('Xe: '+value.vehicleCount):'',value.batteryCount!==undefined?('Pin: '+value.batteryCount):''].filter(Boolean).join('\n')||raw;
  } catch { return raw; }
}

export function AuditLogsPage(){
 const [items,setItems]=useState<AuditEntry[]>([]);
 const [shifts,setShifts]=useState<ShiftEntry[]>([]);
 const [staff,setStaff]=useState<Staff[]>([]);
 const [stations,setStations]=useState<Station[]>([]);
 const [loading,setLoading]=useState(true);
 const [shiftLoading,setShiftLoading]=useState(false);
 const [error,setError]=useState('');
 const [shiftError,setShiftError]=useState('');
 const [from,setFrom]=useState('');
 const [to,setTo]=useState('');
 const [staffId,setStaffId]=useState('');
 const [stationId,setStationId]=useState('');
 const loadShifts=useCallback(async()=>{
   setShiftLoading(true);setShiftError('');
   try {
     const params:Record<string,string>={limit:'200'};
     if(from)params.from=from;if(to)params.to=to;if(staffId)params.staffId=staffId;if(stationId)params.stationId=stationId;
     const {data}=await api.get('/admin/audit-logs/shifts',{params});
     setShifts(Array.isArray(data)?data:[]);
   } catch(e){setShiftError(errorText(e));}
   finally{setShiftLoading(false);}
 },[from,to,staffId,stationId]);
 useEffect(()=>{
   let mounted=true;
   Promise.all([api.get('/admin/audit-logs?limit=200'),api.get('/users/staff'),api.get('/stations')])
     .then(([logs,people,places])=>{if(!mounted)return;setItems(Array.isArray(logs.data)?logs.data:[]);setStaff(Array.isArray(people.data)?people.data:[]);setStations(Array.isArray(places.data)?places.data:[]);})
     .catch(e=>{if(mounted)setError(errorText(e));})
     .finally(()=>{if(mounted)setLoading(false);});
   return()=>{mounted=false;};
 },[]);
 useEffect(()=>{void loadShifts();},[loadShifts]);
 return <div className="container-page py-12 sm:py-16">
   <SectionHeading eyebrow="QUẢN TRỊ HỆ THỐNG" title="Nhật ký hoạt động" description="Theo dõi thao tác hệ thống và tra cứu biên bản nhận ca, bàn giao ca theo nhân viên, trạm và thời gian."/>
   {error&&<p role="alert" className="mt-6 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
   <section className="mt-8">
     <div className="mb-4"><h2 className="text-xl font-bold text-slate-900">Lịch sử bàn giao ca</h2><p className="mt-1 text-sm text-slate-500">Dữ liệu được ghi nhận theo tài khoản nhân viên và thời điểm thực hiện.</p></div>
     <div className="panel grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-5">
       <label className="text-sm"><span className="field-label">Từ ngày</span><input type="date" className="field" value={from} onChange={e=>setFrom(e.target.value)}/></label>
       <label className="text-sm"><span className="field-label">Đến ngày</span><input type="date" min={from||undefined} className="field" value={to} onChange={e=>setTo(e.target.value)}/></label>
       <label className="text-sm"><span className="field-label">Nhân viên</span><select className="field" value={staffId} onChange={e=>setStaffId(e.target.value)}><option value="">Tất cả nhân viên</option>{staff.map(x=><option key={x.id} value={x.id}>{x.fullName}</option>)}</select></label>
       <label className="text-sm"><span className="field-label">Điểm thuê</span><select className="field" value={stationId} onChange={e=>setStationId(e.target.value)}><option value="">Tất cả điểm thuê</option>{stations.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
       <div className="flex items-end gap-2"><button type="button" onClick={()=>{setFrom('');setTo('');setStaffId('');setStationId('');}} className="btn-outline flex-1">Xóa lọc</button><button type="button" onClick={()=>void loadShifts()} disabled={shiftLoading} className="btn-primary flex-1">{shiftLoading?'Đang tải…':'Lọc'}</button></div>
     </div>
     {shiftError&&<p role="alert" className="mt-4 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{shiftError}</p>}
     {shiftLoading?<p className="py-10 text-center text-slate-500">Đang tải lịch sử bàn giao…</p>:shifts.length===0?<div className="mt-5 rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-500">Không có biên bản bàn giao phù hợp.</div>:<div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200 bg-white"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-4">Thời gian</th><th className="px-5 py-4">Nhân viên</th><th className="px-5 py-4">Điểm thuê</th><th className="px-5 py-4">Loại ghi nhận</th><th className="px-5 py-4">Biên bản</th></tr></thead><tbody className="divide-y divide-slate-100">{shifts.map(x=><tr key={x.id} className="align-top"><td className="whitespace-nowrap px-5 py-4 text-slate-600">{new Date(x.createdAt).toLocaleString('vi-VN')}</td><td className="px-5 py-4 font-semibold">{x.actor?.fullName||('Nhân viên #'+(x.actorId??'—'))}</td><td className="px-5 py-4">{x.actor?.station?.name||'Chưa phân trạm'}</td><td className="px-5 py-4"><span className={x.action==='SHIFT_STARTED'?'rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700':'rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700'}>{x.action==='SHIFT_STARTED'?'Bắt đầu ca':'Kết thúc ca'}</span></td><td className="max-w-lg whitespace-pre-wrap px-5 py-4 text-xs leading-5 text-slate-600">{detailText(x.details)}</td></tr>)}</tbody></table></div>}
   </section>
   <section className="mt-12">
     <h2 className="text-xl font-bold text-slate-900">Nhật ký hoạt động khác</h2>
     {loading?<p className="py-10 text-center text-slate-500">Đang tải nhật ký…</p>:items.length===0?<div className="mt-5 rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-500">Chưa có hoạt động được ghi nhận.</div>:<div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200 bg-white"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-4">Thời gian</th><th className="px-5 py-4">Người thực hiện</th><th className="px-5 py-4">Thao tác</th><th className="px-5 py-4">Đối tượng</th><th className="px-5 py-4">Chi tiết</th></tr></thead><tbody className="divide-y divide-slate-100">{items.filter(x=>x.targetType!=='SHIFT').map(x=><tr key={x.id}><td className="whitespace-nowrap px-5 py-4 text-slate-600">{new Date(x.createdAt).toLocaleString('vi-VN')}</td><td className="px-5 py-4">{x.actorId??'Hệ thống'}</td><td className="px-5 py-4 font-semibold text-slate-800">{x.action}</td><td className="px-5 py-4">{x.targetType} {x.targetId??''}</td><td className="max-w-sm px-5 py-4 text-xs text-slate-500"><code className="whitespace-pre-wrap break-all">{x.details||'—'}</code></td></tr>)}</tbody></table></div>}
   </section>
 </div>;
}
