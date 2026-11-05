import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, LoadingState, SectionHeading, money, timeText } from '../../components/Brand';
import { api } from '../../services/api';
import type { Vehicle } from '../../types';

type MaintenanceAlert = { scheduleId:number; vehicleId:number; vehicleCode:string; model:string; stationName:string; currentOdometerKm:number; lastServiceOdometerKm:number; dueOdometerKm:number; kmRemaining:number; dueAt:string; daysRemaining:number; intervalKm:number; intervalDays:number; isActive:boolean; alert:'OVERDUE'|'DUE_SOON'|'OK'|'INACTIVE' };
type Maintenance = { id: number; vehicleId: number; scheduledAt: string; reason: string; description: string | null; cost: string; status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' };
const alertText: Record<MaintenanceAlert['alert'],string> = { OVERDUE:'Quá hạn bảo dưỡng', DUE_SOON:'Sắp đến hạn', OK:'Trong chu kỳ', INACTIVE:'Đã tắt theo dõi' };
const statusText: Record<Maintenance['status'], string> = { SCHEDULED: 'Đã lên lịch', IN_PROGRESS: 'Đang bảo trì', COMPLETED: 'Hoàn thành', CANCELLED: 'Đã hủy' };
const errorText = (err: unknown) => {
  const m = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  return Array.isArray(m) ? m.join(', ') : m || 'Không thể xử lý yêu cầu. Vui lòng thử lại.';
};
function defaultSchedule() {
  const d = new Date(Date.now() + 86_400_000);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
export function MaintenancePage() {
  const [records,setRecords] = useState<Maintenance[]>([]);\n  const [alerts,setAlerts] = useState<MaintenanceAlert[]>([]);
  const [vehicles,setVehicles] = useState<Vehicle[]>([]);
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const [showForm,setShowForm] = useState(false);\n  const [showScheduleForm,setShowScheduleForm] = useState(false);\n  const [scheduleForm,setScheduleForm] = useState({vehicleId:'',intervalKm:'3000',intervalDays:'90',warningKm:'500',warningDays:'7',lastServiceOdometerKm:'0',lastServiceAt:new Date().toISOString().slice(0,10),isActive:true});
  const [form,setForm] = useState({ vehicleId: '', scheduledAt: defaultSchedule(), reason:'', description:'', cost:'0' });
  async function load() {
    setLoading(true);
    try {
      const [maintenance, fleet, schedules] = await Promise.all([api.get('/maintenance-records'),api.get('/vehicles'),api.get('/maintenance-records/schedules')]);
      setRecords(Array.isArray(maintenance.data) ? maintenance.data : maintenance.data?.items ?? []);
      setVehicles(Array.isArray(fleet.data) ? fleet.data : fleet.data?.items ?? []);\n      setAlerts(Array.isArray(schedules.data) ? schedules.data : schedules.data?.items ?? []);
      setError('');
    } catch(err) { setError(errorText(err)); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  async function create(e: React.FormEvent) {
    e.preventDefault();setBusy(true);setError('');setNotice('');
    try {
      await api.post('/maintenance-records', { vehicleId:Number(form.vehicleId),scheduledAt:new Date(form.scheduledAt).toISOString(),reason:form.reason,description:form.description,cost:Number(form.cost) });
      setShowForm(false); setNotice('Đã tạo phiếu bảo trì. Xe sẽ được cập nhật trạng thái trong hệ thống.'); await load();
    } catch(err) { setError(errorText(err)); } finally { setBusy(false); }
  }
  async function saveSchedule(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      await api.post('/maintenance-records/schedules', {
        vehicleId:Number(scheduleForm.vehicleId), intervalKm:Number(scheduleForm.intervalKm),
        intervalDays:Number(scheduleForm.intervalDays), warningKm:Number(scheduleForm.warningKm),
        warningDays:Number(scheduleForm.warningDays), lastServiceOdometerKm:Number(scheduleForm.lastServiceOdometerKm),
        lastServiceAt:new Date(scheduleForm.lastServiceAt + 'T12:00:00').toISOString(), isActive:scheduleForm.isActive,
      });
      setShowScheduleForm(false); setNotice('Đã lưu chu kỳ bảo dưỡng. Hệ thống sẽ tính cảnh báo theo ODO và ngày đến hạn.'); await load();
    } catch(err) { setError(errorText(err)); } finally { setBusy(false); }
  }
  async function setStatus(record: Maintenance, status: Maintenance['status']) {
    if (!window.confirm('Cập nhật phiếu #' + record.id + ' thành "' + statusText[status] + '"?')) return;
    setBusy(true);setError('');setNotice('');
    try { await api.patch('/maintenance-records/' + record.id, {status}); setNotice('Đã cập nhật phiếu #' + record.id); await load(); }
    catch(err){setError(errorText(err));}finally{setBusy(false);}
  }
  return <div className="container-page py-12 sm:py-16">
    <div className="flex flex-wrap items-end justify-between gap-5"><SectionHeading eyebrow="BẢO DƯỠNG ĐỘI XE" title="Giữ mọi hành trình an toàn" description="Theo dõi lịch bảo dưỡng và trạng thái xử lý từng phương tiện."/><div className="flex gap-3"><Link to="/operations" className="btn-outline">← Vận hành</Link><button onClick={()=>{setShowScheduleForm(true);setError('');}} className="btn-outline">⚙ Chu kỳ bảo dưỡng</button><button onClick={()=>{setShowForm(true);setError('');}} className="btn-primary">+ Tạo phiếu</button></div></div>
    {notice && <p role="status" className="mt-7 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}
    {error && <p role="alert" className="mt-7 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
    <section className="mt-8"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow">BẢO DƯỠNG CHỦ ĐỘNG</p><h2 className="mt-2 text-xl font-extrabold">Cảnh báo theo ODO và thời gian</h2><p className="mt-1 text-sm text-slate-500">ODO lấy từ biên bản giao nhận xe mới nhất. Cấu hình chu kỳ cho từng phương tiện.</p></div><span className="tag">{alerts.filter(a=>a.alert==='OVERDUE').length} quá hạn · {alerts.filter(a=>a.alert==='DUE_SOON').length} sắp đến hạn</span></div>{!alerts.length?<div className="panel mt-4 p-5 text-sm text-slate-500">Chưa cấu hình chu kỳ. Chọn “Chu kỳ bảo dưỡng” để thiết lập km, số ngày và mốc ODO bảo dưỡng gần nhất.</div>:<div className="mt-4 grid gap-4 md:grid-cols-2">{alerts.map(a=><article key={a.scheduleId} className="panel p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-extrabold text-slate-400">{a.vehicleCode} · {a.stationName}</p><h3 className="mt-1 font-extrabold">{a.model}</h3></div><span className={'tag '+(a.alert==='OVERDUE'?'bg-rose-100 text-rose-800':a.alert==='DUE_SOON'?'bg-amber-100 text-amber-900':'')}>{alertText[a.alert]}</span></div><div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><p className="field-label">ODO mới nhất</p><strong>{a.currentOdometerKm.toLocaleString('vi-VN')} km</strong></div><div><p className="field-label">Mốc bảo dưỡng</p><strong>{a.dueOdometerKm.toLocaleString('vi-VN')} km</strong></div><div><p className="field-label">Còn theo km</p><strong className={a.kmRemaining<=0?'text-rose-700':''}>{a.kmRemaining.toLocaleString('vi-VN')} km</strong></div><div><p className="field-label">Đến hạn theo ngày</p><strong className={a.daysRemaining<=0?'text-rose-700':''}>{a.daysRemaining<=0?'Quá '+Math.abs(a.daysRemaining)+' ngày':'Còn '+a.daysRemaining+' ngày'}</strong></div></div><p className="mt-3 text-xs text-slate-500">Chu kỳ: {a.intervalKm.toLocaleString('vi-VN')} km hoặc {a.intervalDays} ngày · hạn đến {timeText(a.dueAt)}</p></article>)}</div>}</section>
    {loading ? <div className="mt-8"><LoadingState /></div> : records.length===0 ? <div className="mt-8"><EmptyState title="Chưa có lịch bảo dưỡng" description="Tạo phiếu đầu tiên để theo dõi lịch kiểm tra và sửa chữa xe." /></div> : <div className="mt-8 grid gap-5 md:grid-cols-2">{records.map(m=><article key={m.id} className="panel p-6"><div className="flex flex-wrap items-start justify-between gap-3"><span className="text-xs font-extrabold tracking-widest text-slate-400">PHIẾU #{m.id} · XE #{m.vehicleId}</span><span className="tag">{statusText[m.status]}</span></div><h2 className="mt-4 text-xl font-extrabold">{m.reason}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{m.description || 'Chưa có mô tả chi tiết'}</p><div className="mt-5 grid grid-cols-2 gap-4 border-t border-slate-100 pt-5"><div><span className="field-label">Lịch thực hiện</span><strong className="text-sm">{timeText(m.scheduledAt)}</strong></div><div><span className="field-label">Chi phí dự kiến</span><strong className="text-sm">{money(m.cost)}</strong></div></div>{['SCHEDULED','IN_PROGRESS'].includes(m.status) && <div className="mt-5 flex flex-wrap gap-2">{m.status === 'SCHEDULED' && <button disabled={busy} onClick={()=>void setStatus(m,'IN_PROGRESS')} className="btn-dark">Bắt đầu</button>}<button disabled={busy} onClick={()=>void setStatus(m,'COMPLETED')} className="btn-primary">Hoàn thành</button><button disabled={busy} onClick={()=>void setStatus(m,'CANCELLED')} className="btn-outline">Hủy phiếu</button></div>}</article>)}</div>}
    {showScheduleForm && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#071c21]/70 p-4" onMouseDown={e=>{if(e.target===e.currentTarget)setShowScheduleForm(false);}}><form onSubmit={saveSchedule} role="dialog" aria-modal="true" aria-labelledby="schedule-title" className="max-h-[95vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white p-7"><div className="flex justify-between gap-3"><div><p className="eyebrow">BẢO DƯỠNG ĐỊNH KỲ</p><h2 id="schedule-title" className="mt-2 text-2xl font-extrabold">Cấu hình chu kỳ xe</h2></div><button type="button" className="self-start rounded-xl bg-slate-100 px-3 py-2" onClick={()=>setShowScheduleForm(false)}>✕</button></div><div className="mt-6 grid gap-4"><label><span className="field-label">Phương tiện</span><select required className="field" value={scheduleForm.vehicleId} onChange={e=>setScheduleForm({...scheduleForm,vehicleId:e.target.value})}><option value="">Chọn xe</option>{vehicles.map(v=><option key={v.id} value={v.id}>{v.code} · {v.model?.brand} {v.model?.name}</option>)}</select></label><div className="grid grid-cols-2 gap-3"><label><span className="field-label">Chu kỳ (km)</span><input className="field" type="number" min="100" max="50000" required value={scheduleForm.intervalKm} onChange={e=>setScheduleForm({...scheduleForm,intervalKm:e.target.value})}/></label><label><span className="field-label">Chu kỳ (ngày)</span><input className="field" type="number" min="1" max="730" required value={scheduleForm.intervalDays} onChange={e=>setScheduleForm({...scheduleForm,intervalDays:e.target.value})}/></label><label><span className="field-label">Cảnh báo trước (km)</span><input className="field" type="number" min="0" value={scheduleForm.warningKm} onChange={e=>setScheduleForm({...scheduleForm,warningKm:e.target.value})}/></label><label><span className="field-label">Cảnh báo trước (ngày)</span><input className="field" type="number" min="0" value={scheduleForm.warningDays} onChange={e=>setScheduleForm({...scheduleForm,warningDays:e.target.value})}/></label></div><label><span className="field-label">ODO tại lần bảo dưỡng gần nhất (km)</span><input className="field" type="number" min="0" step="0.1" required value={scheduleForm.lastServiceOdometerKm} onChange={e=>setScheduleForm({...scheduleForm,lastServiceOdometerKm:e.target.value})}/></label><label><span className="field-label">Ngày bảo dưỡng gần nhất</span><input className="field" type="date" required value={scheduleForm.lastServiceAt} onChange={e=>setScheduleForm({...scheduleForm,lastServiceAt:e.target.value})}/></label><label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={scheduleForm.isActive} onChange={e=>setScheduleForm({...scheduleForm,isActive:e.target.checked})}/>Bật theo dõi và cảnh báo</label><p className="text-xs leading-5 text-slate-500">Thiết lập mốc ODO/ngày thực tế từ sổ bảo dưỡng. Cảnh báo sẽ kích hoạt khi chạm một trong hai giới hạn.</p><button disabled={busy||!scheduleForm.vehicleId} className="btn-primary w-full">{busy?'Đang lưu...':'Lưu chu kỳ bảo dưỡng'}</button></div></form></div>}
    {showForm && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#071c21]/70 p-4" onMouseDown={e=>{if(e.target===e.currentTarget)setShowForm(false);}}><form onSubmit={create} role="dialog" aria-modal="true" aria-labelledby="maintenance-title" className="max-h-[95vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white p-7"><div className="flex justify-between gap-3"><div><p className="eyebrow">ĐIỀU PHỐI ĐỘI XE</p><h2 className="mt-2 text-2xl font-extrabold" id="maintenance-title">Tạo lịch bảo dưỡng</h2></div><button type="button" className="self-start rounded-xl bg-slate-100 px-3 py-2" onClick={()=>setShowForm(false)} aria-label="Đóng">✕</button></div><div className="mt-7 grid gap-4"><label><span className="field-label">Phương tiện</span><select className="field" required value={form.vehicleId} onChange={e=>setForm({...form,vehicleId:e.target.value})}><option value="">Chọn xe</option>{vehicles.map(v=><option value={v.id} key={v.id}>{v.code} · {v.model?.brand} {v.model?.name}</option>)}</select></label><label><span className="field-label">Thời gian dự kiến</span><input className="field" type="datetime-local" required value={form.scheduledAt} onChange={e=>setForm({...form,scheduledAt:e.target.value})}/></label><label><span className="field-label">Lý do</span><input className="field" minLength={2} maxLength={160} required value={form.reason} onChange={e=>setForm({...form,reason:e.target.value})}/></label><label><span className="field-label">Mô tả</span><textarea className="field min-h-24" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label><label><span className="field-label">Chi phí dự kiến (VND)</span><input className="field" type="number" min="0" value={form.cost} onChange={e=>setForm({...form,cost:e.target.value})}/></label>{error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}<button disabled={busy || !form.vehicleId} className="btn-primary w-full">{busy ? 'Đang lưu...' : 'Tạo phiếu bảo dưỡng →'}</button></div></form></div>}
  </div>;
}
