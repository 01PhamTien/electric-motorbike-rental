import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Brand } from '../../components/Brand';
import { api } from '../../services/api';
import { useAuth } from './AuthContext';

export function LoginPage() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      if (!data?.accessToken) throw new Error('Missing access token');
      localStorage.setItem('accessToken', data.accessToken);
      await refresh();
      // Let RoleLanding route the verified account to its own workspace.
      // A shared customer URL such as /bookings/my must not be the default for ADMIN/STAFF.
      navigate('/', { replace: true });
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(message || 'Đăng nhập thất bại. Vui lòng kiểm tra email và mật khẩu.');
    } finally { setBusy(false); }
  }
  return <main className="grid min-h-screen bg-[#f3f8f5] lg:grid-cols-2">
    <div className="flex flex-col px-5 py-8 sm:px-12 lg:px-20">
      <Brand />
      <div className="mx-auto flex w-full max-w-[440px] flex-1 flex-col justify-center py-14">
        <p className="eyebrow">CHÀO MỪNG TRỞ LẠI</p><h1 className="mt-3 text-4xl font-extrabold">Tiếp tục hành trình của bạn.</h1><p className="mt-4 text-sm leading-7 text-slate-500">Đăng nhập để đặt xe, xem lịch thuê và quản lý các chuyến đi tại Đà Nẵng.</p>
        <form onSubmit={submit} className="mt-9 space-y-5"><label className="block"><span className="field-label">Email</span><input type="email" autoComplete="email" required className="field" placeholder="ban@example.com" value={email} onChange={e => setEmail(e.target.value)}/></label><label className="block"><span className="field-label">Mật khẩu</span><input type="password" autoComplete="current-password" minLength={6} required className="field" placeholder="Nhập mật khẩu" value={password} onChange={e => setPassword(e.target.value)}/></label>{error && <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}<button disabled={busy} className="btn-primary w-full">{busy ? 'Đang đăng nhập...' : 'Đăng nhập →'}</button></form>
        <p className="mt-7 text-center text-sm text-slate-500">Chưa có tài khoản? <Link className="font-extrabold text-emerald-700" to="/register">Đăng ký ngay ↗</Link></p>
        <Link to="/" className="mt-7 text-center text-xs font-semibold text-slate-500 hover:text-emerald-700">← Về trang chủ</Link>
      </div>
    </div>
    <aside className="hero-mesh relative hidden flex-col justify-between overflow-hidden p-16 text-white lg:flex"><div className="relative z-10"><span className="rounded-full border border-white/20 px-4 py-2 text-xs font-bold text-emerald-200">VOLTGO · ĐÀ NẴNG</span><h2 className="mt-10 max-w-lg text-5xl font-extrabold leading-tight">Khám phá nhiều hơn. Lo ít hơn.</h2><p className="mt-5 max-w-md leading-8 text-emerald-50/80">Một nền tảng để sắp xếp lịch thuê và chủ động mỗi điểm dừng tại thành phố biển.</p></div><div className="relative rounded-3xl border border-white/20 bg-white/10 p-8 backdrop-blur"><p className="text-4xl">“</p><p className="mt-3 text-xl font-bold leading-8">Hành trình đáng nhớ bắt đầu từ sự tự do lựa chọn.</p></div></aside>
  </main>;
}
