import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SectionHeading, LoadingState } from '../../components/Brand';
import { useAuth } from '../auth/AuthContext';
import { api } from '../../services/api';
import type { Station, Vehicle } from '../../types';
import { BatteryInventoryPanel } from './BatteryInventoryPanel';

type BatteryStatus='FULL'|'INSTALLED'|'CHARGING'|'MAINTENANCE'|'RETIRED'|'TRANSFERRING';
type Battery={id:number;serialNumber:string;stationId:number;station?:Station;vehicleId:number|null;vehicle?:Vehicle|null;status:BatteryStatus;capacityKwh:string|null;healthPercent:number|null;cycleCount:number;lastChargedAt:string|null;note:string|null};
type ChargeSession={id:number;batteryId:number;battery?:Battery;station?:Station;startedBy?:{id:number;fullName:string};completedBy?:{id:number;fullName:string};startedAt:string;completedAt:string|null;startNote:string|null;completionNote:string|null};
type Swap={id:number;vehicle?:Vehicle;vehicleId:number;station?:Station;removedBattery?:Battery;installedBattery?:Battery;performedBy?:{id:number;fullName:string};performedById:number;createdAt:string;note:string|null};
type BatteryTransfer={id:number;sourceStationId:number;destinationStationId:number;status:'PENDING'|'IN_TRANSIT'|'COMPLETED'|'CANCELLED';note:string|null;createdAt:string;sourceStation?:Station;destinationStation?:Station;items:{batteryId:number;battery?:Battery}[]};
type StocktakeItem={id:number;batteryId:number|null;serialSnapshot:string;systemStatus:string;systemVehicleId:number|null;exempt:boolean;countStatus:'PENDING'|'PRESENT'|'MISSING'|'EXTRA';observedStatus:string|null;note:string|null};
type Stocktake={id:number;stationId:number;status:'OPEN'|'COMPLETED'|'APPROVED';note:string|null;heldReservationCount:number;createdAt:string;completedAt:string|null;approvedAt:string|null;station?:Station;items:StocktakeItem[]};
type HealthCheck={id:number;healthPercent:number;cycleCount:number;note:string|null;createdAt:string;recordedBy?:{id:number;fullName:string}};
type HealthSummary={thresholds:{warningPercent:number;criticalPercent:number;cycleWarning:number};total:number;healthy:number;watch:number;critical:number;retired:number;unknown:number};
type MaintenanceTask={id:number;batteryId:number;stationId:number;taskType:string;priority:string;status:'OPEN'|'IN_PROGRESS'|'COMPLETED'|'CANCELLED';dueAt:string|null;description:string;result:string|null;cost:string|null;createdAt:string;battery?:Battery};
type OperatingCost={id:number;batteryId:number;stationId:number;costType:'CHARGING'|'MAINTENANCE'|'REPLACEMENT'|'OTHER';amount:string;energyKwh:string|null;unitPrice:string|null;occurredAt:string;note:string|null;battery?:Battery;station?:Station;recordedBy?:{id:number;fullName:string}};
type CostSummary={count:number;total:number;byType:{costType:string;count:number;amount:number}[];byBattery:{batteryId:number;serialNumber:string;count:number;amount:number}[];monthly:{month:string;amount:number}[]};
type Reservation={id:number;customerId:number;stationId:number;bookingId:number;vehicleId:number;vehicle?:Vehicle;station?:Station;status:'RESERVED'|'REDEEMED'|'CANCELLED'|'EXPIRED';expiresAt:string;createdAt:string};
const statusLabel:Record<BatteryStatus,string>={FULL:'Pin đầy · sẵn sàng',INSTALLED:'Đang lắp trên xe',CHARGING:'Đang sạc',MAINTENANCE:'Bảo dưỡng',RETIRED:'Ngừng sử dụng',TRANSFERRING:'Đang điều chuyển'};
const errText=(err:unknown)=>{const m=(err as {response?:{data?:{message?:string|string[]}}})?.response?.data?.message;return Array.isArray(m)?m.join(', '):m||'Không thể thực hiện thao tác.';};

export function BatteriesPage(){
  const {user}=useAuth();
  const [stations,setStations]=useState<Station[]>([]);
  const [vehicles,setVehicles]=useState<Vehicle[]>([]);
  const [batteries,setBatteries]=useState<Battery[]>([]);
  const [history,setHistory]=useState<Swap[]>([]);
  const [chargeHistory,setChargeHistory]=useState<ChargeSession[]>([]);
  const [chargeHistoryPage,setChargeHistoryPage]=useState(1);
  const [chargeHistoryBatteryId,setChargeHistoryBatteryId]=useState('');
  const [chargeHistoryFrom,setChargeHistoryFrom]=useState('');
  const [chargeHistoryTo,setChargeHistoryTo]=useState('');
  const [chargeHistoryTotal,setChargeHistoryTotal]=useState(0);
  const [chargeHistoryPages,setChargeHistoryPages]=useState(0);
  const [chargeHistoryLoading,setChargeHistoryLoading]=useState(false);
  const [historySearch,setHistorySearch]=useState('');
  const [historyVehicleId,setHistoryVehicleId]=useState('');
  const [historyFrom,setHistoryFrom]=useState('');
  const [historyTo,setHistoryTo]=useState('');
  const [historyPage,setHistoryPage]=useState(1);
  const [historyTotal,setHistoryTotal]=useState(0);
  const [historyPages,setHistoryPages]=useState(0);
  const [historyLoading,setHistoryLoading]=useState(false);
  const [reservations,setReservations]=useState<Reservation[]>([]);
  const [transfers,setTransfers]=useState<BatteryTransfer[]>([]); 
  const [stocktakes,setStocktakes]=useState<Stocktake[]>([]);
  const [healthSummary,setHealthSummary]=useState<HealthSummary|null>(null);
  const [healthHistory,setHealthHistory]=useState<HealthCheck[]>([]);
  const [historyBatteryId,setHistoryBatteryId]=useState<number|null>(null);
  const [maintenanceTasks,setMaintenanceTasks]=useState<MaintenanceTask[]>([]);
  const [operatingCosts,setOperatingCosts]=useState<OperatingCost[]>([]);
  const [costSummary,setCostSummary]=useState<CostSummary|null>(null);
  const [costFrom,setCostFrom]=useState(new Date(Date.UTC(new Date().getUTCFullYear(),new Date().getUTCMonth(),1)).toISOString().slice(0,10));
  const [costTo,setCostTo]=useState(new Date().toISOString().slice(0,10));
  const [costFilterType,setCostFilterType]=useState('');
  const [costBatteryId,setCostBatteryId]=useState('');
  const [newCostBatteryId,setNewCostBatteryId]=useState('');
  const [newCostType,setNewCostType]=useState('CHARGING');
  const [costEnergy,setCostEnergy]=useState('');
  const [costUnitPrice,setCostUnitPrice]=useState('');
  const [costAmount,setCostAmount]=useState('');
  const [costOccurredAt,setCostOccurredAt]=useState(new Date().toISOString().slice(0,16));
  const [costNote,setCostNote]=useState('');
  const [healthBatteryId,setHealthBatteryId]=useState('');
  const [healthValue,setHealthValue]=useState('');
  const [healthNote,setHealthNote]=useState('');
  const [taskBatteryId,setTaskBatteryId]=useState('');
  const [taskType,setTaskType]=useState('CAPACITY_TEST');
  const [taskPriority,setTaskPriority]=useState('NORMAL');
  const [taskDueAt,setTaskDueAt]=useState('');
  const [taskDescription,setTaskDescription]=useState('');
  const [completionId,setCompletionId]=useState<number|null>(null);
  const [completionResult,setCompletionResult]=useState('');
  const [completionCost,setCompletionCost]=useState(''); 
  const [extraSerial,setExtraSerial]=useState(''); 
  const [extraNote,setExtraNote]=useState('');
  const [transferDestination,setTransferDestination]=useState('');
  const [transferBatteryIds,setTransferBatteryIds]=useState<number[]>([]);
  const [transferNote,setTransferNote]=useState('');
  const [redeemBatteryIds,setRedeemBatteryIds]=useState<Record<number,string>>({});
  const [stationId,setStationId]=useState(user?.stationId?String(user.stationId):'');
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
  const [error,setError]=useState(''),[notice,setNotice]=useState('');
  const [serial,setSerial]=useState(''),[capacity,setCapacity]=useState(''),[health,setHealth]=useState(''),[newBatteryNote,setNewBatteryNote]=useState(''),[swapNote,setSwapNote]=useState('');
  const [installVehicleId,setInstallVehicleId]=useState(''),[swapVehicleId,setSwapVehicleId]=useState(''),[installBatteryId,setInstallBatteryId]=useState(''),[swapBatteryId,setSwapBatteryId]=useState('');
  const scopedVehicles=useMemo(()=>vehicles.filter(v=>String(v.station?.id)===stationId),[vehicles,stationId]);
  const historyVehicles=stationId?scopedVehicles:vehicles;
  const fullBatteries=batteries.filter(b=>b.status==='FULL'&&!b.vehicleId);
  const unassignedVehicles=scopedVehicles.filter(v=>!batteries.some(b=>b.vehicleId===v.id&&b.status==='INSTALLED'));
  async function load(){
    setLoading(true);setError('');
    try{
      const params=stationId?{stationId:Number(stationId)}:{};
      const costParams={...(stationId?{stationId:Number(stationId)}:{}),...(costFrom?{from:costFrom+'T00:00:00.000Z'}:{}),...(costTo?{to:costTo+'T23:59:59.999Z'}:{}),...(costFilterType?{costType:costFilterType}:{}),...(costBatteryId?{batteryId:Number(costBatteryId)}:{})};
      const summaryParams={...(stationId?{stationId:Number(stationId)}:{}),...(costFrom?{from:costFrom+'T00:00:00.000Z'}:{}),...(costTo?{to:costTo+'T23:59:59.999Z'}:{})};
      const [sr,vr,br,rr,tr,str,hs,mt,cs,cl]=await Promise.all([api.get('/stations'),api.get('/vehicles'),api.get('/batteries',{params}),api.get('/batteries/reservations',{params}),api.get('/batteries/transfers'),api.get('/batteries/stocktakes',{params}),api.get('/batteries/health/summary',{params}),api.get('/batteries/maintenance',{params}),api.get('/batteries/operating-costs/summary',{params:summaryParams}),api.get('/batteries/operating-costs',{params:costParams})]);
      setStations(Array.isArray(sr.data)?sr.data:[]);setVehicles(Array.isArray(vr.data)?vr.data:[]);
      setBatteries(Array.isArray(br.data)?br.data:[]);setReservations(Array.isArray(rr.data)?rr.data:[]);setTransfers(Array.isArray(tr.data)?tr.data:[]);setStocktakes(Array.isArray(str.data)?str.data:[]);setHealthSummary(hs.data);setMaintenanceTasks(Array.isArray(mt.data)?mt.data:[]);setCostSummary(cs.data);setOperatingCosts(Array.isArray(cl.data)?cl.data:[]);
    }catch(e){setError(errText(e));}finally{setLoading(false);}
  }
  useEffect(()=>{if(user?.stationId)setStationId(String(user.stationId));},[user?.stationId]);
  useEffect(()=>{
    let active=true;
    const params:Record<string,string|number>={page:chargeHistoryPage,limit:10};
    if(stationId)params.stationId=Number(stationId);
    if(chargeHistoryBatteryId)params.batteryId=Number(chargeHistoryBatteryId);
    if(chargeHistoryFrom)params.from=chargeHistoryFrom;
    if(chargeHistoryTo)params.to=chargeHistoryTo;
    setChargeHistoryLoading(true);
    api.get('/batteries/charging/history',{params}).then(({data})=>{
      if(!active)return;
      setChargeHistory(Array.isArray(data?.items)?data.items:[]);
      setChargeHistoryTotal(Number(data?.total)||0);
      setChargeHistoryPages(Number(data?.totalPages)||0);
    }).catch(e=>{if(active)setError(errText(e));}).finally(()=>{if(active)setChargeHistoryLoading(false);});
    return()=>{active=false;};
  },[stationId,chargeHistoryPage,chargeHistoryBatteryId,chargeHistoryFrom,chargeHistoryTo]);

  useEffect(()=>{
    let active=true;
    const params:Record<string,string|number>={page:historyPage,limit:10};
    if(stationId)params.stationId=Number(stationId);
    if(historyVehicleId)params.vehicleId=Number(historyVehicleId);
    if(historySearch.trim())params.serial=historySearch.trim();
    if(historyFrom)params.from=historyFrom;
    if(historyTo)params.to=historyTo;
    setHistoryLoading(true);
    api.get('/batteries/swaps/history',{params}).then(({data})=>{
      if(!active)return;
      setHistory(Array.isArray(data?.items)?data.items:[]);
      setHistoryTotal(Number(data?.total)||0);
      setHistoryPages(Number(data?.totalPages)||0);
    }).catch(e=>{if(active)setError(errText(e));}).finally(()=>{if(active)setHistoryLoading(false);});
    return()=>{active=false;};
  },[stationId,historyPage,historyVehicleId,historySearch,historyFrom,historyTo]);

  useEffect(()=>{void load();},[stationId,costFrom,costTo,costFilterType,costBatteryId]);
  async function act(fn:()=>Promise<unknown>,success:string){
    setBusy(true);setError('');setNotice('');
    try{await fn();setNotice(success);await load();}catch(e){setError(errText(e));}finally{setBusy(false);}
  }
  async function addBattery(e:React.FormEvent){
    e.preventDefault();
    await act(()=>api.post('/batteries',{serialNumber:serial.trim(),stationId:Number(stationId),capacityKwh:capacity?Number(capacity):undefined,healthPercent:health?Number(health):undefined,note:newBatteryNote.trim()||undefined}),'Đã nhập pin mới vào kho. Pin được đánh dấu đầy và sẵn sàng.');
    setSerial('');setCapacity('');setHealth('');setNewBatteryNote('');
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

  async function recordOperatingCost(e:React.FormEvent){
    e.preventDefault();if(!newCostBatteryId)return;
    const payload=newCostType==='CHARGING'?{batteryId:Number(newCostBatteryId),costType:newCostType,energyKwh:Number(costEnergy),unitPrice:Number(costUnitPrice),occurredAt:new Date(costOccurredAt).toISOString(),note:costNote.trim()||undefined}:{batteryId:Number(newCostBatteryId),costType:newCostType,amount:Number(costAmount),occurredAt:new Date(costOccurredAt).toISOString(),note:costNote.trim()||undefined};
    await act(()=>api.post('/batteries/operating-costs',payload),'Đã ghi nhận chi phí vận hành pin.');
    setCostEnergy('');setCostUnitPrice('');setCostAmount('');setCostNote('');
  }
  function exportOperatingCosts(){
    const header=['ID','Serial pin','Trạm','Loại chi phí','Thành tiền (VND)','Điện năng (kWh)','Đơn giá (VND/kWh)','Ngày phát sinh','Ghi chú'];
    const rows=operatingCosts.map(x=>[x.id,x.battery?.serialNumber??x.batteryId,x.station?.name??x.stationId,x.costType,x.amount,x.energyKwh??'',x.unitPrice??'',x.occurredAt,x.note??'']);
    const csv=[header,...rows].map(row=>row.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');
    const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download='battery-operating-costs.csv';a.click();URL.revokeObjectURL(url);
  }
  async function loadHealthHistory(id:number){setHistoryBatteryId(id);try{const r=await api.get('/batteries/'+id+'/health-history');setHealthHistory(Array.isArray(r.data)?r.data:[]);}catch(e){setError(errText(e));}}
  async function recordBatteryHealth(e:React.FormEvent){
    e.preventDefault();if(!healthBatteryId||!healthValue)return;
    await act(()=>api.post('/batteries/'+healthBatteryId+'/health-checks',{healthPercent:Number(healthValue),note:healthNote.trim()||undefined}),'Đã lưu đánh giá sức khỏe pin và lịch sử đo.');
    setHealthBatteryId('');setHealthValue('');setHealthNote('');
  }
  async function createMaintenanceTask(e:React.FormEvent){
    e.preventDefault();if(!taskBatteryId||!taskDescription.trim())return;
    await act(()=>api.post('/batteries/maintenance',{batteryId:Number(taskBatteryId),taskType,priority:taskPriority,dueAt:taskDueAt?new Date(taskDueAt).toISOString():undefined,description:taskDescription.trim()}),'Đã tạo phiếu bảo dưỡng.');
    setTaskDescription('');setTaskDueAt('');
  }
  async function maintenanceAction(id:number,action:'start'|'complete'|'cancel'){
    const payload=action==='complete'?{result:completionResult.trim(),cost:completionCost===''?undefined:Number(completionCost)}:undefined;
    await act(()=>api.patch('/batteries/maintenance/'+id+'/'+action,payload),action==='start'?'Đã bắt đầu bảo dưỡng.':action==='complete'?'Đã hoàn tất bảo dưỡng.':'Đã hủy phiếu bảo dưỡng.');
    setCompletionId(null);setCompletionResult('');setCompletionCost('');
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
      <BatteryInventoryPanel stationId={stationId} />
      <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">{[{label:'Pin đầy sẵn sàng',value:counts.full},{label:'Đang lắp trên xe',value:counts.installed},{label:'Đang sạc',value:counts.charging},{label:'Cần kiểm tra',value:counts.maintenance}].map(x=><div key={x.label} className="panel p-5"><p className="text-xs text-slate-500">{x.label}</p><strong className="mt-2 block text-3xl">{x.value}</strong></div>)}</div>
      <div className="mt-7 grid gap-6 xl:grid-cols-3">
        <form onSubmit={addBattery} className="panel space-y-4 p-6"><div><p className="eyebrow">NHẬP KHO</p><h2 className="mt-2 text-lg font-extrabold">Thêm viên pin</h2></div><label className="block"><span className="field-label">Mã serial pin</span><input className="field mt-2" required maxLength={80} value={serial} onChange={e=>setSerial(e.target.value)} placeholder="VG-BAT-0001"/></label><label className="block"><span className="field-label">Dung lượng (kWh)</span><input className="field mt-2" type="number" min="0.1" step="0.01" value={capacity} onChange={e=>setCapacity(e.target.value)} placeholder="Ví dụ 2.4"/></label><label className="block"><span className="field-label">Sức khỏe pin (%) · không bắt buộc</span><input className="field mt-2" type="number" min="1" max="100" value={health} onChange={e=>setHealth(e.target.value)} placeholder="Chỉ nhập khi đã đo thực tế"/></label><button disabled={busy||!stationId} className="btn-primary w-full">Thêm pin đầy vào kho</button></form>
        <form onSubmit={installBattery} className="panel space-y-4 p-6"><div><p className="eyebrow">LẮP PIN BAN ĐẦU</p><h2 className="mt-2 text-lg font-extrabold">Gắn pin cho xe</h2></div><label className="block"><span className="field-label">Xe chưa có pin</span><select className="field mt-2" required value={installVehicleId} onChange={e=>setInstallVehicleId(e.target.value)}><option value="">Chọn xe</option>{unassignedVehicles.map(v=><option key={v.id} value={v.id}>{v.code} · {v.model?.name}</option>)}</select></label><label className="block"><span className="field-label">Pin đầy trong kho</span><select className="field mt-2" required value={installBatteryId} onChange={e=>setInstallBatteryId(e.target.value)}><option value="">Chọn pin</option>{fullBatteries.map(b=><option key={b.id} value={b.id}>{b.serialNumber}</option>)}</select></label><button disabled={busy||!installVehicleId||!installBatteryId} className="btn-primary w-full">Xác nhận lắp pin</button></form>
        <form onSubmit={swapBattery} className="panel space-y-4 border-emerald-200 p-6"><div><p className="eyebrow">ĐỔI PIN NHANH</p><h2 className="mt-2 text-lg font-extrabold">Thay pin đầy cho xe</h2><p className="mt-2 text-sm text-slate-500">Pin cũ tự chuyển sang chờ sạc, pin mới được gắn vào xe trong cùng giao dịch.</p></div><label className="block"><span className="field-label">Xe cần đổi pin</span><select className="field mt-2" required value={swapVehicleId} onChange={e=>setSwapVehicleId(e.target.value)}><option value="">Chọn xe</option>{scopedVehicles.filter(v=>batteries.some(b=>b.vehicleId===v.id&&b.status==='INSTALLED')).map(v=><option key={v.id} value={v.id}>{v.code} · {v.model?.name}</option>)}</select></label><label className="block"><span className="field-label">Pin đầy thay thế</span><select className="field mt-2" required value={swapBatteryId} onChange={e=>setSwapBatteryId(e.target.value)}><option value="">Chọn pin đầy tại trạm</option>{fullBatteries.map(b=><option key={b.id} value={b.id}>{b.serialNumber} · {b.healthPercent===null?'Chưa đo sức khỏe':b.healthPercent+'% sức khỏe'}</option>)}</select></label><label className="block"><span className="field-label">Ghi chú</span><input className="field mt-2" maxLength={500} value={swapNote} onChange={e=>setSwapNote(e.target.value)} placeholder="Tình trạng pin cũ..."/></label><button disabled={busy||!swapVehicleId||!swapBatteryId} className="btn-primary w-full">Xác nhận đổi pin</button></form>
      </div>
      <section className="panel mt-7 p-6">
        <p className="eyebrow">LUÂN CHUYỂN KHO</p><h2 className="mt-2 text-xl font-extrabold">Điều chuyển pin giữa các trạm</h2>
        <p className="mt-2 text-sm text-slate-500">Chọn pin đầy trong kho trạm nguồn. Pin được khóa khỏi thao tác lắp/đổi ngay khi tạo phiếu và chỉ trở lại tồn kho sau khi tiếp nhận hoặc hủy phiếu trước bàn giao.</p>
        <form onSubmit={createTransfer} className="mt-5 grid gap-4 md:grid-cols-2">
          <label><span className="field-label">Trạm gửi</span><select className="field mt-2" value={stationId} disabled={user?.role==='STAFF'} onChange={e=>{setStationId(e.target.value);setTransferBatteryIds([]);}} required><option value="">Chọn trạm nguồn</option>{stations.filter(s=>s.isActive!==false).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <label><span className="field-label">Trạm nhận</span><select className="field mt-2" value={transferDestination} onChange={e=>setTransferDestination(e.target.value)} required><option value="">Chọn trạm đích</option>{stations.filter(s=>s.isActive!==false&&String(s.id)!==stationId).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <div className="md:col-span-2"><p className="field-label">Pin FULL có thể điều chuyển</p><div className="mt-2 grid max-h-44 gap-2 overflow-y-auto rounded-xl border border-slate-200 p-3 sm:grid-cols-2 lg:grid-cols-3">{fullBatteries.filter(b=>String(b.stationId)===stationId).map(b=><label key={b.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={transferBatteryIds.includes(b.id)} onChange={e=>setTransferBatteryIds(ids=>e.target.checked?[...ids,b.id]:ids.filter(id=>id!==b.id))}/><span>{b.serialNumber} · {b.healthPercent===null?'Chưa đo':b.healthPercent+'%'}</span></label>)}{!fullBatteries.some(b=>String(b.stationId)===stationId)&&<p className="text-sm text-slate-400">Trạm nguồn chưa có pin đầy khả dụng.</p>}</div><p className="mt-1 text-xs text-slate-500">Đã chọn {transferBatteryIds.length} pin.</p></div>
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
      <section className="panel mt-7 p-6">
        <p className="eyebrow">CHI PHÍ VÒNG ĐỜI PIN</p><h2 className="mt-2 text-xl font-extrabold">Sổ chi phí vận hành</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4"><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Tổng chi phí</p><p className="mt-1 text-xl font-extrabold">{(costSummary?.total??0).toLocaleString('vi-VN')} ₫</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Số khoản</p><p className="mt-1 text-xl font-extrabold">{costSummary?.count??0}</p></div>{(costSummary?.byType??[]).map(x=><div key={x.costType} className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">{{CHARGING:'Sạc điện',MAINTENANCE:'Bảo dưỡng',REPLACEMENT:'Thay thế',OTHER:'Khác'}[x.costType]??x.costType}</p><p className="mt-1 text-lg font-bold">{x.amount.toLocaleString('vi-VN')} ₫</p></div>)}</div>
        <div className="mt-5 grid gap-3 md:grid-cols-5"><label><span className="field-label">Từ ngày (UTC)</span><input className="field mt-2" type="date" value={costFrom} onChange={e=>setCostFrom(e.target.value)}/></label><label><span className="field-label">Đến ngày (UTC)</span><input className="field mt-2" type="date" value={costTo} onChange={e=>setCostTo(e.target.value)}/></label><label><span className="field-label">Loại chi phí</span><select className="field mt-2" value={costFilterType} onChange={e=>setCostFilterType(e.target.value)}><option value="">Tất cả</option><option value="CHARGING">Sạc điện</option><option value="MAINTENANCE">Bảo dưỡng</option><option value="REPLACEMENT">Thay thế</option><option value="OTHER">Khác</option></select></label><label><span className="field-label">Lọc theo pin</span><select className="field mt-2" value={costBatteryId} onChange={e=>setCostBatteryId(e.target.value)}><option value="">Tất cả pin</option>{batteries.map(b=><option key={b.id} value={b.id}>{b.serialNumber}</option>)}</select></label><div className="flex items-end"><button className="btn-outline w-full" onClick={exportOperatingCosts} disabled={!operatingCosts.length}>Xuất CSV ({operatingCosts.length})</button></div></div>
        <form onSubmit={recordOperatingCost} className="mt-5 rounded-xl border border-slate-200 p-4"><h3 className="font-bold">Ghi nhận khoản chi mới</h3><div className="mt-3 grid gap-3 md:grid-cols-5"><label><span className="field-label">Pin</span><select required className="field mt-2" value={newCostBatteryId} onChange={e=>setNewCostBatteryId(e.target.value)}><option value="">Chọn pin</option>{batteries.map(b=><option key={b.id} value={b.id}>{b.serialNumber}</option>)}</select></label><label><span className="field-label">Loại</span><select className="field mt-2" value={newCostType} onChange={e=>setNewCostType(e.target.value)}><option value="CHARGING">Sạc điện</option><option value="REPLACEMENT">Thay thế</option><option value="OTHER">Khác</option></select></label>{newCostType==='CHARGING'?<><label><span className="field-label">Điện năng (kWh)</span><input required className="field mt-2" type="number" min="0.001" step="0.001" value={costEnergy} onChange={e=>setCostEnergy(e.target.value)}/></label><label><span className="field-label">Đơn giá (₫/kWh)</span><input required className="field mt-2" type="number" min="0" step="0.01" value={costUnitPrice} onChange={e=>setCostUnitPrice(e.target.value)}/></label></>:<label><span className="field-label">Thành tiền (₫)</span><input required className="field mt-2" type="number" min="0" step="0.01" value={costAmount} onChange={e=>setCostAmount(e.target.value)}/></label>}<label><span className="field-label">Ngày phát sinh</span><input required className="field mt-2" type="datetime-local" value={costOccurredAt} onChange={e=>setCostOccurredAt(e.target.value)}/></label><label className="md:col-span-2"><span className="field-label">Ghi chú</span><input className="field mt-2" maxLength={500} value={costNote} onChange={e=>setCostNote(e.target.value)} placeholder="Hóa đơn điện, thay cell, vật tư..."/></label><div className="flex items-end"><button disabled={busy||!newCostBatteryId||(newCostType==='CHARGING'?(!costEnergy||!costUnitPrice):costAmount==='')} className="btn-primary w-full">Lưu khoản chi</button></div></div><p className="mt-2 text-xs text-slate-500">Chi phí bảo dưỡng được tự động ghi sổ khi hoàn tất phiếu, tránh nhập trùng. Các khoản đã ghi nhận không thể sửa trực tiếp.</p></form>
        <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-3 py-3">Ngày</th><th className="px-3 py-3">Pin / Trạm</th><th className="px-3 py-3">Loại</th><th className="px-3 py-3">Điện năng</th><th className="px-3 py-3">Thành tiền</th><th className="px-3 py-3">Ghi chú</th></tr></thead><tbody className="divide-y divide-slate-100">{operatingCosts.map(x=><tr key={x.id}><td className="px-3 py-3">{new Date(x.occurredAt).toLocaleDateString('vi-VN')}</td><td className="px-3 py-3">{x.battery?.serialNumber??'Pin #'+x.batteryId}<p className="text-xs text-slate-500">{x.station?.name??'Trạm #'+x.stationId}</p></td><td className="px-3 py-3">{{CHARGING:'Sạc điện',MAINTENANCE:'Bảo dưỡng',REPLACEMENT:'Thay thế',OTHER:'Khác'}[x.costType]}</td><td className="px-3 py-3">{x.energyKwh?x.energyKwh+' kWh':'—'}</td><td className="px-3 py-3 font-semibold">{Number(x.amount).toLocaleString('vi-VN')} ₫</td><td className="px-3 py-3">{x.note??'—'}</td></tr>)}{!operatingCosts.length&&<tr><td colSpan={6} className="px-3 py-6 text-center text-slate-400">Chưa có khoản chi trong bộ lọc.</td></tr>}</tbody></table></div>
        {!!costSummary?.byBattery.length&&<div className="mt-5"><h3 className="font-bold">Top pin có chi phí cao</h3><div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">{costSummary.byBattery.map(b=><div key={b.batteryId} className="rounded-lg border border-slate-100 p-3"><p className="text-sm font-semibold">{b.serialNumber}</p><p className="mt-1 text-sm">{b.amount.toLocaleString('vi-VN')} ₫</p><p className="text-xs text-slate-500">{b.count} khoản chi</p></div>)}</div></div>}
        {!!costSummary?.monthly.length&&<div className="mt-5"><h3 className="font-bold">Chi phí theo tháng</h3><div className="mt-2 grid gap-2 sm:grid-cols-3 md:grid-cols-6">{costSummary.monthly.slice(-6).map(m=><div key={m.month} className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">{m.month}</p><p className="mt-1 text-sm font-bold">{m.amount.toLocaleString('vi-VN')} ₫</p></div>)}</div></div>}
      </section>
      <section className="panel mt-7 p-6">
        <p className="eyebrow">TÌNH TRẠNG & TUỔI THỌ PIN</p><h2 className="mt-2 text-xl font-extrabold">Sức khỏe pin</h2>
        {healthSummary&&<><div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">{[{label:'Tổng số',value:healthSummary.total},{label:'Tốt',value:healthSummary.healthy},{label:'Theo dõi',value:healthSummary.watch},{label:'Cần xử lý',value:healthSummary.critical},{label:'Ngừng sử dụng',value:healthSummary.retired},{label:'Chưa đo',value:healthSummary.unknown}].map(x=><div key={x.label} className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">{x.label}</p><p className="mt-1 text-2xl font-extrabold">{x.value}</p></div>)}</div><p className="mt-3 text-xs text-slate-500">Ngưỡng cấu hình: cảnh báo dưới {healthSummary.thresholds.warningPercent}% · nghiêm trọng dưới hoặc bằng {healthSummary.thresholds.criticalPercent}% · cảnh báo từ {healthSummary.thresholds.cycleWarning} chu kỳ sạc</p></>}
        <form onSubmit={recordBatteryHealth} className="mt-5 grid gap-3 md:grid-cols-4"><label><span className="field-label">Pin cần đánh giá</span><select className="field mt-2" required value={healthBatteryId} onChange={e=>{setHealthBatteryId(e.target.value);const b=batteries.find(x=>String(x.id)===e.target.value);setHealthValue(b?.healthPercent==null?'':String(b.healthPercent));}}><option value="">Chọn pin</option>{batteries.filter(b=>b.status!=='RETIRED'&&b.status!=='TRANSFERRING').map(b=><option key={b.id} value={b.id}>{b.serialNumber} · hiện tại {b.healthPercent===null?'chưa đo':b.healthPercent+'%'}</option>)}</select></label><label><span className="field-label">Sức khỏe đo được (%)</span><input className="field mt-2" type="number" min="1" max="100" required value={healthValue} onChange={e=>setHealthValue(e.target.value)}/></label><label className="md:col-span-1"><span className="field-label">Ghi chú kiểm tra</span><input className="field mt-2" maxLength={500} value={healthNote} onChange={e=>setHealthNote(e.target.value)} placeholder="Kết quả đo, dấu hiệu bất thường..."/></label><div className="flex items-end"><button disabled={busy||!healthBatteryId||!healthValue} className="btn-primary w-full">Lưu đánh giá</button></div></form>
        <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-3 py-3">Pin</th><th className="px-3 py-3">Sức khỏe</th><th className="px-3 py-3">Chu kỳ</th><th className="px-3 py-3">Đánh giá</th><th className="px-3 py-3">Lịch sử</th></tr></thead><tbody className="divide-y divide-slate-100">{batteries.map(b=>{const level=b.status==='RETIRED'?'Ngừng sử dụng':b.healthPercent===null?'Chưa đo':b.healthPercent<= (healthSummary?.thresholds.criticalPercent??65)?'Nghiêm trọng':b.healthPercent<=(healthSummary?.thresholds.warningPercent??80)||b.cycleCount>=(healthSummary?.thresholds.cycleWarning??500)?'Theo dõi':'Tốt';return <tr key={b.id}><td className="px-3 py-3 font-semibold">{b.serialNumber}</td><td className="px-3 py-3">{b.healthPercent===null?'Chưa đo':b.healthPercent+'%'}</td><td className="px-3 py-3">{b.cycleCount}</td><td className="px-3 py-3">{level}</td><td className="px-3 py-3"><div className="flex gap-3"><button className="text-sm font-bold text-emerald-700 underline" onClick={()=>{setHealthBatteryId(String(b.id));setHealthValue(b.healthPercent===null?'':String(b.healthPercent));}}>Đánh giá lại</button><button className="text-sm font-bold text-sky-700 underline" onClick={()=>void loadHealthHistory(b.id)}>Lịch sử</button></div></td></tr>})}</tbody></table></div>{historyBatteryId!==null&&<div className="mt-4 rounded-xl bg-slate-50 p-4"><div className="flex items-center justify-between"><strong>Lịch sử đánh giá · {batteries.find(b=>b.id===historyBatteryId)?.serialNumber??'Pin #'+historyBatteryId}</strong><button className="text-sm underline" onClick={()=>setHistoryBatteryId(null)}>Đóng</button></div><div className="mt-3 divide-y divide-slate-200">{healthHistory.map(h=><div key={h.id} className="py-2 text-sm"><strong>{h.healthPercent}% sức khỏe · {h.cycleCount} chu kỳ</strong><p className="text-xs text-slate-500">{new Date(h.createdAt).toLocaleString('vi-VN')} · {h.recordedBy?.fullName??'Nhân viên #'+h.recordedBy?.id}</p>{h.note&&<p className="text-sm text-slate-600">{h.note}</p>}</div>)}{!healthHistory.length&&<p className="py-3 text-sm text-slate-400">Chưa có lịch sử đánh giá.</p>}</div></div>}
      </section>
      <section className="panel mt-7 p-6">
        <p className="eyebrow">BẢO DƯỠNG ĐỊNH KỲ</p><h2 className="mt-2 text-xl font-extrabold">Phiếu bảo dưỡng pin</h2>
        <form onSubmit={createMaintenanceTask} className="mt-5 grid gap-3 md:grid-cols-5"><label><span className="field-label">Pin</span><select className="field mt-2" required value={taskBatteryId} onChange={e=>setTaskBatteryId(e.target.value)}><option value="">Chọn pin</option>{batteries.filter(b=>b.status!=='RETIRED').map(b=><option key={b.id} value={b.id}>{b.serialNumber}</option>)}</select></label><label><span className="field-label">Loại công việc</span><select className="field mt-2" value={taskType} onChange={e=>setTaskType(e.target.value)}><option value="CAPACITY_TEST">Đo dung lượng</option><option value="CONNECTOR_CHECK">Kiểm tra đầu nối</option><option value="BMS_DIAGNOSTIC">Chẩn đoán BMS</option><option value="CLEANING">Vệ sinh</option><option value="REPAIR">Sửa chữa</option><option value="OTHER">Khác</option></select></label><label><span className="field-label">Ưu tiên</span><select className="field mt-2" value={taskPriority} onChange={e=>setTaskPriority(e.target.value)}><option value="LOW">Thấp</option><option value="NORMAL">Bình thường</option><option value="HIGH">Cao</option><option value="URGENT">Khẩn cấp</option></select></label><label><span className="field-label">Hạn xử lý</span><input className="field mt-2" type="datetime-local" value={taskDueAt} onChange={e=>setTaskDueAt(e.target.value)}/></label><label className="md:col-span-1"><span className="field-label">Mô tả công việc</span><input className="field mt-2" maxLength={1000} required value={taskDescription} onChange={e=>setTaskDescription(e.target.value)} placeholder="Nội dung cần kiểm tra..."/></label><div className="md:col-span-5"><button disabled={busy||!taskBatteryId||!taskDescription.trim()} className="btn-primary">Tạo phiếu bảo dưỡng</button></div></form>
        <div className="mt-5 divide-y divide-slate-100">{maintenanceTasks.map(t=><div key={t.id} className="py-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><strong>#{t.id} · {t.battery?.serialNumber??'Pin #'+t.batteryId} · {t.taskType}</strong><p className="mt-1 text-sm text-slate-600">{t.description}</p><p className="mt-1 text-xs text-slate-500">Ưu tiên {t.priority} · {t.dueAt?'Hạn '+new Date(t.dueAt).toLocaleString('vi-VN'):'Chưa đặt hạn'} · {({OPEN:'Chờ xử lý',IN_PROGRESS:'Đang thực hiện',COMPLETED:'Hoàn tất',CANCELLED:'Đã hủy'} as Record<string,string>)[t.status]}</p>{t.result&&<p className="mt-2 text-sm text-emerald-700">Kết quả: {t.result} · Chi phí: {t.cost??'Chưa ghi nhận'}</p>}</div><div className="flex flex-wrap gap-2">{t.status==='OPEN'&&<><button disabled={busy} className="btn-outline" onClick={()=>void maintenanceAction(t.id,'start')}>Bắt đầu</button><button disabled={busy} className="btn-outline" onClick={()=>void maintenanceAction(t.id,'cancel')}>Hủy</button></>}{t.status==='IN_PROGRESS'&&<button disabled={busy} className="btn-primary" onClick={()=>setCompletionId(completionId===t.id?null:t.id)}>Hoàn tất</button>}</div></div>{completionId===t.id&&<div className="mt-3 grid gap-3 md:grid-cols-3"><input className="field md:col-span-2" maxLength={2000} required placeholder="Kết quả bảo dưỡng bắt buộc" value={completionResult} onChange={e=>setCompletionResult(e.target.value)}/><input className="field" type="number" min="0" step="0.01" placeholder="Chi phí (VNĐ)" value={completionCost} onChange={e=>setCompletionCost(e.target.value)}/><button disabled={busy||!completionResult.trim()||(completionCost!==''&&Number(completionCost)<0)} className="btn-primary md:col-span-3" onClick={()=>void maintenanceAction(t.id,'complete')}>Lưu kết quả và hoàn tất</button></div>}</div>)}{!maintenanceTasks.length&&<p className="py-5 text-sm text-slate-400">Chưa có phiếu bảo dưỡng.</p>}</div>
      </section>
      <section className="panel mt-7 overflow-hidden"><div className="p-6"><p className="eyebrow">THEO DÕI TỪNG VIÊN PIN</p><h2 className="mt-2 text-xl font-extrabold">Danh sách pin</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-6 py-4">Serial</th><th className="px-4 py-4">Trạng thái</th><th className="px-4 py-4">Xe / Trạm</th><th className="px-4 py-4">Sức khỏe</th><th className="px-4 py-4">Chu kỳ sạc</th><th className="px-6 py-4">Thao tác</th></tr></thead><tbody className="divide-y divide-slate-100">{batteries.map(b=><tr key={b.id}><td className="px-6 py-4 font-bold">{b.serialNumber}<p className="text-xs font-normal text-slate-400">{b.capacityKwh??'—'} kWh</p></td><td className="px-4 py-4">{statusLabel[b.status]}</td><td className="px-4 py-4">{b.vehicle?.code??b.station?.name??'—'}</td><td className="px-4 py-4">{b.healthPercent===null?'Chưa đo':b.healthPercent+'%'}</td><td className="px-4 py-4">{b.cycleCount}</td><td className="px-6 py-4"><div className="flex flex-wrap gap-2">{b.status==='CHARGING'&&<><button disabled={busy} className="text-sm font-bold text-emerald-700 underline" onClick={()=>void act(()=>api.patch('/batteries/'+b.id+'/complete-charging',{note:'Nhân viên xác nhận đã sạc đầy'}),'Đã xác nhận pin sạc đầy. Chu kỳ sạc được ghi nhận.')}>Sạc đầy</button><button disabled={busy} className="text-sm font-bold text-amber-700 underline" onClick={()=>void act(()=>api.patch('/batteries/'+b.id+'/status',{status:'MAINTENANCE',note:'Dừng sạc để kiểm tra bảo dưỡng'}),'Đã chuyển pin sang bảo dưỡng.')}>Bảo dưỡng</button></>}{b.status==='FULL'&&<><button disabled={busy} className="text-sm font-bold text-amber-700 underline" onClick={()=>void act(()=>api.patch('/batteries/'+b.id+'/status',{status:'MAINTENANCE',note:'Chuyển pin đi kiểm tra'}),'Đã chuyển pin sang bảo dưỡng.')}>Bảo dưỡng</button><button disabled={busy} className="text-sm font-bold text-rose-700 underline" onClick={()=>void act(()=>api.patch('/batteries/'+b.id+'/status',{status:'RETIRED',note:'Ngừng sử dụng pin'}),'Đã ngừng sử dụng pin.')}>Ngừng dùng</button></>}{b.status==='MAINTENANCE'&&<><button disabled={busy} className="text-sm font-bold text-emerald-700 underline" onClick={()=>void act(()=>api.patch('/batteries/'+b.id+'/status',{status:'FULL',note:'Đã kiểm tra, đủ điều kiện sử dụng'}),'Pin đã được đưa trở lại kho sẵn sàng.')}>Đưa vào kho</button><button disabled={busy} className="text-sm font-bold text-rose-700 underline" onClick={()=>void act(()=>api.patch('/batteries/'+b.id+'/status',{status:'RETIRED',note:'Không đạt điều kiện sử dụng'}),'Đã ngừng sử dụng pin.')}>Ngừng dùng</button></>}</div></td></tr>)}{!batteries.length&&<tr><td colSpan={6} className="px-6 py-8 text-center text-slate-400">Chưa có dữ liệu pin tại trạm.</td></tr>}</tbody></table></div></section>
      <section className="panel mt-7 overflow-hidden">
        <div className="p-6"><p className="eyebrow">VÒNG ĐỜI SẠC</p><h2 className="mt-2 text-xl font-extrabold">Lịch sử sạc pin</h2><p className="mt-2 text-sm text-slate-500">Theo dõi thời điểm bắt đầu, hoàn tất và nhân viên phụ trách từng phiên sạc.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <label><span className="field-label">Pin</span><select className="field mt-1" value={chargeHistoryBatteryId} onChange={e=>{setChargeHistoryBatteryId(e.target.value);setChargeHistoryPage(1);}}><option value="">Tất cả pin</option>{batteries.map(b=><option key={b.id} value={b.id}>{b.serialNumber}</option>)}</select></label>
            <label><span className="field-label">Từ ngày</span><input className="field mt-1" type="date" value={chargeHistoryFrom} onChange={e=>{setChargeHistoryFrom(e.target.value);setChargeHistoryPage(1);}}/></label>
            <label><span className="field-label">Đến ngày</span><input className="field mt-1" type="date" min={chargeHistoryFrom||undefined} value={chargeHistoryTo} onChange={e=>{setChargeHistoryTo(e.target.value);setChargeHistoryPage(1);}}/></label>
          </div>
          <p className="mt-3 text-xs text-slate-500">{chargeHistoryTotal} phiên sạc · {stationId?'Trong trạm đang chọn':'Toàn hệ thống'}</p>
        </div>
        <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-6 py-4">Pin / Trạm</th><th className="px-4 py-4">Bắt đầu sạc</th><th className="px-4 py-4">Kết thúc sạc</th><th className="px-4 py-4">Người thực hiện</th><th className="px-6 py-4">Ghi chú</th></tr></thead><tbody className="divide-y divide-slate-100">{chargeHistoryLoading?<tr><td colSpan={5} className="px-6 py-6 text-center text-slate-500">Đang tải lịch sử sạc...</td></tr>:chargeHistory.map(session=><tr key={session.id}><td className="px-6 py-4 font-bold">{session.battery?.serialNumber??'Pin #'+session.batteryId}<p className="mt-1 text-xs font-normal text-slate-500">{session.station?.name??'—'}</p></td><td className="px-4 py-4">{new Date(session.startedAt).toLocaleString('vi-VN')}<p className="mt-1 text-xs text-slate-400">{session.startedBy?.fullName??'Dữ liệu lịch sử cũ'}</p></td><td className="px-4 py-4">{session.completedAt?new Date(session.completedAt).toLocaleString('vi-VN'):<span className="font-semibold text-amber-700">Đang sạc</span>}</td><td className="px-4 py-4">{session.startedBy?.fullName??'—'}{session.completedBy&&<p className="mt-1 text-xs text-slate-400">Hoàn tất: {session.completedBy.fullName}</p>}</td><td className="max-w-64 px-6 py-4 text-slate-500">{session.completionNote||session.startNote||'—'}</td></tr>)}{!chargeHistoryLoading&&!chargeHistory.length&&<tr><td colSpan={5} className="px-6 py-8 text-center text-slate-400">Chưa có lịch sử sạc phù hợp.</td></tr>}</tbody></table></div>
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-6 py-4 text-sm"><span className="text-slate-500">Trang {chargeHistoryPages?chargeHistoryPage:0}/{chargeHistoryPages}</span><div className="flex gap-2"><button className="btn-outline" disabled={chargeHistoryPage<=1||chargeHistoryLoading} onClick={()=>setChargeHistoryPage(p=>p-1)}>Trước</button><button className="btn-outline" disabled={chargeHistoryPage>=chargeHistoryPages||chargeHistoryLoading} onClick={()=>setChargeHistoryPage(p=>p+1)}>Sau</button></div></div>
      </section>
      <section className="panel mt-7 overflow-hidden"><div className="p-6"><p className="eyebrow">KHÁCH ĐÃ GIỮ PIN TRƯỚC</p><h2 className="mt-2 text-xl font-extrabold">Lượt giữ pin tại trạm</h2><p className="mt-2 text-sm text-slate-500">Chỉ xác nhận khi khách có mặt và kiểm tra đúng xe thuê. Lượt giữ tự hết hiệu lực sau 10 phút.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-6 py-4">Mã giữ</th><th className="px-4 py-4">Xe / Đơn thuê</th><th className="px-4 py-4">Trạng thái</th><th className="px-4 py-4">Hết hạn</th><th className="px-6 py-4">Xác nhận đổi</th></tr></thead><tbody className="divide-y divide-slate-100">{reservations.map(r=><tr key={r.id}><td className="px-6 py-4 font-bold">#{r.id}<p className="text-xs font-normal text-slate-400">Khách #{r.customerId}</p></td><td className="px-4 py-4">{r.vehicle?.code??'Xe #'+r.vehicleId}<p className="text-xs text-slate-400">Đơn thuê #{r.bookingId}</p></td><td className="px-4 py-4">{r.status==='RESERVED'&&new Date(r.expiresAt)<=new Date()?'Hết hạn':({RESERVED:'Đang giữ',REDEEMED:'Đã đổi',CANCELLED:'Đã hủy',EXPIRED:'Hết hạn'} as Record<string,string>)[r.status]}</td><td className="px-4 py-4">{new Date(r.expiresAt).toLocaleTimeString('vi-VN')}</td><td className="px-6 py-4">{r.status==='RESERVED'&&new Date(r.expiresAt)>new Date()?<div className="flex items-center gap-2"><select className="field min-w-40" value={redeemBatteryIds[r.id]??''} onChange={e=>setRedeemBatteryIds(v=>({...v,[r.id]:e.target.value}))}><option value="">Chọn pin đầy</option>{fullBatteries.map(b=><option key={b.id} value={b.id}>{b.serialNumber}</option>)}</select><button disabled={busy||!redeemBatteryIds[r.id]} className="btn-primary whitespace-nowrap" onClick={()=>void redeemReservation(r.id)}>Đổi pin</button></div>:<span className="text-slate-400">—</span>}</td></tr>)}{!reservations.length&&<tr><td colSpan={5} className="px-6 py-8 text-center text-slate-400">Chưa có lượt giữ pin tại trạm.</td></tr>}</tbody></table></div></section>
      <section className="panel mt-7 overflow-hidden">
      <div className="p-6"><p className="eyebrow">NHẬT KÝ ĐỔI PIN</p><h2 className="mt-2 text-xl font-extrabold">Lịch sử giao dịch</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label><span className="field-label">Serial pin</span><input className="field mt-1" value={historySearch} onChange={e=>{setHistorySearch(e.target.value);setHistoryPage(1);}} placeholder="Pin tháo ra hoặc pin lắp vào"/></label>
          <label><span className="field-label">Xe</span><select className="field mt-1" value={historyVehicleId} onChange={e=>{setHistoryVehicleId(e.target.value);setHistoryPage(1);}}><option value="">Tất cả xe</option>{historyVehicles.map(v=><option key={v.id} value={v.id}>{v.code}{v.licensePlate?' · '+v.licensePlate:''}</option>)}</select></label>
          <label><span className="field-label">Từ ngày</span><input className="field mt-1" type="date" value={historyFrom} onChange={e=>{setHistoryFrom(e.target.value);setHistoryPage(1);}}/></label>
          <label><span className="field-label">Đến ngày</span><input className="field mt-1" type="date" min={historyFrom||undefined} value={historyTo} onChange={e=>{setHistoryTo(e.target.value);setHistoryPage(1);}}/></label>
        </div>
        <p className="mt-3 text-xs text-slate-500">{historyTotal} giao dịch · {stationId?'Trong trạm đang chọn':'Toàn hệ thống'}</p>
      </div>
      <div className="divide-y divide-slate-100">{historyLoading?<p className="px-6 py-5 text-sm text-slate-500">Đang tải lịch sử...</p>:history.map(item=><div key={item.id} className="flex flex-wrap justify-between gap-3 px-6 py-4 text-sm"><div><strong>{item.vehicle?.code??'Xe #'+item.vehicleId}</strong><p className="mt-1 text-xs text-slate-500">{item.removedBattery?.serialNumber} → {item.installedBattery?.serialNumber} · {item.station?.name}</p><p className="mt-1 text-xs text-slate-500">Thực hiện: {item.performedBy?.fullName??'Nhân viên #'+item.performedById}</p>{item.note&&<p className="mt-1 text-xs text-slate-500">{item.note}</p>}</div><time className="text-xs text-slate-400">{new Date(item.createdAt).toLocaleString('vi-VN')}</time></div>)}{!historyLoading&&!history.length&&<p className="px-6 pb-7 text-sm text-slate-400">Không tìm thấy giao dịch phù hợp.</p>}</div>
      <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-6 py-4 text-sm"><span className="text-slate-500">Trang {historyPages?historyPage:0}/{historyPages}</span><div className="flex gap-2"><button className="btn-outline" disabled={historyPage<=1||historyLoading} onClick={()=>setHistoryPage(p=>p-1)}>Trước</button><button className="btn-outline" disabled={historyPage>=historyPages||historyLoading} onClick={()=>setHistoryPage(p=>p+1)}>Sau</button></div></div>
    </section>
    </>}
  </div>;
}
