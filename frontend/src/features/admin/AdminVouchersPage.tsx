import { useCallback, useEffect, useState } from 'react';
import { api } from '../../services/api';
import { LoadingState, money, SectionHeading, timeText } from '../../components/Brand';

type Voucher = { id:number; code:string; discountType:'PERCENT'|'FIXED'; discountValue:string; maxDiscountAmount:string|null; minRentalAmount:string; startsAt:string; endsAt:string; usageLimit:number|null; perCustomerLimit:number; usageCount:number; isActive:boolean; description:string|null };
type Redemption = { id:number; bookingId:number; customerId:number; discountAmount:string; createdAt:string };
const localInput=(date:Date)=>new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);
const errorText=(e:unknown)=>{const m=(e as {response?:{data?:{message?:string|string[]}}})?.response?.data?.message;return Array.isArray(m)?m.join(', '):m||'Không thể thực hiện thao tác.';};

export function AdminVouchersPage() {
  const [items,setItems]=useState<Voucher[]>([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [code,setCode]=useState('');
  const [discountType,setDiscountType]=useState<'PERCENT'|'FIXED'>('PERCENT');
  const [discountValue,setDiscountValue]=useState('10');
  const [maxDiscount,setMaxDiscount]=useState('');
  const [minimum,setMinimum]=useState('0');
  const [startsAt,setStartsAt]=useState(localInput(new Date()));
  const [endsAt,setEndsAt]=useState(localInput(new Date(Date.now()+7*86400000)));
  const [usageLimit,setUsageLimit]=useState('');
  const [perCustomerLimit,setPerCustomerLimit]=useState('1');
  const [description,setDescription]=useState('');
  const [selected,setSelected]=useState<Voucher|null>(null);
  const [redemptions,setRedemptions]=useState<Redemption[]>([]);
  const load=useCallback(async()=>{setLoading(true);setError('');try{const {data}=await api.get('/vouchers');setItems(Array.isArray(data)?data:[]);}catch(e){setError(errorText(e));}finally{setLoading(false);}},[]);
  useEffect(()=>{void load();},[load]);
  async function create(event:React.FormEvent){
    event.preventDefault();setBusy(true);setError('');setNotice('');
    try{
      await api.post('/vouchers',{code,discountType,discountValue:Number(discountValue),maxDiscountAmount:maxDiscount?Number(maxDiscount):undefined,minRentalAmount:Number(minimum),startsAt:new Date(startsAt).toISOString(),endsAt:new Date(endsAt).toISOString(),usageLimit:usageLimit?Number(usageLimit):undefined,perCustomerLimit:Number(perCustomerLimit),description:description.trim()||undefined});
      setCode('');setDescription('');setNotice('Đã tạo voucher. Mã được chuẩn hóa thành chữ in hoa.');await load();
    }catch(e){setError(errorText(e));}finally{setBusy(false);}
  }
  async function toggle(item:Voucher){
    setBusy(true);setError('');setNotice('');
    try{await api.patch('/vouchers/'+item.id,{isActive:!item.isActive});setNotice('Đã cập nhật trạng thái voucher.');await load();}
    catch(e){setError(errorText(e));}finally{setBusy(false);}
  }
  async function showUsage(item:Voucher){
    setSelected(item);setRedemptions([]);
    try{const {data}=await api.get('/vouchers/'+item.id+'/redemptions');setRedemptions(Array.isArray(data)?data:[]);}
    catch(e){setError(errorText(e));}
  }
  return <section className="container-page space-y-8 py-12 sm:py-16">
    <SectionHeading eyebrow="KHUYẾN MÃI VOLTGO" title="Quản lý Voucher" description="Tạo mã giảm giá, kiểm soát ngân sách khuyến mãi, giới hạn lượt dùng và tra cứu lịch sử áp dụng."/>
    {notice&&<p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}
    {error&&<p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
    <form onSubmit={create} className="panel grid gap-4 p-6 md:grid-cols-2">
      <div className="md:col-span-2"><h3 className="text-lg font-extrabold">Tạo voucher mới</h3><p className="mt-1 text-sm text-slate-500">Mã không phân biệt chữ hoa/thường; hệ thống lưu và kiểm tra ở dạng chữ in hoa.</p></div>
      <label><span className="field-label">Mã voucher</span><input required maxLength={40} pattern="[A-Za-z0-9_-]+" className="field uppercase" value={code} onChange={e=>setCode(e.target.value.toUpperCase())} placeholder="VD: VOLTGO10"/></label>
      <label><span className="field-label">Loại giảm giá</span><select className="field" value={discountType} onChange={e=>setDiscountType(e.target.value as 'PERCENT'|'FIXED')}><option value="PERCENT">Theo phần trăm (%)</option><option value="FIXED">Số tiền cố định (₫)</option></select></label>
      <label><span className="field-label">Giá trị giảm {discountType==='PERCENT'?'(%)':'(₫)'}</span><input required type="number" min="0.01" max={discountType==='PERCENT'?100:undefined} step="0.01" className="field" value={discountValue} onChange={e=>setDiscountValue(e.target.value)}/></label>
      <label><span className="field-label">Mức giảm tối đa (₫, tùy chọn)</span><input type="number" min="0.01" step="1000" className="field" value={maxDiscount} onChange={e=>setMaxDiscount(e.target.value)} placeholder="Không giới hạn"/></label>
      <label><span className="field-label">Giá trị thuê tối thiểu (₫)</span><input required type="number" min="0" step="1000" className="field" value={minimum} onChange={e=>setMinimum(e.target.value)}/></label>
      <label><span className="field-label">Tổng lượt dùng tối đa</span><input type="number" min="1" step="1" className="field" value={usageLimit} onChange={e=>setUsageLimit(e.target.value)} placeholder="Để trống = không giới hạn"/></label>
      <label><span className="field-label">Lượt dùng tối đa mỗi khách</span><input required type="number" min="1" max="1000" className="field" value={perCustomerLimit} onChange={e=>setPerCustomerLimit(e.target.value)}/></label>
      <label><span className="field-label">Bắt đầu áp dụng</span><input required type="datetime-local" className="field" value={startsAt} onChange={e=>setStartsAt(e.target.value)}/></label>
      <label><span className="field-label">Kết thúc áp dụng</span><input required type="datetime-local" min={startsAt} className="field" value={endsAt} onChange={e=>setEndsAt(e.target.value)}/></label>
      <label className="md:col-span-2"><span className="field-label">Mô tả chương trình</span><textarea maxLength={500} className="field min-h-20" value={description} onChange={e=>setDescription(e.target.value)} placeholder="Điều kiện, mục đích và nội dung chương trình..."/></label>
      <div className="md:col-span-2 flex justify-end"><button disabled={busy||!code.trim()||new Date(endsAt)<=new Date(startsAt)} className="btn-primary">{busy?'Đang lưu...':'Tạo voucher'}</button></div>
    </form>
    <div className="panel overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 p-5"><h3 className="font-extrabold">Danh sách voucher</h3><button onClick={()=>void load()} className="btn-outline">Làm mới</button></div>
      {loading?<div className="p-5"><LoadingState/></div>:!items.length?<p className="p-8 text-center text-sm text-slate-500">Chưa có voucher nào.</p>:<div className="divide-y divide-slate-100">{items.map(item=><article key={item.id} className="grid gap-4 p-5 md:grid-cols-[1.3fr_1fr_1fr_auto] md:items-center">
        <div><div className="flex items-center gap-2"><strong className="text-lg">{item.code}</strong><span className={'rounded-full px-2 py-1 text-[10px] font-bold '+(item.isActive?'bg-emerald-50 text-emerald-700':'bg-slate-100 text-slate-500')}>{item.isActive?'Đang bật':'Đã tắt'}</span></div><p className="mt-1 text-xs text-slate-500">{item.description||'Không có mô tả'}</p><p className="mt-1 text-xs text-slate-400">{timeText(item.startsAt)} – {timeText(item.endsAt)}</p></div>
        <div><p className="font-bold">{item.discountType==='PERCENT'?item.discountValue+'%':money(item.discountValue)}</p><p className="text-xs text-slate-500">Đơn tối thiểu {money(item.minRentalAmount)}{item.maxDiscountAmount?' · Tối đa '+money(item.maxDiscountAmount):''}</p></div>
        <div><p className="font-bold">{item.usageCount}{item.usageLimit==null?' / ∞':' / '+item.usageLimit} lượt</p><p className="text-xs text-slate-500">Tối đa {item.perCustomerLimit} lượt/khách</p></div>
        <div className="flex flex-wrap gap-2"><button disabled={busy} onClick={()=>void showUsage(item)} className="btn-outline">Lịch sử</button><button disabled={busy} onClick={()=>void toggle(item)} className="btn-dark">{item.isActive?'Tạm dừng':'Kích hoạt'}</button></div>
      </article>)}</div>}
    </div>
    {selected&&<div className="panel p-5"><div className="flex items-center justify-between"><div><h3 className="font-extrabold">Lịch sử sử dụng {selected.code}</h3><p className="text-xs text-slate-500">Tối đa 200 lượt gần nhất</p></div><button className="btn-outline" onClick={()=>setSelected(null)}>Đóng</button></div>{!redemptions.length?<p className="mt-4 text-sm text-slate-500">Chưa có lượt sử dụng.</p>:<div className="mt-4 divide-y divide-slate-100">{redemptions.map(r=><div key={r.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><span>Đơn #{r.bookingId} · Khách #{r.customerId}</span><strong>{money(r.discountAmount)}</strong><span className="text-xs text-slate-400">{timeText(r.createdAt)}</span></div>)}</div>}</div>}
  </section>;
}
