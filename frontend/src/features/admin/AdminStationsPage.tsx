import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { SectionHeading } from '../../components/Brand';
import { api } from '../../services/api';

type Station = { id: number; name: string; address: string; latitude: string; longitude: string; phone: string | null; isActive: boolean };
const blank = { name: '', address: '', latitude: '16.0676', longitude: '108.2210', phone: '', isActive: true };
const errorText = (err: unknown) => {
  const msg = (err as {response?:{data?:{message?:string|string[]}}})?.response?.data?.message;
  return Array.isArray(msg) ? msg.join(', ') : msg || 'Không thể lưu điểm thuê.';
};
export function AdminStationsPage() {
  const [items, setItems] = useState<Station[]>([]);
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function load() {
    setLoading(true);
    try { const { data } = await api.get<Station[]>('/stations'); setItems(data); setError(''); }
    catch (e) { setError(errorText(e)); }
    finally { setLoading(false); }
  }
  useEffect(()=>{ void load(); },[]);
  function edit(item?: Station) {
    setEditing(item?.id ?? null);
    setForm(item ? { name:item.name, address:item.address, latitude:String(item.latitude), longitude:String(item.longitude), phone:item.phone || '',isActive:item.isActive } : blank);
    setOpen(true);setError('');setNotice('');
  }
  async function submit(e: FormEvent) {
    e.preventDefault();setSaving(true);setError('');
    try {
      const payload = {name:form.name.trim(),address:form.address.trim(),latitude:Number(form.latitude),longitude:Number(form.longitude),phone:form.phone.trim()};
      if (editing===null) await api.post('/stations',payload);
      else await api.patch('/stations/'+editing,{...payload,isActive:form.isActive});
      setOpen(false);setNotice(editing===null?'Đã thêm điểm thuê.':'Đã cập nhật điểm thuê.');await load();
    } catch(e) {setError(errorText(e));}
    finally {setSaving(false);}
  }
  const filtered=items.filter(s=>(s.name+' '+s.address).toLowerCase().includes(query.toLowerCase()));
  return <section className="container-page space-y-7 py-12 sm:py-16">
    <div className="flex flex-wrap items-end justify-between gap-4"><SectionHeading eyebrow="QUẢN TRỊ MẠNG LƯỚI" title="Quản lý điểm thuê" description="Cập nhật trạm nhận/trả xe, thông tin liên hệ, tọa độ tham khảo và trạng thái hoạt động."/><button className="btn-primary" onClick={()=>edit()}>+ Thêm điểm thuê</button></div>
    <Link className="text-sm font-bold text-emerald-700" to="/admin">← Trung tâm quản trị</Link>
    {notice && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-emerald-800">{notice}</p>}
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-4 text-rose-800">{error}</p>}
    <div className="panel p-5"><label><span className="field-label">Tìm điểm thuê</span><input className="field" placeholder="Tên trạm, địa chỉ..." value={query} onChange={e=>setQuery(e.target.value)}/></label></div>
    <div className="panel overflow-hidden"><div className="flex justify-between border-b p-5"><strong>{filtered.length} điểm thuê</strong><button className="text-sm font-bold text-emerald-700" onClick={()=>void load()}>↻ Làm mới</button></div>
      {loading?<p className="p-5">Đang tải...</p>:<div className="overflow-x-auto"><table className="w-full min-w-[780px] text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr><th className="p-4">Trạm</th><th className="p-4">Địa chỉ</th><th className="p-4">Liên hệ</th><th className="p-4">Trạng thái</th><th className="p-4">Thao tác</th></tr></thead><tbody className="divide-y">{filtered.map(s=><tr key={s.id}><td className="p-4 font-bold">{s.name}</td><td className="p-4">{s.address}</td><td className="p-4">{s.phone||'—'}</td><td className="p-4">{s.isActive?'Đang hoạt động':'Đã ngưng'}</td><td className="p-4"><button className="font-bold text-emerald-700" onClick={()=>edit(s)}>Chỉnh sửa</button></td></tr>)}</tbody></table></div>}
    </div>
    {open&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"><form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="station-form-title" className="panel max-h-[92vh] w-full max-w-2xl overflow-y-auto p-7">
      <div className="flex justify-between"><h2 id="station-form-title" className="text-xl font-extrabold">{editing===null?'Thêm điểm thuê':'Cập nhật điểm thuê'}</h2><button type="button" aria-label="Đóng" onClick={()=>setOpen(false)}>✕</button></div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2"><label className="sm:col-span-2"><span className="field-label">Tên trạm</span><input required maxLength={120} className="field" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label><label className="sm:col-span-2"><span className="field-label">Địa chỉ</span><input required maxLength={255} className="field" value={form.address} onChange={e=>setForm({...form,address:e.target.value})}/></label><label><span className="field-label">Vĩ độ</span><input required type="number" step="any" min="-90" max="90" className="field" value={form.latitude} onChange={e=>setForm({...form,latitude:e.target.value})}/></label><label><span className="field-label">Kinh độ</span><input required type="number" step="any" min="-180" max="180" className="field" value={form.longitude} onChange={e=>setForm({...form,longitude:e.target.value})}/></label><label><span className="field-label">Số điện thoại</span><input maxLength={30} className="field" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></label>{editing!==null&&<label className="flex items-center gap-3 pt-7"><input type="checkbox" checked={form.isActive} onChange={e=>setForm({...form,isActive:e.target.checked})}/>Trạm đang hoạt động</label>}</div>
      {error&&<p role="alert" className="mt-4 text-red-700">{error}</p>}<div className="mt-7 flex justify-end gap-3"><button type="button" className="btn-outline" onClick={()=>setOpen(false)}>Hủy</button><button disabled={saving} className="btn-primary">{saving?'Đang lưu...':'Lưu điểm thuê'}</button></div>
    </form></div>}
  </section>;
}
