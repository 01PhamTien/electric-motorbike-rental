import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import type { Vehicle } from '../../types';

type Swap={id:number;vehicleId:number;vehicle?:Vehicle;station?:{name:string};removedBattery?:{serialNumber:string};installedBattery?:{serialNumber:string};performedById:number;performedBy?:{id:number;fullName:string};createdAt:string;note:string|null};
type Result={items:Swap[];total:number;page:number;limit:number;totalPages:number};

export function BatterySwapHistoryPanel({stationId,vehicles}:{stationId:string;vehicles:Vehicle[]}) {
  const [items,setItems]=useState<Swap[]>([]);
  const [search,setSearch]=useState('');
  const [vehicleId,setVehicleId]=useState('');
  const [from,setFrom]=useState('');
  const [to,setTo]=useState('');
  const [page,setPage]=useState(1);
  const [total,setTotal]=useState(0);
  const [totalPages,setTotalPages]=useState(0);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  useEffect(()=>{setPage(1);},[stationId,search,vehicleId,from,to]);
  useEffect(()=>{
    let active=true;
    const params:Record<string,string|number>={page,limit:10};
    if(stationId)params.stationId=Number(stationId);
    if(vehicleId)params.vehicleId=Number(vehicleId);
    if(search.trim())params.serial=search.trim();
    if(from)params.from=from;
    if(to)params.to=to;
    setLoading(true);setError('');
    api.get('/batteries/swaps/history',{params}).then(({data})=>{
      if(!active)return;
      setItems(Array.isArray(data?.items)?data.items:[]);
      setTotal(Number(data?.total)||0);
      setTotalPages(Number(data?.totalPages)||0);
    }).catch(e=>{
      if(!active)return;
      const message=(e as {response?:{data?:{message?:string|string[]}}})?.response?.data?.message;
      setError(Array.isArray(message)?message.join(', '):message||'Không tải được lịch sử đổi pin.');
    }).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[stationId,search,vehicleId,from,to,page]);
  return <section className="panel mt-7 overflow-hidden">
    <div className="flex flex-wrap items-end justify-between gap-4 p-6">
      <div><p className="eyebrow">NHẬT KÝ ĐỔI PIN</p><h2 className="mt-2 text-xl font-extrabold">Lịch sử giao dịch</h2><p className="mt-1 text-sm text-slate-500">{total} giao dịch phù hợp</p></div>
      <div className="flex flex-wrap gap-2">
        <input aria-label="Tìm serial pin trong lịch sử" className="field min-w-48" placeholder="Tìm serial pin..." value={search} onChange={e=>setSearch(e.target.value)}/>
        <select aria-label="Lọc xe" className="field min-w-40" value={vehicleId} onChange={e=>setVehicleId(e.target.value)}><option value="">Tất cả xe</option>{vehicles.map(v=><option key={v.id} value={v.id}>{v.code}</option>)}</select>
        <input aria-label="Từ ngày" title="Từ ngày" className="field" type="date" value={from} onChange={e=>setFrom(e.target.value)}/>
        <input aria-label="Đến ngày" title="Đến ngày" className="field" type="date" min={from||undefined} value={to} onChange={e=>setTo(e.target.value)}/>
      </div>
    </div>
    {error&&<p role="alert" className="px-6 pb-3 text-sm text-rose-700">{error}</p>}
    <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm">
      <thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-6 py-4">Thời gian</th><th className="px-4 py-4">Xe / Trạm</th><th className="px-4 py-4">Pin tháo ra</th><th className="px-4 py-4">Pin lắp vào</th><th className="px-4 py-4">Nhân viên</th><th className="px-6 py-4">Ghi chú</th></tr></thead>
      <tbody className="divide-y divide-slate-100">
        {loading?<tr><td colSpan={6} className="px-6 py-10 text-center text-slate-500">Đang tải lịch sử...</td></tr>:items.map(item=><tr key={item.id}>
          <td className="whitespace-nowrap px-6 py-4"><strong>{new Date(item.createdAt).toLocaleDateString('vi-VN')}</strong><p className="mt-1 text-xs text-slate-400">{new Date(item.createdAt).toLocaleTimeString('vi-VN')}</p></td>
          <td className="px-4 py-4"><strong>{item.vehicle?.code??'Xe #'+item.vehicleId}</strong><p className="mt-1 text-xs text-slate-500">{item.station?.name??'—'}</p></td>
          <td className="px-4 py-4"><strong>{item.removedBattery?.serialNumber??'—'}</strong><p className="mt-1 text-xs text-slate-500">Chuyển sang chờ sạc</p></td>
          <td className="px-4 py-4"><strong>{item.installedBattery?.serialNumber??'—'}</strong><p className="mt-1 text-xs text-slate-500">Đã lắp trên xe</p></td>
          <td className="px-4 py-4">{item.performedBy?.fullName??'Nhân viên #'+item.performedById}</td>
          <td className="max-w-56 px-6 py-4 text-slate-500">{item.note||'—'}</td>
        </tr>)}
        {!loading&&!items.length&&<tr><td colSpan={6} className="px-6 py-10 text-center"><p className="font-semibold text-slate-700">Chưa có giao dịch phù hợp</p><p className="mt-1 text-xs text-slate-400">Thử điều chỉnh bộ lọc hoặc khoảng thời gian.</p></td></tr>}
      </tbody>
    </table></div>
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-6 py-4"><p className="text-xs text-slate-500">Trang {page} / {Math.max(1,totalPages)} · {total} giao dịch</p><div className="flex gap-2"><button className="btn-outline" disabled={page<=1||loading} onClick={()=>setPage(p=>p-1)}>Trước</button><button className="btn-outline" disabled={page>=totalPages||loading} onClick={()=>setPage(p=>p+1)}>Tiếp</button></div></div>
  </section>;
}
