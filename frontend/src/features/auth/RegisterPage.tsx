import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from './AuthContext';

export function RegisterPage() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/register', {
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        password: form.password,
      });
      localStorage.setItem('accessToken', data.accessToken);
      const currentUser = await refreshUser();
      if (!currentUser) throw new Error('Không thể xác thực tài khoản vừa tạo.');
      navigate('/vehicles', { replace: true });
    } catch (err: any) {
      localStorage.removeItem('accessToken');
      setError(err?.response?.data?.message || err.message || 'Đăng ký thất bại');
    } finally {
      setLoading(false);
    }
  }

  return <main className="mx-auto flex min-h-[calc(100vh-250px)] max-w-5xl items-center justify-center px-0 py-6 sm:py-10">
    <div className="grid w-full overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.10)] md:grid-cols-[0.9fr_1.1fr]">
      <aside className="relative hidden min-h-[610px] flex-col justify-between overflow-hidden bg-slate-950 p-9 text-white md:flex lg:p-11">
        <div className="pointer-events-none absolute -right-24 -top-20 h-80 w-80 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 -left-24 h-80 w-80 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="relative">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 text-xl font-black shadow-lg">EV</div>
          <p className="mt-8 text-[10px] font-black tracking-[0.24em] text-cyan-300">EV RENTAL · ĐÀ NẴNG</p>
          <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight lg:text-4xl">Chọn hành trình<br/><span className="text-cyan-300">theo cách xanh.</span></h1>
          <p className="mt-5 max-w-sm text-sm leading-7 text-slate-300">Tạo tài khoản khách hàng để tìm kiếm xe máy điện, lựa chọn thời gian và quản lý đơn thuê.</p>
        </div>
        <div className="relative rounded-2xl border border-white/10 bg-white/[0.06] p-5">
          <p className="text-sm font-bold">Bắt đầu thật đơn giản</p>
          <p className="mt-2 text-xs leading-6 text-slate-400">Đăng ký tài khoản khách hàng. Tài khoản nhân viên và quản trị được cấp bởi quản trị hệ thống.</p>
        </div>
      </aside>

      <section className="flex flex-col justify-center px-6 py-9 sm:px-10 sm:py-12 lg:px-12">
        <div className="mb-8 md:hidden">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-600 text-lg font-black text-white">EV</div>
          <p className="mt-4 text-[10px] font-black tracking-[0.2em] text-blue-700">EV RENTAL ĐÀ NẴNG</p>
        </div>
        <div className="mb-8">
          <p className="text-xs font-bold tracking-[0.16em] text-blue-700">THÀNH VIÊN MỚI</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Tạo tài khoản</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">Điền thông tin bên dưới để đăng ký tài khoản khách hàng.</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-5 text-rose-700">{Array.isArray(error) ? error.join(', ') : error}</div>}
          <label className="block text-sm font-bold text-slate-700">Họ và tên
            <input required maxLength={120} autoComplete="name" value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-normal focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-100" placeholder="Nguyễn Văn A" />
          </label>
          <label className="block text-sm font-bold text-slate-700">Địa chỉ email
            <input required type="email" maxLength={160} autoComplete="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-normal focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-100" placeholder="name@example.com" />
          </label>
          <label className="block text-sm font-bold text-slate-700">Số điện thoại <span className="font-normal text-slate-400">(không bắt buộc)</span>
            <input type="tel" autoComplete="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-normal focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-100" placeholder="09xxxxxxxx" />
          </label>
          <label className="block text-sm font-bold text-slate-700">Mật khẩu
            <div className="relative mt-2">
              <input required minLength={8} type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 pr-20 text-sm font-normal focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-100" placeholder="Ít nhất 8 ký tự" />
              <button type="button" onClick={() => setShowPassword(value => !value)} className="absolute inset-y-0 right-2 my-1 rounded-lg px-3 text-xs font-bold text-slate-500 hover:bg-slate-100">{showPassword ? 'Ẩn' : 'Hiện'}</button>
            </div>
          </label>
          <button disabled={loading} className="w-full rounded-xl bg-blue-700 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-700/15 transition hover:-translate-y-0.5 hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60">{loading ? 'Đang tạo tài khoản...' : 'Đăng ký tài khoản'}</button>
        </form>

        <div className="mt-7 border-t border-slate-100 pt-6 text-center">
          <p className="text-sm text-slate-500">Đã có tài khoản? <Link to="/login" className="font-bold text-blue-700 hover:text-blue-800 hover:underline">Đăng nhập</Link></p>
          <p className="mt-5 text-[11px] text-slate-400">Chỉ đăng ký tài khoản khách hàng. Quyền nhân viên do ADMIN cấp.</p>
        </div>
      </section>
    </div>
  </main>;
}
