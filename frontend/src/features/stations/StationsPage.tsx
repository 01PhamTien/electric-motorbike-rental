import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, LoadingState, SectionHeading } from '../../components/Brand';
import { StationMap, coordinatesValid, stationDirections } from '../../components/StationMap';
import type { StationMapPoint, UserMapLocation } from '../../components/StationMap';
import { api } from '../../services/api';
import type { Station, Vehicle } from '../../types';

function distanceKm(a: UserMapLocation, b: UserMapLocation) {
  const rad = (value: number) => value * Math.PI / 180;
  const dLat = rad(b.latitude - a.latitude), dLng = rad(b.longitude - a.longitude);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
export function StationsPage() {
  const [items, setItems] = useState<Station[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [location, setLocation] = useState<UserMapLocation | null>(null);
  const [locationError, setLocationError] = useState('');
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([api.get('/stations'), api.get('/vehicles')]).then(([stationResponse, vehicleResponse]) => {
      if (!alive) return;
      const stations: Station[] = Array.isArray(stationResponse.data) ? stationResponse.data : stationResponse.data?.items ?? [];
      const active = stations.filter(s => s.isActive !== false && coordinatesValid(s.latitude, s.longitude));
      const vehicleList: Vehicle[] = Array.isArray(vehicleResponse.data) ? vehicleResponse.data : vehicleResponse.data?.items ?? [];
      setItems(active);
      setVehicles(vehicleList.filter(v => v.status === 'ACTIVE' && v.station && coordinatesValid(v.station.latitude, v.station.longitude)));
      setSelectedId(current => active.some(s => s.id === current) ? current : active[0]?.id ?? null);
    }).catch(() => { if (alive) setError('Không thể tải trạm và phương tiện. Vui lòng thử lại.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const points = useMemo<StationMapPoint[]>(() => [
    ...items.map(s => ({ id: s.id, latitude: s.latitude, longitude: s.longitude, name: 'Trạm: ' + s.name, kind: 'station' as const })),
    ...vehicles.map(v => ({ id: -v.id, latitude: v.station.latitude, longitude: v.station.longitude, name: 'Xe ' + v.code + ' · ' + v.model?.brand + ' ' + v.model?.name, kind: 'vehicle' as const })),
  ], [items, vehicles]);
  const onMarkerClick = useCallback((id: number) => {
    if (id > 0) { setSelectedId(id); return; }
    const vehicle = vehicles.find(v => v.id === -id);
    if (vehicle?.station) setSelectedId(vehicle.station.id);
  }, [vehicles]);
  const ranked = useMemo(() => items.map(station => ({
    station,
    distance: location ? distanceKm(location, { latitude: Number(station.latitude), longitude: Number(station.longitude) }) : null,
    availableVehicles: vehicles.filter(vehicle => vehicle.station.id === station.id).length,
  })).sort((a, b) => a.distance === null || b.distance === null ? a.station.name.localeCompare(b.station.name) : a.distance - b.distance), [items, location, vehicles]);
  const selected = items.find(s => s.id === selectedId) ?? ranked[0]?.station;

  function locateMe() {
    if (!navigator.geolocation) { setLocationError('Trình duyệt không hỗ trợ định vị. Bạn vẫn có thể chọn trạm trong danh sách.'); return; }
    setLocating(true); setLocationError('');
    navigator.geolocation.getCurrentPosition(
      position => {
        setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setLocating(false);
      },
      reason => {
        setLocationError(reason.code === reason.PERMISSION_DENIED
          ? 'Bạn chưa cấp quyền vị trí. Hãy cho phép định vị trong trình duyệt rồi thử lại.'
          : 'Không lấy được vị trí hiện tại. Hãy kiểm tra GPS và quyền định vị.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  }

  return <section className="container-page space-y-9 py-12 sm:py-16">
    <div className="flex flex-wrap items-end justify-between gap-6">
      <SectionHeading eyebrow="MẠNG LƯỚI ĐIỂM THUÊ" title="Tìm trạm và xe gần bạn" description="Bản đồ hiển thị trạm đang hoạt động, xe sẵn sàng tại từng trạm và vị trí hiện tại của bạn. Bật định vị để tìm điểm thuê gần nhất."/>
      <div className="flex flex-wrap gap-2">
        <button onClick={locateMe} disabled={locating} className="btn-outline">{locating ? 'Đang xác định...' : location ? '↻ Cập nhật vị trí' : '◎ Dùng vị trí của tôi'}</button>
        <Link to="/vehicles" className="btn-dark">Khám phá xe ↗</Link>
      </div>
    </div>
    {locationError && <p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">{locationError}</p>}
    {loading ? <LoadingState /> : error ? <p role="alert" className="rounded-xl bg-rose-50 p-6 text-rose-700">{error}</p> : !items.length ?
      <EmptyState title="Chưa có điểm thuê" description="Các điểm nhận xe có tọa độ hợp lệ sẽ xuất hiện tại đây." /> :
      <>
        <div className="panel overflow-hidden">
          <div className="grid lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="relative h-[390px] bg-slate-100 sm:h-[540px]">
              <StationMap key={location ? 'located' : 'all-stations'} points={points} userLocation={location} onMarkerClick={onMarkerClick}/>
              <div className="pointer-events-none absolute left-5 top-5 flex flex-wrap gap-2">
                <span className="rounded-full bg-white/95 px-4 py-2 text-xs font-extrabold text-emerald-800 shadow-md">📍 {items.length} TRẠM</span>
                <span className="rounded-full bg-white/95 px-4 py-2 text-xs font-extrabold text-sky-800 shadow-md">⚡ {vehicles.length} XE SẴN SÀNG</span>
                {location && <span className="rounded-full bg-sky-50 px-4 py-2 text-xs font-extrabold text-sky-800 shadow-md">◎ VỊ TRÍ CỦA BẠN</span>}
              </div>
              <div className="pointer-events-none absolute bottom-4 left-5 flex gap-3 rounded-xl bg-white/95 px-3 py-2 text-xs font-bold shadow-md">
                <span className="text-emerald-700">⌖ Trạm xe</span><span className="text-sky-700">⚡ Xe sẵn sàng</span>
              </div>
            </div>
            <aside className="flex flex-col justify-between bg-[#103a39] p-6 text-white sm:p-8">
              <div>
                <p className="text-xs font-black uppercase tracking-[.16em] text-emerald-300">{location ? 'TRẠM GẦN NHẤT' : 'ĐIỂM NHẬN ĐƯỢC CHỌN'}</p>
                <h2 className="mt-4 text-2xl font-extrabold">{selected?.name ?? ranked[0]?.station.name}</h2>
                <p className="mt-3 text-sm leading-7 text-emerald-50/85">{selected?.address}</p>
                {selected && location && <p className="mt-3 inline-flex rounded-full bg-emerald-300/15 px-3 py-2 text-sm font-bold text-emerald-100">Cách bạn khoảng {distanceKm(location,{latitude:Number(selected.latitude),longitude:Number(selected.longitude)}).toFixed(1)} km</p>}
                {location && ranked[0] && <p className="mt-2 text-xs text-emerald-100/80">Trạm gần nhất: {ranked[0].station.name} ({ranked[0].distance?.toFixed(1)} km)</p>}
                <p className="mt-3 text-sm font-bold text-sky-200">⚡ {ranked.find(x => x.station.id === selected?.id)?.availableVehicles ?? 0} xe đang sẵn sàng tại trạm</p>
                <label className="mt-7 block text-sm font-bold" htmlFor="station-map-choice">Chọn điểm nhận xe</label>
                <select id="station-map-choice" className="mt-3 w-full rounded-xl border border-white/20 bg-white p-3 text-sm font-medium text-slate-900" value={selected?.id ?? ''} onChange={e => setSelectedId(Number(e.target.value))}>
                  {ranked.map(({station, distance, availableVehicles}) => <option key={station.id} value={station.id}>{station.name} · {availableVehicles} xe{distance !== null ? ' · ' + distance.toFixed(1) + ' km' : ''}</option>)}
                </select>
              </div>
              <div className="mt-7 flex flex-col gap-3">
                {selected && coordinatesValid(selected.latitude, selected.longitude) && <a className="btn-primary justify-center text-center" href={stationDirections(selected.latitude, selected.longitude)} rel="noopener noreferrer" target="_blank">Mở chỉ đường ↗</a>}
                <Link className="rounded-xl border border-white/25 px-5 py-3 text-center text-sm font-bold text-white hover:bg-white/10" to="/vehicles">Xem xe tại các điểm →</Link>
              </div>
            </aside>
          </div>
        </div>
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl font-extrabold">Danh sách điểm nhận xe</h2><span className="text-sm text-slate-500">{location ? 'Đã sắp xếp theo khoảng cách tới bạn' : 'Bật định vị để sắp xếp theo khoảng cách'}</span></div>
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            {ranked.map(({station: s, distance, availableVehicles}, i) => <article key={s.id} className={'panel overflow-hidden ' + (i === 0 && location ? 'ring-2 ring-emerald-300' : '')}>
              <div className="relative h-48 overflow-hidden bg-slate-100">
                <StationMap latitude={s.latitude} longitude={s.longitude} name={s.name} compact/>
                <span className="pointer-events-none absolute left-4 top-4 rounded-full bg-white/95 px-4 py-2 text-xs font-extrabold text-emerald-800 shadow-sm">{location && i === 0 ? 'GẦN BẠN NHẤT' : 'ĐIỂM NHẬN ' + String(i + 1).padStart(2,'0')}</span>
                {distance !== null && <span className="pointer-events-none absolute right-4 top-4 rounded-full bg-slate-900/80 px-3 py-2 text-xs font-bold text-white">{distance.toFixed(1)} km</span>}
              </div>
              <div className="p-6">
                <h3 className="text-xl font-extrabold">{s.name}</h3>
                <p className="mt-3 min-h-12 text-sm leading-6 text-slate-600">📍 {s.address}</p>
                <p className="mt-2 text-sm font-bold text-sky-700">⚡ {availableVehicles} xe sẵn sàng</p>
                {s.phone && <p className="mt-2 text-sm text-slate-600">☎ {s.phone}</p>}
                <div className="mt-5 flex flex-wrap gap-3 border-t border-slate-100 pt-5">
                  <button className="btn-primary" onClick={() => {setSelectedId(s.id);window.scrollTo({top:0,behavior:'smooth'});}}>Chọn trạm này ↑</button>
                  <a className="btn-outline" href={stationDirections(s.latitude,s.longitude)} rel="noopener noreferrer" target="_blank">Chỉ đường ↗</a>
                </div>
              </div>
            </article>)}
          </div>
        </div>
        <p className="text-xs text-slate-500">Khoảng cách tới trạm là đường chim bay, không phải quãng đường di chuyển. Các marker xe hiện đặt tại tọa độ trạm quản lý xe, chưa phải GPS trực tiếp của từng xe. Bản đồ © OpenStreetMap contributors; tọa độ demo cần được xác minh trước khi phục vụ khách thật.</p>
      </>}
  </section>;
}
