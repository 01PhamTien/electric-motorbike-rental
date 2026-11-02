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

  return <main className="mx-auto mt-10 max-w-md px-4 sm:mt-16">
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60">
      <div className="bg-slate-950 px-8 py-7 text-white">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-xl font-black">EV</div>
        <p className="text-xs font-bold tracking-[0.2em] text-blue-300">EV RENTAL ĐÀ NẴNG</p>
        <h1 className="mt-2 text-2xl font-bold">Chào mừng trở lại</h1>
        <p className="mt-1 text-sm text-slate-300">Đăng nhập để tiếp tục sử dụng hệ thống.</p>
      </div>
      <form onSubmit={submit} className="space-y-5 p-8">
        {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <label className="block text-sm font-semibold text-slate-700">Email
          <input required type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" placeholder="name@example.com" />
        </label>
        <label className="block text-sm font-semibold text-slate-700">Mật khẩu
          <input required type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" placeholder="Nhập mật khẩu" />
        </label>
        <button disabled={loading} className="w-full rounded-lg bg-blue-700 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60">
          {loading ? 'Đang xác thực...' : 'Đăng nhập'}
        </button>
        <p className="text-center text-sm text-slate-500">Chưa có tài khoản? <Link to="/register" className="font-semibold text-blue-700 hover:underline">Đăng ký khách hàng</Link></p>
      </form>
    </div>
  </main>;
}
