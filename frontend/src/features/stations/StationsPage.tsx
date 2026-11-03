import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, LoadingState, SectionHeading } from '../../components/Brand';
import { api } from '../../services/api';
import type { Station } from '../../types';

export function StationsPage() {
  const [items, setItems] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => { let alive = true; api.get('/stations').then(({ data }) => { if (alive) setItems(Array.isArray(data) ? data : data?.items ?? []); }).catch(() => { if (alive) setError('Không thể tải các điểm nhận xe. Vui lòng thử lại.'); }).finally(() => { if (alive) setLoading(false); }); return () => { alive = false; }; }, []);
  return <div className="container-page py-12 sm:py-16">
    <div className="flex flex-wrap items-end justify-between gap-6"><SectionHeading eyebrow="MẠNG LƯỚI ĐIỂM THUÊ" title="Nhận xe thuận tiện, khám phá tự do" description="Tìm địa điểm nhận xe phù hợp với lịch trình. Địa chỉ, vị trí và liên hệ được cập nhật từ hệ thống."/><Link to="/vehicles" className="btn-dark">Khám phá xe ↗</Link></div>
    <div className="mt-9 rounded-[26px] bg-[#0e3439] p-8 text-white sm:p-10"><div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center"><div><p className="text-xs font-black uppercase tracking-[.2em] text-emerald-300">ĐÀ NẴNG, VIỆT NAM</p><h2 className="mt-3 text-2xl font-extrabold sm:text-3xl">Điểm bắt đầu cho hành trình xanh của bạn.</h2><p className="mt-3 max-w-xl text-sm leading-7 text-emerald-50/80">Từ trung tâm thành phố đến những cung đường ven biển, chủ động chọn điểm nhận xe và tham khảo đường đi.</p></div><div className="rounded-2xl border border-white/20 bg-white/10 px-8 py-5 text-center"><strong className="block text-4xl font-black text-emerald-300">{items.length}</strong><span className="text-xs font-semibold uppercase tracking-wider">Điểm thuê</span></div></div></div>
    {loading ? <div className="mt-8"><LoadingState /></div> : error ? <p role="alert" className="mt-8 rounded-xl bg-rose-50 p-6 text-rose-700">{error}</p> : items.length === 0 ? <div className="mt-8"><EmptyState title="Chưa có điểm thuê" description="Các điểm nhận xe sẽ xuất hiện khi hệ thống được cập nhật." /></div> : <div className="mt-8 grid gap-6 md:grid-cols-2">{items.map((s, i) => {
      const lat = Number(s.latitude); const lng = Number(s.longitude);
      const validMap = Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
      return <article key={s.id} className="panel overflow-hidden"><div className="relative flex h-44 items-center justify-center bg-gradient-to-br from-emerald-100 via-[#e8f2ec] to-sky-100"><div className="absolute left-7 top-6 rounded-full bg-white px-4 py-2 text-xs font-bold text-emerald-800 shadow-sm">ĐIỂM NHẬN {String(i + 1).padStart(2,'0')}</div><div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0e4740] text-3xl text-emerald-200 shadow-xl">⌖</div><div className="absolute bottom-4 text-xs font-bold tracking-wider text-emerald-800">ĐÀ NẴNG</div></div><div className="p-7"><h3 className="text-xl font-extrabold">{s.name}</h3><p className="mt-3 text-sm leading-6 text-slate-600">⌖ {s.address}</p>{s.phone && <p className="mt-2 text-sm text-slate-600">☎ {s.phone}</p>}<div className="mt-6 flex flex-wrap gap-3 border-t border-slate-100 pt-6"><Link to="/vehicles" className="btn-primary">Chọn xe tại đây ↗</Link>{validMap && <a href={'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(lat + ',' + lng)} target="_blank" rel="noreferrer" className="btn-outline">Chỉ đường ↗</a>}</div></div></article>;
    })}</div>}
  </div>;
}
