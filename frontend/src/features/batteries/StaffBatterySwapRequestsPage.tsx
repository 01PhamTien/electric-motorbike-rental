import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, LoadingState, SectionHeading, timeText } from '../../components/Brand';
import { api } from '../../services/api';
import { useAuth } from '../auth/AuthContext';

type Reservation={id:number;customerId:number;bookingId:number;stationId:number;vehicleId:number;status:'RESERVED'|'REDEEMED'|'CANCELLED'|'EXPIRED';expiresAt:string;createdAt:string;station?:{name:string};vehicle?:{code:string};customer?:{fullName:string;phone?:string|null}};
type Battery={id:number;serialNumber:string;stationId:number;status:string;vehicleId:number|null};
const errorText=(error:unknown)=>{const message=(error as {response?:{data?:{message?:string|string[]}}})?.response?.data?.message;return Array.isArray(message)?message.join(', '):message||'Không thể tải yêu cầu đổi pin.';};

export function StaffBatterySwapRequestsPage(){
  const {user}=useAuth();
  const [items,setItems]=useState<Reservation[]>([]);
  const [batteries,setBatteries]=useState<Battery[]>([]);
  const [selected,setSelected]=useState<Record<number,string>>({});
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState<number|null>(null);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const load=useCallback(async(silent=false)=>{
    if(!silent)setLoading(true);
    try{
      const params=user?.stationId?{stationId:user.stationId}:{};
      const [r,b]=await Promise.all([api.get('/batteries/reservations',{params}),api.get('/batteries',{params:{...params,status:'FULL'}})]);
      setItems(Array.isArray(r.data)?r.data:r.data?.items??[]);
      setBatteries((Array.isArray(b.data)?b.data:b.data?.items??[]).filter((x:Battery)=>x.status==='FULL'&&!x.vehicleId));
      setError('');
    }catch(e){setError(errorText(e));}
    finally{if(!silent)setLoading(false);}
  },[user?.stationId]);
  useEffect(()=>{void load();const timer=window.setInterval(()=>void load(true),15000);return()=>window.clearInterval(timer);},[load]);
  async function redeem(item:Reservation){
    const replacementBatteryId=Number(selected[item.id]);
    if(!replacementBatteryId||busy!==null)return;
    setBusy(item.id);setError('');setNotice('');
    try{
      await api.post('/batteries/reservations/'+item.id+'/redeem',{replacementBatteryId,note:'Nhân viên xác nhận đổi pin theo lượt giữ trước #'+item.id});
      setNotice('Đã xác nhận đổi pin cho lượt giữ #'+item.id+'. Kho pin và trạng thái xe đã được cập nhật.');
      setSelected(current=>({...current,[item.id]:''}));
      await load(true);
    }catch(e){setError(errorText(e));}
    finally{setBusy(null);}
  }
  const active=items.filter(x=>x.status==='RESERVED'&&new Date(x.expiresAt).getTime()>Date.now());
  const history=items.filter(x=>!active.some(a=>a.id===x.id));
  return <div className="container-page space-y-7 py-8 sm:py-12">
    <div className="flex flex-wrap items-end justify-between gap-4"><SectionHeading eyebrow="ĐIỀU PHỐI PIN" title="Yêu cầu đổi pin" description="Tiếp nhận lượt giữ pin của khách, kiểm tra đúng đơn thuê và xác nhận viên pin thay thế tại trạm."/><Link to="/batteries" className="btn-outline">Kho pin</Link></div>
    <div className="grid gap-3 sm:grid-cols-3"><div className="panel p-4"><p className="field-label">Đang chờ xác nhận</p><strong className="mt-2 block text-2xl">{active.length}</strong></div><div className="panel p-4"><p className="field-label">Pin đầy khả dụng</p><strong className="mt-2 block text-2xl">{batteries.length}</strong></div><div className="panel p-4"><p className="field-label">Lượt đã xử lý / hết hạn</p><strong className="mt-2 block text-2xl">{history.length}</strong></div></div>
    {error&&<p role="alert" className="rounded-xl border border-[#f0e4e1] bg-[#fcf8f7] p-4 text-sm text-[#87534b]">{error}</p>}
    {notice&&<p role="status" className="rounded-xl border border-[#dfebe2] bg-[#f7faf7] p-4 text-sm text-[#416c53]">{notice}</p>}
    <section className="panel overflow-hidden"><div className="border-b border-[#edf1ed] p-5 sm:p-6"><h2 className="text-lg font-bold">Đang chờ khách đến trạm</h2><p className="mt-1 text-sm text-slate-500">Danh sách tự cập nhật mỗi 15 giây. Chỉ xác nhận khi khách có mặt và thông tin xe khớp đơn thuê.</p></div>
      {loading?<div className="p-6"><LoadingState/></div>:!active.length?<div className="p-6"><EmptyState title="Chưa có yêu cầu đổi pin đang hiệu lực" description="Khi khách giữ pin trước trên ứng dụng, yêu cầu sẽ xuất hiện tại đây."/></div>:<div className="divide-y divide-[#edf1ed]">{active.map(item=><article key={item.id} className="grid gap-4 p-5 sm:p-6 lg:grid-cols-[1fr_1fr]">
        <div><p className="text-xs font-bold uppercase tracking-wide text-[#829087]">LƯỢT GIỮ PIN #{item.id} · ĐƠN #{item.bookingId}</p><h3 className="mt-2 text-lg font-bold">{item.vehicle?.code??'Xe #'+item.vehicleId}</h3><p className="mt-1 text-sm text-slate-600">{item.customer?.fullName??'Khách hàng #'+item.customerId}{item.customer?.phone?' · '+item.customer.phone:''}</p><p className="mt-1 text-sm text-slate-500">{item.station?.name??'Trạm #'+item.stationId}</p><p className="mt-3 text-xs font-semibold text-amber-700">Hết hạn: {timeText(item.expiresAt)}</p></div>
        <div className="flex flex-col justify-center gap-3"><label><span className="field-label">Chọn pin đầy để thay thế</span><select className="field mt-1" value={selected[item.id]??''} onChange={e=>setSelected(v=>({...v,[item.id]:e.target.value}))}><option value="">Chọn serial pin</option>{batteries.filter(b=>b.stationId===item.stationId).map(b=><option key={b.id} value={b.id}>{b.serialNumber}</option>)}</select></label><button disabled={busy!==null||!selected[item.id]} onClick={()=>void redeem(item)} className="btn-primary">{busy===item.id?'Đang xác nhận...':'Xác nhận đã đổi pin'}</button></div>
      </article>)}</div>}
    </section>
    <section className="panel overflow-hidden"><div className="p-5 sm:p-6"><h2 className="text-lg font-bold">Lịch sử yêu cầu</h2><p className="mt-1 text-sm text-slate-500">Các lượt đã đổi, đã hủy hoặc hết hạn.</p></div>{history.length?<div className="divide-y divide-[#edf1ed]">{history.map(item=><div key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6"><div><p className="font-semibold">Lượt #{item.id} · {item.vehicle?.code??'Xe #'+item.vehicleId}</p><p className="mt-1 text-xs text-slate-500">Đơn #{item.bookingId} · {timeText(item.createdAt)}</p></div><span className="rounded-full bg-[#f3f6f3] px-3 py-1.5 text-xs font-bold text-[#65766b]">{item.status==='REDEEMED'?'Đã đổi':item.status==='CANCELLED'?'Đã hủy':'Hết hạn'}</span></div>)}</div>:<p className="px-6 pb-6 text-sm text-slate-500">Chưa có lịch sử.</p>}</section>
  </div>;
}
