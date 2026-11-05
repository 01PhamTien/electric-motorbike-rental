import { useEffect, useState } from 'react';
import { SectionHeading } from '../../components/Brand';
import { api } from '../../services/api';
type Presence = { staffId:number; fullName:string; stationName:string; active:boolean; lastAction:string; lastActivityAt:string };
export function StaffPresencePage() {
 const [items,setItems]=useState<Presence[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 async function load() { setLoading(true); setError(''); try { const {data}=await api.get<Presence[]>('/admin/audit-logs/staff-presence'); setItems(Array.isArray(data)?data:[]); } catch(e) { setError((e as any)?.response?.data?.message||'Không tải được dữ liệu'); } finally { setLoading(false); } }
 useEffect(()=>{ void load(); },[]);
 return <section className="container-page space-y-7 py-12 sm:py-16">
  <SectionHeading eyebrow="ĐIỀU HÀNH NHÂN SỰ" title="Nhân viên đang trực" description="Theo dõi trạng thái ca gần nhất và điểm thuê của nhân viên." />
  <button className="btn-outline" onClick={()=>void load()} disabled={loading}>Cập nhật</button>
  {error&&<p role="alert">{error}</p>}
  <div className="panel p-5"><p>Đang trong ca: {items.filter(x=>x.active).length}</p><p>Đã kết thúc ca: {items.filter(x=>!x.active).length}</p></div>
  {loading?<p>Đang tải...</p>:<div className="overflow-x-auto panel"><table className="w-full text-left text-sm"><thead><tr><th className="p-4">Nhân viên</th><th className="p-4">Điểm thuê</th><th className="p-4">Trạng thái</th><th className="p-4">Thời gian</th></tr></thead><tbody>{items.map(x=><tr key={x.staffId}><td className="p-4">{x.fullName}</td><td className="p-4">{x.stationName}</td><td className="p-4">{x.active?'Đang trong ca':'Đã kết thúc ca'}</td><td className="p-4">{new Date(x.lastActivityAt).toLocaleString('vi-VN')}</td></tr>)}</tbody></table></div>}
 </section>;
}