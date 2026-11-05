import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { LoadingState, SectionHeading, timeText } from '../../components/Brand';
import { api } from '../../services/api';
import { useAuth } from '../auth/AuthContext';

type Station = { id:number; name:string; isActive:boolean };
type Vehicle = { id:number; code:string; status:string; isActive:boolean; stationId:number; station?:Station; model?:{brand:string;name:string} };
type Transfer = { id:number; vehicleId:number; vehicleCode:string; sourceStationId:number; sourceStationName:string; destinationStationId:number; destinationStationName:string; status:'PENDING'|'IN_TRANSIT'|'COMPLETED'|'CANCELLED'; note:string|null; createdAt:string; dispatchedAt:string|null; receivedAt:string|null; dispatchBatteryPercent:number|null; dispatchOdometerKm:string|null; dispatchConditionNote:string|null; dispatchChecklist:string|null; dispatchDamageNotes:string|null; dispatchPhotoUrls:string|null; receiveBatteryPercent:number|null; receiveOdometerKm:string|null; receiveConditionNote:string|null; receiveChecklist:string|null; receiveDamageNotes:string|null; receivePhotoUrls:string|null };
type InspectionPayload = { batteryPercent:number; odometerKm:number; conditionNote:string; inspectionChecklist:Record<string,boolean>; damageNotes?:string; photoUrls:string[] };
const checklistItems = [{key:'body',label:'Thân xe và vỏ nhựa'},{key:'lights',label:'Đèn chiếu sáng và xi-nhan'},{key:'brakes',label:'Phanh trước và sau'},{key:'tires',label:'Lốp xe'},{key:'mirrors',label:'Gương chiếu hậu'},{key:'horn',label:'Còi xe'},{key:'battery',label:'Pin và khóa pin'},{key:'charger',label:'Bộ sạc'},{key:'keys',label:'Chìa khóa và phụ kiện'}];
function TransferInspectionForm({kind,busy,onSubmit}:{kind:'dispatch'|'receive';busy:boolean;onSubmit:(payload:InspectionPayload)=>void}) {
  const [battery,setBattery]=useState('80');
  const [odo,setOdo]=useState('');
  const [condition,setCondition]=useState('');
  const [damage,setDamage]=useState('');
  const [photos,setPhotos]=useState('');
  const [checklist,setChecklist]=useState<Record<string,boolean>>({});
  function submit(e:React.FormEvent) {
    e.preventDefault();
    onSubmit({batteryPercent:Number(battery),odometerKm:Number(odo),conditionNote:condition.trim(),inspectionChecklist:Object.fromEntries(checklistItems.map(item=>[item.key,Boolean(checklist[item.key])])),damageNotes:damage.trim()||undefined,photoUrls:photos.split(/\\r?\\n/).map(url=>url.trim()).filter(Boolean)});
  }
  return <form onSubmit={submit} className="mt-4 grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
    <div className="md:col-span-2"><p className="text-sm font-extrabold">{kind==='dispatch'?'Biên bản trước khi rời trạm':'Biên bản khi xe đến trạm'}</p><p className="mt-1 text-xs text-slate-500">Ghi nhận số liệu thực tế. ODO tiếp nhận không được thấp hơn ODO bàn giao.</p></div>
    <label><span className="field-label">Mức pin (%)</span><input required type="number" min="0" max="100" className="field" value={battery} onChange={e=>setBattery(e.target.value)}/></label>
    <label><span className="field-label">ODO (km)</span><input required type="number" min="0" step="0.1" className="field" value={odo} onChange={e=>setOdo(e.target.value)}/></label>
    <div className="md:col-span-2"><p className="field-label">Checklist kiểm tra 9 hạng mục</p><div className="grid gap-2 sm:grid-cols-2">{checklistItems.map(item=><label key={item.key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(checklist[item.key])} onChange={e=>setChecklist(old=>({...old,[item.key]:e.target.checked}))}/>{item.label}</label>)}</div><p className="mt-1 text-xs text-slate-500">Đánh dấu hạng mục đạt yêu cầu; hạng mục chưa đánh dấu cần mô tả ở phần hư hỏng.</p></div>
    <label className="md:col-span-2"><span className="field-label">Tình trạng tổng quát</span><textarea required maxLength={1000} className="field min-h-20" value={condition} onChange={e=>setCondition(e.target.value)} placeholder="Mô tả tình trạng xe, phụ kiện và ghi nhận thực tế..."/></label>
    <label className="md:col-span-2"><span className="field-label">Hư hỏng / sai khác (nếu có)</span><textarea maxLength={1000} className="field min-h-16" value={damage} onChange={e=>setDamage(e.target.value)} placeholder="Ghi rõ vị trí trầy xước, thiếu phụ kiện hoặc vấn đề phát hiện..."/></label>
    <label className="md:col-span-2"><span className="field-label">URL ảnh bằng chứng (tối đa 8 URL, mỗi dòng một URL)</span><textarea className="field min-h-16" value={photos} onChange={e=>setPhotos(e.target.value)} placeholder="https://..."/></label>
    <div className="md:col-span-2 flex justify-end"><button className="btn-primary" disabled={busy||!odo||!condition.trim()||photos.split(/\\r?\\n/).filter(x=>x.trim()).length>8}>{busy?'Đang lưu...':kind==='dispatch'?'Lưu biên bản và xác nhận bàn giao':'Lưu biên bản và xác nhận tiếp nhận'}</button></div>
  </form>;
}
const parseList=(value:string|null):string[]=>{try{const parsed=JSON.parse(value||'[]');return Array.isArray(parsed)?parsed:[];}catch{return [];}};
const parseChecklist=(value:string|null):Record<string,boolean>=>{try{return JSON.parse(value||'{}');}catch{return {};}};
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
  async function act(id:number,action:'dispatch'|'receive'|'cancel',payload?:InspectionPayload) {
    const labels={dispatch:'Xác nhận đã bàn giao xe cho vận chuyển?',receive:'Xác nhận đã nhận xe tại trạm đến?',cancel:'Hủy yêu cầu điều chuyển này?'};
    if(action==='cancel'&&!window.confirm(labels[action]))return;
    setBusyId(id);setError('');setNotice('');
    try {
      if(action==='cancel') await api.patch('/vehicle-transfers/'+id+'/'+action);
      else await api.patch('/vehicle-transfers/'+id+'/'+action,payload);
      setNotice(action==='dispatch'?'Đã lưu biên bản và xác nhận bàn giao. Trạm đích có thể tiếp nhận xe.':action==='receive'?'Đã lưu biên bản tiếp nhận. Trạm hiện tại của xe đã được cập nhật.':'Đã hủy yêu cầu điều chuyển.');
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
      {loading?<div className="p-6"><LoadingState label="Đang tải yêu cầu điều chuyển..."/></div>:!visible.length?<p className="p-6 text-sm text-slate-500">Chưa có yêu cầu điều chuyển phù hợp.</p>:<div className="divide-y">{visible.map(t=><article key={t.id} className="flex flex-wrap items-center justify-between gap-5 p-5"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="text-xs font-extrabold text-slate-400">YÊU CẦU #{t.id}</span><span className={'rounded-full px-3 py-1 text-xs font-bold '+(t.status==='COMPLETED'?'bg-emerald-50 text-emerald-700':t.status==='CANCELLED'?'bg-slate-100 text-slate-500':t.status==='IN_TRANSIT'?'bg-sky-50 text-sky-700':'bg-amber-50 text-amber-800')}>{statusText[t.status]}</span></div><h3 className="mt-2 font-extrabold">Xe {t.vehicleCode}</h3><p className="mt-1 text-sm text-slate-600">{t.sourceStationName} <span className="px-2 text-emerald-700">→</span> {t.destinationStationName}</p>{t.note&&<p className="mt-2 text-sm text-slate-500">{t.note}</p>}<p className="mt-2 text-xs text-slate-400">Tạo lúc {timeText(t.createdAt)}{t.dispatchedAt?' · Bàn giao '+timeText(t.dispatchedAt):''}{t.receivedAt?' · Tiếp nhận '+timeText(t.receivedAt):''}</p>
          {(t.dispatchOdometerKm!==null||t.receiveOdometerKm!==null)&&<div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600"><span>Bàn giao: {t.dispatchOdometerKm??'—'} km · Pin {t.dispatchBatteryPercent??'—'}%</span><span>Tiếp nhận: {t.receiveOdometerKm??'—'} km · Pin {t.receiveBatteryPercent??'—'}%</span></div>}
          {(t.dispatchConditionNote||t.receiveConditionNote)&&<details className="mt-3 text-sm"><summary className="cursor-pointer font-semibold text-emerald-700">Xem biên bản và ảnh bằng chứng</summary><div className="mt-2 grid gap-3 md:grid-cols-2">
            {(['dispatch','receive'] as const).map(kind=>{const title=kind==='dispatch'?'Lúc bàn giao':'Lúc tiếp nhận';const note=kind==='dispatch'?t.dispatchConditionNote:t.receiveConditionNote;const damage=kind==='dispatch'?t.dispatchDamageNotes:t.receiveDamageNotes;const checklist=parseChecklist(kind==='dispatch'?t.dispatchChecklist:t.receiveChecklist);const photos=parseList(kind==='dispatch'?t.dispatchPhotoUrls:t.receivePhotoUrls);return <div key={kind} className="rounded-lg border p-3"><p className="font-bold">{title}</p><p className="mt-1 text-slate-600">{note||'Chưa có biên bản'}</p>{damage&&<p className="mt-1 text-rose-700">Hư hỏng: {damage}</p>}<p className="mt-2 text-xs text-slate-500">Checklist đạt: {Object.values(checklist).filter(Boolean).length}/9</p>{photos.map((url,i)=><a key={i} href={url} target="_blank" rel="noreferrer" className="mt-1 block break-all text-xs text-emerald-700 underline">Ảnh {i+1}: {url}</a>)}</div>;})}
          </div></details>}</div><div className="flex w-full flex-col gap-2 md:max-w-xl">
          {t.status==='PENDING'&&(user?.role==='ADMIN'||user?.stationId===t.sourceStationId)&&<details><summary className="btn-dark cursor-pointer list-none text-center">Lập biên bản bàn giao</summary><TransferInspectionForm kind="dispatch" busy={busyId===t.id} onSubmit={payload=>void act(t.id,'dispatch',payload)}/></details>}
          {t.status==='IN_TRANSIT'&&(user?.role==='ADMIN'||user?.stationId===t.destinationStationId)&&<details><summary className="btn-primary cursor-pointer list-none text-center">Lập biên bản tiếp nhận</summary><TransferInspectionForm kind="receive" busy={busyId===t.id} onSubmit={payload=>void act(t.id,'receive',payload)}/></details>}
          {t.status==='PENDING'&&(user?.role==='ADMIN'||user?.stationId===t.sourceStationId)&&<button disabled={busyId===t.id} className="btn-outline" onClick={()=>void act(t.id,'cancel')}>Hủy yêu cầu</button>}
          </div></article>)}</div>}
    </section>
  </section>;
}
