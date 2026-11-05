import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Brand } from '../../components/Brand';
import { api } from '../../services/api';
import { useAuth } from './AuthContext';

export function RegisterPage() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const { data } = await api.post('/auth/register', form);
      if (data?.accessToken) { localStorage.setItem('accessToken', data.accessToken); await refresh(); navigate('/vehicles'); }
      else navigate('/login');
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(message || 'Đăng ký thất bại. Vui lòng kiểm tra thông tin và thử lại.');
    } finally { setBusy(false); }
  }
  return <main className="grid min-h-screen bg-[#f5faf7] lg:grid-cols-2">
    <aside className="relative hidden flex-col justify-between bg-gradient-to-br from-[#dff7e9] via-[#c9f0dc] to-[#a9e6ca] p-16 text-[#245344] lg:flex"><div><span className="inline-flex rounded-full border border-white/70 bg-white/50 px-4 py-2 text-xs font-bold text-[#267657]">VOLTGO · ĐÀ NẴNG</span><h2 className="mt-10 max-w-lg text-5xl font-extrabold leading-tight">Hành trình mới bắt đầu từ đây.</h2><p className="mt-6 max-w-md leading-8 text-[#52796a]">Tạo tài khoản để khám phá danh sách xe, đặt thuê trực tuyến và theo dõi lịch trình của bạn.</p></div><div className="rounded-3xl border border-white/70 bg-white/55 p-7 text-[#315c4b] shadow-sm backdrop-blur"><p className="text-3xl">⚡</p><p className="mt-3 font-semibold">Một chiếc xe điện. Cả Đà Nẵng phía trước.</p></div></aside>
    <div className="flex flex-col px-5 py-8 sm:px-12 lg:px-20"><Brand /><div className="mx-auto flex w-full max-w-[440px] flex-1 flex-col justify-center py-14"><p className="eyebrow">THAM GIA VOLTGO</p><h1 className="mt-3 text-4xl font-extrabold">Bắt đầu chuyến đi xanh.</h1><p className="mt-4 text-sm leading-7 text-slate-500">Tạo tài khoản miễn phí để dễ dàng quản lý lịch thuê xe điện của bạn.</p>
      <form onSubmit={submit} className="mt-9 space-y-4 rounded-[28px] border border-[#e5eee8] bg-white p-6 shadow-[0_18px_55px_rgba(30,90,65,.07)] sm:p-8"><label className="block"><span className="field-label">Họ và tên</span><input required className="field" autoComplete="name" placeholder="Nguyễn Văn A" value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })}/></label><label className="block"><span className="field-label">Email</span><input required type="email" autoComplete="email" className="field" placeholder="ban@example.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}/></label><label className="block"><span className="field-label">Số điện thoại</span><input required type="tel" autoComplete="tel" className="field" placeholder="09xxxxxxxx" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}/></label><label className="block"><span className="field-label">Mật khẩu</span><input required type="password" minLength={8} autoComplete="new-password" className="field" placeholder="Ít nhất 8 ký tự" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}/></label>{error && <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}<button disabled={busy} className="btn-primary w-full">{busy ? 'Đang đăng ký...' : 'Tạo tài khoản →'}</button></form>
      <p className="mt-7 text-center text-sm text-slate-500">Đã có tài khoản? <Link className="font-extrabold text-[#159b70]" to="/login">Đăng nhập ↗</Link></p><Link to="/" className="mt-7 text-center text-xs font-semibold text-slate-500">← Về trang chủ</Link>
    </div></div>
  </main>;
}
