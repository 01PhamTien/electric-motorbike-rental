import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, LoadingState, SectionHeading } from '../../components/Brand';
import { StationMap, coordinatesValid, stationDirections } from '../../components/StationMap';
import { api } from '../../services/api';
import type { Station } from '../../types';

export function StationsPage() {
  const [items, setItems] = useState<Station[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    api.get('/stations').then(({ data }) => {
      if (!alive) return;
      const stations: Station[] = Array.isArray(data) ? data : data?.items ?? [];
      const active = stations.filter(s => s.isActive !== false);
      setItems(active);
      setSelectedId(current => active.some(s => s.id === current) ? current : active.find(s => coordinatesValid(s.latitude, s.longitude))?.id ?? active[0]?.id ?? null);
    }).catch(() => {
      if (alive) setError('Không thể tải các điểm nhận xe. Vui lòng thử lại.');
    }).finally(() => {
      if (alive) setLoading(false);
    });
    return () => { alive = false; };
  }, []);
  const selected = items.find(s => s.id === selectedId) ?? items[0];
  return <section className="container-page space-y-9 py-12 sm:py-16">
    <div className="flex flex-wrap items-end justify-between gap-6">
      <SectionHeading eyebrow="MẠNG LƯỚI ĐIỂM THUÊ" title="Chọn điểm nhận xe trên bản đồ" description="Xem vị trí trực quan, địa chỉ, thông tin liên hệ và tìm đường tới điểm nhận phù hợp."/>
      <Link to="/vehicles" className="btn-dark">Khám phá xe ↗</Link>
    </div>
    {loading ? <LoadingState /> : error ? <p role="alert" className="rounded-xl bg-rose-50 p-6 text-rose-700">{error}</p> : !items.length ?
      <EmptyState title="Chưa có điểm thuê" description="Các điểm nhận xe sẽ xuất hiện khi hệ thống được cập nhật." /> :
      <>
        <div className="panel overflow-hidden">
          <div className="grid lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="relative h-[360px] bg-slate-100 sm:h-[470px]">
              {selected && <StationMap key={selected.id} latitude={selected.latitude} longitude={selected.longitude} name={selected.name} />}
              <span className="pointer-events-none absolute left-5 top-5 rounded-full bg-white/95 px-4 py-2 text-xs font-extrabold text-emerald-800 shadow-md">📍 BẢN ĐỒ ĐIỂM NHẬN XE</span>
            </div>
            <aside className="flex flex-col justify-between bg-[#103a39] p-6 text-white sm:p-8">
              <div>
                <p className="text-xs font-black uppercase tracking-[.16em] text-emerald-300">{items.length} điểm thuê đang hoạt động</p>
                <h2 className="mt-4 text-2xl font-extrabold">{selected?.name}</h2>
                <p className="mt-4 text-sm leading-7 text-emerald-50/85">{selected?.address}</p>
                {selected?.phone && <p className="mt-3 text-sm text-emerald-50/80">☎ {selected.phone}</p>}
                <label className="mt-7 block text-sm font-bold" htmlFor="station-map-choice">Chọn điểm trên bản đồ</label>
                <select id="station-map-choice" className="mt-3 w-full rounded-xl border border-white/20 bg-white p-3 text-sm font-medium text-slate-900" value={selected?.id ?? ''} onChange={e => setSelectedId(Number(e.target.value))}>
                  {items.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="mt-7 flex flex-col gap-3">
                {selected && coordinatesValid(selected.latitude,selected.longitude) && <a className="btn-primary justify-center text-center" href={stationDirections(selected.latitude, selected.longitude)} rel="noopener noreferrer" target="_blank">Mở chỉ đường ↗</a>}
                <Link className="rounded-xl border border-white/25 px-5 py-3 text-center text-sm font-bold text-white hover:bg-white/10" to="/vehicles">Xem xe cho thuê →</Link>
              </div>
            </aside>
          </div>
        </div>
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl font-extrabold">Danh sách điểm nhận xe</h2><span className="text-sm text-slate-500">Nhấn vào một điểm để xem trên bản đồ lớn</span></div>
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {items.map((s, i) => <article key={s.id} className="panel overflow-hidden">
              <div className="relative h-56 overflow-hidden bg-slate-100">
                <StationMap latitude={s.latitude} longitude={s.longitude} name={s.name} compact/>
                <span className="pointer-events-none absolute left-4 top-4 rounded-full bg-white/95 px-4 py-2 text-xs font-extrabold text-emerald-800 shadow-sm">ĐIỂM NHẬN {String(i + 1).padStart(2,'0')}</span>
              </div>
              <div className="p-6 sm:p-7">
                <h3 className="text-xl font-extrabold">{s.name}</h3>
                <p className="mt-3 min-h-12 text-sm leading-6 text-slate-600">📍 {s.address}</p>
                {s.phone && <p className="mt-2 text-sm text-slate-600">☎ {s.phone}</p>}
                <div className="mt-5 flex flex-wrap gap-3 border-t border-slate-100 pt-5">
                  <button className="btn-primary" onClick={() => {setSelectedId(s.id);window.scrollTo({top:0,behavior:'smooth'});}}>Xem trên bản đồ ↑</button>
                  {coordinatesValid(s.latitude,s.longitude)&&<a className="btn-outline" href={stationDirections(s.latitude,s.longitude)} rel="noopener noreferrer" target="_blank">Chỉ đường ↗</a>}
                </div>
              </div>
            </article>)}
          </div>
        </div>
        <p className="text-xs text-slate-500">Bản đồ: © OpenStreetMap contributors. Vị trí được hiển thị theo tọa độ do VoltGo lưu; các điểm demo có tọa độ minh họa, cần xác minh trước khi phục vụ khách thực tế.</p>
      </>}
  </section>;
}
