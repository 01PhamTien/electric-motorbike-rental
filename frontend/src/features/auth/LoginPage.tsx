import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { roleHome, useAuth } from './AuthContext';

export function LoginPage() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email: email.trim(), password });
      localStorage.setItem('accessToken', data.accessToken);
      const currentUser = await refreshUser();
      if (!currentUser) throw new Error('Tài khoản không hoạt động hoặc không thể xác thực.');
      navigate(roleHome(currentUser.role), { replace: true });
    } catch (err: any) {
      localStorage.removeItem('accessToken');
      setError(err?.response?.data?.message || err.message || 'Đăng nhập thất bại');
    } finally {
      setLoading(false);
    }
  }

  return <main className="mx-auto flex min-h-[calc(100vh-250px)] max-w-5xl items-center justify-center px-0 py-6 sm:py-10">
    <div className="grid w-full overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.10)] md:grid-cols-[0.95fr_1.05fr]">
      <aside className="relative hidden min-h-[570px] flex-col justify-between overflow-hidden bg-slate-950 p-9 text-white md:flex lg:p-11">
        <div className="pointer-events-none absolute -right-24 -top-20 h-80 w-80 rounded-full bg-blue-500/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 -left-24 h-80 w-80 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="relative">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-xl font-black shadow-lg shadow-blue-950/40">EV</div>
          <p className="mt-8 text-[10px] font-black tracking-[0.24em] text-blue-300">EV RENTAL · ĐÀ NẴNG</p>
          <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight lg:text-4xl">Hành trình mới<br/><span className="text-blue-300">bắt đầu từ đây.</span></h1>
          <p className="mt-5 max-w-sm text-sm leading-7 text-slate-300">Một nền tảng thuận tiện để đặt thuê, vận hành và quản lý dịch vụ xe máy điện.</p>
        </div>
        <div className="relative space-y-3">
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400/10 text-lg text-emerald-300">↗</span>
            <div><p className="text-sm font-bold">Di chuyển linh hoạt</p><p className="mt-1 text-xs text-slate-400">Tìm xe và điểm nhận phù hợp</p></div>
          </div>
          <p className="text-[11px] text-slate-500">ELECTRIC MOBILITY MANAGEMENT PLATFORM</p>
        </div>
      </aside>

      <section className="flex flex-col justify-center px-6 py-9 sm:px-10 sm:py-12 lg:px-12">
        <div className="mb-8 md:hidden">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-lg font-black text-white">EV</div>
          <p className="mt-4 text-[10px] font-black tracking-[0.2em] text-blue-700">EV RENTAL ĐÀ NẴNG</p>
        </div>
        <div className="mb-8">
          <p className="text-xs font-bold tracking-[0.16em] text-blue-700">CHÀO MỪNG TRỞ LẠI</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Đăng nhập</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">Nhập thông tin tài khoản để tiếp tục sử dụng hệ thống.</p>
        </div>

        <form onSubmit={submit} className="space-y-5">
          {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-5 text-rose-700">{Array.isArray(error) ? error.join(', ') : error}</div>}
          <label className="block text-sm font-bold text-slate-700">Địa chỉ email
            <input required type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-normal transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-100" placeholder="name@example.com" />
          </label>
          <label className="block text-sm font-bold text-slate-700">Mật khẩu
            <div className="relative mt-2">
              <input required type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 pr-20 text-sm font-normal transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-100" placeholder="Nhập mật khẩu" />
              <button type="button" onClick={() => setShowPassword(value => !value)} className="absolute inset-y-0 right-2 my-1 rounded-lg px-3 text-xs font-bold text-slate-500 hover:bg-slate-100">{showPassword ? 'Ẩn' : 'Hiện'}</button>
            </div>
          </label>
          <button disabled={loading} className="w-full rounded-xl bg-blue-700 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-700/15 transition hover:-translate-y-0.5 hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60">
            {loading ? 'Đang xác thực...' : 'Đăng nhập hệ thống'}
          </button>
        </form>

        <div className="mt-7 border-t border-slate-100 pt-6 text-center">
          <p className="text-sm text-slate-500">Chưa có tài khoản? <Link to="/register" className="font-bold text-blue-700 hover:text-blue-800 hover:underline">Đăng ký khách hàng</Link></p>
          <p className="mt-5 text-[11px] text-slate-400">Bằng việc đăng nhập, bạn tiếp tục sử dụng dịch vụ EV Rental.</p>
        </div>
      </section>
    </div>
  </main>;
}
