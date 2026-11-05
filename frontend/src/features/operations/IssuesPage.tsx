import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, LoadingState, SectionHeading, timeText } from '../../components/Brand';
import { api } from '../../services/api';

type Issue = {
  id:number; bookingId:number; issueType:string; severity:string; status:string; description:string;
  latitude:string|null; longitude:string|null; resolutionNote:string|null; createdAt:string;
  customer?:{fullName:string;phone?:string|null};
  vehicle?:{code:string;model?:{brand:string;name:string};station?:{name:string;address:string}};
};
const typeLabel:Record<string,string>={BREAKDOWN:'Xe bị hỏng',LOW_BATTERY:'Sắp hết pin',ACCIDENT:'Tai nạn / va chạm',OTHER:'Vấn đề khác'};
const statusLabel:Record<string,string>={OPEN:'Mới tiếp nhận',IN_PROGRESS:'Đang xử lý',RESOLVED:'Đã xử lý',CANCELLED:'Đã hủy'};
const severityLabel:Record<string,string>={LOW:'Thấp',MEDIUM:'Trung bình',HIGH:'Cao',CRITICAL:'Khẩn cấp'};
const getError=(e:unknown)=>(e as {response?:{data?:{message?:string|string[]}}})?.response?.data?.message||'Không thể xử lý yêu cầu.';
export function IssuesPage(){
  const [items,setItems]=useState<Issue[]>([]);const [loading,setLoading]=useState(true);const [error,setError]=useState('');const [notice,setNotice]=useState('');const [busy,setBusy]=useState<number|null>(null);
  const [drafts,setDrafts]=useState<Record<number,{status:string;note:string}>>({});
  const load=useCallback(async()=>{setLoading(true);try{const {data}=await api.get('/issues');const list=Array.isArray(data)?data:data?.items??[];setItems(list);setDrafts(Object.fromEntries(list.map((x:Issue)=>[x.id,{status:x.status,note:x.resolutionNote??''}])));setError('');}catch(e){setError(getError(e));}finally{setLoading(false);}},[]);
  useEffect(()=>{void load();},[load]);
  async function save(issue:Issue){const draft=drafts[issue.id];if(!draft)return;if(draft.status==='RESOLVED'&&!draft.note.trim()){setError('Cần ghi chú cách xử lý trước khi đóng sự cố.');return;}setBusy(issue.id);setError('');setNotice('');try{await api.patch('/issues/'+issue.id,{status:draft.status,resolutionNote:draft.note||undefined});setNotice('Đã cập nhật báo cáo #'+issue.id);await load();}catch(e){setError(getError(e));}finally{setBusy(null);}}
  const openCount=items.filter(x=>x.status==='OPEN'||x.status==='IN_PROGRESS').length;
  return <div className="container-page py-12 sm:py-16">
    <div className="flex flex-wrap items-end justify-between gap-5"><SectionHeading eyebrow="CHĂM SÓC KHÁCH HÀNG" title="Báo cáo sự cố trong chuyến thuê" description="Tiếp nhận xe hỏng, hết pin và tình huống khẩn cấp. Nhân viên chỉ xem được sự cố tại trạm mình phụ trách."/><div className="flex gap-2"><span className="tag">{openCount} cần xử lý</span><Link to="/operations" className="btn-outline">← Vận hành</Link></div></div>
    {notice&&<p role="status" className="mt-6 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}{error&&<p role="alert" className="mt-6 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
    {loading?<div className="mt-7"><LoadingState/></div>:!items.length?<div className="mt-7"><EmptyState title="Chưa có báo cáo sự cố" description="Báo cáo từ khách hàng đang thuê xe sẽ xuất hiện tại đây."/></div>:<div className="mt-7 space-y-5">{items.map(issue=><article key={issue.id} className="panel p-6">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-slate-400">SỰ CỐ #{issue.id} · ĐƠN #{issue.bookingId}</p><h2 className="mt-2 text-lg font-extrabold">{typeLabel[issue.issueType]||issue.issueType} · {severityLabel[issue.severity]||issue.severity}</h2><p className="mt-1 text-xs text-slate-500">{timeText(issue.createdAt)}</p></div><span className="rounded-full bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">{statusLabel[issue.status]||issue.status}</span></div>
      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><p><strong>Khách:</strong> {issue.customer?.fullName||'—'} {issue.customer?.phone?'· '+issue.customer.phone:''}</p><p><strong>Xe:</strong> {issue.vehicle?.model?.brand} {issue.vehicle?.model?.name} · {issue.vehicle?.code}</p><p><strong>Trạm:</strong> {issue.vehicle?.station?.name||'—'}</p><p><strong>Địa chỉ:</strong> {issue.vehicle?.station?.address||'—'}</p></div>
      <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">{issue.description}</p>
      {issue.latitude&&issue.longitude&&<a className="mt-3 inline-block text-sm font-bold text-sky-800 underline" href={'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(issue.latitude+','+issue.longitude)} target="_blank" rel="noopener noreferrer">Mở vị trí khách gửi ↗</a>}
      <form onSubmit={e=>{e.preventDefault();void save(issue);}} className="mt-5 grid gap-3 border-t border-slate-100 pt-5 sm:grid-cols-[180px_1fr_auto] sm:items-end"><label><span className="field-label">Trạng thái xử lý</span><select className="field" value={drafts[issue.id]?.status??issue.status} onChange={e=>setDrafts(d=>({...d,[issue.id]:{...d[issue.id],status:e.target.value}}))}>{Object.entries(statusLabel).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><label><span className="field-label">Ghi chú xử lý {drafts[issue.id]?.status==='RESOLVED'?'(bắt buộc)':''}</span><input className="field" value={drafts[issue.id]?.note??''} onChange={e=>setDrafts(d=>({...d,[issue.id]:{...d[issue.id],note:e.target.value}}))} placeholder="Ví dụ: đã điều phối xe cứu hộ..." maxLength={1000}/></label><button disabled={busy===issue.id} className="btn-primary">{busy===issue.id?'Đang lưu...':'Cập nhật'}</button></form>
      {issue.resolutionNote&&<p className="mt-3 text-sm text-emerald-800">Kết quả xử lý trước đó: {issue.resolutionNote}</p>}
    </article>)}</div>}
  </div>;
}
