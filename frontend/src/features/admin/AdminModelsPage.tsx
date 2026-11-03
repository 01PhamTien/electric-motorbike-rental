import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { SectionHeading } from '../../components/Brand';
import { api } from '../../services/api';

type Model = { id: number; brand: string; name: string; specifications: string | null };
const empty = { brand: '', name: '', specifications: '' };
function errorMessage(error: unknown): string {
  const m=(error as {response?:{data?:{message?:string|string[]}}})?.response?.data?.message;
  return Array.isArray(m)?m.join(', '):m||'Không thể lưu dòng xe.';
}
export function AdminModelsPage(){
  const [items,setItems]=useState<Model[]>([]);
  const [form,setForm]=useState(empty);
  const [editing,setEditing]=useState<number|null>(null);
  const [open,setOpen]=useState(false);
  const [query,setQuery]=useState('');
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [saving,setSaving]=useState(false);
  const [loading,setLoading]=useState(true);
  async function load(){
    setLoading(true);
    try {const {data}=await api.get<Model[]>('/vehicle-models');setItems(data);setError('');}
    catch(e){setError(errorMessage(e));}finally{setLoading(false);}
  }
  useEffect(()=>{void load();},[]);
  function edit(m?:Model){setEditing(m?.id??null);setForm(m?{brand:m.brand,name:m.name,specifications:m.specifications||''}:empty);setOpen(true);setError('');setNotice('');}
  async function submit(e:FormEvent){
    e.preventDefault();setSaving(true);setError('');
    try{
      const payload={brand:form.brand.trim(),name:form.name.trim(),specifications:form.specifications.trim()};
      if(editing===null)await api.post('/vehicle-models',payload);
      else await api.patch('/vehicle-models/'+editing,payload);
      setOpen(false);setNotice(editing===null?'Đã thêm dòng xe.':'Đã cập nhật dòng xe.');await load();
    }catch(e){setError(errorMessage(e));}finally{setSaving(false);}
  }
  return <section className="container-page space-y-7 py-12 sm:py-16">
    <div className="flex flex-wrap items-end justify-between gap-4"><SectionHeading eyebrow="DANH MỤC ĐỘI XE" title="Quản lý dòng xe" description="Tổ chức danh mục hãng, mẫu xe điện và mô tả kỹ thuật dùng cho đội xe VoltGo."/><button onClick={()=>edit()} className="btn-primary">+ Thêm dòng xe</button></div>
    <div className="flex flex-wrap gap-4 text-sm font-bold text-emerald-700"><Link to="/admin">← Trung tâm quản trị</Link><Link to="/admin/vehicles">Đến quản lý xe ↗</Link></div>
    {notice&&<p role="status" className="rounded-xl bg-emerald-50 p-4 text-emerald-800">{notice}</p>}
    {error&&<p role="alert" className="rounded-xl bg-rose-50 p-4 text-rose-800">{error}</p>}
    <div className="panel p-5"><label><span className="field-label">Tìm dòng xe</span><input className="field" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Hãng, tên mẫu xe..."/></label></div>
    <div className="panel overflow-hidden"><div className="border-b p-5 font-bold">{items.filter(m=>(m.brand+' '+m.name).toLowerCase().includes(query.toLowerCase())).length} dòng xe</div>{loading?<p className="p-5">Đang tải...</p>:<div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr><th className="p-4">Hãng</th><th className="p-4">Tên mẫu xe</th><th className="p-4">Thông số / mô tả</th><th className="p-4">Thao tác</th></tr></thead><tbody className="divide-y">{items.filter(m=>(m.brand+' '+m.name).toLowerCase().includes(query.toLowerCase())).map(m=><tr key={m.id}><td className="p-4 font-bold">{m.brand}</td><td className="p-4">{m.name}</td><td className="p-4 max-w-md text-slate-600">{m.specifications||'—'}</td><td className="p-4"><button className="font-bold text-emerald-700" onClick={()=>edit(m)}>Chỉnh sửa</button></td></tr>)}</tbody></table></div>}</div>
    {open&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"><form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="model-form-title" className="panel w-full max-w-xl p-7">
      <div className="flex items-center justify-between"><h2 id="model-form-title" className="text-xl font-extrabold">{editing===null?'Thêm mẫu xe':'Cập nhật mẫu xe'}</h2><button type="button" onClick={()=>setOpen(false)} aria-label="Đóng">✕</button></div>
      <div className="mt-6 space-y-4"><label className="block"><span className="field-label">Hãng</span><input required maxLength={100} className="field" value={form.brand} onChange={e=>setForm({...form,brand:e.target.value})}/></label><label className="block"><span className="field-label">Tên dòng xe</span><input required maxLength={120} className="field" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label><label className="block"><span className="field-label">Thông số / mô tả</span><textarea rows={4} className="field" value={form.specifications} onChange={e=>setForm({...form,specifications:e.target.value})}/></label></div>
      {error&&<p role="alert" className="mt-4 text-red-700">{error}</p>}<div className="mt-6 flex justify-end gap-3"><button type="button" className="btn-outline" onClick={()=>setOpen(false)}>Hủy</button><button className="btn-primary" disabled={saving}>{saving?'Đang lưu...':'Lưu dòng xe'}</button></div>
    </form></div>}
  </section>;
}
