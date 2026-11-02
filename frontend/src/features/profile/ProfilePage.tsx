import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../auth/AuthContext';

const roleLabels = { CUSTOMER: 'Khách hàng', STAFF: 'Nhân viên vận hành', ADMIN: 'Quản trị viên' } as const;
const assetUrl = (path?: string | null) => {
  if (!path) return '';
  const base = (api.defaults.baseURL || 'http://localhost:3000/api').split('/api')[0];
  return path.startsWith('http') ? path : base + path;
};

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Không đọc được ảnh'));
    reader.onerror = () => reject(new Error('Không đọc được ảnh'));
    reader.readAsDataURL(file);
  });
}

export function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [form, setForm] = useState({ fullName: user?.fullName || '', email: user?.email || '', phone: user?.phone || '' });
  const [password, setPassword] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (user) setForm({ fullName: user.fullName || '', email: user.email || '', phone: user.phone || '' });
  }, [user?.id, user?.fullName, user?.email, user?.phone]);

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    setSaving(true); setError(''); setMessage('');
    try {
      await api.patch('/users/me', {
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
      });
      await refreshUser();
      setMessage('Thông tin cá nhân đã được cập nhật.');
    } catch (err: any) {
      setError(Array.isArray(err.response?.data?.message) ? err.response.data.message.join(', ') : err.response?.data?.message || 'Không thể cập nhật hồ sơ.');
    } finally { setSaving(false); }
  }

  async function uploadAvatar(file?: File) {
    if (!file) return;
    setError(''); setMessage('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Chỉ chấp nhận ảnh JPG, PNG hoặc WEBP.'); return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setError('Ảnh đại diện không được vượt quá 3 MB.'); return;
    }
    setUploading(true);
    try {
      const avatarDataUrl = await readFileAsDataUrl(file);
      await api.patch('/users/me/avatar', { avatarDataUrl });
      await refreshUser();
      setMessage('Ảnh đại diện đã được cập nhật.');
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Không thể tải ảnh đại diện.');
    } finally { setUploading(false); }
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    setError(''); setMessage('');
    if (password.newPassword !== password.confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.'); return;
    }
    if (password.newPassword.length < 8) {
      setError('Mật khẩu mới phải có ít nhất 8 ký tự.'); return;
    }
    setChangingPassword(true);
    try {
      const response = await api.patch('/users/me/password', {
        currentPassword: password.currentPassword,
        newPassword: password.newPassword,
      });
      setMessage(response.data?.message || 'Đổi mật khẩu thành công.');
      setPassword({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không thể đổi mật khẩu.');
    } finally { setChangingPassword(false); }
  }

  if (!user) return <div className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500">Không tìm thấy thông tin tài khoản.</div>;

  return <section className="mx-auto max-w-5xl space-y-6">
    <header className="relative overflow-hidden rounded-3xl bg-slate-950 px-6 py-7 text-white shadow-lg sm:px-8 sm:py-9">
      <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />
      <div className="relative">
        <span className="inline-flex rounded-full border border-blue-300/20 bg-blue-300/10 px-3 py-1 text-[11px] font-bold tracking-[0.15em] text-blue-200">TÀI KHOẢN EV RENTAL</span>
        <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">Hồ sơ cá nhân</h1>
        <p className="mt-2 text-sm text-slate-300">Quản lý thông tin liên hệ, ảnh đại diện và bảo mật tài khoản.</p>
      </div>
    </header>

    {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
    {message && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{message}</div>}

    <div className="grid gap-6 lg:grid-cols-[0.75fr_1.25fr]">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="font-bold text-slate-900">Ảnh đại diện</h2>
        <div className="mt-5 flex flex-col items-center text-center">
          {user.avatarUrl ? <img src={assetUrl(user.avatarUrl)} alt="Ảnh đại diện" className="h-28 w-28 rounded-full border-4 border-slate-100 object-cover shadow-sm" /> :
            <div className="flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 text-3xl font-black text-white shadow-lg">{user.fullName.trim().charAt(0).toUpperCase()}</div>}
          <p className="mt-4 text-lg font-bold text-slate-900">{user.fullName}</p>
          <p className="mt-1 text-sm text-slate-500">{roleLabels[user.role]}</p>
          {user.role === 'STAFF' && user.station?.name && <p className="mt-1 text-xs text-slate-400">{user.station.name}</p>}
          <label className="mt-5 inline-flex cursor-pointer items-center justify-center rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-800">
            {uploading ? 'Đang tải ảnh...' : 'Chọn ảnh đại diện'}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={uploading} onChange={event => { void uploadAvatar(event.target.files?.[0]); event.currentTarget.value = ''; }} />
          </label>
          <p className="mt-2 text-[11px] leading-5 text-slate-400">JPG, PNG hoặc WEBP · Tối đa 3 MB</p>
        </div>
        <div className="mt-6 space-y-3 border-t border-slate-100 pt-5 text-sm">
          <div className="flex justify-between gap-3"><span className="text-slate-500">Mã tài khoản</span><span className="font-semibold text-slate-800">#{user.id}</span></div>
          <div className="flex justify-between gap-3"><span className="text-slate-500">Vai trò</span><span className="font-semibold text-slate-800">{roleLabels[user.role]}</span></div>
          <div className="flex justify-between gap-3"><span className="text-slate-500">Trạng thái</span><span className="font-semibold text-emerald-700">{user.status === 'ACTIVE' ? 'Đang hoạt động' : 'Đã khóa'}</span></div>
        </div>
      </section>

      <div className="space-y-6">
        <form onSubmit={saveProfile} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div><h2 className="font-bold text-slate-900">Thông tin liên hệ</h2><p className="mt-1 text-xs text-slate-500">Thông tin được sử dụng trong hồ sơ và quá trình thuê xe.</p></div>
          <label className="block text-sm font-semibold text-slate-700">Họ và tên
            <input required maxLength={120} value={form.fullName} onChange={event => setForm({ ...form, fullName: event.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" />
          </label>
          <label className="block text-sm font-semibold text-slate-700">Email
            <input required type="email" maxLength={160} value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" />
          </label>
          <label className="block text-sm font-semibold text-slate-700">Số điện thoại
            <input maxLength={20} value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" placeholder="Nhập số điện thoại" />
          </label>
          <button disabled={saving} className="rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-50">{saving ? 'Đang lưu...' : 'Lưu thông tin'}</button>
        </form>

        <form onSubmit={changePassword} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div><h2 className="font-bold text-slate-900">Đổi mật khẩu</h2><p className="mt-1 text-xs text-slate-500">Nhập mật khẩu hiện tại để xác nhận trước khi thay đổi.</p></div>
          <label className="block text-sm font-semibold text-slate-700">Mật khẩu hiện tại
            <input required type="password" autoComplete="current-password" value={password.currentPassword} onChange={event => setPassword({ ...password, currentPassword: event.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" />
          </label>
          <label className="block text-sm font-semibold text-slate-700">Mật khẩu mới
            <input required minLength={8} maxLength={72} type="password" autoComplete="new-password" value={password.newPassword} onChange={event => setPassword({ ...password, newPassword: event.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" />
          </label>
          <label className="block text-sm font-semibold text-slate-700">Xác nhận mật khẩu mới
            <input required minLength={8} maxLength={72} type="password" autoComplete="new-password" value={password.confirmPassword} onChange={event => setPassword({ ...password, confirmPassword: event.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" />
          </label>
          <button disabled={changingPassword} className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">{changingPassword ? 'Đang cập nhật...' : 'Đổi mật khẩu'}</button>
        </form>
      </div>
    </div>
  </section>;
}
