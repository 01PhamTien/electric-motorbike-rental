import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api } from '../../services/api';

type VehicleModel = { id: number; brand: string; name: string; specifications: string | null };
type ModelForm = { brand: string; name: string; specifications: string };
const emptyForm: ModelForm = { brand: '', name: '', specifications: '' };

export function AdminVehicleModelsPage() {
  const [items, setItems] = useState<VehicleModel[]>([]);
  const [form, setForm] = useState<ModelForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await api.get<VehicleModel[]>('/vehicle-models');
      setItems(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không tải được danh sách dòng xe. Hãy đăng nhập bằng ADMIN.');
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  function reset() { setForm(emptyForm); setEditingId(null); }
  function edit(item: VehicleModel) {
    setEditingId(item.id);
    setForm({ brand: item.brand, name: item.name, specifications: item.specifications || '' });
    setError(''); setMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(''); setMessage('');
    const payload = { brand: form.brand.trim(), name: form.name.trim(), specifications: form.specifications.trim() || undefined };
    try {
      if (editingId !== null) {
        await api.patch('/vehicle-models/' + editingId, payload);
        setMessage('Đã cập nhật dòng xe.');
      } else {
        await api.post('/vehicle-models', payload);
        setMessage('Đã thêm dòng xe mới.');
      }
      reset(); await load();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không thể lưu thông tin dòng xe.');
    } finally { setSaving(false); }
  }

  const filtered = items.filter(item => (item.brand + ' ' + item.name + ' ' + (item.specifications || '')).toLowerCase().includes(keyword.toLowerCase()));

  return <section className="space-y-6">
    <header className="relative overflow-hidden rounded-3xl bg-slate-950 px-6 py-7 text-white shadow-lg sm:px-8">
      <div className="pointer-events-none absolute -right-14 -top-20 h-64 w-64 rounded-full bg-indigo-400/10 blur-3xl" />
      <div className="relative flex flex-wrap items-end justify-between gap-4">
        <div><span className="inline-flex rounded-full border border-indigo-300/20 bg-indigo-300/10 px-3 py-1 text-[11px] font-bold tracking-[0.15em] text-indigo-200">DANH MỤC PHƯƠNG TIỆN</span>
          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">Quản lý dòng xe</h1>
          <p className="mt-2 text-sm text-slate-300">Khai báo hãng xe, tên dòng xe và thông số kỹ thuật dùng trong danh mục đội xe.</p></div>
        <button onClick={() => void load()} disabled={loading} className="rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/15 disabled:opacity-50">{loading ? 'Đang tải...' : '↻ Làm mới'}</button>
      </div>
    </header>

    {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{Array.isArray(error) ? error.join(', ') : error}</div>}
    {message && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{message}</div>}

    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold text-slate-900">{editingId !== null ? 'Cập nhật dòng xe' : 'Thêm dòng xe mới'}</h2><p className="mt-1 text-xs text-slate-500">Thông tin hãng và tên dòng xe là bắt buộc.</p></div>
        {editingId !== null && <button type="button" onClick={reset} className="text-sm font-semibold text-slate-500 underline">Hủy chỉnh sửa</button>}</div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold text-slate-700">Hãng xe<input required maxLength={100} value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" placeholder="Ví dụ: VinFast" /></label>
        <label className="text-sm font-semibold text-slate-700">Tên dòng xe<input required maxLength={120} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" placeholder="Ví dụ: Feliz S" /></label>
        <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Thông số kỹ thuật<textarea rows={4} value={form.specifications} onChange={e => setForm({ ...form, specifications: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" placeholder="Dung lượng pin, quãng đường, tốc độ tối đa, công suất..." /></label>
      </div>
      <button disabled={saving} className="rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-50">{saving ? 'Đang lưu...' : editingId !== null ? 'Lưu thay đổi' : 'Thêm dòng xe'}</button>
    </form>

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 p-5"><div><h2 className="font-bold text-slate-900">Danh mục dòng xe</h2><p className="mt-1 text-xs text-slate-500">{items.length} dòng xe trong hệ thống</p></div>
        <input value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="Tìm hãng, dòng xe..." className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm sm:w-64" /></div>
      {loading ? <p className="p-5 text-sm text-slate-500">Đang tải danh mục...</p> : filtered.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">Không có dòng xe phù hợp.</p> :
        <div className="divide-y divide-slate-100">{filtered.map(item => <article key={item.id} className="flex flex-wrap items-start justify-between gap-4 p-5 transition hover:bg-slate-50/70">
          <div className="min-w-0 flex-1"><p className="text-xs font-bold uppercase tracking-wide text-blue-700">{item.brand}</p><h3 className="mt-1 font-bold text-slate-900">{item.name}</h3>
            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">{item.specifications || 'Chưa cập nhật thông số kỹ thuật.'}</p></div>
          <button onClick={() => edit(item)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50">Chỉnh sửa</button>
        </article>)}</div>}
    </section>
  </section>;
}
