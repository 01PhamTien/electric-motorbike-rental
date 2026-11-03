import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SectionHeading } from '../../components/Brand';
import { api } from '../../services/api';

type Customer = { id:number; fullName:string; email:string; phone:string|null; status:'ACTIVE'|'LOCKED'; createdAt:string };
function errorMessage(err:unknown) {
  const m=(err as {response?:{data?:{message?:string|string[]}}})?.response?.data?.message;
  return Array.isArray(m)?m.join(', '):m||'Không thực hiện được thao tác.';
}
export function AdminCustomersPage() {
  const [items,setItems]=useState<Customer[]>([]);
  const [query,setQuery]=useState('');
  const [status,setStatus]=useState('');
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState<number|null>(null);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  async function load(){
    setLoading(true);
    try{const {data}=await api.get<Customer[]>('/users/customers');setItems(data);setError('');}
    catch(e){setError(errorMessage(e));}finally{setLoading(false);}
  }
  useEffect(()=>{void load();},[]);
  const filtered=useMemo(()=>items.filter(u=>(u.fullName+' '+u.email+' '+(u.phone||'')).toLowerCase().includes(query.toLowerCase())&&(!status||u.status===status)),[items,query,status]);
  async function toggle(u:Customer){
    const next=u.status==='ACTIVE'?'LOCKED':'ACTIVE';
    if(!window.confirm((next==='LOCKED'?'Khóa':'Mở khóa')+' khách hàng '+u.fullName+'?'))return;
    setBusy(u.id);setError('');setNotice('');
    try{await api.patch('/users/customers/'+u.id+'/status',{status:next});setNotice('Đã cập nhật trạng thái khách hàng.');await load();}
    catch(e){setError(errorMessage(e));}finally{setBusy(null);}
  }
  return <section className="container-page space-y-7 py-12 sm:py-16">
    <SectionHeading eyebrow="QUẢN TRỊ TÀI KHOẢN" title="Danh sách khách hàng" description="Xem hồ sơ, tìm kiếm và tạm khóa hoặc mở lại tài khoản khách hàng. Thông tin đăng nhập và mật khẩu không được hiển thị."/>
    <Link className="text-sm font-bold text-emerald-700" to="/admin">← Trung tâm quản trị</Link>
    {notice&&<p role="status" className="rounded-xl bg-emerald-50 p-4 text-emerald-800">{notice}</p>}{error&&<p role="alert" className="rounded-xl bg-rose-50 p-4 text-rose-800">{error}</p>}
    <div className="panel grid gap-4 p-5 md:grid-cols-2"><label><span className="field-label">Tìm khách hàng</span><input className="field" placeholder="Họ tên, email, số điện thoại..." value={query} onChange={e=>setQuery(e.target.value)}/></label><label><span className="field-label">Trạng thái</span><select className="field" value={status} onChange={e=>setStatus(e.target.value)}><option value="">Tất cả</option><option value="ACTIVE">Đang hoạt động</option><option value="LOCKED">Đã khóa</option></select></label></div>
    <div className="panel overflow-hidden"><div className="flex justify-between border-b p-5"><strong>{filtered.length} / {items.length} khách hàng</strong><button className="text-sm font-bold text-emerald-700" onClick={()=>void load()}>↻ Làm mới</button></div>
    {loading?<p className="p-5">Đang tải...</p>:!filtered.length?<p className="p-5 text-slate-500">Chưa có khách hàng phù hợp.</p>:<div className="overflow-x-auto"><table className="w-full min-w-[800px] text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr><th className="p-4">Khách hàng</th><th className="p-4">Email</th><th className="p-4">Số điện thoại</th><th className="p-4">Trạng thái</th><th className="p-4">Thao tác</th></tr></thead><tbody className="divide-y">{filtered.map(u=><tr key={u.id}><td className="p-4"><strong>{u.fullName}</strong><p className="text-xs text-slate-500">#{u.id}</p></td><td className="p-4">{u.email}</td><td className="p-4">{u.phone||'Chưa cập nhật'}</td><td className="p-4">{u.status==='ACTIVE'?'Đang hoạt động':'Đã khóa'}</td><td className="p-4"><button disabled={busy===u.id} onClick={()=>void toggle(u)} className="font-bold text-emerald-700">{busy===u.id?'Đang xử lý...':u.status==='ACTIVE'?'Khóa tài khoản':'Mở khóa'}</button></td></tr>)}</tbody></table></div>}</div>
  </section>;
}
