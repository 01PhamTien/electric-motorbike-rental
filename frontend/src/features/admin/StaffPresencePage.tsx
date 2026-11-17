import { useEffect, useState } from 'react';
import { SectionHeading } from '../../components/Brand';
import { AppIcon } from '../../components/AppIcon';
import { api } from '../../services/api';
type Presence = { staffId:number; fullName:string; stationName:string; active:boolean; lastAction:string; lastActivityAt:string };
export function StaffPresencePage() {
 const [items,setItems]=useState<Presence[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 async function load() { setLoading(true); setError(''); try { const {data}=await api.get<Presence[]>('/admin/audit-logs/staff-presence'); setItems(Array.isArray(data)?data:[]); } catch(e) { setError((e as any)?.response?.data?.message||'Không tải được dữ liệu'); } finally { setLoading(false); } }
 useEffect(()=>{ void load(); },[]);
 return <section className="container-page space-y-7 py-8 sm:py-12">
  <SectionHeading eyebrow="ĐIỀU HÀNH NHÂN SỰ" title="Nhân viên đang trực" description="Theo dõi trạng thái ca gần nhất và điểm thuê của nhân viên." />
  <button className="btn-outline" onClick={()=>void load()} disabled={loading}><AppIcon name="refresh" size={15}/> Cập nhật</button>
  {error&&<p role="alert">{error}</p>}
  <div className="panel p-5"><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-[#e4eee7] bg-[#f8fbf8] p-4"><p className="text-xs font-medium text-slate-500">Đang trong ca</p><strong className="mt-2 block text-2xl font-bold text-[#286746]">{items.filter(x=>x.active).length}</strong></div><div className="rounded-xl border border-[#edf1ed] bg-[#fafcfa] p-4"><p className="text-xs font-medium text-slate-500">Đã kết thúc ca</p><strong className="mt-2 block text-2xl font-bold text-slate-800">{items.filter(x=>!x.active).length}</strong></div></div></div>
  {loading?<p>Đang tải...</p>:<div className="overflow-x-auto panel"><table className="w-full text-left text-sm"><thead className="bg-[#f8faf8] text-slate-500"><tr><th className="p-4">Nhân viên</th><th className="p-4">Điểm thuê</th><th className="p-4">Trạng thái</th><th className="p-4">Thời gian</th></tr></thead><tbody>{items.map(x=><tr key={x.staffId} className="border-t border-[#edf1ed]"><td className="p-4">{x.fullName}</td><td className="p-4">{x.stationName}</td><td className="p-4">{x.active?'Đang trong ca':'Đã kết thúc ca'}</td><td className="p-4">{new Date(x.lastActivityAt).toLocaleString('vi-VN')}</td></tr>)}</tbody></table></div>}
 </section>;
}