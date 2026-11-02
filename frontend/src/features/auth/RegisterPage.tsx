import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';

export function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '' });
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const { data } = await api.post('/auth/register', form);
      localStorage.setItem('accessToken', data.accessToken);
      navigate('/vehicles');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Đăng ký thất bại');
    }
  }

  return <main className="mx-auto mt-16 max-w-md rounded-2xl bg-white p-8 shadow">
    <h1 className="mb-6 text-2xl font-bold">Đăng ký</h1>
    <form onSubmit={submit} className="space-y-4">
      <input className="w-full" placeholder="Họ tên" onChange={e => setForm({ ...form, fullName: e.target.value })} />
      <input className="w-full" placeholder="Email" onChange={e => setForm({ ...form, email: e.target.value })} />
      <input className="w-full" placeholder="Số điện thoại" onChange={e => setForm({ ...form, phone: e.target.value })} />
      <input className="w-full" type="password" placeholder="Mật khẩu" onChange={e => setForm({ ...form, password: e.target.value })} />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button className="w-full bg-slate-900 text-white">Tạo tài khoản</button>
    </form>
  </main>;
}
