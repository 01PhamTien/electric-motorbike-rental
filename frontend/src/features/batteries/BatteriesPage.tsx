import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SectionHeading, LoadingState } from '../../components/Brand';
import { useAuth } from '../auth/AuthContext';
import { api } from '../../services/api';
import type { Station, Vehicle } from '../../types';

type BatteryStatus='FULL'|'INSTALLED'|'CHARGING'|'MAINTENANCE'|'RETIRED';
type Battery={id:number;serialNumber:string;stationId:number;station?:Station;vehicleId:number|null;vehicle?:Vehicle|null;status:BatteryStatus;capacityKwh:string|null;healthPercent:number;cycleCount:number;lastChargedAt:string|null;note:string|null};
type Swap={id:number;vehicle?:Vehicle;vehicleId:number;station?:Station;removedBattery?:Battery;installedBattery?:Battery;createdAt:string;note:string|null};
type ChargingSession={id:number;batteryId:number;battery?:Battery;station?:Station;startedAt:string;completedAt:string|null;status:'IN_PROGRESS'|'COMPLETED'|'CANCELLED';startedBy?:{id:number;fullName:string};completedBy?:{id:number;fullName:string};note:string|null};
type Reservation={id:number;customerId:number;stationId:number;bookingId:number;vehicleId:number;vehicle?:Vehicle;station?:Station;status:'RESERVED'|'REDEEMED'|'CANCELLED'|'EXPIRED';expiresAt:string;createdAt:string};
type InventorySummary={totals:{total:number;FULL:number;INSTALLED:number;CHARGING:number;MAINTENANCE:number;RETIRED:number};stations:Array<{stationId:number;stationName:string;total:number;FULL:number;INSTALLED:number;CHARGING:number;MAINTENANCE:number;RETIRED:number}>};

const statusLabel:Record<BatteryStatus,string>={FULL:'Pin đầy · sẵn sàng',INSTALLED:'Đang lắp trên xe',CHARGING:'Đang sạc',MAINTENANCE:'Bảo dưỡng',RETIRED:'Ngừng sử dụng'};
const errText=(err:unknown)=>{const m=(err as {response?:{data?:{message?:string|string[]}}})?.response?.data?.message;return Array.isArray(m)?m.join(', '):m||'Không thể thực hiện thao tác.';};

export function BatteriesPage(){
  const {user}=useAuth();
  const [stations,setStations]=useState<Station[]>([]);
  const [vehicles,setVehicles]=useState<Vehicle[]>([]);
  const [batteries,setBatteries]=useState<Battery[]>([]);
  const [inventory,setInventory]=useState<Battery[]>([]);
  const [inventorySummary,setInventorySummary]=useState<InventorySummary|null>(null);
  const [inventorySearch,setInventorySearch]=useState('');
  const [inventoryStatus,setInventoryStatus]=useState('');
  const [inventoryPage,setInventoryPage]=useState(1);
  const [inventoryTotal,setInventoryTotal]=useState(0);
  const [inventoryPages,setInventoryPages]=useState(0);
  const [inventoryLoading,setInventoryLoading]=useState(false);

  const [history,setHistory]=useState<Swap[]>([]);
  const [chargingHistory,setChargingHistory]=useState<ChargingSession[]>([]);
  const [healthDrafts,setHealthDrafts]=useState<Record<number,string>>({});
  const [reservations,setReservations]=useState<Reservation[]>([]);
  const [redeemBatteryIds,setRedeemBatteryIds]=useState<Record<number,string>>({});
  const [stationId,setStationId]=useState(user?.stationId?String(user.stationId):'');
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
  const [error,setError]=useState(''),[notice,setNotice]=useState('');
  const [serial,setSerial]=useState(''),[capacity,setCapacity]=useState(''),[health,setHealth]=useState('100'),[newBatteryNote,setNewBatteryNote]=useState(''),[swapNote,setSwapNote]=useState('');
  const [installVehicleId,setInstallVehicleId]=useState(''),[swapVehicleId,setSwapVehicleId]=useState(''),[installBatteryId,setInstallBatteryId]=useState(''),[swapBatteryId,setSwapBatteryId]=useState('');
  const scopedVehicles=useMemo(()=>vehicles.filter(v=>String(v.station?.id)===stationId),[vehicles,stationId]);
  const fullBatteries=batteries.filter(b=>b.status==='FULL'&&!b.vehicleId);
  const unassignedVehicles=scopedVehicles.filter(v=>!batteries.some(b=>b.vehicleId===v.id&&b.status==='INSTALLED'));
  async function load(){
    setLoading(true);setError('');
    try{
      const params=stationId?{stationId:Number(stationId)}:{};
      const [sr,vr,br,hr,rr,cr]=await Promise.all([api.get('/stations'),api.get('/vehicles'),api.get('/batteries',{params}),api.get('/batteries/swaps/history',{params}),api.get('/batteries/reservations',{params}),api.get('/batteries/charging/history',{params})]);
      setStations(Array.isArray(sr.data)?sr.data:[]);setVehicles(Array.isArray(vr.data)?vr.data:[]);
      setBatteries(Array.isArray(br.data)?br.data:[]);setHistory(Array.isArray(hr.data)?hr.data:[]);setReservations(Array.isArray(rr.data)?rr.data:[]);setChargingHistory(Array.isArray(cr.data)?cr.data:[]);
    }catch(e){setError(errText(e));}finally{setLoading(false);}
  }
  useEffect(()=>{if(user?.stationId)setStationId(String(user.stationId));},[user?.stationId]);
  useEffect(()=>{void load();},[stationId]);
  useEffect(()=>{
    let active=true;
    const params:Record<string,string|number>={page:inventoryPage,limit:10};
    if(stationId)params.stationId=Number(stationId);
    if(inventoryStatus)params.status=inventoryStatus;
    if(inventorySearch.trim())params.search=inventorySearch.trim();
    setInventoryLoading(true);
    api.get('/batteries/inventory',{params}).then(({data})=>{
      if(!active)return;
      setInventory(Array.isArray(data?.items)?data.items:[]);
      setInventoryTotal(Number(data?.total)||0);
      setInventoryPages(Number(data?.totalPages)||0);
    }).catch(e=>{if(active)setError(errText(e));}).finally(()=>{if(active)setInventoryLoading(false);});
    return()=>{active=false;};
  },[stationId,inventoryPage,inventoryStatus,inventorySearch,batteries.length]);
  useEffect(()=>{
    let active=true;
    const params=stationId?{stationId:Number(stationId)}:{};
    api.get('/batteries/inventory/summary',{params}).then(({data})=>{if(active)setInventorySummary(data);})
      .catch(e=>{if(active)setError(errText(e));});
    return()=>{active=false;};
  },[stationId,batteries.length]);

  async function act(fn:()=>Promise<unknown>,success:string){
    setBusy(true);setError('');setNotice('');
    try{await fn();setNotice(success);await load();}catch(e){setError(errText(e));}finally{setBusy(false);}
  }
  async function addBattery(e:React.FormEvent){
    e.preventDefault();
    await act(()=>api.post('/batteries',{serialNumber:serial.trim(),stationId:Number(stationId),capacityKwh:capacity?Number(capacity):undefined,healthPercent:Number(health),note:newBatteryNote.trim()||undefined}),'Đã nhập pin mới vào kho. Pin được đánh dấu đầy và sẵn sàng.');
    setSerial('');setCapacity('');setHealth('100');setNewBatteryNote('');
  }
  async function installBattery(e:React.FormEvent){
    e.preventDefault();
    await act(()=>api.post('/batteries/install',{vehicleId:Number(installVehicleId),batteryId:Number(installBatteryId)}),'Đã ghi nhận lắp pin cho xe.');
    setInstallVehicleId('');setInstallBatteryId('');
  }
  async function swapBattery(e:React.FormEvent){
    e.preventDefault();
    await act(()=>api.post('/batteries/swap',{vehicleId:Number(swapVehicleId),replacementBatteryId:Number(swapBatteryId),note:swapNote.trim()||undefined}),'Đổi pin thành công. Pin cũ đã chuyển sang trạng thái chờ sạc.');
    setSwapVehicleId('');setSwapBatteryId('');setSwapNote('');
  }
  async function redeemReservation(id:number){
    const replacementBatteryId=Number(redeemBatteryIds[id]);
    if(!replacementBatteryId)return;
    await act(()=>api.post('/batteries/reservations/'+id+'/redeem',{replacementBatteryId,note:'Hoàn tất đổi pin theo lượt giữ trước #'+id}),'Đã đổi pin và hoàn tất lượt giữ trước #'+id+'.');
  }
  const counts={full:batteries.filter(b=>b.status==='FULL').length,installed:batteries.filter(b=>b.status==='INSTALLED').length,charging:batteries.filter(b=>b.status==='CHARGING').length,maintenance:batteries.filter(b=>b.status==='MAINTENANCE').length};
  return <div className="container-page py-12 sm:py-16">
    <div className="flex flex-wrap items-end justify-between gap-5"><SectionHeading eyebrow="QUẢN LÝ NĂNG LƯỢNG" title="Kho pin & đổi pin nhanh" description="Quản lý từng viên pin, lắp pin ban đầu, đổi pin đầy tại trạm và theo dõi pin chờ sạc."/><Link to="/admin" className="btn-outline">← Quản trị</Link></div>
    {error&&<p role="alert" className="mt-6 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
    {notice&&<p role="status" className="mt-6 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}
    <div className="mt-8 flex flex-wrap items-center justify-between gap-3"><label className="min-w-64"><span className="field-label">Trạm đang quản lý</span><select className="field mt-2" value={stationId} disabled={user?.role==='STAFF'} onChange={e=>setStationId(e.target.value)}><option value="">Tất cả trạm</option>{stations.filter(s=>s.isActive!==false&&(user?.role!=='STAFF'||s.id===user?.stationId)).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><button className="btn-outline" onClick={()=>void load()}>Làm mới dữ liệu</button></div>
    {loading?<div className="mt-8"><LoadingState label="Đang tải kho pin..."/></div>:<>
      <div className="mt-7 grid grid-cols-2 gap-3 xl:grid-cols-5">{[{label:'Tổng số pin',value:inventorySummary?.totals.total??batteries.length,accent:'text-slate-900'},{label:'Sẵn sàng',value:inventorySummary?.totals.FULL??counts.full,accent:'text-emerald-700'},{label:'Đang lắp',value:inventorySummary?.totals.INSTALLED??counts.installed,accent:'text-sky-700'},{label:'Đang sạc',value:inventorySummary?.totals.CHARGING??counts.charging,accent:'text-amber-700'},{label:'Bảo dưỡng',value:inventorySummary?.totals.MAINTENANCE??counts.maintenance,accent:'text-rose-700'}].map(x=><div key={x.label} className="panel p-5"><p className="text-xs text-slate-500">{x.label}</p><strong className={`mt-2 block text-3xl ${x.accent}`}>{x.value}</strong></div>)}</div>
      {user?.role==='ADMIN'&&inventorySummary?.stations.length? <section className="panel mt-5 p-5"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="eyebrow">PHÂN BỔ THEO ĐIỂM</p><h2 className="mt-1 text-lg font-extrabold">Tồn kho từng trạm</h2></div><span className="text-xs text-slate-500">{inventorySummary.stations.length} trạm có pin</span></div><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{inventorySummary.stations.map(s=><div key={s.stationId} className="rounded-xl border border-slate-100 bg-slate-50/70 p-4"><div className="flex items-start justify-between gap-2"><strong className="text-sm">{s.stationName}</strong><span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold">{s.total} pin</span></div><div className="mt-3 flex h-2 overflow-hidden rounded-full bg-slate-200"><span className="bg-emerald-500" style={{width:`${s.total?s.FULL/s.total*100:0}%`}}/><span className="bg-sky-500" style={{width:`${s.total?s.INSTALLED/s.total*100:0}%`}}/><span className="bg-amber-400" style={{width:`${s.total?s.CHARGING/s.total*100:0}%`}}/><span className="bg-rose-400" style={{width:`${s.total?s.MAINTENANCE/s.total*100:0}%`}}/></div><p className="mt-2 text-xs text-slate-500">Sẵn sàng {s.FULL} · Đang lắp {s.INSTALLED} · Đang sạc {s.CHARGING} · Bảo dưỡng {s.MAINTENANCE}</p></div>)}</div></section>:null}
      <div className="mt-7 grid gap-6 xl:grid-cols-3">
        <form onSubmit={addBattery} className="panel space-y-4 p-6"><div><p className="eyebrow">NHẬP KHO</p><h2 className="mt-2 text-lg font-extrabold">Thêm viên pin</h2></div><label className="block"><span className="field-label">Mã serial pin</span><input className="field mt-2" required maxLength={80} value={serial} onChange={e=>setSerial(e.target.value)} placeholder="VG-BAT-0001"/></label><label className="block"><span className="field-label">Dung lượng (kWh)</span><input className="field mt-2" type="number" min="0.1" step="0.01" value={capacity} onChange={e=>setCapacity(e.target.value)} placeholder="Ví dụ 2.4"/></label><label className="block"><span className="field-label">Sức khỏe pin (%)</span><input className="field mt-2" type="number" min="1" max="100" value={health} onChange={e=>setHealth(e.target.value)}/></label><button disabled={busy||!stationId} className="btn-primary w-full">Thêm pin đầy vào kho</button></form>
        <form onSubmit={installBattery} className="panel space-y-4 p-6"><div><p className="eyebrow">LẮP PIN BAN ĐẦU</p><h2 className="mt-2 text-lg font-extrabold">Gắn pin cho xe</h2></div><label className="block"><span className="field-label">Xe chưa có pin</span><select className="field mt-2" required value={installVehicleId} onChange={e=>setInstallVehicleId(e.target.value)}><option value="">Chọn xe</option>{unassignedVehicles.map(v=><option key={v.id} value={v.id}>{v.code} · {v.model?.name}</option>)}</select></label><label className="block"><span className="field-label">Pin đầy trong kho</span><select className="field mt-2" required value={installBatteryId} onChange={e=>setInstallBatteryId(e.target.value)}><option value="">Chọn pin</option>{fullBatteries.map(b=><option key={b.id} value={b.id}>{b.serialNumber}</option>)}</select></label><button disabled={busy||!installVehicleId||!installBatteryId} className="btn-primary w-full">Xác nhận lắp pin</button></form>
        <form onSubmit={swapBattery} className="panel space-y-4 border-emerald-200 p-6"><div><p className="eyebrow">ĐỔI PIN NHANH</p><h2 className="mt-2 text-lg font-extrabold">Thay pin đầy cho xe</h2><p className="mt-2 text-sm text-slate-500">Pin cũ tự chuyển sang chờ sạc, pin mới được gắn vào xe trong cùng giao dịch.</p></div><label className="block"><span className="field-label">Xe cần đổi pin</span><select className="field mt-2" required value={swapVehicleId} onChange={e=>setSwapVehicleId(e.target.value)}><option value="">Chọn xe</option>{scopedVehicles.filter(v=>batteries.some(b=>b.vehicleId===v.id&&b.status==='INSTALLED')).map(v=><option key={v.id} value={v.id}>{v.code} · {v.model?.name}</option>)}</select></label><label className="block"><span className="field-label">Pin đầy thay thế</span><select className="field mt-2" required value={swapBatteryId} onChange={e=>setSwapBatteryId(e.target.value)}><option value="">Chọn pin đầy tại trạm</option>{fullBatteries.map(b=><option key={b.id} value={b.id}>{b.serialNumber} · {b.healthPercent}% sức khỏe</option>)}</select></label><label className="block"><span className="field-label">Ghi chú</span><input className="field mt-2" maxLength={500} value={swapNote} onChange={e=>setSwapNote(e.target.value)} placeholder="Tình trạng pin cũ..."/></label><button disabled={busy||!swapVehicleId||!swapBatteryId} className="btn-primary w-full">Xác nhận đổi pin</button></form>
      </div>
      <section className="panel mt-7 overflow-hidden"><div className="flex flex-wrap items-end justify-between gap-4 p-6"><div><p className="eyebrow">THEO DÕI TỪNG VIÊN PIN</p><h2 className="mt-2 text-xl font-extrabold">Danh sách tồn kho</h2><p className="mt-1 text-sm text-slate-500">{inventoryTotal} kết quả phù hợp</p></div><div className="flex flex-wrap gap-2"><input aria-label="Tìm serial hoặc xe" className="field min-w-52" placeholder="Tìm serial, mã xe..." value={inventorySearch} onChange={e=>{setInventorySearch(e.target.value);setInventoryPage(1);}}/><select aria-label="Lọc trạng thái pin" className="field min-w-44" value={inventoryStatus} onChange={e=>{setInventoryStatus(e.target.value);setInventoryPage(1);}}><option value="">Tất cả trạng thái</option>{Object.entries(statusLabel).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></div></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-6 py-4">Serial</th><th className="px-4 py-4">Trạng thái</th><th className="px-4 py-4">Xe / Trạm</th><th className="px-4 py-4">Sức khỏe</th><th className="px-4 py-4">Chu kỳ sạc</th><th className="px-6 py-4">Thao tác</th></tr></thead><tbody className="divide-y divide-slate-100">{inventoryLoading?<tr><td colSpan={6} className="px-6 py-10 text-center text-slate-500">Đang tải danh sách pin...</td></tr>:inventory.map(b=><tr key={b.id}><td className="px-6 py-4 font-bold">{b.serialNumber}<p className="text-xs font-normal text-slate-400">{b.capacityKwh??'—'} kWh</p></td><td className="px-4 py-4">{statusLabel[b.status]}</td><td className="px-4 py-4">{b.vehicle?.code??b.station?.name??'—'}</td><td className="px-4 py-4"><span className={b.healthPercent<70?'font-bold text-rose-600':b.healthPercent<85?'font-semibold text-amber-600':'text-emerald-700'}>{b.healthPercent}%</span><p className="mt-1 text-xs text-slate-400">{b.healthPercent<70?'Cần kiểm tra/bảo dưỡng':b.healthPercent<85?'Theo dõi sức khỏe':'Hoạt động tốt'}</p></td><td className="px-4 py-4">{b.cycleCount}</td><td className="px-6 py-4"><div className="flex min-w-52 flex-col gap-2">
            {b.status==='CHARGING'?<button disabled={busy} className="text-left text-sm font-bold text-emerald-700 underline" onClick={()=>void act(()=>api.patch('/batteries/'+b.id+'/complete-charging',{healthPercent:Number(healthDrafts[b.id]??b.healthPercent)}), 'Đã hoàn tất phiên sạc, cập nhật chu kỳ và sức khỏe pin.')}>Xác nhận sạc đầy</button>:null}
            {b.status==='FULL'?<button disabled={busy} className="text-left text-sm font-bold text-amber-700 underline" onClick={()=>void act(()=>api.patch('/batteries/'+b.id+'/maintenance',{note:'Chuyển bảo dưỡng từ màn hình kho pin'}),'Đã chuyển pin sang bảo dưỡng.')}>Đưa vào bảo dưỡng</button>:null}
            {b.status==='MAINTENANCE'?<button disabled={busy} className="text-left text-sm font-bold text-emerald-700 underline" onClick={()=>void act(()=>api.patch('/batteries/'+b.id+'/maintenance/complete',{note:'Hoàn tất bảo dưỡng'}),'Đã hoàn tất bảo dưỡng, pin trở lại kho sẵn sàng.')}>Hoàn tất bảo dưỡng</button>:null}
            {(b.status==='FULL'||b.status==='MAINTENANCE')?<button disabled={busy} className="text-left text-xs font-semibold text-rose-700 underline" onClick={()=>{if(window.confirm('Ngừng sử dụng pin '+b.serialNumber+'?'))void act(()=>api.patch('/batteries/'+b.id+'/retire',{note:'Ngừng sử dụng từ quản lý kho pin'}),'Đã chuyển pin sang ngừng sử dụng.');}}>Ngừng sử dụng pin</button>:null}
            {b.status!=='RETIRED'?<div className="flex items-center gap-1"><input aria-label={'Sức khỏe pin '+b.serialNumber} className="field w-16 px-2 py-1" type="number" min="1" max="100" value={healthDrafts[b.id]??String(b.healthPercent)} onChange={e=>setHealthDrafts(s=>({...s,[b.id]:e.target.value}))}/><button disabled={busy||Number(healthDrafts[b.id]??b.healthPercent)<1||Number(healthDrafts[b.id]??b.healthPercent)>100} className="text-xs font-semibold text-sky-700 underline" onClick={()=>void act(()=>api.patch('/batteries/'+b.id+'/health',{healthPercent:Number(healthDrafts[b.id]??b.healthPercent)}),'Đã cập nhật sức khỏe pin.')}>Lưu %</button></div>:null}
          </div></td></tr>)}{!inventoryLoading&&!inventory.length&&<tr><td colSpan={6} className="px-6 py-10 text-center"><p className="font-semibold text-slate-700">Không tìm thấy pin phù hợp</p><p className="mt-1 text-xs text-slate-400">Thử thay đổi từ khóa hoặc bộ lọc.</p></td></tr>}</tbody></table></div><div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-6 py-4"><p className="text-xs text-slate-500">Trang {inventoryPage} / {Math.max(1,inventoryPages)} · {inventoryTotal} pin</p><div className="flex gap-2"><button className="btn-outline" disabled={inventoryPage<=1||inventoryLoading} onClick={()=>setInventoryPage(p=>p-1)}>Trước</button><button className="btn-outline" disabled={inventoryPage>=inventoryPages||inventoryLoading} onClick={()=>setInventoryPage(p=>p+1)}>Tiếp</button></div></div></section>
      <section className="panel mt-7 overflow-hidden"><div className="p-6"><p className="eyebrow">LỊCH SỬ SẠC PIN</p><h2 className="mt-2 text-xl font-extrabold">Theo dõi từng phiên sạc</h2><p className="mt-1 text-sm text-slate-500">Ghi nhận thời điểm bắt đầu, hoàn tất, nhân viên phụ trách và tình trạng pin.</p></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-6 py-4">Pin / Trạm</th><th className="px-4 py-4">Bắt đầu sạc</th><th className="px-4 py-4">Hoàn tất</th><th className="px-4 py-4">Nhân viên</th><th className="px-4 py-4">Trạng thái</th><th className="px-6 py-4">Ghi chú</th></tr></thead><tbody className="divide-y divide-slate-100">
          {chargingHistory.map(s=><tr key={s.id}><td className="px-6 py-4 font-semibold">{s.battery?.serialNumber??'Pin #'+s.batteryId}<p className="mt-1 text-xs font-normal text-slate-500">{s.station?.name??'—'}</p></td><td className="px-4 py-4 whitespace-nowrap">{new Date(s.startedAt).toLocaleString('vi-VN')}</td><td className="px-4 py-4 whitespace-nowrap">{s.completedAt?new Date(s.completedAt).toLocaleString('vi-VN'):'Đang sạc'}</td><td className="px-4 py-4">{s.startedBy?.fullName??'—'}{s.completedBy?.fullName?' → '+s.completedBy.fullName:''}</td><td className="px-4 py-4">{s.status==='IN_PROGRESS'?'Đang sạc':s.status==='COMPLETED'?'Đã hoàn tất':'Đã hủy'}</td><td className="px-6 py-4 text-slate-500">{s.note||'—'}</td></tr>)}
          {!chargingHistory.length?<tr><td colSpan={6} className="px-6 py-8 text-center text-slate-500">Chưa có lịch sử sạc pin.</td></tr>:null}
        </tbody></table></div></section>
      <section className="panel mt-7 overflow-hidden"><div className="p-6"><p className="eyebrow">KHÁCH ĐÃ GIỮ PIN TRƯỚC</p><h2 className="mt-2 text-xl font-extrabold">Lượt giữ pin tại trạm</h2><p className="mt-2 text-sm text-slate-500">Chỉ xác nhận khi khách có mặt và kiểm tra đúng xe thuê. Lượt giữ tự hết hiệu lực sau 10 phút.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-6 py-4">Mã giữ</th><th className="px-4 py-4">Xe / Đơn thuê</th><th className="px-4 py-4">Trạng thái</th><th className="px-4 py-4">Hết hạn</th><th className="px-6 py-4">Xác nhận đổi</th></tr></thead><tbody className="divide-y divide-slate-100">{reservations.map(r=><tr key={r.id}><td className="px-6 py-4 font-bold">#{r.id}<p className="text-xs font-normal text-slate-400">Khách #{r.customerId}</p></td><td className="px-4 py-4">{r.vehicle?.code??'Xe #'+r.vehicleId}<p className="text-xs text-slate-400">Đơn thuê #{r.bookingId}</p></td><td className="px-4 py-4">{r.status==='RESERVED'&&new Date(r.expiresAt)<=new Date()?'Hết hạn':({RESERVED:'Đang giữ',REDEEMED:'Đã đổi',CANCELLED:'Đã hủy',EXPIRED:'Hết hạn'} as Record<string,string>)[r.status]}</td><td className="px-4 py-4">{new Date(r.expiresAt).toLocaleTimeString('vi-VN')}</td><td className="px-6 py-4">{r.status==='RESERVED'&&new Date(r.expiresAt)>new Date()?<div className="flex items-center gap-2"><select className="field min-w-40" value={redeemBatteryIds[r.id]??''} onChange={e=>setRedeemBatteryIds(v=>({...v,[r.id]:e.target.value}))}><option value="">Chọn pin đầy</option>{fullBatteries.map(b=><option key={b.id} value={b.id}>{b.serialNumber}</option>)}</select><button disabled={busy||!redeemBatteryIds[r.id]} className="btn-primary whitespace-nowrap" onClick={()=>void redeemReservation(r.id)}>Đổi pin</button></div>:<span className="text-slate-400">—</span>}</td></tr>)}{!reservations.length&&<tr><td colSpan={5} className="px-6 py-8 text-center text-slate-400">Chưa có lượt giữ pin tại trạm.</td></tr>}</tbody></table></div></section>
      <section className="panel mt-7 overflow-hidden"><div className="p-6"><p className="eyebrow">NHẬT KÝ ĐỔI PIN</p><h2 className="mt-2 text-xl font-extrabold">Lịch sử giao dịch</h2></div><div className="divide-y divide-slate-100">{history.map(item=><div key={item.id} className="flex flex-wrap justify-between gap-3 px-6 py-4 text-sm"><div><strong>{item.vehicle?.code??'Xe #'+item.vehicleId}</strong><p className="mt-1 text-xs text-slate-500">{item.removedBattery?.serialNumber} → {item.installedBattery?.serialNumber} · {item.station?.name}</p>{item.note&&<p className="mt-1 text-xs text-slate-500">{item.note}</p>}</div><time className="text-xs text-slate-400">{new Date(item.createdAt).toLocaleString('vi-VN')}</time></div>)}{!history.length&&<p className="px-6 pb-7 text-sm text-slate-400">Chưa có lịch sử đổi pin.</p>}</div></section>
    </>}
  </div>;
}
