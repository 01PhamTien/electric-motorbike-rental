import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import type { Station } from '../../types';

export function StationsPage() {
  const [items, setItems] = useState<Station[]>([]);
  useEffect(() => { api.get('/stations').then(r => setItems(r.data)); }, []);
  return <section><h1 className="mb-6 text-2xl font-bold">Điểm thuê</h1><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{items.map(s => <article key={s.id} className="rounded-xl bg-white p-5 shadow-sm"><h2 className="font-semibold">{s.name}</h2><p className="mt-2 text-sm text-slate-600">{s.address}</p></article>)}</div></section>;
}
