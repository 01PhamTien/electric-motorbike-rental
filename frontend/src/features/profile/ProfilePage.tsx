import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { SectionHeading } from '../../components/Brand';
import { useAuth } from '../auth/AuthContext';
import { api } from '../../services/api';

export function ProfilePage() {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(''); setNotice(''); setBusy(true);
    try {
      await api.patch('/users/me/password', { currentPassword, newPassword });
      setCurrentPassword(''); setNewPassword('');
      setNotice('Mật khẩu đã được thay đổi thành công.');
    } catch (err: unknown) {
      const m = (err as {response?:{data?:{message?:string|string[]}}}).response?.data?.message;
      setError(Array.isArray(m) ? m.join(', ') : m || 'Không thể đổi mật khẩu.');
    } finally { setBusy(false); }
  }
  return <section className="container-page py-12 sm:py-16">
    <SectionHeading eyebrow="TÀI KHOẢN VOLTGO" title="Hồ sơ và bảo mật" description="Xem thông tin tài khoản và tự thay đổi mật khẩu để bảo vệ quyền truy cập." />
    <div className="mt-8 grid gap-6 lg:grid-cols-2">
      <div className="panel self-start p-7"><h2 className="text-xl font-extrabold">Thông tin tài khoản</h2>
        <div className="mt-6 space-y-5 text-sm"><div><p className="field-label">Họ và tên</p><p className="font-semibold">{user?.fullName || '—'}</p></div><div><p className="field-label">Email</p><p className="font-semibold">{user?.email || '—'}</p></div><div><p className="field-label">Vai trò</p><span className="tag">{user?.role || '—'}</span></div><div><p className="field-label">Điểm thuê được phân công</p><p className="font-semibold">{user?.stationId ? 'Trạm #' + user.stationId : 'Chưa phân công'}</p></div></div>
        <Link to="/" className="mt-7 inline-flex text-sm font-bold text-emerald-700">← Về trang chủ</Link>
      </div>
      <form onSubmit={submit} className="panel self-start p-7"><h2 className="text-xl font-extrabold">Thay đổi mật khẩu</h2><p className="mt-2 text-sm text-slate-500">Đổi mật khẩu ngay sau khi được cấp hoặc đặt lại tài khoản.</p>
        <div className="mt-6 space-y-5">
          <label className="block"><span className="field-label">Mật khẩu hiện tại</span><input className="field" type="password" autoComplete="current-password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required /></label>
          <label className="block"><span className="field-label">Mật khẩu mới</span><input className="field" type="password" autoComplete="new-password" minLength={8} maxLength={72} value={newPassword} onChange={e => setNewPassword(e.target.value)} required /></label>
          {error && <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
          {notice && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}
          <button disabled={busy} className="btn-primary w-full">{busy ? 'Đang cập nhật...' : 'Đổi mật khẩu →'}</button>
        </div>
      </form>
    </div>
  </section>;
}
