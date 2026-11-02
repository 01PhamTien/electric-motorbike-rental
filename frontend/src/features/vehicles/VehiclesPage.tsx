import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import type { Vehicle } from '../../types';

export function VehiclesPage() {
  const [items, setItems] = useState<Vehicle[]>([]);
  useEffect(() => { api.get('/vehicles').then(r => setItems(r.data)); }, []);
  return <section><h1 className="mb-6 text-2xl font-bold">Danh sách xe</h1><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{items.map(v => <article key={v.id} className="rounded-xl bg-white p-5 shadow-sm"><h2 className="font-semibold">{v.model?.brand} {v.model?.name}</h2><p className="text-sm">{v.code} · {v.licensePlate}</p><p className="mt-3 font-bold">{Number(v.dailyRate).toLocaleString('vi-VN')} đ/ngày</p><p className="mt-1 text-sm text-slate-500">{v.station?.name}</p></article>)}</div></section>;
}
