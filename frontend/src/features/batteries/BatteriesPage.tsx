import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SectionHeading, LoadingState } from '../../components/Brand';
import { useAuth } from '../auth/AuthContext';
import { api } from '../../services/api';
import type { Station, Vehicle } from '../../types';

type BatteryStatus='FULL'|'INSTALLED'|'CHARGING'|'MAINTENANCE'|'RETIRED';
type Battery={id:number;serialNumber:string;stationId:number;station?:Station;vehicleId:number|null;vehicle?:Vehicle|null;status:BatteryStatus;capacityKwh:string|null;healthPercent:number;cycleCount:number;lastChargedAt:string|null;note:string|null};
type Swap={id:number;vehicle?:Vehicle;vehicleId:number;station?:Station;removedBattery?:Battery;installedBattery?:Battery;createdAt:string;note:string|null};
const statusLabel:Record<BatteryStatus,string>={FULL:'Pin đầy · sẵn sàng',INSTALLED:'Đang lắp trên xe',CHARGING:'Đang sạc',MAINTENANCE:'Bảo dưỡng',RETIRED:'Ngừng sử dụng'};
const errText=(err:unknown)=>{const m=(err as {response?:{data?:{message?:string|string[]}}})?.response?.data?.message;return Array.isArray(m)?m.join(', '):m||'Không thể thực hiện thao tác.';};

export function BatteriesPage(){
  const {user}=useAuth();
  const [stations,setStations]=useState<Station[]>([]);
  const [vehicles,setVehicles]=useState<Vehicle[]>([]);
  const [batteries,setBatteries]=useState<Battery[]>([]);
  const [history,setHistory]=useState<Swap[]>([]);
  const [stationId,setStationId]=useState(user?.stationId?String(user.stationId):'');
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
  const [error,setError]=useState(''),[notice,setNotice]=useState('');
  const [serial,setSerial]=useState(''),[capacity,setCapacity]=useState(''),[health,setHealth]=useState('100'),[note,setNote]=useState('');
  const [installVehicleId,setInstallVehicleId]=useState(''),[swapVehicleId,setSwapVehicleId]=useState(''),[batteryId,setBatteryId]=useState('');
  const scopedVehicles=useMemo(()=>vehicles.filter(v=>String(v.station?.id)===stationId),[vehicles,stationId]);
  const fullBatteries=batteries.filter(b=>b.status==='FULL'&&!b.vehicleId);
  const unassignedVehicles=scopedVehicles.filter(v=>!batteries.some(b=>b.vehicleId===v.id&&b.status==='INSTALLED'));
  async function load(){
    setLoading(true);setError('');
    try{
      const params=stationId?{stationId:Number(stationId)}:{};
      const [sr,vr,br,hr]=await Promise.all([api.get('/stations'),api.get('/vehicles'),api.get('/batteries',{params}),api.get('/batteries/swaps/history',{params})]);
      setStations(Array.isArray(sr.data)?sr.data:[]);setVehicles(Array.isArray(vr.data)?vr.data:[]);
      setBatteries(Array.isArray(br.data)?br.data:[]);setHistory(Array.isArray(hr.data)?hr.data:[]);
    }catch(e){setError(errText(e));}finally{setLoading(false);}
  }
  useEffect(()=>{if(user?.stationId)setStationId(String(user.stationId));},[user?.stationId]);
  useEffect(()=>{void load();},[stationId]);
  async function act(fn:()=>Promise<unknown>,success:string){
    setBusy(true);setError('');setNotice('');
    try{await fn();setNotice(success);await load();}catch(e){setError(errText(e));}finally{setBusy(false);}
  }
  async function addBattery(e:React.FormEvent){
    e.preventDefault();
    await act(()=>api.post('/batteries',{serialNumber:serial.trim(),stationId:Number(stationId),capacityKwh:capacity?Number(capacity):undefined,healthPercent:Number(health),note:note.trim()||undefined}),'Đã nhập pin mới vào kho. Pin được đánh dấu đầy và sẵn sàng.');
    setSerial('');setCapacity('');setHealth('100');setNote('');
  }
  async function installBattery(e:React.FormEvent){
    e.preventDefault();
    await act(()=>api.post('/batteries/install',{vehicleId:Number(installVehicleId),batteryId:Number(batteryId)}),'Đã ghi nhận lắp pin cho xe.');
    setInstallVehicleId('');setBatteryId('');
  }
  async function swapBattery(e:React.FormEvent){
    e.preventDefault();
    await act(()=>api.post('/batteries/swap',{vehicleId:Number(swapVehicleId),replacementBatteryId:Number(batteryId),note:note.trim()||undefined}),'Đổi pin thành công. Pin cũ đã chuyển sang trạng thái chờ sạc.');
    setSwapVehicleId('');setBatteryId('');setNote('');
  }
  const counts={full:batteries.filter(b=>b.status==='FULL').length,installed:batteries.filter(b=>b.status==='INSTALLED').length,charging:batteries.filter(b=>b.status==='CHARGING').length,maintenance:batteries.filter(b=>b.status==='MAINTENANCE').length};
  return <div className="container-page py-12 sm:py-16">
    <div className="flex flex-wrap items-end justify-between gap-5"><SectionHeading eyebrow="QUẢN LÝ NĂNG LƯỢNG" title="Kho pin & đổi pin nhanh" description="Quản lý từng viên pin, lắp pin ban đầu, đổi pin đầy tại trạm và theo dõi pin chờ sạc."/><Link to="/admin" className="btn-outline">← Quản trị</Link></div>
    {error&&<p role="alert" className="mt-6 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
    {notice&&<p role="status" className="mt-6 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}
    <div className="mt-8 flex flex-wrap items-center justify-between gap-3"><label className="min-w-64"><span className="field-label">Trạm đang quản lý</span><select className="field mt-2" value={stationId} disabled={user?.role==='STAFF'} onChange={e=>setStationId(e.target.value)}><option value="">Tất cả trạm</option>{stations.filter(s=>s.isActive!==false&&(user?.role!=='STAFF'||s.id===user?.stationId)).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><button className="btn-outline" onClick={()=>void load()}>Làm mới dữ liệu</button></div>
    {loading?<div className="mt-8"><LoadingState label="Đang tải kho pin..."/></div>:<>
      <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">{[{label:'Pin đầy sẵn sàng',value:counts.full},{label:'Đang lắp trên xe',value:counts.installed},{label:'Đang sạc',value:counts.charging},{label:'Cần kiểm tra',value:counts.maintenance}].map(x=><div key={x.label} className="panel p-5"><p className="text-xs text-slate-500">{x.label}</p><strong className="mt-2 block text-3xl">{x.value}</strong></div>)}</div>
      <div className="mt-7 grid gap-6 xl:grid-cols-3">
        <form onSubmit={addBattery} className="panel space-y-4 p-6"><div><p className="eyebrow">NHẬP KHO</p><h2 className="mt-2 text-lg font-extrabold">Thêm viên pin</h2></div><label className="block"><span className="field-label">Mã serial pin</span><input className="field mt-2" required maxLength={80} value={serial} onChange={e=>setSerial(e.target.value)} placeholder="VG-BAT-0001"/></label><label className="block"><span className="field-label">Dung lượng (kWh)</span><input className="field mt-2" type="number" min="0.1" step="0.01" value={capacity} onChange={e=>setCapacity(e.target.value)} placeholder="Ví dụ 2.4"/></label><label className="block"><span className="field-label">Sức khỏe pin (%)</span><input className="field mt-2" type="number" min="1" max="100" value={health} onChange={e=>setHealth(e.target.value)}/></label><button disabled={busy||!stationId} className="btn-primary w-full">Thêm pin đầy vào kho</button></form>
        <form onSubmit={installBattery} className="panel space-y-4 p-6"><div><p className="eyebrow">LẮP PIN BAN ĐẦU</p><h2 className="mt-2 text-lg font-extrabold">Gắn pin cho xe</h2></div><label className="block"><span className="field-label">Xe chưa có pin</span><select className="field mt-2" required value={installVehicleId} onChange={e=>setInstallVehicleId(e.target.value)}><option value="">Chọn xe</option>{unassignedVehicles.map(v=><option key={v.id} value={v.id}>{v.code} · {v.model?.name}</option>)}</select></label><label className="block"><span className="field-label">Pin đầy trong kho</span><select className="field mt-2" required value={batteryId} onChange={e=>setBatteryId(e.target.value)}><option value="">Chọn pin</option>{fullBatteries.map(b=><option key={b.id} value={b.id}>{b.serialNumber}</option>)}</select></label><button disabled={busy||!installVehicleId||!batteryId} className="btn-primary w-full">Xác nhận lắp pin</button></form>
        <form onSubmit={swapBattery} className="panel space-y-4 border-emerald-200 p-6"><div><p className="eyebrow">ĐỔI PIN NHANH</p><h2 className="mt-2 text-lg font-extrabold">Thay pin đầy cho xe</h2><p className="mt-2 text-sm text-slate-500">Pin cũ tự chuyển sang chờ sạc, pin mới được gắn vào xe trong cùng giao dịch.</p></div><label className="block"><span className="field-label">Xe cần đổi pin</span><select className="field mt-2" required value={swapVehicleId} onChange={e=>setSwapVehicleId(e.target.value)}><option value="">Chọn xe</option>{scopedVehicles.filter(v=>batteries.some(b=>b.vehicleId===v.id&&b.status==='INSTALLED')).map(v=><option key={v.id} value={v.id}>{v.code} · {v.model?.name}</option>)}</select></label><label className="block"><span className="field-label">Pin đầy thay thế</span><select className="field mt-2" required value={batteryId} onChange={e=>setBatteryId(e.target.value)}><option value="">Chọn pin đầy tại trạm</option>{fullBatteries.map(b=><option key={b.id} value={b.id}>{b.serialNumber} · {b.healthPercent}% sức khỏe</option>)}</select></label><label className="block"><span className="field-label">Ghi chú</span><input className="field mt-2" maxLength={500} value={note} onChange={e=>setNote(e.target.value)} placeholder="Tình trạng pin cũ..."/></label><button disabled={busy||!swapVehicleId||!batteryId} className="btn-primary w-full">Xác nhận đổi pin</button></form>
      </div>
      <section className="panel mt-7 overflow-hidden"><div className="p-6"><p className="eyebrow">THEO DÕI TỪNG VIÊN PIN</p><h2 className="mt-2 text-xl font-extrabold">Danh sách pin</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-6 py-4">Serial</th><th className="px-4 py-4">Trạng thái</th><th className="px-4 py-4">Xe / Trạm</th><th className="px-4 py-4">Sức khỏe</th><th className="px-4 py-4">Chu kỳ sạc</th><th className="px-6 py-4">Thao tác</th></tr></thead><tbody className="divide-y divide-slate-100">{batteries.map(b=><tr key={b.id}><td className="px-6 py-4 font-bold">{b.serialNumber}<p className="text-xs font-normal text-slate-400">{b.capacityKwh??'—'} kWh</p></td><td className="px-4 py-4">{statusLabel[b.status]}</td><td className="px-4 py-4">{b.vehicle?.code??b.station?.name??'—'}</td><td className="px-4 py-4">{b.healthPercent}%</td><td className="px-4 py-4">{b.cycleCount}</td><td className="px-6 py-4">{b.status==='CHARGING'?<button disabled={busy} className="text-sm font-bold text-emerald-700 underline" onClick={()=>void act(()=>api.patch('/batteries/'+b.id+'/complete-charging'), 'Đã xác nhận pin sạc đầy và sẵn sàng đổi.')}>Xác nhận sạc đầy</button>:<span className="text-slate-400">—</span>}</td></tr>)}{!batteries.length&&<tr><td colSpan={6} className="px-6 py-8 text-center text-slate-400">Chưa có dữ liệu pin tại trạm.</td></tr>}</tbody></table></div></section>
      <section className="panel mt-7 overflow-hidden"><div className="p-6"><p className="eyebrow">NHẬT KÝ ĐỔI PIN</p><h2 className="mt-2 text-xl font-extrabold">Lịch sử giao dịch</h2></div><div className="divide-y divide-slate-100">{history.map(item=><div key={item.id} className="flex flex-wrap justify-between gap-3 px-6 py-4 text-sm"><div><strong>{item.vehicle?.code??'Xe #'+item.vehicleId}</strong><p className="mt-1 text-xs text-slate-500">{item.removedBattery?.serialNumber} → {item.installedBattery?.serialNumber} · {item.station?.name}</p>{item.note&&<p className="mt-1 text-xs text-slate-500">{item.note}</p>}</div><time className="text-xs text-slate-400">{new Date(item.createdAt).toLocaleString('vi-VN')}</time></div>)}{!history.length&&<p className="px-6 pb-7 text-sm text-slate-400">Chưa có lịch sử đổi pin.</p>}</div></section>
    </>}
  </div>;
}
