import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SectionHeading, LoadingState, money, timeText } from '../../components/Brand';
import { useAuth } from '../auth/AuthContext';
import { api } from '../../services/api';
import type { Station, Vehicle } from '../../types';

type Category = 'CHARGING'|'CLEANING'|'INSURANCE'|'REGISTRATION'|'PARKING'|'OTHER';
type Cost = {id:number;stationId:number;station?:Station;vehicleId:number|null;vehicle?:Vehicle|null;category:Category;amount:string;energyKwh:string|null;unitPrice:string|null;occurredAt:string;note:string|null;recordedById:number};
const categories: {value:Category;label:string}[] = [
  {value:'CHARGING',label:'Điện sạc'}, {value:'CLEANING',label:'Vệ sinh'},
  {value:'INSURANCE',label:'Bảo hiểm'}, {value:'REGISTRATION',label:'Đăng ký xe'},
  {value:'PARKING',label:'Bãi đỗ'}, {value:'OTHER',label:'Khác'},
];
const categoryLabel = (value:Category) => categories.find(item=>item.value===value)?.label ?? value;
const errorText = (err:unknown) => {
  const message=(err as {response?:{data?:{message?:string|string[]}}})?.response?.data?.message;
  return Array.isArray(message)?message.join(', '):message||'Không thể xử lý yêu cầu. Vui lòng thử lại.';
};
const localDateTime = () => { const date=new Date();return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16); };

export function OperatingCostsPage() {
  const {user}=useAuth();
  const [stations,setStations]=useState<Station[]>([]);
  const [vehicles,setVehicles]=useState<Vehicle[]>([]);
  const [costs,setCosts]=useState<Cost[]>([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [categoryFilter,setCategoryFilter]=useState('');
  const [form,setForm]=useState({stationId:user?.stationId?String(user.stationId):'',vehicleId:'',category:'CHARGING' as Category,amount:'',energyKwh:'',unitPrice:'',occurredAt:localDateTime(),note:''});
  const visibleVehicles=useMemo(()=>vehicles.filter(v=>String(v.station?.id)===form.stationId),[vehicles,form.stationId]);
  async function load() {
    setLoading(true);setError('');
    try {
      const [stationResponse,vehicleResponse,costResponse]=await Promise.all([
        api.get('/stations'),api.get('/vehicles'),api.get('/operating-costs', {params:categoryFilter?{category:categoryFilter}:{}}),
      ]);
      setStations(Array.isArray(stationResponse.data)?stationResponse.data:[]);
      setVehicles(Array.isArray(vehicleResponse.data)?vehicleResponse.data:[]);
      setCosts(Array.isArray(costResponse.data)?costResponse.data:[]);
    } catch(err) {setError(errorText(err));}
    finally {setLoading(false);}
  }
  useEffect(()=>{void load();},[categoryFilter]);
  useEffect(()=>{
    if(user?.stationId) setForm(current=>({...current,stationId:String(user.stationId)}));
  },[user?.stationId]);
  function updateCharging(next:Partial<typeof form>) {
    setForm(current=>{
      const updated={...current,...next};
      if(updated.category==='CHARGING'&&updated.energyKwh&&updated.unitPrice) {
        const total=Number(updated.energyKwh)*Number(updated.unitPrice);
        if(Number.isFinite(total)&&total>0) updated.amount=total.toFixed(2);
      }
      return updated;
    });
  }
  async function submit(event:React.FormEvent) {
    event.preventDefault();setBusy(true);setError('');setNotice('');
    try {
      await api.post('/operating-costs',{
        stationId:Number(form.stationId),vehicleId:form.vehicleId?Number(form.vehicleId):undefined,
        category:form.category,amount:Number(form.amount),
        energyKwh:form.category==='CHARGING'&&form.energyKwh?Number(form.energyKwh):undefined,
        unitPrice:form.category==='CHARGING'&&form.unitPrice?Number(form.unitPrice):undefined,
        occurredAt:new Date(form.occurredAt).toISOString(),note:form.note.trim()||undefined,
      });
      setNotice('Đã ghi nhận chi phí vận hành. Bản ghi được lưu để đối soát và không thể sửa/xóa trực tiếp.');
      setForm(current=>({...current,vehicleId:'',amount:'',energyKwh:'',unitPrice:'',note:'',occurredAt:localDateTime()}));
      await load();
    } catch(err) {setError(errorText(err));}
    finally {setBusy(false);}
  }
  return <div className="container-page py-12 sm:py-16">
    <div className="flex flex-wrap items-end justify-between gap-5"><SectionHeading eyebrow="TÀI CHÍNH VẬN HÀNH" title="Chi phí vận hành" description="Ghi nhận điện sạc, vệ sinh, bảo hiểm, đăng ký, bãi đỗ và các khoản chi phí khác theo xe hoặc theo trạm."/><div className="flex gap-3"><Link to="/admin" className="btn-outline">← Quản trị</Link><Link to="/admin/dashboard" className="btn-outline">Báo cáo</Link></div></div>
    {notice&&<p role="status" className="mt-7 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}
    {error&&<p role="alert" className="mt-7 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
    <div className="mt-8 grid gap-7 lg:grid-cols-[.85fr_1.15fr]">
      <form onSubmit={submit} className="panel h-fit space-y-4 p-6">
        <div><p className="eyebrow">GHI NHẬN KHOẢN CHI</p><h2 className="mt-2 text-xl font-extrabold">Thêm chi phí mới</h2></div>
        <label className="block"><span className="field-label">Trạm ghi nhận</span><select className="field mt-2" required disabled={user?.role==='STAFF'} value={form.stationId} onChange={e=>setForm({...form,stationId:e.target.value,vehicleId:''})}><option value="">Chọn trạm</option>{stations.filter(s=>s.isActive!==false&&(user?.role!=='STAFF'||s.id===user?.stationId)).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label className="block"><span className="field-label">Loại chi phí</span><select className="field mt-2" value={form.category} onChange={e=>updateCharging({category:e.target.value as Category,vehicleId:'',energyKwh:'',unitPrice:''})}>{categories.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}</select></label>
        <label className="block"><span className="field-label">Gắn với xe {form.category==='CHARGING'?'(bắt buộc)':'(không bắt buộc)'}</span><select className="field mt-2" required={form.category==='CHARGING'} value={form.vehicleId} onChange={e=>setForm({...form,vehicleId:e.target.value})}><option value="">Chi phí chung của trạm</option>{visibleVehicles.map(v=><option key={v.id} value={v.id}>{v.code} · {v.model?.brand} {v.model?.name}</option>)}</select></label>
        {form.category==='CHARGING'&&<div className="grid grid-cols-2 gap-3"><label><span className="field-label">Điện năng (kWh)</span><input className="field mt-2" type="number" min="0" step="0.001" value={form.energyKwh} onChange={e=>updateCharging({energyKwh:e.target.value})}/></label><label><span className="field-label">Đơn giá (VND/kWh)</span><input className="field mt-2" type="number" min="0" step="0.01" value={form.unitPrice} onChange={e=>updateCharging({unitPrice:e.target.value})}/></label></div>}
        <label className="block"><span className="field-label">Số tiền (VND)</span><input className="field mt-2" required type="number" min="0.01" step="0.01" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})}/></label>
        <label className="block"><span className="field-label">Thời điểm phát sinh</span><input className="field mt-2" required type="datetime-local" value={form.occurredAt} onChange={e=>setForm({...form,occurredAt:e.target.value})}/></label>
        <label className="block"><span className="field-label">Ghi chú / mã hóa đơn</span><textarea className="field mt-2 min-h-20" maxLength={500} value={form.note} onChange={e=>setForm({...form,note:e.target.value})} placeholder="Nhập thông tin chứng từ hoặc nội dung chi..."/></label>
        <p className="text-xs leading-5 text-slate-500">Bản ghi chi phí là sổ đối soát. Kiểm tra kỹ trước khi lưu; hiện chưa hỗ trợ sửa hoặc xóa để giữ lịch sử kiểm toán.</p>
        <button className="btn-primary w-full" disabled={busy||!form.stationId||!form.amount||(form.category==='CHARGING'&&!form.vehicleId)}>{busy?'Đang lưu...':'Lưu chi phí vận hành'}</button>
      </form>
      <section className="panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 p-6"><div><p className="eyebrow">SỔ CHI PHÍ</p><h2 className="mt-2 text-xl font-extrabold">Các khoản đã ghi nhận</h2></div><select className="field max-w-48" value={categoryFilter} onChange={e=>setCategoryFilter(e.target.value)}><option value="">Tất cả loại</option>{categories.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}</select></div>
        {loading?<div className="p-7"><LoadingState label="Đang tải sổ chi phí..."/></div>:!costs.length?<p className="px-6 pb-7 text-sm text-slate-500">Chưa có khoản chi nào phù hợp bộ lọc.</p>:<div className="divide-y divide-slate-100">{costs.map(cost=><article key={cost.id} className="flex flex-wrap items-start justify-between gap-3 p-6"><div><div className="flex flex-wrap items-center gap-2"><strong>{categoryLabel(cost.category)}</strong><span className="tag">{cost.vehicle?.code??'Chi phí trạm'}</span></div><p className="mt-1 text-xs text-slate-500">{cost.station?.name??'Trạm #'+cost.stationId} · {timeText(cost.occurredAt)}</p>{cost.note&&<p className="mt-2 text-sm text-slate-600">{cost.note}</p>}{cost.energyKwh&&<p className="mt-1 text-xs text-slate-500">{cost.energyKwh} kWh {cost.unitPrice?'· '+money(cost.unitPrice)+'/kWh':''}</p>}</div><strong className="text-lg">{money(cost.amount)}</strong></article>)}</div>}
      </section>
    </div>
  </div>;
}
