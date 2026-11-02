import { FormEvent, useEffect, useState } from 'react';
import { api } from '../../services/api';

type Station = { id: number; name: string; address: string; isActive: boolean };
type Staff = {
  id: number; fullName: string; email: string; phone: string | null;
  status: 'ACTIVE' | 'LOCKED'; stationId: number | null;
  station?: Station | null; createdAt: string;
};

const emptyForm = { fullName: '', email: '', phone: '', password: '', stationId: '' };

export function StaffPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    setLoading(true); setError('');
    try {
      const [staffResponse, stationResponse] = await Promise.all([
        api.get<Staff[]>('/users/staff'),
        api.get<Station[]>('/stations'),
      ]);
      setStaff(staffResponse.data);
      setStations(stationResponse.data.filter((station) => station.isActive));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không tải được dữ liệu. Hãy đăng nhập bằng tài khoản ADMIN.');
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  function resetForm() { setForm(emptyForm); setEditing(null); }

  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(''); setMessage('');
    try {
      const payload = {
        fullName: form.fullName.trim(), email: form.email.trim(),
        phone: form.phone.trim() || undefined, stationId: Number(form.stationId),
        ...(!editing ? { password: form.password } : {}),
      };
      if (editing) await api.patch(`/users/staff/${editing}`, payload);
      else await api.post('/users/staff', payload);
      setMessage(editing ? 'Đã cập nhật nhân viên.' : 'Đã tạo tài khoản nhân viên.');
      resetForm(); await load();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không thể lưu thông tin nhân viên.');
    } finally { setSaving(false); }
  }

  function startEdit(item: Staff) {
    setEditing(item.id);
    setForm({ fullName: item.fullName, email: item.email, phone: item.phone || '', password: '', stationId: String(item.stationId || '') });
    setMessage(''); setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function toggleStatus(item: Staff) {
    const status = item.status === 'ACTIVE' ? 'LOCKED' : 'ACTIVE';
    if (!window.confirm(`${status === 'LOCKED' ? 'Khóa' : 'Mở khóa'} tài khoản ${item.fullName}?`)) return;
    setError(''); setMessage('');
    try {
      await api.patch(`/users/staff/${item.id}/status`, { status });
      setMessage(status === 'LOCKED' ? 'Đã khóa tài khoản.' : 'Đã mở khóa tài khoản.');
      await load();
    } catch (err: any) { setError(err.response?.data?.message || 'Không thể cập nhật trạng thái.'); }
  }

  return <section className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-sm font-medium text-blue-700">QUẢN TRỊ HỆ THỐNG</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Quản lý nhân viên</h1>
        <p className="mt-1 text-sm text-slate-600">Tạo tài khoản, phân công điểm thuê và quản lý trạng thái nhân viên.</p></div>
      <button onClick={() => void load()} className="rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-slate-50">Làm mới</button>
    </div>

    {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{Array.isArray(error) ? error.join(', ') : error}</div>}
    {message && <div role="status" className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">{message}</div>}

    <form onSubmit={submit} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-semibold text-slate-900">{editing ? 'Cập nhật nhân viên' : 'Thêm nhân viên mới'}</h2>
        {editing && <button type="button" onClick={resetForm} className="text-sm text-slate-600 underline">Hủy chỉnh sửa</button>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium text-slate-700">Họ và tên
          <input required maxLength={120} value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
        </label>
        <label className="text-sm font-medium text-slate-700">Email
          <input required type="email" maxLength={160} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
        </label>
        <label className="text-sm font-medium text-slate-700">Số điện thoại
          <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
        </label>
        {!editing && <label className="text-sm font-medium text-slate-700">Mật khẩu khởi tạo
          <input required minLength={8} type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
        </label>}
        <label className="text-sm font-medium text-slate-700">Điểm thuê phụ trách
          <select required value={form.stationId} onChange={e => setForm({ ...form, stationId: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
            <option value="">Chọn điểm thuê</option>
            {stations.map(station => <option key={station.id} value={station.id}>{station.name}</option>)}
          </select>
        </label>
      </div>
      <button disabled={saving || stations.length === 0} className="mt-5 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
        {saving ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Tạo nhân viên'}
      </button>
      {stations.length === 0 && <p className="mt-2 text-xs text-amber-700">Chưa có điểm thuê đang hoạt động. Hãy tạo/kích hoạt điểm thuê trước.</p>}
    </form>

    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b p-5"><h2 className="font-semibold text-slate-900">Danh sách nhân viên ({staff.length})</h2></div>
      {loading ? <p className="p-5 text-sm text-slate-500">Đang tải...</p> : staff.length === 0 ? <p className="p-5 text-sm text-slate-500">Chưa có nhân viên.</p> :
        <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>
            <th className="px-5 py-3">Nhân viên</th><th className="px-5 py-3">Liên hệ</th><th className="px-5 py-3">Điểm thuê</th><th className="px-5 py-3">Trạng thái</th><th className="px-5 py-3">Thao tác</th>
          </tr></thead><tbody className="divide-y divide-slate-100">
            {staff.map(item => <tr key={item.id}>
              <td className="px-5 py-4"><div className="font-semibold text-slate-900">{item.fullName}</div><div className="text-xs text-slate-500">ID: {item.id}</div></td>
              <td className="px-5 py-4"><div>{item.email}</div><div className="text-xs text-slate-500">{item.phone || 'Chưa có SĐT'}</div></td>
              <td className="px-5 py-4">{item.station?.name || `Điểm thuê #${item.stationId ?? '—'}`}</td>
              <td className="px-5 py-4"><span className={item.status === 'ACTIVE' ? 'rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700' : 'rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700'}>{item.status === 'ACTIVE' ? 'Hoạt động' : 'Đã khóa'}</span></td>
              <td className="px-5 py-4"><div className="flex gap-3"><button onClick={() => startEdit(item)} className="font-medium text-blue-700 hover:underline">Sửa</button><button onClick={() => void toggleStatus(item)} className="font-medium text-slate-700 hover:underline">{item.status === 'ACTIVE' ? 'Khóa' : 'Mở khóa'}</button></div></td>
            </tr>)}
          </tbody></table></div>}
    </div>
    <p className="text-xs text-slate-500">Chỉ ADMIN được quản lý tài khoản nhân viên. Mật khẩu được băm trước khi lưu; API không trả về passwordHash.</p>
  </section>;
}
