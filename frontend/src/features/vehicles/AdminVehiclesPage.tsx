import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api } from '../../services/api';

type Station = { id: number; name: string; isActive: boolean };
type VehicleModel = { id: number; brand: string; name: string };
type Vehicle = {
  id: number; code: string; licensePlate: string; modelId: number;
  stationId: number; dailyRate: string; depositAmount: string;
  status: 'ACTIVE' | 'CHARGING' | 'MAINTENANCE' | 'INACTIVE';
  model?: VehicleModel; station?: Station; images?: Array<{ id: number; imageUrl: string }>;
};
type VehicleForm = {
  code: string; licensePlate: string; modelId: string; stationId: string;
  dailyRate: string; depositAmount: string; status: Vehicle['status']; imageUrls: string;
};
const emptyForm: VehicleForm = { code: '', licensePlate: '', modelId: '', stationId: '', dailyRate: '100000', depositAmount: '500000', status: 'ACTIVE', imageUrls: '' };
const money = (value: string | number) => Number(value).toLocaleString('vi-VN', { maximumFractionDigits: 0 }) + ' đ';
const statusLabels: Record<Vehicle['status'], string> = { ACTIVE: 'Sẵn sàng', CHARGING: 'Đang sạc', MAINTENANCE: 'Bảo dưỡng', INACTIVE: 'Ngừng khai thác' };

export function AdminVehiclesPage() {
  const [items, setItems] = useState<Vehicle[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [models, setModels] = useState<VehicleModel[]>([]);
  const [form, setForm] = useState<VehicleForm>(emptyForm);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [vehicleResponse, stationResponse, modelResponse] = await Promise.all([
        api.get<Vehicle[]>('/vehicles'),
        api.get<Station[]>('/stations'),
        api.get<VehicleModel[]>('/vehicle-models'),
      ]);
      setItems(vehicleResponse.data);
      setStations(stationResponse.data.filter(item => item.isActive));
      setModels(modelResponse.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không tải được dữ liệu đội xe. Hãy đăng nhập bằng ADMIN.');
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  function reset() { setForm(emptyForm); setEditing(null); }
  function startEdit(item: Vehicle) {
    setEditing(item);
    setForm({
      code: item.code, licensePlate: item.licensePlate, modelId: String(item.modelId),
      stationId: String(item.stationId), dailyRate: String(item.dailyRate),
      depositAmount: String(item.depositAmount), status: item.status,
      imageUrls: (item.images || []).map(image => image.imageUrl).join('\n'),
    });
    setError(''); setMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(''); setMessage('');
    const dailyRate = Number(form.dailyRate), depositAmount = Number(form.depositAmount);
    const imageUrls = form.imageUrls.split(/\r?\n/).map(url => url.trim()).filter(Boolean);
    if (imageUrls.length > 10 || imageUrls.some(url => !/^https?:\/\//i.test(url))) {
      setError('Nhập tối đa 10 URL ảnh hợp lệ bắt đầu bằng http:// hoặc https://.'); setSaving(false); return;
    }
    if (!Number.isFinite(dailyRate) || dailyRate < 0 || !Number.isFinite(depositAmount) || depositAmount < 0) {
      setError('Giá thuê và tiền cọc phải là số không âm.'); setSaving(false); return;
    }
    try {
      if (editing) {
        await api.patch('/vehicles/' + editing.id, {
          stationId: Number(form.stationId), dailyRate, depositAmount, status: form.status, imageUrls,
        });
        setMessage('Đã cập nhật thông tin xe.');
      } else {
        await api.post('/vehicles', {
          code: form.code.trim(), licensePlate: form.licensePlate.trim().toUpperCase(),
          modelId: Number(form.modelId), stationId: Number(form.stationId), dailyRate, depositAmount, imageUrls,
        });
        setMessage('Đã thêm xe mới vào đội xe.');
      }
      reset(); await load();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không thể lưu thông tin phương tiện.');
    } finally { setSaving(false); }
  }

  const filtered = items.filter(item => {
    const text = [item.code, item.licensePlate, item.model?.brand, item.model?.name, item.station?.name].join(' ').toLowerCase();
    return text.includes(keyword.toLowerCase()) && (statusFilter === 'ALL' || item.status === statusFilter);
  });
  const activeCount = items.filter(item => item.status === 'ACTIVE').length;
  const maintenanceCount = items.filter(item => item.status === 'MAINTENANCE').length;

  return <section className="space-y-6">
    <header className="relative overflow-hidden rounded-3xl bg-slate-950 px-6 py-7 text-white shadow-lg sm:px-8">
      <div className="pointer-events-none absolute -right-14 -top-20 h-64 w-64 rounded-full bg-blue-500/15 blur-3xl" />
      <div className="relative flex flex-wrap items-end justify-between gap-4">
        <div><span className="inline-flex rounded-full border border-blue-300/20 bg-blue-300/10 px-3 py-1 text-[11px] font-bold tracking-[0.15em] text-blue-200">QUẢN TRỊ ĐỘI XE</span>
          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">Quản lý phương tiện</h1>
          <p className="mt-2 text-sm text-slate-300">Quản lý mã xe, biển số, dòng xe, điểm trực thuộc, giá thuê và tình trạng khai thác.</p></div>
        <button onClick={() => void load()} disabled={loading} className="rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/15 disabled:opacity-50">{loading ? 'Đang tải...' : '↻ Làm mới'}</button>
      </div>
    </header>

    {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{Array.isArray(error) ? error.join(', ') : error}</div>}
    {message && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{message}</div>}

    <div className="grid gap-3 sm:grid-cols-3">
      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Xe trong danh sách</p><p className="mt-2 text-3xl font-bold text-slate-950">{items.length}</p></article>
      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Sẵn sàng cho thuê</p><p className="mt-2 text-3xl font-bold text-emerald-700">{activeCount}</p></article>
      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Đang bảo dưỡng</p><p className="mt-2 text-3xl font-bold text-amber-700">{maintenanceCount}</p></article>
    </div>

    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold text-slate-900">{editing ? 'Cập nhật phương tiện' : 'Thêm phương tiện mới'}</h2><p className="mt-1 text-xs text-slate-500">{editing ? 'Có thể cập nhật điểm thuê, giá và trạng thái. Mã xe, biển số và dòng xe được giữ nguyên.' : 'Khai báo thông tin định danh và cấu hình thuê ban đầu.'}</p></div>
        {editing && <button type="button" onClick={reset} className="text-sm font-semibold text-slate-500 underline">Hủy chỉnh sửa</button>}</div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {!editing && <>
          <label className="text-sm font-semibold text-slate-700">Mã xe<input required maxLength={50} value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" placeholder="EV001" /></label>
          <label className="text-sm font-semibold text-slate-700">Biển số<input required maxLength={30} value={form.licensePlate} onChange={e => setForm({ ...form, licensePlate: e.target.value.toUpperCase() })} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" placeholder="43-A1 123.45" /></label>
          <label className="text-sm font-semibold text-slate-700">Dòng xe<select required value={form.modelId} onChange={e => setForm({ ...form, modelId: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal"><option value="">Chọn dòng xe</option>{models.map(model => <option key={model.id} value={model.id}>{model.brand} {model.name}</option>)}</select></label>
        </>}
        <label className="text-sm font-semibold text-slate-700">Điểm thuê<select required value={form.stationId} onChange={e => setForm({ ...form, stationId: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal"><option value="">Chọn điểm thuê</option>{stations.map(station => <option key={station.id} value={station.id}>{station.name}</option>)}</select></label>
        <label className="text-sm font-semibold text-slate-700">Giá thuê / 24 giờ (VNĐ)<input required type="number" min="0" step="1" value={form.dailyRate} onChange={e => setForm({ ...form, dailyRate: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" /></label>
        <label className="text-sm font-semibold text-slate-700">Tiền cọc (VNĐ)<input required type="number" min="0" step="1" value={form.depositAmount} onChange={e => setForm({ ...form, depositAmount: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" /></label>
        <label className="text-sm font-semibold text-slate-700 sm:col-span-2 lg:col-span-3">Ảnh giới thiệu xe (mỗi URL một dòng)
          <textarea rows={3} maxLength={20480} value={form.imageUrls} onChange={e => setForm({ ...form, imageUrls: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" placeholder="https://.../xe-may-dien-1.jpg&#10;https://.../xe-may-dien-2.jpg" />
          <span className="mt-1 block text-xs font-normal text-slate-500">Tối đa 10 ảnh. Dán URL ảnh HTTP/HTTPS đã tải lên kho lưu trữ; hiện chưa hỗ trợ tải file trực tiếp. Khi chỉnh sửa, danh sách URL này sẽ thay thế bộ ảnh hiện tại.</span>
        </label>
        {editing && <label className="text-sm font-semibold text-slate-700">Trạng thái khai thác<select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as Vehicle['status'] })} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal">{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}
      </div>
      {(stations.length === 0 || (!editing && models.length === 0)) && <p className="text-xs text-amber-700">Cần có ít nhất một điểm thuê đang hoạt động và một dòng xe trước khi thêm phương tiện.</p>}
      <button disabled={saving || stations.length === 0 || (!editing && models.length === 0)} className="rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-50">{saving ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Thêm phương tiện'}</button>
    </form>

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 p-5"><div><h2 className="font-bold text-slate-900">Danh sách phương tiện</h2><p className="mt-1 text-xs text-slate-500">Danh sách hiện tại từ API đội xe.</p></div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row"><input value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="Tìm mã xe, biển số..." className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"><option value="ALL">Mọi trạng thái</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div></div>
      {loading ? <p className="p-5 text-sm text-slate-500">Đang tải đội xe...</p> : filtered.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">Không có phương tiện phù hợp.</p> :
        <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Phương tiện</th><th className="px-5 py-3">Điểm thuê</th><th className="px-5 py-3">Giá thuê</th><th className="px-5 py-3">Tiền cọc</th><th className="px-5 py-3">Trạng thái</th><th className="px-5 py-3">Thao tác</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{filtered.map(item => <tr key={item.id} className="hover:bg-slate-50/70">
            <td className="px-5 py-4"><div className="flex items-center gap-3">
              {item.images?.[0]?.imageUrl ? <img src={item.images[0].imageUrl} alt={item.model?.brand + ' ' + item.model?.name} loading="lazy" className="h-14 w-16 rounded-xl border border-slate-200 object-cover" /> : <span className="flex h-14 w-16 items-center justify-center rounded-xl bg-slate-100 text-xs font-black text-slate-400">EV</span>}
              <div><p className="font-bold text-slate-900">{item.model?.brand} {item.model?.name}</p><p className="mt-1 text-xs text-slate-500">{item.code} · {item.licensePlate}</p></div>
            </div></td>
            <td className="px-5 py-4">{item.station?.name || '—'}</td><td className="px-5 py-4 font-semibold">{money(item.dailyRate)}<span className="block text-xs font-normal text-slate-400">/ 24 giờ</span></td>
            <td className="px-5 py-4">{money(item.depositAmount)}</td>
            <td className="px-5 py-4"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{statusLabels[item.status] || item.status}</span></td>
            <td className="px-5 py-4"><button onClick={() => startEdit(item)} className="font-semibold text-blue-700 hover:underline">Chỉnh sửa</button></td>
          </tr>)}</tbody>
        </table></div>}
    </section>
  </section>;
}
