import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { money, SectionHeading } from '../../components/Brand';
import { api } from '../../services/api';

type Model = { id: number; brand: string; name: string };
type Station = { id: number; name: string; isActive: boolean };
type Vehicle = { id: number; code: string; licensePlate: string; modelId: number; stationId: number; model: Model; station: Station; dailyRate: string; depositAmount: string; status: string; isActive: boolean };
const initial = { code: '', licensePlate: '', modelId: '', stationId: '', dailyRate: '180000', depositAmount: '1000000', status: 'ACTIVE', isActive: true };
const statuses = ['ACTIVE', 'CHARGING', 'MAINTENANCE', 'INACTIVE'] as const;
function errorText(err: unknown) {
  const message = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  return Array.isArray(message) ? message.join(', ') : message || 'Không thể hoàn thành thao tác. Vui lòng thử lại.';
}

export function AdminVehiclesPage() {
  const [items, setItems] = useState<Vehicle[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [query, setQuery] = useState('');
  const [stationFilter, setStationFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [editing, setEditing] = useState<number | null>(null);
  const [form, setForm] = useState(initial);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function load() {
    setLoading(true);
    try {
      const [v, m, s] = await Promise.all([api.get<Vehicle[]>('/vehicles/admin/all'), api.get<Model[]>('/vehicle-models'), api.get<Station[]>('/stations')]);
      setItems(v.data); setModels(m.data); setStations(s.data); setError('');
    } catch (e) { setError(errorText(e)); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  const filtered = useMemo(() => items.filter(v =>
    [v.code, v.licensePlate, v.model?.brand, v.model?.name].join(' ').toLowerCase().includes(query.toLowerCase())
    && (!stationFilter || String(v.stationId) === stationFilter)
    && (!statusFilter || (statusFilter === 'DISABLED' ? !v.isActive : v.status === statusFilter && v.isActive))
  ), [items, query, stationFilter, statusFilter]);
  function newVehicle() { setForm(initial); setEditing(null); setOpen(true); setError(''); setNotice(''); }
  function edit(v: Vehicle) {
    setEditing(v.id); setForm({ code: v.code, licensePlate: v.licensePlate, modelId: String(v.modelId), stationId: String(v.stationId), dailyRate: String(v.dailyRate), depositAmount: String(v.depositAmount), status: v.status, isActive: v.isActive });
    setOpen(true); setError(''); setNotice('');
  }
  async function submit(e: FormEvent) {
    e.preventDefault(); setSaving(true); setError(''); setNotice('');
    try {
      const payload = { modelId: Number(form.modelId), stationId: Number(form.stationId), dailyRate: Number(form.dailyRate), depositAmount: Number(form.depositAmount) };
      if (editing !== null) await api.patch('/vehicles/' + editing, { ...payload, status: form.status, isActive: form.isActive });
      else await api.post('/vehicles', { ...payload, code: form.code.trim(), licensePlate: form.licensePlate.trim() });
      setOpen(false); setNotice(editing === null ? 'Đã thêm xe.' : 'Đã cập nhật xe.'); await load();
    } catch (err) { setError(errorText(err)); }
    finally { setSaving(false); }
  }
  return <section className="container-page space-y-7 py-12 sm:py-16">
    <div className="flex flex-wrap items-end justify-between gap-4"><SectionHeading eyebrow="QUẢN TRỊ ĐỘI XE" title="Danh sách xe điện" description="Quản lý tất cả xe, kể cả xe tạm ngưng khai thác. Thêm xe mới, cập nhật giá thuê, phân trạm và trạng thái." /><button className="btn-primary" onClick={newVehicle}>+ Thêm xe</button></div>
    <div className="flex flex-wrap gap-3 text-sm"><Link className="font-bold text-emerald-700" to="/admin">← Trung tâm quản trị</Link><Link className="font-bold text-emerald-700" to="/admin/models">Quản lý dòng xe ↗</Link><Link className="font-bold text-emerald-700" to="/admin/stations">Quản lý điểm thuê ↗</Link><Link className="font-bold text-emerald-700" to="/vehicle-transfers">Điều chuyển xe ↗</Link></div>
    {notice && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-emerald-800">{notice}</p>}
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-4 text-rose-800">{error}</p>}
    <div className="panel grid gap-4 p-5 md:grid-cols-3">
      <label><span className="field-label">Tìm kiếm</span><input className="field" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Mã xe, biển số, tên xe..." /></label>
      <label><span className="field-label">Điểm thuê</span><select className="field" value={stationFilter} onChange={e=>setStationFilter(e.target.value)}><option value="">Tất cả trạm</option>{stations.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label><span className="field-label">Trạng thái</span><select className="field" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="">Tất cả</option>{statuses.map(s=><option key={s}>{s}</option>)}<option value="DISABLED">Ngưng khai thác</option></select></label>
    </div>
    <div className="panel overflow-hidden">
      <div className="flex justify-between border-b p-5"><strong>{filtered.length} / {items.length} xe</strong><button className="text-sm font-bold text-emerald-700" onClick={()=>void load()}>↻ Làm mới</button></div>
      {loading ? <p className="p-6">Đang tải...</p> : !filtered.length ? <p className="p-6 text-slate-500">Không tìm thấy xe phù hợp.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr><th className="p-4">Xe</th><th className="p-4">Dòng xe</th><th className="p-4">Điểm thuê</th><th className="p-4">Giá / ngày</th><th className="p-4">Tình trạng</th><th className="p-4">Thao tác</th></tr></thead><tbody className="divide-y">{filtered.map(v=><tr key={v.id}><td className="p-4"><strong>{v.code}</strong><p className="text-xs text-slate-500">{v.licensePlate}</p></td><td className="p-4">{v.model?.brand} {v.model?.name}</td><td className="p-4">{v.station?.name}</td><td className="p-4">{money(v.dailyRate)}</td><td className="p-4"><span className={v.isActive && v.status === 'ACTIVE' ? 'tag' : 'rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-700'}>{!v.isActive ? 'Ngưng khai thác' : v.status}</span></td><td className="p-4"><button onClick={()=>edit(v)} className="font-bold text-emerald-700">Chỉnh sửa</button></td></tr>)}</tbody></table></div>}
    </div>
    {open && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"><form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="vehicle-form-title" className="panel max-h-[92vh] w-full max-w-2xl overflow-y-auto p-7">
      <div className="flex items-center justify-between"><h2 id="vehicle-form-title" className="text-xl font-extrabold">{editing === null ? 'Thêm xe điện' : 'Chỉnh sửa xe #' + editing}</h2><button type="button" onClick={()=>setOpen(false)} aria-label="Đóng">✕</button></div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label><span className="field-label">Mã xe</span><input className="field" required maxLength={50} disabled={editing!==null} value={form.code} onChange={e=>setForm({...form,code:e.target.value})}/></label>
        <label><span className="field-label">Biển số</span><input className="field" required maxLength={30} disabled={editing!==null} value={form.licensePlate} onChange={e=>setForm({...form,licensePlate:e.target.value})}/></label>
        <label><span className="field-label">Dòng xe</span><select required className="field" value={form.modelId} onChange={e=>setForm({...form,modelId:e.target.value})}><option value="">Chọn dòng xe</option>{models.map(m=><option key={m.id} value={m.id}>{m.brand} {m.name}</option>)}</select></label>
        <label><span className="field-label">Điểm thuê</span><select required disabled={editing!==null} className="field" value={form.stationId} onChange={e=>setForm({...form,stationId:e.target.value})}><option value="">Chọn điểm thuê</option>{stations.filter(s=>s.isActive || String(s.id)===form.stationId).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>{editing!==null&&<span className="mt-1 block text-xs text-slate-500">Muốn đổi trạm, hãy dùng chức năng Điều chuyển xe để lưu lịch sử bàn giao.</span>}</label>
        <label><span className="field-label">Giá thuê/ngày (₫)</span><input type="number" min="0" required className="field" value={form.dailyRate} onChange={e=>setForm({...form,dailyRate:e.target.value})}/></label>
        <label><span className="field-label">Tiền cọc (₫)</span><input type="number" min="0" required className="field" value={form.depositAmount} onChange={e=>setForm({...form,depositAmount:e.target.value})}/></label>
        {editing !== null && <><label><span className="field-label">Tình trạng</span><select className="field" value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>{statuses.map(s=><option key={s}>{s}</option>)}</select></label><label className="flex items-center gap-3 pt-6"><input type="checkbox" checked={form.isActive} onChange={e=>setForm({...form,isActive:e.target.checked})}/> Cho phép khai thác xe</label></>}
      </div>
      {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
      <div className="mt-7 flex justify-end gap-3"><button type="button" className="btn-outline" onClick={()=>setOpen(false)}>Hủy</button><button disabled={saving} className="btn-primary">{saving?'Đang lưu...':'Lưu thông tin'}</button></div>
    </form></div>}
  </section>;
}
