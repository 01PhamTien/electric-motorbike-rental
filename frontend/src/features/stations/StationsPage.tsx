import { useEffect, useMemo, useState } from 'react';
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet';
import { Link } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import { api } from '../../services/api';
import type { Station } from '../../types';

const DEFAULT_CENTER: [number, number] = [16.0544, 108.2022];

function MapViewport({ stations, selected }: {
  stations: Station[];
  selected: Station | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (selected) {
      map.setView([Number(selected.latitude), Number(selected.longitude)], 15, { animate: true });
      return;
    }
    if (stations.length === 1) {
      map.setView([Number(stations[0].latitude), Number(stations[0].longitude)], 14);
      return;
    }
    if (stations.length > 1) {
      map.fitBounds(stations.map(station => [Number(station.latitude), Number(station.longitude)] as [number, number]), {
        padding: [36, 36],
        maxZoom: 13,
      });
      return;
    }
    map.setView(DEFAULT_CENTER, 12);
  }, [map, selected, stations]);

  return null;
}

export function StationsPage() {
  const [items, setItems] = useState<Station[]>([]);
  const [keyword, setKeyword] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<Station[]>('/stations')
      .then(response => setItems(Array.isArray(response.data) ? response.data.filter(station => station.isActive !== false) : []))
      .catch((err: any) => setError(err.response?.data?.message || 'Không tải được danh sách điểm thuê.'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => items.filter(station =>
    [station.name, station.address, station.phone].join(' ').toLowerCase().includes(keyword.trim().toLowerCase())
  ), [items, keyword]);

  const mappedStations = useMemo(() => filtered.filter(station => {
    const lat = Number(station.latitude);
    const lng = Number(station.longitude);
    return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  }), [filtered]);

  const selected = mappedStations.find(station => station.id === selectedId) || null;

  return <section className="space-y-6">
    <header className="relative overflow-hidden rounded-3xl bg-slate-950 px-6 py-8 text-white shadow-lg sm:px-9">
      <div className="pointer-events-none absolute -right-12 -top-20 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="relative max-w-2xl">
        <span className="inline-flex rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[11px] font-bold tracking-[0.15em] text-cyan-200">EV RENTAL · ĐÀ NẴNG</span>
        <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">Hệ thống điểm thuê xe</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">Khám phá vị trí các điểm nhận và trả xe. Chọn một điểm trên bản đồ để xem thông tin liên hệ và tìm xe tại khu vực đó.</p>
      </div>
    </header>

    {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}

    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 p-5 sm:p-6">
        <div><p className="text-xs font-bold tracking-[0.12em] text-blue-700">BẢN ĐỒ ĐIỂM NHẬN XE</p><h2 className="mt-1 text-xl font-bold text-slate-950">Tìm điểm thuê gần bạn</h2>
          <p className="mt-1 text-xs text-slate-500">Bản đồ sử dụng OpenStreetMap; tọa độ lấy từ dữ liệu điểm thuê trong hệ thống.</p></div>
        {!loading && <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">{filtered.length} điểm hoạt động · {mappedStations.length} có tọa độ</span>}
      </div>
      <div className="grid lg:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.6fr)]">
        <div className="h-[360px] border-b border-slate-100 sm:h-[460px] lg:h-[560px] lg:border-b-0 lg:border-r">
          <MapContainer center={DEFAULT_CENTER} zoom={12} scrollWheelZoom className="h-full w-full">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapViewport stations={mappedStations} selected={selected} />
            {mappedStations.map((station, index) => <CircleMarker
              key={station.id}
              center={[Number(station.latitude), Number(station.longitude)]}
              radius={selectedId === station.id ? 12 : 9}
              pathOptions={{
                color: selectedId === station.id ? '#1d4ed8' : '#0f766e',
                fillColor: selectedId === station.id ? '#3b82f6' : '#14b8a6',
                fillOpacity: 0.9,
                weight: 3,
              }}
              eventHandlers={{ click: () => setSelectedId(station.id) }}
            >
              <Popup>
                <div className="min-w-44 space-y-1">
                  <p className="font-bold">{station.name}</p>
                  <p className="text-xs">{station.address}</p>
                  {station.phone && <p className="text-xs">☎ {station.phone}</p>}
                  <a className="inline-block pt-1 text-xs font-semibold text-blue-700" href={`https://www.google.com/maps/dir/?api=1&destination=${station.latitude},${station.longitude}`} target="_blank" rel="noreferrer">Chỉ đường đến điểm thuê ↗</a>
                </div>
              </Popup>
            </CircleMarker>)}
          </MapContainer>
        </div>

        <aside className="flex min-h-0 flex-col">
          <div className="border-b border-slate-100 p-4 sm:p-5">
            <label className="block text-xs font-bold text-slate-600">Tìm điểm thuê
              <input value={keyword} onChange={event => setKeyword(event.target.value)} placeholder="Tên điểm, địa chỉ, số điện thoại..." className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-normal outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100" />
            </label>
          </div>
          <div className="max-h-[420px] flex-1 divide-y divide-slate-100 overflow-y-auto lg:max-h-[490px]">
            {loading ? [1,2,3].map(n => <div key={n} className="m-4 h-24 animate-pulse rounded-xl bg-slate-100" />) :
              filtered.length === 0 ? <p className="p-6 text-center text-sm text-slate-500">Không tìm thấy điểm thuê phù hợp.</p> :
              filtered.map((station, index) => {
                const hasCoordinates = mappedStations.some(item => item.id === station.id);
                const active = selectedId === station.id;
                return <button key={station.id} type="button" onClick={() => hasCoordinates && setSelectedId(station.id)} disabled={!hasCoordinates}
                  className={`w-full p-4 text-left transition hover:bg-slate-50 sm:p-5 ${active ? 'bg-blue-50/80' : 'bg-white'} ${!hasCoordinates ? 'cursor-not-allowed opacity-60' : ''}`}>
                  <div className="flex items-start gap-3">
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-black ${active ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-600'}`}>{String(index + 1).padStart(2, '0')}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2"><span className="font-bold text-slate-900">{station.name}</span>
                        {active && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">Đang chọn</span>}</span>
                      <span className="mt-1 block text-xs leading-5 text-slate-500">{station.address || 'Địa chỉ đang được cập nhật'}</span>
                      {station.phone && <span className="mt-1 block text-xs text-slate-500">☎ {station.phone}</span>}
                      <span className="mt-2 block text-[11px] text-slate-400">{hasCoordinates ? `${Number(station.latitude).toFixed(5)}, ${Number(station.longitude).toFixed(5)}` : 'Chưa cập nhật tọa độ bản đồ'}</span>
                    </span>
                  </div>
                </button>;
              })}
          </div>
          {selected && <div className="border-t border-slate-100 bg-slate-50 p-4 sm:p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-blue-700">Điểm đang chọn</p>
            <p className="mt-1 font-bold text-slate-900">{selected.name}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Link to={`/vehicles?stationId=${selected.id}`} className="inline-flex items-center justify-center rounded-xl bg-blue-700 px-3 py-2.5 text-center text-xs font-bold text-white transition hover:bg-blue-800">Xem xe tại điểm</Link>
              <a href={`https://www.google.com/maps/dir/?api=1&destination=${selected.latitude},${selected.longitude}`} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-center text-xs font-bold text-slate-700 transition hover:bg-slate-100">Chỉ đường ↗</a>
            </div>
          </div>}
        </aside>
      </div>
    </section>

    <div className="flex flex-wrap items-end justify-between gap-2">
      <div><p className="text-xs font-bold tracking-[0.12em] text-blue-700">MẠNG LƯỚI ĐIỂM THUÊ</p><h2 className="mt-1 text-xl font-bold text-slate-950">Thông tin các điểm nhận xe</h2></div>
      {!loading && <span className="text-sm text-slate-500">{filtered.length} điểm đang hoạt động</span>}
    </div>
    {loading ? <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{[1,2,3].map(n => <div key={n} className="h-44 animate-pulse rounded-2xl bg-white" />)}</div> :
      filtered.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><p className="font-semibold text-slate-800">Chưa có điểm thuê đang hoạt động</p><p className="mt-1 text-sm text-slate-500">Vui lòng quay lại sau.</p></div> :
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{filtered.map((station, index) => <article key={station.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
        <div className="flex h-24 items-center justify-between bg-gradient-to-br from-slate-950 to-blue-900 px-5 text-white"><span className="text-xs font-bold tracking-[0.15em] text-blue-200">STATION {String(index + 1).padStart(2, '0')}</span><span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-2xl">⌖</span></div>
        <div className="p-5"><h3 className="text-lg font-bold text-slate-950">{station.name}</h3><p className="mt-2 min-h-10 text-sm leading-5 text-slate-600">{station.address || 'Địa chỉ đang được cập nhật'}</p>
          {station.phone && <p className="mt-2 text-xs text-slate-500">☎ {station.phone}</p>}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => { setSelectedId(station.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }} disabled={!mappedStations.some(item => item.id === station.id)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40">Xem bản đồ</button>
            <Link to={`/vehicles?stationId=${station.id}`} className="rounded-xl bg-blue-700 px-3 py-2.5 text-center text-xs font-bold text-white hover:bg-blue-800">Tìm xe tại đây</Link>
          </div>
        </div>
      </article>)}</div>}
  </section>;
}
