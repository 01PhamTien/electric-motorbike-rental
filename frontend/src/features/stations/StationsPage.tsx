import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, LoadingState, SectionHeading } from '../../components/Brand';
import { StationMap, coordinatesValid, stationDirections } from '../../components/StationMap';
import type { StationMapPoint, UserMapLocation } from '../../components/StationMap';
import { api } from '../../services/api';
import type { Station, Vehicle } from '../../types';
import { useAuth } from '../auth/AuthContext';

function distanceKm(a: UserMapLocation, b: UserMapLocation) {
  const rad = (value: number) => value * Math.PI / 180;
  const dLat = rad(b.latitude - a.latitude), dLng = rad(b.longitude - a.longitude);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
export function StationsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Station[]>([]);
  const [rentingBookings, setRentingBookings] = useState<{id:number;vehicleId:number;vehicle?:Vehicle;status:string}[]>([]);
  const [myBatteryReservations, setMyBatteryReservations] = useState<{id:number;stationId:number;status:string;expiresAt:string;station?:Station}[]>([]);
  const [reservationBusy, setReservationBusy] = useState(false);
  const [reservationMessage, setReservationMessage] = useState('');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [swapAvailability, setSwapAvailability] = useState<{stationId:number;availableBatteryCount:number;supportsBatterySwap:boolean}[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [location, setLocation] = useState<UserMapLocation | null>(null);
  const [locationError, setLocationError] = useState('');
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([api.get('/stations'), api.get('/vehicles'), api.get('/battery-swap/availability').catch(() => ({data:[]})), user?.role === 'CUSTOMER' ? api.get('/bookings/my').catch(() => ({data:[]})) : Promise.resolve({data:[]}), user?.role === 'CUSTOMER' ? api.get('/batteries/reservations/my').catch(() => ({data:[]})) : Promise.resolve({data:[]})]).then(([stationResponse, vehicleResponse, swapResponse, bookingResponse, reservationResponse]) => {
      if (!alive) return;
      const stations: Station[] = Array.isArray(stationResponse.data) ? stationResponse.data : stationResponse.data?.items ?? [];
      const active = stations.filter(s => s.isActive !== false && coordinatesValid(s.latitude, s.longitude));
      const vehicleList: Vehicle[] = Array.isArray(vehicleResponse.data) ? vehicleResponse.data : vehicleResponse.data?.items ?? [];
      setItems(active);
      setVehicles(vehicleList.filter(v => v.status === 'ACTIVE' && v.station && coordinatesValid(v.station.latitude, v.station.longitude)));
      setSwapAvailability(Array.isArray(swapResponse.data) ? swapResponse.data : []);
      setRentingBookings((Array.isArray(bookingResponse.data) ? bookingResponse.data : []).filter((b:{status:string})=>b.status==='RENTING'));
      setMyBatteryReservations(Array.isArray(reservationResponse.data) ? reservationResponse.data : []);
      setSelectedId(current => active.some(s => s.id === current) ? current : active[0]?.id ?? null);
    }).catch(() => { if (alive) setError('Không thể tải trạm và phương tiện. Vui lòng thử lại.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [user?.role]);

  const points = useMemo<StationMapPoint[]>(() => [
    ...items.map(s => ({ id: s.id, latitude: s.latitude, longitude: s.longitude, name: s.name })),
  ], [items]);
  const onMarkerClick = useCallback((id: number) => setSelectedId(id), []);
  const ranked = useMemo(() => items.map(station => ({
    station,
    distance: location ? distanceKm(location, { latitude: Number(station.latitude), longitude: Number(station.longitude) }) : null,
    availableVehicles: vehicles.filter(vehicle => vehicle.station.id === station.id).length,
    availableBatteryCount: swapAvailability.find(item => item.stationId === station.id)?.availableBatteryCount ?? 0,
  })).sort((a, b) => a.distance === null || b.distance === null ? a.station.name.localeCompare(b.station.name) : a.distance - b.distance), [items, location, vehicles, swapAvailability]);
  const selected = items.find(s => s.id === selectedId) ?? ranked[0]?.station;

  async function reserveBattery(bookingId:number,stationId:number) {
    setReservationBusy(true);setReservationMessage('');
    try {
      const response=await api.post('/batteries/reservations',{bookingId,stationId});
      setReservationMessage('Đã giữ pin thành công. Mã giữ pin #'+response.data.id+' có hiệu lực đến '+new Date(response.data.expiresAt).toLocaleTimeString('vi-VN')+'.');
      const [availability,reservations]=await Promise.all([api.get('/battery-swap/availability'),api.get('/batteries/reservations/my')]);
      setSwapAvailability(Array.isArray(availability.data)?availability.data:[]);
      setMyBatteryReservations(Array.isArray(reservations.data)?reservations.data:[]);
    } catch(error) {
      const message=(error as {response?:{data?:{message?:string}}})?.response?.data?.message;
      setReservationMessage(message||'Không thể giữ pin. Vui lòng đăng nhập và kiểm tra đơn thuê đang sử dụng.');
    } finally {setReservationBusy(false);}
  }
  async function cancelBatteryReservation(id:number) {
    setReservationBusy(true);setReservationMessage('');
    try {
      await api.patch('/batteries/reservations/'+id+'/cancel');
      setReservationMessage('Đã hủy lượt giữ pin #'+id+'.');
      const [availability,reservations]=await Promise.all([api.get('/battery-swap/availability'),api.get('/batteries/reservations/my')]);
      setSwapAvailability(Array.isArray(availability.data)?availability.data:[]);
      setMyBatteryReservations(Array.isArray(reservations.data)?reservations.data:[]);
    } catch(error) {
      const message=(error as {response?:{data?:{message?:string}}})?.response?.data?.message;
      setReservationMessage(message||'Không thể hủy lượt giữ pin.');
    } finally {setReservationBusy(false);}
  }

  function locateMe() {
    if (!navigator.geolocation) { setLocationError('Trình duyệt không hỗ trợ định vị. Bạn vẫn có thể chọn trạm trong danh sách.'); return; }
    setLocating(true); setLocationError('');
    navigator.geolocation.getCurrentPosition(
      position => {
        const current = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        setLocation(current);
        const nearest = items
          .map(station => ({ station, distance: distanceKm(current, { latitude: Number(station.latitude), longitude: Number(station.longitude) }) }))
          .sort((a, b) => a.distance - b.distance)[0];
        if (nearest) setSelectedId(nearest.station.id);
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
      <SectionHeading eyebrow="MẠNG LƯỚI ĐIỂM THUÊ" title="Tìm trạm nhận xe gần bạn" description="Bản đồ chỉ hiển thị các điểm nhận xe với tọa độ GPS của trạm. Bật định vị để tìm trạm gần nhất và xem khoảng cách ước tính."/>
      <div className="flex flex-wrap gap-2">
        <button onClick={locateMe} disabled={locating} className="btn-outline">{locating ? 'Đang xác định...' : location ? '↻ Cập nhật vị trí' : '◎ Dùng vị trí của tôi'}</button>
        <Link to="/vehicles" className="btn-dark">Khám phá xe ↗</Link>
      </div>
    </div>
    {locationError && <p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">{locationError}</p>}
    {loading ? <LoadingState /> : error ? <p role="alert" className="rounded-xl bg-rose-50 p-6 text-rose-700">{error}</p> : !items.length ?
      <EmptyState title="Chưa có điểm thuê" description="Các điểm nhận xe có tọa độ hợp lệ sẽ xuất hiện tại đây." /> :
      <>
        {user?.role==='CUSTOMER' && <section className="panel p-6">
          <p className="eyebrow">GIỮ PIN TRƯỚC KHI ĐẾN TRẠM</p>
          <h2 className="mt-2 text-xl font-extrabold">Đặt trước pin đổi trong 10 phút</h2>
          <p className="mt-2 text-sm text-slate-600">Chọn một đơn thuê đang sử dụng xe tại trạm được chọn. Hệ thống sẽ giữ một pin đầy trong 10 phút.</p>
          {reservationMessage && <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{reservationMessage}</p>}
          {myBatteryReservations.filter(r=>r.status==='RESERVED'&&new Date(r.expiresAt)>new Date()).map(r=><div key={r.id} className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4"><div><strong className="text-sm">Đang giữ pin #{r.id}</strong><p className="mt-1 text-xs text-slate-600">{r.station?.name??'Trạm #'+r.stationId} · Hết hạn {new Date(r.expiresAt).toLocaleTimeString('vi-VN')}</p></div><button disabled={reservationBusy} onClick={()=>void cancelBatteryReservation(r.id)} className="text-sm font-bold text-rose-700 underline">Hủy giữ pin</button></div>)}
          {rentingBookings.length>0 ? <div className="mt-4 flex flex-wrap items-end gap-3"><label className="min-w-64 flex-1"><span className="field-label">Đơn thuê đang sử dụng tại trạm này</span><select id="battery-reservation-booking" className="field mt-2" defaultValue=""><option value="">Chọn đơn thuê</option>{rentingBookings.filter(b=>vehicles.some(v=>v.id===b.vehicleId&&v.station?.id===selected?.id)).map(b=><option key={b.id} value={b.id}>Đơn #{b.id} · {b.vehicle?.code}</option>)}</select></label><button disabled={reservationBusy||(ranked.find(x=>x.station.id===selected?.id)?.availableBatteryCount??0)<1} onClick={()=>{const select=document.getElementById('battery-reservation-booking') as HTMLSelectElement|null;if(select?.value&&selected)void reserveBattery(Number(select.value),selected.id);else setReservationMessage('Vui lòng chọn đơn thuê đang sử dụng tại trạm này.');}} className="btn-primary">Giữ pin 10 phút</button></div> : <p className="mt-4 text-sm text-slate-500">{user?.role==='CUSTOMER'?'Bạn chưa có đơn thuê đang sử dụng.':'Đăng nhập bằng tài khoản khách hàng có xe đang thuê để giữ pin.'}</p>}
        </section>}
        <div className="panel overflow-hidden border-[#e7eee9] shadow-[0_18px_50px_rgba(30,90,65,.06)]">
          <div className="grid lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="relative h-[390px] bg-[#edf5f0] sm:h-[540px]">
              <StationMap key={location ? 'located' : 'all-stations'} points={points} userLocation={location} onMarkerClick={onMarkerClick}/>
              <div className="pointer-events-none absolute left-5 top-5 flex flex-wrap gap-2">
                <span className="rounded-full border border-[#e4eee8] bg-white/95 px-4 py-2 text-xs font-extrabold text-emerald-800 shadow-md">📍 {items.length} TRẠM</span>
                <span className="rounded-full bg-white/95 px-4 py-2 text-xs font-extrabold text-sky-800 shadow-md">⚡ {vehicles.length} XE SẴN SÀNG</span>
                {location && <span className="rounded-full bg-sky-50 px-4 py-2 text-xs font-extrabold text-sky-800 shadow-md">◎ VỊ TRÍ CỦA BẠN</span>}
              </div>
              
            </div>
            <aside className="flex flex-col justify-between bg-gradient-to-br from-[#f0faf4] via-white to-[#eaf7ef] p-6 text-[#294442] sm:p-8">
              <div>
                <p className="text-xs font-black uppercase tracking-[.16em] text-[#159b70]">{location ? 'TRẠM GẦN NHẤT' : 'ĐIỂM NHẬN ĐƯỢC CHỌN'}</p>
                <h2 className="mt-4 text-2xl font-extrabold">{selected?.name ?? ranked[0]?.station.name}</h2>
                <p className="mt-3 text-sm leading-7 text-[#647873]">{selected?.address}</p>
                {selected && location && <p className="mt-3 inline-flex rounded-full bg-white px-3 py-2 text-sm font-bold text-[#159b70] shadow-sm">Cách bạn khoảng {distanceKm(location,{latitude:Number(selected.latitude),longitude:Number(selected.longitude)}).toFixed(1)} km</p>}
                {location && ranked[0] && <p className="mt-2 text-xs text-[#71847c]">Trạm gần nhất: {ranked[0].station.name} ({ranked[0].distance?.toFixed(1)} km)</p>}
                <p className="mt-3 text-sm font-bold text-[#4d8292]">⚡ {ranked.find(x => x.station.id === selected?.id)?.availableVehicles ?? 0} xe đang sẵn sàng tại trạm</p>
                <p className="mt-2 text-sm font-bold text-[#159b70]">🔋 {ranked.find(x => x.station.id === selected?.id)?.availableBatteryCount ?? 0} pin đầy có thể đổi ngay</p>
                <label className="mt-7 block text-sm font-bold" htmlFor="station-map-choice">Chọn điểm nhận xe</label>
                <select id="station-map-choice" className="mt-3 w-full rounded-xl border border-[#dceae1] bg-white p-3 text-sm font-medium text-slate-900" value={selected?.id ?? ''} onChange={e => setSelectedId(Number(e.target.value))}>
                  {ranked.map(({station, distance, availableVehicles, availableBatteryCount}) => <option key={station.id} value={station.id}>{station.name} · {availableVehicles} xe · {availableBatteryCount} pin đổi{distance !== null ? ' · ' + distance.toFixed(1) + ' km' : ''}</option>)}
                </select>
              </div>
              <div className="mt-7 flex flex-col gap-3">
                {selected && coordinatesValid(selected.latitude, selected.longitude) && <a className="btn-primary justify-center text-center" href={stationDirections(selected.latitude, selected.longitude)} rel="noopener noreferrer" target="_blank">Mở chỉ đường ↗</a>}
                <Link className="rounded-xl border border-[#cfe6d8] bg-white px-5 py-3 text-center text-sm font-bold text-[#31544b] hover:bg-[#f7fcf8]" to="/vehicles">Xem xe tại các điểm →</Link>
              </div>
            </aside>
          </div>
        </div>
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl font-extrabold">Danh sách điểm nhận xe</h2><span className="text-sm text-slate-500">{location ? 'Đã sắp xếp theo khoảng cách tới bạn' : 'Bật định vị để sắp xếp theo khoảng cách'}</span></div>
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            {ranked.map(({station: s, distance, availableVehicles, availableBatteryCount}, i) => <article key={s.id} className={'panel overflow-hidden ' + (i === 0 && location ? 'ring-2 ring-emerald-300' : '')}>
              <div className="relative h-48 overflow-hidden bg-slate-100">
                <StationMap latitude={s.latitude} longitude={s.longitude} name={s.name} compact/>
                <span className="pointer-events-none absolute left-4 top-4 rounded-full bg-white/95 px-4 py-2 text-xs font-extrabold text-emerald-800 shadow-sm">{location && i === 0 ? 'GẦN BẠN NHẤT' : 'ĐIỂM NHẬN ' + String(i + 1).padStart(2,'0')}</span>
                {distance !== null && <span className="pointer-events-none absolute right-4 top-4 rounded-full bg-slate-900/80 px-3 py-2 text-xs font-bold text-white">{distance.toFixed(1)} km</span>}
              </div>
              <div className="p-6">
                <h3 className="text-xl font-extrabold">{s.name}</h3>
                <p className="mt-3 min-h-12 text-sm leading-6 text-slate-600">📍 {s.address}</p>
                <p className="mt-2 text-sm font-bold text-sky-700">⚡ {availableVehicles} xe sẵn sàng</p>
                <p className="mt-2 text-sm font-bold text-emerald-700">🔋 {availableBatteryCount > 0 ? availableBatteryCount + ' pin đầy có thể đổi ngay' : 'Chưa có pin đổi sẵn'}</p>
                {s.phone && <p className="mt-2 text-sm text-slate-600">☎ {s.phone}</p>}
                <div className="mt-5 flex flex-wrap gap-3 border-t border-slate-100 pt-5">
                  <button className="btn-primary" onClick={() => {setSelectedId(s.id);window.scrollTo({top:0,behavior:'smooth'});}}>Chọn trạm này ↑</button>
                  <a className="btn-outline" href={stationDirections(s.latitude,s.longitude)} rel="noopener noreferrer" target="_blank">Chỉ đường ↗</a>
                </div>
              </div>
            </article>)}
          </div>
        </div>
        <p className="text-xs text-slate-500">Khoảng cách tới trạm là đường chim bay, không phải quãng đường di chuyển. Không theo dõi GPS riêng cho từng xe; vị trí trên bản đồ là tọa độ GPS của trạm. Bản đồ © OpenStreetMap contributors; tọa độ demo cần được xác minh trước khi phục vụ khách thật.</p>
      </>}
  </section>;
}
