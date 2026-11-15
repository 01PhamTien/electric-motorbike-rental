import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SectionHeading, LoadingState } from '../../components/Brand';
import { useAuth } from '../auth/AuthContext';
import { api } from '../../services/api';
import type { Station, Vehicle } from '../../types';

type BatteryStatus='FULL'|'INSTALLED'|'CHARGING'|'MAINTENANCE'|'RETIRED'|'TRANSFERRING';
type Battery={id:number;serialNumber:string;stationId:number;station?:Station;vehicleId:number|null;vehicle?:Vehicle|null;status:BatteryStatus;capacityKwh:string|null;healthPercent:number;cycleCount:number;lastChargedAt:string|null;note:string|null};
type Swap={id:number;vehicle?:Vehicle;vehicleId:number;station?:Station;removedBattery?:Battery;installedBattery?:Battery;createdAt:string;note:string|null};
type BatteryTransfer={id:number;sourceStationId:number;destinationStationId:number;status:'PENDING'|'IN_TRANSIT'|'COMPLETED'|'CANCELLED';note:string|null;createdAt:string;sourceStation?:Station;destinationStation?:Station;items:{batteryId:number;battery?:Battery}[]};
type StocktakeItem={id:number;batteryId:number|null;serialSnapshot:string;systemStatus:string;systemVehicleId:number|null;exempt:boolean;countStatus:'PENDING'|'PRESENT'|'MISSING'|'EXTRA';observedStatus:string|null;note:string|null};
type Stocktake={id:number;stationId:number;status:'OPEN'|'COMPLETED'|'APPROVED';note:string|null;heldReservationCount:number;createdAt:string;completedAt:string|null;approvedAt:string|null;station?:Station;items:StocktakeItem[]};
type Reservation={id:number;customerId:number;stationId:number;bookingId:number;vehicleId:number;vehicle?:Vehicle;station?:Station;status:'RESERVED'|'REDEEMED'|'CANCELLED'|'EXPIRED';expiresAt:string;createdAt:string};
const statusLabel:Record<BatteryStatus,string>={FULL:'Pin đầy · sẵn sàng',INSTALLED:'Đang lắp trên xe',CHARGING:'Đang sạc',MAINTENANCE:'Bảo dưỡng',RETIRED:'Ngừng sử dụng',TRANSFERRING:'Đang điều chuyển'};
const errText=(err:unknown)=>{const m=(err as {response?:{data?:{message?:string|string[]}}})?.response?.data?.message;return Array.isArray(m)?m.join(', '):m||'Không thể thực hiện thao tác.';};

export function BatteriesPage(){
  const {user}=useAuth();
  const [stations,setStations]=useState<Station[]>([]);
  const [vehicles,setVehicles]=useState<Vehicle[]>([]);
  const [batteries,setBatteries]=useState<Battery[]>([]);
  const [history,setHistory]=useState<Swap[]>([]);
  const [reservations,setReservations]=useState<Reservation[]>([]);
  const [transfers,setTransfers]=useState<BatteryTransfer[]>([]);\n  const [stocktakes,setStocktakes]=useState<Stocktake[]>([]);\n  const [extraSerial,setExtraSerial]=useState('');\n  const [extraNote,setExtraNote]=useState('');
  const [transferDestination,setTransferDestination]=useState('');
  const [transferBatteryIds,setTransferBatteryIds]=useState<number[]>([]);
  const [transferNote,setTransferNote]=useState('');
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
      const [sr,vr,br,hr,rr,tr,str]=await Promise.all([api.get('/stations'),api.get('/vehicles'),api.get('/batteries',{params}),api.get('/batteries/swaps/history',{params}),api.get('/batteries/reservations',{params}),api.get('/batteries/transfers'),api.get('/batteries/stocktakes',{params})]);
      setStations(Array.isArray(sr.data)?sr.data:[]);setVehicles(Array.isArray(vr.data)?vr.data:[]);
      setBatteries(Array.isArray(br.data)?br.data:[]);setHistory(Array.isArray(hr.data)?hr.data:[]);setReservations(Array.isArray(rr.data)?rr.data:[]);setTransfers(Array.isArray(tr.data)?tr.data:[]);setStocktakes(Array.isArray(str.data)?str.data:[]);
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
  const openStocktake=stationId?stocktakes.find(s=>s.status==='OPEN'&&String(s.stationId)===stationId):undefined;
  async function startStocktake(){
    if(!stationId)return;
    await act(()=>api.post('/batteries/stocktakes',{stationId:Number(stationId)}),'Đã tạo đợt kiểm kê và chụp snapshot tồn kho.');
  }
  async function recordStocktakeItem(stocktakeId:number,itemId:number,countStatus:'PRESENT'|'MISSING'){
    await act(()=>api.patch('/batteries/stocktakes/'+stocktakeId+'/items/'+itemId,{countStatus}),'Đã lưu kết quả kiểm đếm.');
  }
  async function addStocktakeExtra(e:React.FormEvent){
    e.preventDefault();if(!openStocktake||!extraSerial.trim())return;
    await act(()=>api.post('/batteries/stocktakes/'+openStocktake.id+'/extras',{serialNumber:extraSerial.trim(),note:extraNote.trim()||undefined}),'Đã ghi nhận pin thừa/không có trong hệ thống.');
    setExtraSerial('');setExtraNote('');
  }
  async function stocktakeAction(id:number,action:'complete'|'approve'){
    const label=action==='complete'?'Đã hoàn tất kiểm kê.':'ADMIN đã duyệt biên bản kiểm kê.';
    await act(()=>api.patch('/batteries/stocktakes/'+id+'/'+action),label);
  }
  async function createTransfer(e:React.FormEvent){
    e.preventDefault();
    if(!stationId||!transferDestination||!transferBatteryIds.length)return;
    await act(()=>api.post('/batteries/transfers',{sourceStationId:Number(stationId),destinationStationId:Number(transferDestination),batteryIds:transferBatteryIds,note:transferNote.trim()||undefined}),'Đã tạo phiếu điều chuyển. Các pin đã được giữ khỏi tồn kho khả dụng.');
    setTransferBatteryIds([]);setTransferDestination('');setTransferNote('');
  }
  async function transferAction(id:number,action:'dispatch'|'receive'|'cancel'){
    const labels={dispatch:'Đã bàn giao pin cho vận chuyển.',receive:'Đã tiếp nhận pin vào kho trạm đích.',cancel:'Đã hủy phiếu và hoàn pin về kho trạm gửi.'};
    await act(()=>api.patch('/batteries/transfers/'+id+'/'+action),labels[action]);
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
      <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">{[{label:'Pin đầy sẵn sàng',value:counts.full},{label:'Đang lắp trên xe',value:counts.installed},{label:'Đang sạc',value:counts.charging},{label:'Cần kiểm tra',value:counts.maintenance}].map(x=><div key={x.label} className="panel p-5"><p className="text-xs text-slate-500">{x.label}</p><strong className="mt-2 block text-3xl">{x.value}</strong></div>)}</div>
      <div className="mt-7 grid gap-6 xl:grid-cols-3">
        <form onSubmit={addBattery} className="panel space-y-4 p-6"><div><p className="eyebrow">NHẬP KHO</p><h2 className="mt-2 text-lg font-extrabold">Thêm viên pin</h2></div><label className="block"><span className="field-label">Mã serial pin</span><input className="field mt-2" required maxLength={80} value={serial} onChange={e=>setSerial(e.target.value)} placeholder="VG-BAT-0001"/></label><label className="block"><span className="field-label">Dung lượng (kWh)</span><input className="field mt-2" type="number" min="0.1" step="0.01" value={capacity} onChange={e=>setCapacity(e.target.value)} placeholder="Ví dụ 2.4"/></label><label className="block"><span className="field-label">Sức khỏe pin (%)</span><input className="field mt-2" type="number" min="1" max="100" value={health} onChange={e=>setHealth(e.target.value)}/></label><button disabled={busy||!stationId} className="btn-primary w-full">Thêm pin đầy vào kho</button></form>
        <form onSubmit={installBattery} className="panel space-y-4 p-6"><div><p className="eyebrow">LẮP PIN BAN ĐẦU</p><h2 className="mt-2 text-lg font-extrabold">Gắn pin cho xe</h2></div><label className="block"><span className="field-label">Xe chưa có pin</span><select className="field mt-2" required value={installVehicleId} onChange={e=>setInstallVehicleId(e.target.value)}><option value="">Chọn xe</option>{unassignedVehicles.map(v=><option key={v.id} value={v.id}>{v.code} · {v.model?.name}</option>)}</select></label><label className="block"><span className="field-label">Pin đầy trong kho</span><select className="field mt-2" required value={installBatteryId} onChange={e=>setInstallBatteryId(e.target.value)}><option value="">Chọn pin</option>{fullBatteries.map(b=><option key={b.id} value={b.id}>{b.serialNumber}</option>)}</select></label><button disabled={busy||!installVehicleId||!installBatteryId} className="btn-primary w-full">Xác nhận lắp pin</button></form>
        <form onSubmit={swapBattery} className="panel space-y-4 border-emerald-200 p-6"><div><p className="eyebrow">ĐỔI PIN NHANH</p><h2 className="mt-2 text-lg font-extrabold">Thay pin đầy cho xe</h2><p className="mt-2 text-sm text-slate-500">Pin cũ tự chuyển sang chờ sạc, pin mới được gắn vào xe trong cùng giao dịch.</p></div><label className="block"><span className="field-label">Xe cần đổi pin</span><select className="field mt-2" required value={swapVehicleId} onChange={e=>setSwapVehicleId(e.target.value)}><option value="">Chọn xe</option>{scopedVehicles.filter(v=>batteries.some(b=>b.vehicleId===v.id&&b.status==='INSTALLED')).map(v=><option key={v.id} value={v.id}>{v.code} · {v.model?.name}</option>)}</select></label><label className="block"><span className="field-label">Pin đầy thay thế</span><select className="field mt-2" required value={swapBatteryId} onChange={e=>setSwapBatteryId(e.target.value)}><option value="">Chọn pin đầy tại trạm</option>{fullBatteries.map(b=><option key={b.id} value={b.id}>{b.serialNumber} · {b.healthPercent}% sức khỏe</option>)}</select></label><label className="block"><span className="field-label">Ghi chú</span><input className="field mt-2" maxLength={500} value={swapNote} onChange={e=>setSwapNote(e.target.value)} placeholder="Tình trạng pin cũ..."/></label><button disabled={busy||!swapVehicleId||!swapBatteryId} className="btn-primary w-full">Xác nhận đổi pin</button></form>
      </div>
      <section className="panel mt-7 p-6">
        <p className="eyebrow">LUÂN CHUYỂN KHO</p><h2 className="mt-2 text-xl font-extrabold">Điều chuyển pin giữa các trạm</h2>
        <p className="mt-2 text-sm text-slate-500">Chọn pin đầy trong kho trạm nguồn. Pin được khóa khỏi thao tác lắp/đổi ngay khi tạo phiếu và chỉ trở lại tồn kho sau khi tiếp nhận hoặc hủy phiếu trước bàn giao.</p>
        <form onSubmit={createTransfer} className="mt-5 grid gap-4 md:grid-cols-2">
          <label><span className="field-label">Trạm gửi</span><select className="field mt-2" value={stationId} disabled={user?.role==='STAFF'} onChange={e=>{setStationId(e.target.value);setTransferBatteryIds([]);}} required><option value="">Chọn trạm nguồn</option>{stations.filter(s=>s.isActive!==false).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <label><span className="field-label">Trạm nhận</span><select className="field mt-2" value={transferDestination} onChange={e=>setTransferDestination(e.target.value)} required><option value="">Chọn trạm đích</option>{stations.filter(s=>s.isActive!==false&&String(s.id)!==stationId).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <div className="md:col-span-2"><p className="field-label">Pin FULL có thể điều chuyển</p><div className="mt-2 grid max-h-44 gap-2 overflow-y-auto rounded-xl border border-slate-200 p-3 sm:grid-cols-2 lg:grid-cols-3">{fullBatteries.filter(b=>String(b.stationId)===stationId).map(b=><label key={b.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={transferBatteryIds.includes(b.id)} onChange={e=>setTransferBatteryIds(ids=>e.target.checked?[...ids,b.id]:ids.filter(id=>id!==b.id))}/><span>{b.serialNumber} · {b.healthPercent}%</span></label>)}{!fullBatteries.some(b=>String(b.stationId)===stationId)&&<p className="text-sm text-slate-400">Trạm nguồn chưa có pin đầy khả dụng.</p>}</div><p className="mt-1 text-xs text-slate-500">Đã chọn {transferBatteryIds.length} pin.</p></div>
          <label className="md:col-span-2"><span className="field-label">Ghi chú điều chuyển</span><input className="field mt-2" maxLength={500} value={transferNote} onChange={e=>setTransferNote(e.target.value)} placeholder="Lý do hoặc thông tin vận chuyển..."/></label>
          <div className="md:col-span-2"><button disabled={busy||!stationId||!transferDestination||!transferBatteryIds.length} className="btn-primary">Tạo phiếu điều chuyển</button></div>
        </form>
        <div className="mt-7 border-t border-slate-100 pt-5"><h3 className="font-extrabold">Phiếu điều chuyển gần đây</h3><div className="mt-3 divide-y divide-slate-100">{transfers.map(t=><div key={t.id} className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm"><div><strong>Phiếu #{t.id} · {t.sourceStation?.name??'Trạm '+t.sourceStationId} → {t.destinationStation?.name??'Trạm '+t.destinationStationId}</strong><p className="mt-1 text-xs text-slate-500">{t.items?.length??0} pin · {(t.items??[]).map(i=>i.battery?.serialNumber??('#'+i.batteryId)).join(', ')} · {t.note??'Không có ghi chú'}</p><p className="mt-1 text-xs text-slate-500">{({PENDING:'Chờ bàn giao',IN_TRANSIT:'Đang vận chuyển',COMPLETED:'Đã tiếp nhận',CANCELLED:'Đã hủy'} as Record<string,string>)[t.status]}</p></div><div className="flex flex-wrap gap-2">{t.status==='PENDING'&&(user?.role==='ADMIN'||user?.stationId===t.sourceStationId)&&<><button disabled={busy} className="btn-outline" onClick={()=>void transferAction(t.id,'dispatch')}>Bàn giao</button><button disabled={busy} className="btn-outline border-rose-200 text-rose-700" onClick={()=>void transferAction(t.id,'cancel')}>Hủy</button></>}{t.status==='IN_TRANSIT'&&(user?.role==='ADMIN'||user?.stationId===t.destinationStationId)&&<button disabled={busy} className="btn-primary" onClick={()=>void transferAction(t.id,'receive')}>Xác nhận tiếp nhận</button>}</div></div>)}{!transfers.length&&<p className="py-4 text-sm text-slate-400">Chưa có phiếu điều chuyển pin.</p>}</div></div>
      </section>
      <section className="panel mt-7 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="eyebrow">KIỂM SOÁT TỒN KHO</p><h2 className="mt-2 text-xl font-extrabold">Kiểm kê pin tại trạm</h2><p className="mt-2 text-sm text-slate-500">Chụp snapshot, đánh dấu pin có mặt hoặc thất lạc và ghi nhận pin thừa. Kết quả không tự động sửa dữ liệu kho.</p></div>{!openStocktake&&<button disabled={busy||!stationId} className="btn-primary" onClick={()=>void startStocktake()}>Bắt đầu kiểm kê</button>}</div>
        {openStocktake?<div className="mt-5">
          <div className="rounded-xl bg-slate-50 p-4 text-sm"><strong>Đợt kiểm kê #{openStocktake.id}</strong><p className="mt-1 text-slate-500">Snapshot: {new Date(openStocktake.createdAt).toLocaleString('vi-VN')} · Pin được giữ trước: {openStocktake.heldReservationCount} lượt · {openStocktake.items.filter(i=>i.countStatus==='PENDING').length} dòng chưa kiểm đếm</p></div>
          <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-3 py-3">Serial</th><th className="px-3 py-3">Trạng thái hệ thống</th><th className="px-3 py-3">Kết quả</th><th className="px-3 py-3">Thao tác</th></tr></thead><tbody className="divide-y divide-slate-100">{openStocktake.items.map(item=><tr key={item.id}><td className="px-3 py-3 font-semibold">{item.serialSnapshot}{item.exempt&&<p className="text-xs font-normal text-amber-700">Đang điều chuyển · miễn kiểm đếm</p>}{item.systemVehicleId&&<p className="text-xs font-normal text-slate-400">Xe #{item.systemVehicleId}</p>}</td><td className="px-3 py-3">{item.systemStatus}</td><td className="px-3 py-3">{({PENDING:'Chưa kiểm',PRESENT:'Có mặt',MISSING:'Thiếu',EXTRA:'Pin thừa'} as Record<string,string>)[item.countStatus]}</td><td className="px-3 py-3"><div className="flex gap-2">{!item.exempt&&item.batteryId!==null&&<><button disabled={busy} className="btn-outline" onClick={()=>void recordStocktakeItem(openStocktake.id,item.id,'PRESENT')}>Có mặt</button><button disabled={busy} className="btn-outline border-rose-200 text-rose-700" onClick={()=>void recordStocktakeItem(openStocktake.id,item.id,'MISSING')}>Thiếu</button></>}</div></td></tr>)}</tbody></table></div>
          <form onSubmit={addStocktakeExtra} className="mt-5 flex flex-wrap items-end gap-3"><label className="min-w-56 flex-1"><span className="field-label">Serial pin không có trong hệ thống</span><input className="field mt-2" maxLength={80} required value={extraSerial} onChange={e=>setExtraSerial(e.target.value)} placeholder="VG-BAT-UNKNOWN-01"/></label><label className="min-w-56 flex-1"><span className="field-label">Ghi chú</span><input className="field mt-2" maxLength={500} value={extraNote} onChange={e=>setExtraNote(e.target.value)} placeholder="Tình trạng hoặc nguồn gốc..."/></label><button disabled={busy||!extraSerial.trim()} className="btn-outline">Ghi nhận pin thừa</button></form>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-500">Pin đang điều chuyển được miễn kiểm đếm. Các dòng snapshot khác phải được đánh dấu có mặt hoặc thiếu.</p><button disabled={busy||openStocktake.items.some(i=>i.countStatus==='PENDING')} className="btn-primary" onClick={()=>void stocktakeAction(openStocktake.id,'complete')}>Hoàn tất kiểm kê</button></div>
        </div>:<p className="mt-5 text-sm text-slate-500">Không có đợt kiểm kê đang mở tại trạm này.</p>}
        <div className="mt-6 border-t border-slate-100 pt-5"><h3 className="font-extrabold">Lịch sử kiểm kê</h3><div className="mt-3 divide-y divide-slate-100">{stocktakes.filter(s=>s.status!=='OPEN').map(s=><div key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><div><strong>Đợt #{s.id} · {s.station?.name??'Trạm '+s.stationId}</strong><p className="mt-1 text-xs text-slate-500">{new Date(s.createdAt).toLocaleString('vi-VN')} · {s.items.filter(i=>i.countStatus==='MISSING').length} pin thiếu · {s.items.filter(i=>i.countStatus==='EXTRA').length} pin thừa · {s.items.length} dòng</p>{s.items.some(i=>i.countStatus==='MISSING'||i.countStatus==='EXTRA')&&<p className="mt-1 text-xs text-rose-700">Chênh lệch: {s.items.filter(i=>i.countStatus==='MISSING').map(i=>i.serialSnapshot).join(', ')||'Không có pin thiếu'}; {s.items.filter(i=>i.countStatus==='EXTRA').map(i=>i.serialSnapshot).join(', ')||'Không có pin thừa'}</p>}<p className="text-xs text-slate-500">{s.status==='APPROVED'?'Đã duyệt':'Chờ ADMIN duyệt'}</p></div>{s.status==='COMPLETED'&&user?.role==='ADMIN'&&<button disabled={busy} className="btn-primary" onClick={()=>void stocktakeAction(s.id,'approve')}>Duyệt biên bản</button>}</div>)}{!stocktakes.some(s=>s.status!=='OPEN')&&<p className="py-3 text-sm text-slate-400">Chưa có lịch sử kiểm kê.</p>}</div></div>
      </section>
      <section className="panel mt-7 overflow-hidden"><div className="p-6"><p className="eyebrow">THEO DÕI TỪNG VIÊN PIN</p><h2 className="mt-2 text-xl font-extrabold">Danh sách pin</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-6 py-4">Serial</th><th className="px-4 py-4">Trạng thái</th><th className="px-4 py-4">Xe / Trạm</th><th className="px-4 py-4">Sức khỏe</th><th className="px-4 py-4">Chu kỳ sạc</th><th className="px-6 py-4">Thao tác</th></tr></thead><tbody className="divide-y divide-slate-100">{batteries.map(b=><tr key={b.id}><td className="px-6 py-4 font-bold">{b.serialNumber}<p className="text-xs font-normal text-slate-400">{b.capacityKwh??'—'} kWh</p></td><td className="px-4 py-4">{statusLabel[b.status]}</td><td className="px-4 py-4">{b.vehicle?.code??b.station?.name??'—'}</td><td className="px-4 py-4">{b.healthPercent}%</td><td className="px-4 py-4">{b.cycleCount}</td><td className="px-6 py-4">{b.status==='CHARGING'?<button disabled={busy} className="text-sm font-bold text-emerald-700 underline" onClick={()=>void act(()=>api.patch('/batteries/'+b.id+'/complete-charging'), 'Đã xác nhận pin sạc đầy và sẵn sàng đổi.')}>Xác nhận sạc đầy</button>:<span className="text-slate-400">—</span>}</td></tr>)}{!batteries.length&&<tr><td colSpan={6} className="px-6 py-8 text-center text-slate-400">Chưa có dữ liệu pin tại trạm.</td></tr>}</tbody></table></div></section>
      <section className="panel mt-7 overflow-hidden"><div className="p-6"><p className="eyebrow">KHÁCH ĐÃ GIỮ PIN TRƯỚC</p><h2 className="mt-2 text-xl font-extrabold">Lượt giữ pin tại trạm</h2><p className="mt-2 text-sm text-slate-500">Chỉ xác nhận khi khách có mặt và kiểm tra đúng xe thuê. Lượt giữ tự hết hiệu lực sau 10 phút.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-6 py-4">Mã giữ</th><th className="px-4 py-4">Xe / Đơn thuê</th><th className="px-4 py-4">Trạng thái</th><th className="px-4 py-4">Hết hạn</th><th className="px-6 py-4">Xác nhận đổi</th></tr></thead><tbody className="divide-y divide-slate-100">{reservations.map(r=><tr key={r.id}><td className="px-6 py-4 font-bold">#{r.id}<p className="text-xs font-normal text-slate-400">Khách #{r.customerId}</p></td><td className="px-4 py-4">{r.vehicle?.code??'Xe #'+r.vehicleId}<p className="text-xs text-slate-400">Đơn thuê #{r.bookingId}</p></td><td className="px-4 py-4">{r.status==='RESERVED'&&new Date(r.expiresAt)<=new Date()?'Hết hạn':({RESERVED:'Đang giữ',REDEEMED:'Đã đổi',CANCELLED:'Đã hủy',EXPIRED:'Hết hạn'} as Record<string,string>)[r.status]}</td><td className="px-4 py-4">{new Date(r.expiresAt).toLocaleTimeString('vi-VN')}</td><td className="px-6 py-4">{r.status==='RESERVED'&&new Date(r.expiresAt)>new Date()?<div className="flex items-center gap-2"><select className="field min-w-40" value={redeemBatteryIds[r.id]??''} onChange={e=>setRedeemBatteryIds(v=>({...v,[r.id]:e.target.value}))}><option value="">Chọn pin đầy</option>{fullBatteries.map(b=><option key={b.id} value={b.id}>{b.serialNumber}</option>)}</select><button disabled={busy||!redeemBatteryIds[r.id]} className="btn-primary whitespace-nowrap" onClick={()=>void redeemReservation(r.id)}>Đổi pin</button></div>:<span className="text-slate-400">—</span>}</td></tr>)}{!reservations.length&&<tr><td colSpan={5} className="px-6 py-8 text-center text-slate-400">Chưa có lượt giữ pin tại trạm.</td></tr>}</tbody></table></div></section>
      <section className="panel mt-7 overflow-hidden"><div className="p-6"><p className="eyebrow">NHẬT KÝ ĐỔI PIN</p><h2 className="mt-2 text-xl font-extrabold">Lịch sử giao dịch</h2></div><div className="divide-y divide-slate-100">{history.map(item=><div key={item.id} className="flex flex-wrap justify-between gap-3 px-6 py-4 text-sm"><div><strong>{item.vehicle?.code??'Xe #'+item.vehicleId}</strong><p className="mt-1 text-xs text-slate-500">{item.removedBattery?.serialNumber} → {item.installedBattery?.serialNumber} · {item.station?.name}</p>{item.note&&<p className="mt-1 text-xs text-slate-500">{item.note}</p>}</div><time className="text-xs text-slate-400">{new Date(item.createdAt).toLocaleString('vi-VN')}</time></div>)}{!history.length&&<p className="px-6 pb-7 text-sm text-slate-400">Chưa có lịch sử đổi pin.</p>}</div></section>
    </>}
  </div>;
}
