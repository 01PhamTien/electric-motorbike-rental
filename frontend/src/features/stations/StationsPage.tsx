import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import type { Station } from '../../types';

export function StationsPage() {
  const [items, setItems] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<Station[]>('/stations')
      .then(response => setItems(Array.isArray(response.data) ? response.data.filter((station: any) => station.isActive !== false) : []))
      .catch((err: any) => setError(err.response?.data?.message || 'Không tải được danh sách điểm thuê.'))
      .finally(() => setLoading(false));
  }, []);

  return <section className="space-y-6">
    <header className="relative overflow-hidden rounded-3xl bg-slate-950 px-6 py-8 text-white shadow-lg sm:px-9">
      <div className="pointer-events-none absolute -right-12 -top-20 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="relative max-w-2xl"><span className="inline-flex rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[11px] font-bold tracking-[0.15em] text-cyan-200">EV RENTAL · ĐÀ NẴNG</span>
        <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">Các điểm thuê xe</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">Chọn điểm thuê thuận tiện để nhận xe và bắt đầu hành trình. Vui lòng xem địa chỉ chi tiết trước khi đặt xe.</p>
      </div>
    </header>

    {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
    <div className="flex flex-wrap items-end justify-between gap-2"><div><p className="text-xs font-bold tracking-[0.12em] text-blue-700">MẠNG LƯỚI ĐIỂM THUÊ</p><h2 className="mt-1 text-xl font-bold text-slate-950">Tìm điểm nhận xe</h2></div>
      {!loading && <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">{items.length} điểm đang hoạt động</span>}</div>

    {loading ? <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{[1,2,3].map(n=><div key={n} className="h-44 animate-pulse rounded-2xl bg-white" />)}</div> :
      items.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><p className="font-semibold text-slate-800">Chưa có điểm thuê đang hoạt động</p><p className="mt-1 text-sm text-slate-500">Vui lòng quay lại sau.</p></div> :
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{items.map((station, index) => <article key={station.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
        <div className="flex h-28 items-center justify-between bg-gradient-to-br from-slate-950 to-blue-900 px-5 text-white"><span className="text-xs font-bold tracking-[0.15em] text-blue-200">STATION {String(index + 1).padStart(2, '0')}</span><span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-2xl">⌖</span></div>
        <div className="p-5"><h3 className="text-lg font-bold text-slate-950">{station.name}</h3><p className="mt-2 min-h-10 text-sm leading-5 text-slate-600">{station.address || 'Địa chỉ đang được cập nhật'}</p>
          <a href="/vehicles" className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-800">Tìm xe tại hệ thống</a>
        </div>
      </article>)}</div>}
  </section>;
}
