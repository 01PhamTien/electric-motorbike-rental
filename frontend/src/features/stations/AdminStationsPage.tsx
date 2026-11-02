import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api } from '../../services/api';

type Station = {
  id: number; name: string; address: string; latitude: string;
  longitude: string; phone: string | null; isActive: boolean;
};
type StationForm = { name: string; address: string; latitude: string; longitude: string; phone: string };
const emptyForm: StationForm = { name: '', address: '', latitude: '16.0471', longitude: '108.2068', phone: '' };

export function AdminStationsPage() {
  const [items, setItems] = useState<Station[]>([]);
  const [form, setForm] = useState<StationForm>(emptyForm);
  const [editing, setEditing] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [keyword, setKeyword] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await api.get<Station[]>('/stations');
      setItems(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không tải được danh sách điểm thuê. Hãy đăng nhập bằng ADMIN.');
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  function reset() { setForm(emptyForm); setEditing(null); }
  function edit(item: Station) {
    setEditing(item.id);
    setForm({ name: item.name, address: item.address, latitude: String(item.latitude), longitude: String(item.longitude), phone: item.phone || '' });
    setError(''); setMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(''); setMessage('');
    const payload = {
      name: form.name.trim(), address: form.address.trim(),
      latitude: Number(form.latitude), longitude: Number(form.longitude),
      ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
    };
    if (!Number.isFinite(payload.latitude) || payload.latitude < -90 || payload.latitude > 90 ||
        !Number.isFinite(payload.longitude) || payload.longitude < -180 || payload.longitude > 180) {
      setError('Tọa độ không hợp lệ. Latitude từ -90 đến 90, longitude từ -180 đến 180.');
      setSaving(false); return;
    }
    try {
      if (editing) await api.patch('/stations/' + editing, payload);
      else await api.post('/stations', payload);
      setMessage(editing ? 'Đã cập nhật điểm thuê.' : 'Đã tạo điểm thuê mới.');
      reset(); await load();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không thể lưu điểm thuê.');
    } finally { setSaving(false); }
  }

  async function toggleActive(item: Station) {
    const next = !item.isActive;
    if (!window.confirm(next ? 'Kích hoạt điểm thuê ' + item.name + '?' : 'Ngừng hoạt động điểm thuê ' + item.name + '?')) return;
    setError(''); setMessage('');
    try {
      await api.patch('/stations/' + item.id, { isActive: next });
      setMessage(next ? 'Đã kích hoạt điểm thuê.' : 'Đã ngừng hoạt động điểm thuê.');
      await load();
    } catch (err: any) { setError(err.response?.data?.message || 'Không thể đổi trạng thái điểm thuê.'); }
  }

  const filtered = items.filter(item => (item.name + ' ' + item.address + ' ' + (item.phone || '')).toLowerCase().includes(keyword.toLowerCase()));
  const activeCount = items.filter(item => item.isActive).length;

  return <section className="space-y-6">
    <header className="relative overflow-hidden rounded-3xl bg-slate-950 px-6 py-7 text-white shadow-lg sm:px-8">
      <div className="pointer-events-none absolute -right-14 -top-20 h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="relative flex flex-wrap items-end justify-between gap-4">
        <div><span className="inline-flex rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[11px] font-bold tracking-[0.15em] text-cyan-200">QUẢN TRỊ HẠ TẦNG</span>
          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">Quản lý điểm thuê</h1>
          <p className="mt-2 text-sm text-slate-300">Thiết lập địa chỉ, tọa độ bản đồ và trạng thái hoạt động của từng điểm thuê.</p></div>
        <button onClick={() => void load()} disabled={loading} className="rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/15 disabled:opacity-50">{loading ? 'Đang tải...' : '↻ Làm mới'}</button>
      </div>
    </header>

    {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{Array.isArray(error) ? error.join(', ') : error}</div>}
    {message && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{message}</div>}

    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold text-slate-900">{editing ? 'Cập nhật điểm thuê' : 'Tạo điểm thuê mới'}</h2><p className="mt-1 text-xs text-slate-500">Tọa độ dùng cho bản đồ và mô phỏng vị trí xe.</p></div>
        {editing && <button type="button" onClick={reset} className="text-sm font-semibold text-slate-500 underline">Hủy chỉnh sửa</button>}</div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold text-slate-700">Tên điểm thuê<input required maxLength={120} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" placeholder="Ví dụ: Điểm thuê trung tâm" /></label>
        <label className="text-sm font-semibold text-slate-700">Số điện thoại<input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" placeholder="Số liên hệ điểm thuê" /></label>
        <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Địa chỉ<input required maxLength={255} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" placeholder="Số nhà, đường, quận, thành phố" /></label>
        <label className="text-sm font-semibold text-slate-700">Latitude<input required type="number" step="any" min="-90" max="90" value={form.latitude} onChange={e => setForm({ ...form, latitude: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" /></label>
        <label className="text-sm font-semibold text-slate-700">Longitude<input required type="number" step="any" min="-180" max="180" value={form.longitude} onChange={e => setForm({ ...form, longitude: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" /></label>
      </div>
      <button disabled={saving} className="rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-50">{saving ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Tạo điểm thuê'}</button>
    </form>

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 p-5"><div><h2 className="font-bold text-slate-900">Danh sách điểm thuê</h2><p className="mt-1 text-xs text-slate-500">{activeCount} đang hoạt động · {items.length - activeCount} đã ngừng</p></div>
        <input value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="Tìm tên, địa chỉ..." className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm sm:w-64" /></div>
      {loading ? <p className="p-5 text-sm text-slate-500">Đang tải dữ liệu...</p> : filtered.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">Không có điểm thuê phù hợp.</p> :
        <div className="divide-y divide-slate-100">{filtered.map(item => <article key={item.id} className="flex flex-wrap items-center justify-between gap-4 p-5 transition hover:bg-slate-50/70">
          <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-slate-900">{item.name}</h3><span className={item.isActive ? 'rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700' : 'rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500'}>{item.isActive ? 'Đang hoạt động' : 'Đã ngừng'}</span></div>
            <p className="mt-1 text-sm text-slate-600">{item.address}</p><p className="mt-1 text-xs text-slate-400">☎ {item.phone || 'Chưa có số điện thoại'} · {item.latitude}, {item.longitude}</p></div>
          <div className="flex shrink-0 gap-2"><button onClick={() => edit(item)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50">Chỉnh sửa</button><button onClick={() => void toggleActive(item)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">{item.isActive ? 'Ngừng hoạt động' : 'Kích hoạt'}</button></div>
        </article>)}</div>}
    </section>
  </section>;
}
