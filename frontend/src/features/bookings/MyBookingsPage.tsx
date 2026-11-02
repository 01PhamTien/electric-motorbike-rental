import { useEffect, useState } from 'react';
import { api } from '../../services/api';

export function MyBookingsPage() {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => { api.get('/bookings/my').then(r => setItems(r.data)).catch(() => setItems([])); }, []);
  return <section><h1 className="mb-6 text-2xl font-bold">Đơn thuê của tôi</h1><div className="space-y-3">{items.map(b => <article key={b.id} className="rounded-xl bg-white p-5 shadow-sm"><div className="flex justify-between"><strong>Đơn #{b.id}</strong><span>{b.status}</span></div><p className="mt-2 text-sm">{new Date(b.pickupAt).toLocaleString('vi-VN')} → {new Date(b.returnAt).toLocaleString('vi-VN')}</p></article>)}</div></section>;
}
