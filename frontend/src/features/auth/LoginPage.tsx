import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const { data } = await api.post('/auth/login', { email, password });
      localStorage.setItem('accessToken', data.accessToken);
      navigate('/vehicles');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Đăng nhập thất bại');
    }
  }

  return <main className="mx-auto mt-20 max-w-md rounded-2xl bg-white p-8 shadow">
    <h1 className="mb-6 text-2xl font-bold">Đăng nhập</h1>
    <form onSubmit={submit} className="space-y-4">
      <input className="w-full" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
      <input className="w-full" type="password" placeholder="Mật khẩu" value={password} onChange={e => setPassword(e.target.value)} />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button className="w-full bg-slate-900 text-white">Đăng nhập</button>
    </form>
  </main>;
}
