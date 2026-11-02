import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { api } from '../../services/api';
import type { Vehicle } from '../../types';

type LocationRecord = {
  id: number;
  vehicleId: number;
  latitude: string;
  longitude: string;
  source: string;
  createdAt: string;
};

const DEFAULT_CENTER: [number, number] = [16.0544, 108.2022];

function MapClickPicker({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(event) {
      onPick(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

function MapCenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom(), { animate: true });
  }, [center, map]);
  return null;
}

export function LocationsPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleId, setVehicleId] = useState('');
  const [latitude, setLatitude] = useState('16.0544');
  const [longitude, setLongitude] = useState('108.2022');
  const [latest, setLatest] = useState<LocationRecord | null>(null);
  const [history, setHistory] = useState<LocationRecord[]>([]);
  const [fleetLocations, setFleetLocations] = useState<Array<LocationRecord & { vehicle: Vehicle }>>([]);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const selectedVehicle = useMemo(
    () => vehicles.find((vehicle) => String(vehicle.id) === vehicleId),
    [vehicles, vehicleId],
  );

  const lat = Number(latitude);
  const lng = Number(longitude);
  const validCoordinates =
    Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  const mapCenter: [number, number] = validCoordinates ? [lat, lng] : DEFAULT_CENTER;

  async function loadFleetLocations() {
    try {
      const response = await api.get('/locations/latest');
      setFleetLocations(Array.isArray(response.data) ? response.data : []);
    } catch (err: any) {
      setFleetLocations([]);
      setError(err.response?.data?.message || 'Không tải được bản đồ vị trí toàn đội xe.');
    }
  }

  async function loadLocationData(id: string) {
    if (!id) return;
    setError('');
    try {
      const [latestResponse, historyResponse] = await Promise.all([
        api.get(`/vehicles/${id}/locations/latest`),
        api.get(`/vehicles/${id}/locations`),
      ]);
      const latestRecord = latestResponse.data ?? null;
      setLatest(latestRecord);
      setHistory(Array.isArray(historyResponse.data) ? historyResponse.data : []);
      if (latestRecord) {
        setLatitude(String(latestRecord.latitude));
        setLongitude(String(latestRecord.longitude));
      }
    } catch (err: any) {
      setLatest(null);
      setHistory([]);
      setError(err.response?.data?.message || 'Không tải được lịch sử vị trí. Kiểm tra quyền ADMIN/STAFF và API.');
    }
  }

  useEffect(() => {
    void loadFleetLocations();
    api.get('/vehicles')
      .then((response) => {
        const data = Array.isArray(response.data) ? response.data : response.data?.items ?? [];
        setVehicles(data);
        if (data.length) setVehicleId(String(data[0].id));
      })
      .catch((err) => setError(err.response?.data?.message || 'Không tải được danh sách xe.'))
      .finally(() => setPageLoading(false));
  }, []);

  useEffect(() => {
    if (vehicleId) void loadLocationData(vehicleId);
    else { setLatest(null); setHistory([]); }
  }, [vehicleId]);

  function pickCoordinates(nextLat: number, nextLng: number) {
    setLatitude(nextLat.toFixed(7));
    setLongitude(nextLng.toFixed(7));
    setMessage('');
  }

  async function saveLocation(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    setError('');
    if (!vehicleId || !validCoordinates) {
      setError('Vui lòng chọn xe và nhập tọa độ hợp lệ (vĩ độ -90..90, kinh độ -180..180).');
      return;
    }
    setLoading(true);
    try {
      await api.post(`/vehicles/${vehicleId}/locations/simulate`, { latitude: lat, longitude: lng });
      setMessage('Đã lưu vị trí mô phỏng. Một bản ghi lịch sử mới đã được tạo.');
      await Promise.all([loadLocationData(vehicleId), loadFleetLocations()]);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không lưu được vị trí. Chỉ ADMIN hoặc STAFF đúng điểm thuê mới được cập nhật.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Vị trí mô phỏng xe</h1>
        <p className="mt-1 text-sm text-slate-600">Chọn xe, bấm trực tiếp trên bản đồ hoặc nhập tọa độ, xem trước rồi lưu lịch sử vị trí.</p>
      </div>

      {message && <div className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{message}</div>}
      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{String(error)}</div>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <form onSubmit={saveLocation} className="space-y-4 rounded-xl bg-white p-5 shadow-sm">
          <h2 className="font-semibold">Cập nhật vị trí</h2>
          <label className="block text-sm font-medium">Xe
            <select className="mt-1 w-full rounded-lg border p-2" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} required>
              <option value="">-- Chọn xe --</option>
              {vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.code} · {vehicle.model?.brand} {vehicle.model?.name} · {vehicle.station?.name}</option>)}
            </select>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium">Vĩ độ (latitude)
              <input className="mt-1 w-full rounded-lg border p-2" type="number" step="any" min="-90" max="90" value={latitude} onChange={(e) => setLatitude(e.target.value)} required />
            </label>
            <label className="block text-sm font-medium">Kinh độ (longitude)
              <input className="mt-1 w-full rounded-lg border p-2" type="number" step="any" min="-180" max="180" value={longitude} onChange={(e) => setLongitude(e.target.value)} required />
            </label>
          </div>
          <div className="rounded-lg bg-slate-50 p-3 text-sm">
            <p className="font-medium">Tọa độ đang chọn</p>
            <p className="mt-1 text-slate-600">{validCoordinates ? `${lat.toFixed(7)}, ${lng.toFixed(7)}` : 'Tọa độ không hợp lệ'}</p>
            <a className="mt-2 inline-block text-blue-700 underline" href={`https://www.google.com/maps?q=${encodeURIComponent(`${latitude},${longitude}`)}`} target="_blank" rel="noreferrer">Mở vị trí trên Google Maps</a>
          </div>
          <button disabled={loading || !vehicleId || !validCoordinates} className="w-full rounded-lg bg-blue-700 px-4 py-2.5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
            {loading ? 'Đang lưu...' : 'Cập nhật vị trí mô phỏng'}
          </button>
          <p className="text-xs text-slate-500">Đây là vị trí mô phỏng nhập thủ công hoặc chọn trên bản đồ, không phải GPS phần cứng.</p>
        </form>

        <div className="space-y-4 rounded-xl bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div><h2 className="font-semibold">Bản đồ chọn vị trí</h2><p className="text-xs text-slate-500">Bấm vào bản đồ để chọn tọa độ mới.</p></div>
            <button type="button" onClick={() => void loadLocationData(vehicleId)} disabled={!vehicleId} className="text-sm text-blue-700 underline disabled:opacity-40">Làm mới</button>
          </div>
          <div className="h-[360px] overflow-hidden rounded-lg border">
            <MapContainer center={mapCenter} zoom={13} scrollWheelZoom className="h-full w-full">
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapClickPicker onPick={pickCoordinates} />
              <MapCenter center={mapCenter} />
              {fleetLocations.map((item) => (
                <CircleMarker
                  key={item.id}
                  center={[Number(item.latitude), Number(item.longitude)]}
                  radius={String(item.vehicleId) === vehicleId ? 10 : 7}
                  pathOptions={{
                    color: String(item.vehicleId) === vehicleId ? '#1d4ed8' : '#15803d',
                    fillColor: String(item.vehicleId) === vehicleId ? '#3b82f6' : '#22c55e',
                    fillOpacity: 0.85,
                  }}
                  eventHandlers={{
                    click: () => {
                      setVehicleId(String(item.vehicleId));
                      setLatitude(String(item.latitude));
                      setLongitude(String(item.longitude));
                      setMessage(item.vehicle.code + ' · vị trí mô phỏng gần nhất');
                    },
                  }}
                />
              ))}
              {validCoordinates && <CircleMarker center={mapCenter} radius={5} pathOptions={{ color: '#b45309', fillColor: '#f59e0b', fillOpacity: 0.9 }} />}
            </MapContainer>
          </div>
          {latest ? <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-sm font-semibold">Vị trí đã lưu gần nhất</p>
            <p className="mt-1 text-sm">{latest.latitude}, {latest.longitude}</p>
            <p className="mt-1 text-xs text-slate-500">Cập nhật: {new Date(latest.createdAt).toLocaleString('vi-VN')}</p>
          </div> : <p className="text-sm text-slate-500">Xe chưa có lịch sử vị trí.</p>}
          <div className="rounded-lg border p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">Bản đồ toàn đội xe</p>
              <span className="text-xs text-slate-500">{fleetLocations.length} xe có vị trí đã lưu</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">Chấm xanh là vị trí gần nhất đã lưu. Bấm vào chấm để chọn xe.</p>
            {fleetLocations.length > 0 && <div className="mt-2 max-h-36 space-y-1 overflow-y-auto">
              {fleetLocations.map((item) => (
                <button key={item.id} type="button" onClick={() => {
                  setVehicleId(String(item.vehicleId));
                  setLatitude(String(item.latitude));
                  setLongitude(String(item.longitude));
                }} className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs hover:bg-slate-50 ${String(item.vehicleId) === vehicleId ? 'bg-blue-50 font-semibold' : ''}`}>
                  <span>{item.vehicle.code} · {item.vehicle.station?.name}</span>
                  <span className="text-slate-500">{new Date(item.createdAt).toLocaleString('vi-VN')}</span>
                </button>
              ))}
            </div>}
          </div>
          {selectedVehicle && <p className="text-xs text-slate-500">Đang xem: {selectedVehicle.code} · {selectedVehicle.station?.name}</p>}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="border-b p-4"><h2 className="font-semibold">Lịch sử vị trí (tối đa 200 bản ghi)</h2><p className="mt-1 text-xs text-slate-500">Mỗi lần lưu tạo một bản ghi mới, không ghi đè lịch sử cũ.</p></div>
        {pageLoading ? <p className="p-4 text-sm text-slate-500">Đang tải danh sách xe...</p> :
          history.length ? <div className="divide-y">{history.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
            <div><p className="font-medium">{item.latitude}, {item.longitude}</p><p className="mt-1 text-xs text-slate-500">{new Date(item.createdAt).toLocaleString('vi-VN')} · {item.source === 'MANUAL_SIMULATION' ? 'Vị trí mô phỏng' : item.source}</p></div>
            <button type="button" onClick={() => pickCoordinates(Number(item.latitude), Number(item.longitude))} className="text-blue-700 underline">Xem trên bản đồ</button>
          </div>)}</div> : <p className="p-4 text-sm text-slate-500">Chưa có dữ liệu lịch sử.</p>}
      </div>
    </section>
  );
}
