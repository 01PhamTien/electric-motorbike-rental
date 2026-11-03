import { useEffect, useMemo, useState } from 'react';
import { api } from '../../services/api';
import { SectionHeading } from '../../components/Brand';
import type { Vehicle } from '../../types';

type LocationRecord = {
  id: number;
  vehicleId: number;
  latitude: string;
  longitude: string;
  source: string;
  createdAt: string;
};

export function LocationsPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleId, setVehicleId] = useState('');
  const [latitude, setLatitude] = useState('16.0544');
  const [longitude, setLongitude] = useState('108.2022');
  const [latest, setLatest] = useState<LocationRecord | null>(null);
  const [history, setHistory] = useState<LocationRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const selectedVehicle = useMemo(
    () => vehicles.find((vehicle) => String(vehicle.id) === vehicleId),
    [vehicles, vehicleId],
  );

  async function loadLocationData(id: string) {
    if (!id) return;
    setError('');
    try {
      const [latestResponse, historyResponse] = await Promise.all([
        api.get(`/vehicles/${id}/locations/latest`),
        api.get(`/vehicles/${id}/locations`),
      ]);
      setLatest(latestResponse.data ?? null);
      setHistory(Array.isArray(historyResponse.data) ? historyResponse.data : []);
    } catch (err: any) {
      setLatest(null);
      setHistory([]);
      setError(err.response?.data?.message || 'Không tải được lịch sử vị trí. Kiểm tra quyền ADMIN/STAFF và API.');
    }
  }

  useEffect(() => {
    api.get('/vehicles')
      .then((response) => {
        const data = Array.isArray(response.data) ? response.data : response.data?.items ?? [];
        setVehicles(data);
        if (data.length) setVehicleId(String(data[0].id));
      })
      .catch((err) => setError(err.response?.data?.message || 'Không tải được danh sách xe.'));
  }, []);

  useEffect(() => {
    if (vehicleId) loadLocationData(vehicleId);
  }, [vehicleId]);

  const lat = Number(latitude);
  const lng = Number(longitude);
  const validCoordinates = Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  const mapUrl = `https://www.google.com/maps?q=${encodeURIComponent(`${latitude},${longitude}`)}`;

  async function saveLocation(event: React.FormEvent) {
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
      await loadLocationData(vehicleId);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không lưu được vị trí. Chỉ ADMIN hoặc STAFF đúng điểm thuê mới được cập nhật.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="container-page space-y-8 py-12 sm:py-16">
      <SectionHeading eyebrow="ĐỊNH VỊ VẬN HÀNH" title="Vị trí mô phỏng xe" description="Chọn xe, nhập tọa độ, xem trước trên Google Maps rồi lưu lịch sử vị trí. Không phải dữ liệu GPS phần cứng." />

      {message && <div className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{message}</div>}
      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{String(error)}</div>}

      <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={saveLocation} className="space-y-4 panel p-6">
          <h2 className="font-semibold">Cập nhật vị trí</h2>
          <label className="block text-sm font-medium">Xe
            <select className="mt-1 w-full field" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} required>
              <option value="">-- Chọn xe --</option>
              {vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.code} · {vehicle.model?.brand} {vehicle.model?.name} · {vehicle.station?.name}</option>)}
            </select>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium">Vĩ độ (latitude)
              <input className="mt-1 w-full field" type="number" step="any" min="-90" max="90" value={latitude} onChange={(e) => setLatitude(e.target.value)} required />
            </label>
            <label className="block text-sm font-medium">Kinh độ (longitude)
              <input className="mt-1 w-full field" type="number" step="any" min="-180" max="180" value={longitude} onChange={(e) => setLongitude(e.target.value)} required />
            </label>
          </div>
          <div className="rounded-lg bg-slate-50 p-3 text-sm">
            <p className="font-medium">Xem trước tọa độ</p>
            <p className="mt-1 text-slate-600">{validCoordinates ? `${lat.toFixed(7)}, ${lng.toFixed(7)}` : 'Tọa độ không hợp lệ'}</p>
            <a className="mt-2 inline-block text-emerald-700 underline" href={mapUrl} target="_blank" rel="noreferrer">Mở vị trí trên Google Maps</a>
          </div>
          <button disabled={loading || !vehicleId || !validCoordinates} className="w-full rounded-lg btn-primary">
            {loading ? 'Đang lưu...' : 'Cập nhật vị trí mô phỏng'}
          </button>
          <p className="text-xs text-slate-500">Đây là vị trí mô phỏng nhập thủ công, không phải GPS phần cứng.</p>
        </form>

        <div className="space-y-4 panel p-6">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold">Vị trí gần nhất</h2>
            <button type="button" onClick={() => loadLocationData(vehicleId)} className="text-sm text-emerald-700 underline">Làm mới</button>
          </div>
          {latest ? <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Vị trí mô phỏng</p>
            <p className="mt-1 font-semibold">{latest.latitude}, {latest.longitude}</p>
            <p className="mt-1 text-xs text-slate-500">Cập nhật: {new Date(latest.createdAt).toLocaleString('vi-VN')}</p>
            <a className="mt-2 inline-block text-sm text-emerald-700 underline" href={`https://www.google.com/maps?q=${latest.latitude},${latest.longitude}`} target="_blank" rel="noreferrer">Xem trên Google Maps</a>
          </div> : <p className="text-sm text-slate-500">{vehicleId ? 'Xe chưa có lịch sử vị trí.' : 'Chọn xe để xem vị trí.'}</p>}
          <div>
            <h3 className="mb-2 text-sm font-semibold">Lịch sử cập nhật (tối đa 200 bản ghi)</h3>
            <div className="max-h-72 overflow-auto rounded-lg border">
              {history.length ? history.map((item) => <div key={item.id} className="border-b p-3 text-sm last:border-0">
                <p className="font-medium">{item.latitude}, {item.longitude}</p>
                <p className="mt-1 text-xs text-slate-500">{new Date(item.createdAt).toLocaleString('vi-VN')} · {item.source === 'MANUAL_SIMULATION' ? 'Vị trí mô phỏng' : item.source}</p>
              </div>) : <p className="p-3 text-sm text-slate-500">Chưa có dữ liệu lịch sử.</p>}
            </div>
          </div>
          {selectedVehicle && <p className="text-xs text-slate-500">Đang xem: {selectedVehicle.code} · {selectedVehicle.station?.name}</p>}
        </div>
      </div>
    </section>
  );
}
