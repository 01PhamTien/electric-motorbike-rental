import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api } from '../../services/api';
import type { Vehicle } from '../../types';

type MaintenanceStatus='SCHEDULED'|'IN_PROGRESS'|'COMPLETED'|'CANCELLED';
type RecordItem={id:number;vehicleId:number;scheduledAt:string;plannedEndAt:string|null;completedAt:string|null;reason:string;description:string|null;cost:string;status:MaintenanceStatus;createdAt:string};
type FormState={vehicleId:string;scheduledAt:string;plannedEndAt:string;reason:string;description:string;cost:string};
const labels:Record<MaintenanceStatus,string>={SCHEDULED:'Đã lên lịch',IN_PROGRESS:'Đang bảo dưỡng',COMPLETED:'Hoàn thành',CANCELLED:'Đã hủy'};
const money=(value:string|number)=>Number(value).toLocaleString('vi-VN')+' đ';
const localDateTime=(date:Date)=>{const offset=date.getTimezoneOffset()*60000;return new Date(date.getTime()-offset).toISOString().slice(0,16);};

export function MaintenancePage(){
  const [vehicles,setVehicles]=useState<Vehicle[]>([]);
  const [records,setRecords]=useState<RecordItem[]>([]);
  const [form,setForm]=useState<FormState>({vehicleId:'',scheduledAt:localDateTime(new Date(Date.now()+3600000)),plannedEndAt:localDateTime(new Date(Date.now()+3*3600000)),reason:'Bảo dưỡng định kỳ',description:'',cost:'0'});
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const [filter,setFilter]=useState('ALL');

  const load=useCallback(async()=>{
    setLoading(true);setError('');
    try{
      const [v,m]=await Promise.all([api.get<Vehicle[]>('/vehicles'),api.get<RecordItem[]>('/maintenance-records')]);
      setVehicles(v.data);
      setRecords(m.data);
      setForm(current=>({...current,vehicleId:current.vehicleId||String(v.data[0]?.id||'')}));
    }catch(err:any){setError(err.response?.data?.message||'Không tải được dữ liệu bảo dưỡng. Hãy đăng nhập bằng ADMIN hoặc STAFF.');}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{void load();},[load]);

  async function create(event:FormEvent){
    event.preventDefault();setSaving(true);setError('');setMessage('');
    try{
      await api.post('/maintenance-records',{
        vehicleId:Number(form.vehicleId),scheduledAt:new Date(form.scheduledAt).toISOString(),plannedEndAt:new Date(form.plannedEndAt).toISOString(),
        reason:form.reason.trim(),description:form.description.trim()||undefined,cost:Number(form.cost),
      });
      setMessage('Đã tạo lịch bảo dưỡng. Xe chỉ chuyển sang MAINTENANCE khi nhân viên bắt đầu công việc.');
      setForm(current=>({...current,reason:'Bảo dưỡng định kỳ',description:'',cost:'0'}));
      await load();
    }catch(err:any){setError(err.response?.data?.message||'Không thể tạo phiếu bảo dưỡng.');}
    finally{setSaving(false);}
  }

  async function changeStatus(record:RecordItem,status:MaintenanceStatus){
    const confirmText=status==='COMPLETED'?'Xác nhận hoàn thành bảo dưỡng và đưa xe về trạng thái trước bảo dưỡng?':status==='CANCELLED'?'Xác nhận hủy phiếu bảo dưỡng?':'Chuyển phiếu sang trạng thái đang bảo dưỡng?';
    if(!window.confirm(confirmText))return;
    let payload:{status:MaintenanceStatus;cost?:number}={status};
    if(status==='COMPLETED'){
      const raw=window.prompt('Nhập chi phí thực tế sau bảo dưỡng (VNĐ):',record.cost);
      if(raw===null)return;
      const actualCost=Number(raw);
      if(!Number.isFinite(actualCost)||actualCost<0){setError('Chi phí thực tế không hợp lệ.');return;}
      payload={status,cost:actualCost};
    }
    setError('');setMessage('');
    try{
      await api.patch('/maintenance-records/'+record.id,payload);
      setMessage('Đã cập nhật phiếu bảo dưỡng #'+record.id+'.');
      await load();
    }catch(err:any){setError(err.response?.data?.message||'Không thể cập nhật trạng thái phiếu.');}
  }

  const filtered=records.filter(record=>filter==='ALL'||record.status===filter);
  const vehicleName=(id:number)=>{
    const v=vehicles.find(item=>item.id===id);
    return v? v.code+' · '+v.model?.brand+' '+v.model?.name+' · '+v.station?.name:'Xe #'+id;
  };

  return <section className="space-y-6">
    <header className="relative overflow-hidden rounded-3xl bg-slate-950 px-6 py-7 text-white shadow-lg sm:px-8">
      <div className="pointer-events-none absolute -right-14 -top-20 h-64 w-64 rounded-full bg-amber-400/10 blur-3xl" />
      <div className="relative flex flex-wrap items-end justify-between gap-4">
        <div><span className="inline-flex rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-[11px] font-bold tracking-[0.15em] text-amber-200">QUẢN LÝ ĐỘI XE</span>
          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">Lịch bảo dưỡng xe</h1>
          <p className="mt-2 text-sm leading-6 text-slate-300">Lập lịch, theo dõi nội dung công việc, chi phí và kết quả bảo dưỡng.</p></div>
        <button onClick={()=>void load()} disabled={loading} className="rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15 disabled:opacity-50">{loading?'Đang tải...':'↻ Làm mới'}</button>
      </div>
    </header>
    {error&&<div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{Array.isArray(error)?error.join(', '):error}</div>}
    {message&&<div role="status" className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">{message}</div>}

    <form onSubmit={create} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2 sm:p-6">
      <div className="md:col-span-2"><h2 className="font-semibold">Tạo phiếu bảo dưỡng</h2><p className="mt-1 text-xs text-slate-500">Xe chỉ chuyển sang MAINTENANCE khi nhân viên bắt đầu công việc. Lịch SCHEDULED chỉ chặn các đơn thuê giao với khung giờ bảo dưỡng.</p></div>
      <label className="block text-sm font-medium">Xe
        <select required value={form.vehicleId} onChange={e=>setForm({...form,vehicleId:e.target.value})} className="mt-1 w-full rounded-lg border bg-white px-3 py-2">
          <option value="">-- Chọn xe --</option>{vehicles.map(v=><option key={v.id} value={v.id}>{v.code} · {v.model?.brand} {v.model?.name} · {v.station?.name} ({v.status})</option>)}
        </select>
      </label>
      <label className="block text-sm font-medium">Thời gian dự kiến
        <input required type="datetime-local" value={form.scheduledAt} onChange={e=>setForm({...form,scheduledAt:e.target.value})} className="mt-1 w-full rounded-lg border px-3 py-2"/>
      </label>
      <label className="block text-sm font-medium">Thời gian kết thúc dự kiến
        <input required type="datetime-local" min={form.scheduledAt} value={form.plannedEndAt} onChange={e=>setForm({...form,plannedEndAt:e.target.value})} className="mt-1 w-full rounded-lg border px-3 py-2"/>
      </label>
      <label className="block text-sm font-medium">Lý do bảo dưỡng
        <input required minLength={2} maxLength={160} value={form.reason} onChange={e=>setForm({...form,reason:e.target.value})} className="mt-1 w-full rounded-lg border px-3 py-2" placeholder="Bảo dưỡng định kỳ, thay lốp..."/>
      </label>
      <label className="block text-sm font-medium">Chi phí dự kiến (VNĐ)
        <input required type="number" min="0" step="0.01" value={form.cost} onChange={e=>setForm({...form,cost:e.target.value})} className="mt-1 w-full rounded-lg border px-3 py-2"/>
      </label>
      <label className="block text-sm font-medium md:col-span-2">Mô tả / nội dung công việc
        <textarea rows={3} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} className="mt-1 w-full rounded-lg border px-3 py-2" placeholder="Các hạng mục cần kiểm tra, phụ tùng dự kiến..."/>
      </label>
      <div className="md:col-span-2"><button disabled={saving||!form.vehicleId} className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving?'Đang lưu...':'Tạo phiếu bảo dưỡng'}</button></div>
    </form>

    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4"><div><h2 className="font-semibold">Danh sách phiếu ({filtered.length})</h2><p className="text-xs text-slate-500">Tối đa 200 phiếu gần nhất trong phạm vi điểm thuê của tài khoản.</p></div>
        <select value={filter} onChange={e=>setFilter(e.target.value)} className="rounded-lg border bg-white px-3 py-2 text-sm">
          <option value="ALL">Tất cả trạng thái</option><option value="SCHEDULED">Đã lên lịch</option><option value="IN_PROGRESS">Đang bảo dưỡng</option><option value="COMPLETED">Hoàn thành</option><option value="CANCELLED">Đã hủy</option>
        </select>
      </div>
      {loading?<p className="p-5 text-sm text-slate-500">Đang tải phiếu bảo dưỡng...</p>:
       filtered.length===0?<p className="p-5 text-sm text-slate-500">Chưa có phiếu bảo dưỡng phù hợp.</p>:
       <div className="divide-y">{filtered.map(record=><article key={record.id} className="space-y-3 p-5">
        <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-semibold">Phiếu #{record.id} · {vehicleName(record.vehicleId)}</h3><p className="mt-1 text-sm text-slate-600">{record.reason}</p></div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">{labels[record.status]}</span></div>
        {record.description&&<p className="text-sm text-slate-600">{record.description}</p>}
        <div className="grid gap-2 text-sm text-slate-600 sm:grid-cols-3"><p>Bắt đầu: {new Date(record.scheduledAt).toLocaleString('vi-VN')}</p><p>Dự kiến xong: {record.plannedEndAt?new Date(record.plannedEndAt).toLocaleString('vi-VN'):'Chưa cập nhật'}</p><p>Chi phí: <strong>{money(record.cost)}</strong></p><p>Hoàn thành: {record.completedAt?new Date(record.completedAt).toLocaleString('vi-VN'):'Chưa hoàn thành'}</p></div>
        {record.status==='SCHEDULED'&&<button onClick={()=>void changeStatus(record,'IN_PROGRESS')} className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white">Bắt đầu bảo dưỡng</button>}
        {record.status==='IN_PROGRESS'&&<div className="flex flex-wrap gap-2"><button onClick={()=>void changeStatus(record,'COMPLETED')} className="rounded-lg bg-green-700 px-3 py-2 text-sm font-semibold text-white">Hoàn thành bảo dưỡng</button><button onClick={()=>void changeStatus(record,'CANCELLED')} className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700">Hủy phiếu</button></div>}
       </article>)}</div>}
    </div>
  </section>;
}
