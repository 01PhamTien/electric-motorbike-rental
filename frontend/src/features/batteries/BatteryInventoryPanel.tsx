import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../auth/AuthContext';

type BatteryStatus='FULL'|'INSTALLED'|'CHARGING'|'MAINTENANCE'|'RETIRED'|'TRANSFERRING';
type BatteryRow={id:number;serialNumber:string;status:BatteryStatus;stationId:number;station?:{name:string};vehicleId:number|null;vehicle?:{code:string;licensePlate?:string|null}|null;healthPercent:number|null;cycleCount:number;capacityKwh:string|null};
type Totals={total:number;FULL:number;INSTALLED:number;CHARGING:number;MAINTENANCE:number;RETIRED:number;TRANSFERRING:number};
type Summary={totals:Totals;stations:Array<Totals&{stationId:number;stationName:string}>};
type PageResult={items:BatteryRow[];total:number;page:number;limit:number;totalPages:number};
const labels:Record<BatteryStatus,string>={FULL:'Sẵn sàng',INSTALLED:'Đang lắp',CHARGING:'Đang sạc',MAINTENANCE:'Bảo dưỡng',RETIRED:'Ngừng sử dụng',TRANSFERRING:'Đang điều chuyển'};
const empty:Totals={total:0,FULL:0,INSTALLED:0,CHARGING:0,MAINTENANCE:0,RETIRED:0,TRANSFERRING:0};

export function BatteryInventoryPanel({stationId}:{stationId:string}) {
  const {user}=useAuth();
  const [summary,setSummary]=useState<Summary|null>(null);
  const [result,setResult]=useState<PageResult>({items:[],total:0,page:1,limit:10,totalPages:0});
  const [search,setSearch]=useState('');
  const [status,setStatus]=useState('');
  const [page,setPage]=useState(1);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  useEffect(()=>{setPage(1);},[stationId,status,search]);
  useEffect(()=>{
    let active=true;
    const params=stationId?{stationId:Number(stationId)}:{};
    api.get('/batteries/inventory/summary',{params}).then(({data})=>{if(active)setSummary(data);})
      .catch(()=>{if(active)setError('Không tải được tổng hợp tồn kho pin.');});
    return()=>{active=false;};
  },[stationId]);
  useEffect(()=>{
    let active=true;
    const params:Record<string,string|number>={page,limit:10};
    if(stationId)params.stationId=Number(stationId);
    if(status)params.status=status;
    if(search.trim())params.search=search.trim();
    setLoading(true);setError('');
    api.get('/batteries/inventory',{params}).then(({data})=>{
      if(active)setResult({items:Array.isArray(data?.items)?data.items:[],total:Number(data?.total)||0,page:Number(data?.page)||page,limit:Number(data?.limit)||10,totalPages:Number(data?.totalPages)||0});
    }).catch(()=>{if(active)setError('Không tải được danh sách tồn kho pin.');})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[stationId,status,search,page]);
  const totals=summary?.totals??empty;
  return <section className="panel mt-7 overflow-hidden">
    <div className="p-6">
      <p className="eyebrow">TỔNG QUAN KHO PIN</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-extrabold">Tồn kho theo trạng thái</h2><p className="mt-1 text-sm text-slate-500">Dữ liệu tổng hợp trực tiếp từ các viên pin đã ghi nhận.</p></div><strong className="text-2xl">{totals.total} pin</strong></div>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {([{key:'FULL',label:'Sẵn sàng'},{key:'INSTALLED',label:'Đang lắp'},{key:'CHARGING',label:'Đang sạc'},{key:'MAINTENANCE',label:'Bảo dưỡng'},{key:'RETIRED',label:'Ngừng dùng'},{key:'TRANSFERRING',label:'Điều chuyển'}] as const).map(x=><div key={x.key} className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">{x.label}</p><strong className="mt-1 block text-xl">{totals[x.key]}</strong></div>)}
      </div>
    </div>
    {user?.role==='ADMIN'&&summary?.stations.length? <div className="border-t border-slate-100 p-6"><h3 className="font-bold">Phân bổ theo trạm</h3><div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{summary.stations.map(station=><div key={station.stationId} className="rounded-xl border border-slate-100 p-4"><div className="flex justify-between gap-3"><strong className="text-sm">{station.stationName}</strong><span className="text-sm font-bold">{station.total}</span></div><p className="mt-2 text-xs text-slate-500">Sẵn sàng {station.FULL} · Đang lắp {station.INSTALLED} · Sạc {station.CHARGING} · Bảo dưỡng {station.MAINTENANCE} · Điều chuyển {station.TRANSFERRING}</p></div>)}</div></div>:null}
    <div className="border-t border-slate-100 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h3 className="font-extrabold">Danh sách pin có phân trang</h3><p className="mt-1 text-xs text-slate-500">{result.total} kết quả</p></div><div className="flex flex-wrap gap-2"><input aria-label="Tìm serial hoặc xe" className="field min-w-52" placeholder="Tìm serial, mã xe..." value={search} onChange={e=>setSearch(e.target.value)}/><select aria-label="Lọc trạng thái pin" className="field min-w-40" value={status} onChange={e=>setStatus(e.target.value)}><option value="">Tất cả trạng thái</option>{Object.entries(labels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></div></div>
      {error&&<p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-4 py-3">Serial</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3">Xe / Trạm</th><th className="px-4 py-3">Sức khỏe</th><th className="px-4 py-3">Chu kỳ sạc</th></tr></thead><tbody className="divide-y divide-slate-100">{loading?<tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Đang tải...</td></tr>:result.items.map(b=><tr key={b.id}><td className="px-4 py-3 font-semibold">{b.serialNumber}<p className="text-xs font-normal text-slate-400">{b.capacityKwh??'—'} kWh</p></td><td className="px-4 py-3">{labels[b.status]}</td><td className="px-4 py-3">{b.vehicle?.code??b.station?.name??'—'}{b.vehicle?.licensePlate&&<p className="text-xs text-slate-400">{b.vehicle.licensePlate}</p>}</td><td className="px-4 py-3">{b.healthPercent===null?'Chưa đo':b.healthPercent+'%'}</td><td className="px-4 py-3">{b.cycleCount}</td></tr>)}{!loading&&!result.items.length&&<tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Không có pin phù hợp với bộ lọc.</td></tr>}</tbody></table></div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-500">Trang {page} / {Math.max(1,result.totalPages)}</p><div className="flex gap-2"><button className="btn-outline" disabled={page<=1||loading} onClick={()=>setPage(p=>p-1)}>Trước</button><button className="btn-outline" disabled={page>=result.totalPages||loading} onClick={()=>setPage(p=>p+1)}>Tiếp</button></div></div>
    </div>
  </section>;
}
