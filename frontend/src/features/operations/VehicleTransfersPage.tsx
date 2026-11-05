import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { LoadingState, SectionHeading, timeText } from '../../components/Brand';
import { api } from '../../services/api';
import { useAuth } from '../auth/AuthContext';

type Station = { id:number; name:string; isActive:boolean };
type Vehicle = { id:number; code:string; status:string; isActive:boolean; stationId:number; station?:Station; model?:{brand:string;name:string} };
type Transfer = { id:number; vehicleId:number; vehicleCode:string; sourceStationId:number; sourceStationName:string; destinationStationId:number; destinationStationName:string; status:'PENDING'|'IN_TRANSIT'|'COMPLETED'|'CANCELLED'; note:string|null; createdAt:string; dispatchedAt:string|null; receivedAt:string|null };
const statusText:Record<Transfer['status'],string>={PENDING:'Chờ bàn giao',IN_TRANSIT:'Đang vận chuyển',COMPLETED:'Đã tiếp nhận',CANCELLED:'Đã hủy'};
const errorText=(e:unknown)=>{const m=(e as {response?:{data?:{message?:string|string[]}}})?.response?.data?.message;return Array.isArray(m)?m.join(', '):m||'Không thể hoàn thành thao tác. Vui lòng thử lại.';};

export function VehicleTransfersPage() {
  const {user}=useAuth();
  const [transfers,setTransfers]=useState<Transfer[]>([]);
  const [vehicles,setVehicles]=useState<Vehicle[]>([]);
  const [stations,setStations]=useState<Station[]>([]);
  const [vehicleId,setVehicleId]=useState('');
  const [destinationStationId,setDestinationStationId]=useState('');
  const [note,setNote]=useState('');
  const [filter,setFilter]=useState('OPEN');
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [busyId,setBusyId]=useState<number|null>(null);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');

  async function load() {
    setLoading(true);
    try {
      const [t,v,s]=await Promise.all([
        api.get<Transfer[]>('/vehicle-transfers'),
        api.get<Vehicle[]>(user?.role==='ADMIN'?'/vehicles/admin/all':'/vehicles'),
        api.get<Station[]>('/stations'),
      ]);
      setTransfers(Array.isArray(t.data)?t.data:[]);
      setVehicles(Array.isArray(v.data)?v.data:[]);
      setStations(Array.isArray(s.data)?s.data:[]);
      setError('');
    } catch(e) {setError(errorText(e));}
    finally {setLoading(false);}
  }
  useEffect(()=>{void load();},[user?.role,user?.stationId]);
  const sourceVehicles=useMemo(()=>vehicles.filter(v=>v.isActive&&v.status==='ACTIVE'&&(user?.role==='ADMIN'||v.stationId===user?.stationId)&&!transfers.some(t=>t.vehicleId===v.id&&['PENDING','IN_TRANSIT'].includes(t.status))),[vehicles,user,transfers]);
  const activeStations=stations.filter(s=>s.isActive);
  const visible=transfers.filter(t=>filter==='ALL'||(filter==='OPEN'&&['PENDING','IN_TRANSIT'].includes(t.status))||t.status===filter);
  async function create(e:React.FormEvent) {
    e.preventDefault();setSaving(true);setError('');setNotice('');
    try {
      await api.post('/vehicle-transfers',{vehicleId:Number(vehicleId),destinationStationId:Number(destinationStationId),note:note.trim()||undefined});
      setVehicleId('');setDestinationStationId('');setNote('');
      setNotice('Đã tạo yêu cầu. Trạm đi cần xác nhận bàn giao, sau đó trạm đến mới có thể tiếp nhận.');
      await load();
    } catch(e) {setError(errorText(e));}
    finally {setSaving(false);}
  }
  async function act(id:number,action:'dispatch'|'receive'|'cancel') {
    const labels={dispatch:'Xác nhận đã bàn giao xe cho vận chuyển?',receive:'Xác nhận đã nhận xe tại trạm đến?',cancel:'Hủy yêu cầu điều chuyển này?'};
    if(!window.confirm(labels[action]))return;
    setBusyId(id);setError('');setNotice('');
    try {
      await api.patch('/vehicle-transfers/'+id+'/'+action);
      setNotice(action==='dispatch'?'Đã xác nhận bàn giao. Trạm đích có thể tiếp nhận xe.':action==='receive'?'Đã tiếp nhận xe. Trạm hiện tại của xe đã được cập nhật.':'Đã hủy yêu cầu điều chuyển.');
      await load();
    } catch(e) {setError(errorText(e));}
    finally {setBusyId(null);}
  }
  return <section className="container-page space-y-7 py-12 sm:py-16">
    <div className="flex flex-wrap items-end justify-between gap-4"><SectionHeading eyebrow="ĐIỀU PHỐI ĐỘI XE" title="Điều chuyển xe giữa các trạm" description="Quản lý yêu cầu chuyển xe, xác nhận bàn giao tại trạm đi và xác nhận tiếp nhận tại trạm đến."/><button className="btn-outline" onClick={()=>void load()}>↻ Làm mới</button></div>
    <div className="flex flex-wrap gap-3 text-sm"><Link className="font-bold text-emerald-700" to="/operations">← Trung tâm vận hành</Link>{user?.role==='ADMIN'&&<Link className="font-bold text-emerald-700" to="/admin">Quản trị ↗</Link>}</div>
    {notice&&<p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}
    {error&&<p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">{error}</p>}
    <form onSubmit={create} className="panel grid gap-4 p-6 md:grid-cols-2">
      <div className="md:col-span-2"><p className="eyebrow">TẠO YÊU CẦU ĐIỀU CHUYỂN</p><h2 className="mt-2 text-xl font-extrabold">Chọn xe và trạm tiếp nhận</h2><p className="mt-1 text-sm text-slate-500">Chỉ xe sẵn sàng, không có đơn thuê hoặc bảo dưỡng đang mở mới được tạo yêu cầu.</p></div>
      <label><span className="field-label">Xe tại trạm đi</span><select required className="field" value={vehicleId} onChange={e=>{setVehicleId(e.target.value);setDestinationStationId('');}}><option value="">Chọn xe...</option>{sourceVehicles.map(v=><option key={v.id} value={v.id}>{v.code} · {v.model?.brand} {v.model?.name} · {v.station?.name||stations.find(s=>s.id===v.stationId)?.name||('Trạm #'+v.stationId)}</option>)}</select>{!sourceVehicles.length&&<span className="mt-1 block text-xs text-amber-700">Không có xe sẵn sàng thuộc phạm vi được phép điều chuyển.</span>}</label>
      <label><span className="field-label">Trạm đến</span><select required className="field" value={destinationStationId} onChange={e=>setDestinationStationId(e.target.value)}><option value="">Chọn trạm nhận...</option>{activeStations.filter(s=>{const v=vehicles.find(x=>String(x.id)===vehicleId);return !v||s.id!==v.stationId;}).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label className="md:col-span-2"><span className="field-label">Ghi chú (không bắt buộc)</span><textarea maxLength={500} className="field min-h-20" value={note} onChange={e=>setNote(e.target.value)} placeholder="Lý do điều chuyển, tình trạng xe, phụ kiện đi kèm..."/></label>
      <div className="md:col-span-2 flex justify-end"><button className="btn-primary" disabled={saving||!vehicleId||!destinationStationId}>{saving?'Đang tạo...':'Tạo yêu cầu điều chuyển →'}</button></div>
    </form>
    <section className="panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b p-5"><div><h2 className="font-extrabold">Danh sách điều chuyển</h2><p className="mt-1 text-xs text-slate-500">Nhân viên chỉ thấy yêu cầu liên quan đến trạm được phân công.</p></div><select className="field max-w-52" value={filter} onChange={e=>setFilter(e.target.value)}><option value="OPEN">Đang xử lý</option><option value="ALL">Tất cả</option><option value="PENDING">Chờ bàn giao</option><option value="IN_TRANSIT">Đang vận chuyển</option><option value="COMPLETED">Đã tiếp nhận</option><option value="CANCELLED">Đã hủy</option></select></div>
      {loading?<div className="p-6"><LoadingState label="Đang tải yêu cầu điều chuyển..."/></div>:!visible.length?<p className="p-6 text-sm text-slate-500">Chưa có yêu cầu điều chuyển phù hợp.</p>:<div className="divide-y">{visible.map(t=><article key={t.id} className="flex flex-wrap items-center justify-between gap-5 p-5"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="text-xs font-extrabold text-slate-400">YÊU CẦU #{t.id}</span><span className={'rounded-full px-3 py-1 text-xs font-bold '+(t.status==='COMPLETED'?'bg-emerald-50 text-emerald-700':t.status==='CANCELLED'?'bg-slate-100 text-slate-500':t.status==='IN_TRANSIT'?'bg-sky-50 text-sky-700':'bg-amber-50 text-amber-800')}>{statusText[t.status]}</span></div><h3 className="mt-2 font-extrabold">Xe {t.vehicleCode}</h3><p className="mt-1 text-sm text-slate-600">{t.sourceStationName} <span className="px-2 text-emerald-700">→</span> {t.destinationStationName}</p>{t.note&&<p className="mt-2 text-sm text-slate-500">{t.note}</p>}<p className="mt-2 text-xs text-slate-400">Tạo lúc {timeText(t.createdAt)}{t.dispatchedAt?' · Bàn giao '+timeText(t.dispatchedAt):''}{t.receivedAt?' · Tiếp nhận '+timeText(t.receivedAt):''}</p></div><div className="flex flex-wrap gap-2">{t.status==='PENDING'&&(user?.role==='ADMIN'||user?.stationId===t.sourceStationId)&&<button disabled={busyId===t.id} className="btn-dark" onClick={()=>void act(t.id,'dispatch')}>Xác nhận bàn giao</button>}{t.status==='IN_TRANSIT'&&(user?.role==='ADMIN'||user?.stationId===t.destinationStationId)&&<button disabled={busyId===t.id} className="btn-primary" onClick={()=>void act(t.id,'receive')}>Xác nhận tiếp nhận</button>}{t.status==='PENDING'&&(user?.role==='ADMIN'||user?.stationId===t.sourceStationId)&&<button disabled={busyId===t.id} className="btn-outline" onClick={()=>void act(t.id,'cancel')}>Hủy</button>}</div></article>)}</div>}
    </section>
  </section>;
}
