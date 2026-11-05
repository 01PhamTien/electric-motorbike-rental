import { useEffect, useState } from 'react';
import { SectionHeading } from '../../components/Brand';
import { api } from '../../services/api';

type AuditEntry={id:number;actorId:number|null;action:string;targetType:string;targetId:number|null;details:string|null;createdAt:string};
export function AuditLogsPage(){
 const [items,setItems]=useState<AuditEntry[]>([]);const [loading,setLoading]=useState(true);const [error,setError]=useState('');
 useEffect(()=>{api.get('/admin/audit-logs?limit=200').then(r=>setItems(Array.isArray(r.data)?r.data:[])).catch(e=>setError(e?.response?.data?.message||'Không thể tải nhật ký.')).finally(()=>setLoading(false));},[]);
 return <div className="container-page py-12 sm:py-16"><SectionHeading eyebrow="QUẢN TRỊ HỆ THỐNG" title="Nhật ký hoạt động" description="Theo dõi các thao tác quan trọng trên đơn thuê và quá trình giao nhận xe."/>
 {error&&<p role="alert" className="mt-6 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
 {loading?<p className="py-12 text-center text-slate-500">Đang tải nhật ký…</p>:items.length===0?<div className="mt-8 rounded-2xl border border-dashed border-slate-300 p-12 text-center text-slate-500">Chưa có hoạt động được ghi nhận.</div>:<div className="mt-8 overflow-x-auto rounded-2xl border border-slate-200 bg-white"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-4">Thời gian</th><th className="px-5 py-4">Người thực hiện</th><th className="px-5 py-4">Thao tác</th><th className="px-5 py-4">Đối tượng</th><th className="px-5 py-4">Chi tiết</th></tr></thead><tbody className="divide-y divide-slate-100">{items.map(x=><tr key={x.id}><td className="whitespace-nowrap px-5 py-4 text-slate-600">{new Date(x.createdAt).toLocaleString('vi-VN')}</td><td className="px-5 py-4">{x.actorId??'Hệ thống'}</td><td className="px-5 py-4 font-semibold text-slate-800">{x.action}</td><td className="px-5 py-4">{x.targetType} {x.targetId??''}</td><td className="max-w-sm px-5 py-4 text-xs text-slate-500"><code className="whitespace-pre-wrap break-all">{x.details||'—'}</code></td></tr>)}</tbody></table></div>}</div>;
}
