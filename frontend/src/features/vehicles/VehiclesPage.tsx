import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { api } from '../../services/api';
import type { Station, Vehicle } from '../../types';

type VehicleModelOption = { id: number; brand: string; name: string };
type AvailabilityResponse = {
  count: number;
  criteria: { rentalDays: number };
  items: Array<Vehicle & { estimatedRentalDays: number; estimatedRentalAmount: string }>;
};

function localDateTime(date: Date) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
const money = (value: string | number) => Number(value).toLocaleString('vi-VN', { maximumFractionDigits: 0 }) + ' đ';

export function VehiclesPage() {
  const [items, setItems] = useState<AvailabilityResponse['items']>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [models, setModels] = useState<VehicleModelOption[]>([]);
  const [stationId, setStationId] = useState('');
  const [modelId, setModelId] = useState('');
  const [keyword, setKeyword] = useState('');
  const [minDailyRate, setMinDailyRate] = useState('');
  const [maxDailyRate, setMaxDailyRate] = useState('');
  const [pickupAt, setPickupAt] = useState(localDateTime(new Date(Date.now() + 60 * 60 * 1000)));
  const [returnAt, setReturnAt] = useState(localDateTime(new Date(Date.now() + 25 * 60 * 60 * 1000)));
  const [rentalDays, setRentalDays] = useState(2);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState<Vehicle | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get<Station[]>('/stations'),
      api.get<VehicleModelOption[]>('/vehicle-models'),
    ])
      .then(([stationResponse, modelResponse]) => {
        setStations(stationResponse.data.filter((station: any) => station.isActive !== false));
        setModels(modelResponse.data);
      })
      .catch((err: any) => setError(err.response?.data?.message || 'Không tải được điểm thuê và dòng xe.'))
      .finally(() => setLoading(false));
  }, []);

  async function searchAvailability(event?: FormEvent) {
    event?.preventDefault();
    const start = new Date(pickupAt);
    const end = new Date(returnAt);
    if (!(end > start)) { setError('Thời gian trả phải sau thời gian nhận.'); return; }
    if (start.getTime() <= Date.now()) { setError('Thời gian nhận xe phải ở tương lai.'); return; }
    if (minDailyRate && Number(minDailyRate) < 0) { setError('Giá tối thiểu không hợp lệ.'); return; }
    if (maxDailyRate && Number(maxDailyRate) < 0) { setError('Giá tối đa không hợp lệ.'); return; }
    if (minDailyRate && maxDailyRate && Number(minDailyRate) > Number(maxDailyRate)) {
      setError('Giá tối thiểu không được lớn hơn giá tối đa.'); return;
    }

    setSearching(true); setError(''); setMessage('');
    try {
      const params: Record<string, string | number> = {
        pickupAt: start.toISOString(),
        returnAt: end.toISOString(),
      };
      if (stationId) params.stationId = Number(stationId);
      if (modelId) params.modelId = Number(modelId);
      if (minDailyRate) params.minDailyRate = Number(minDailyRate);
      if (maxDailyRate) params.maxDailyRate = Number(maxDailyRate);
      const response = await api.get<AvailabilityResponse>('/vehicles/availability', { params });
      setItems(response.data.items);
      setRentalDays(response.data.criteria.rentalDays);
    } catch (err: any) {
      setItems([]);
      setError(err.response?.data?.message || 'Không tìm được xe phù hợp với khoảng thời gian đã chọn.');
    } finally {
      setSearching(false);
    }
  }

  useEffect(() => {
    if (stations.length || models.length) void searchAvailability();
  }, [stations, models]);

  const visible = useMemo(() => items.filter(vehicle => {
    const haystack = `${vehicle.code} ${vehicle.licensePlate} ${vehicle.model?.brand} ${vehicle.model?.name} ${vehicle.station?.name}`.toLowerCase();
    return haystack.includes(keyword.toLowerCase());
  }), [items, keyword]);

  async function book() {
    if (!selected) return;
    const start = new Date(pickupAt);
    const end = new Date(returnAt);
    if (!(end > start)) { setError('Thời gian trả phải sau thời gian nhận.'); return; }
    setSubmitting(true); setError(''); setMessage('');
    try {
      const response = await api.post('/bookings', {
        vehicleId: selected.id,
        pickupAt: start.toISOString(),
        returnAt: end.toISOString(),
      });
      setMessage(`Đã tạo đơn thuê #${response.data.id}. Đơn đang chờ nhân viên xác nhận.`);
      setSelected(null);
      await searchAvailability();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không thể tạo đơn thuê. Xe có thể vừa được khách khác đặt hoặc đang bảo dưỡng.');
    } finally { setSubmitting(false); }
  }

  return <section className="space-y-6">
    <div>
      <p className="text-sm font-semibold text-blue-700">THUÊ XE ĐIỆN</p>
      <h1 className="mt-1 text-2xl font-bold text-slate-900">Tìm xe và đặt thuê</h1>
      <p className="mt-1 text-sm text-slate-600">Kết quả chỉ hiển thị xe còn trống trong toàn bộ khoảng thời gian nhận và trả.</p>
    </div>
    {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{Array.isArray(error) ? error.join(', ') : error}</div>}
    {message && <div role="status" className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">{message} <a className="ml-2 font-semibold underline" href="/bookings/my">Xem đơn thuê</a></div>}

    <form onSubmit={searchAvailability} className="space-y-4 rounded-xl border bg-white p-5 shadow-sm">
      <h2 className="font-semibold text-slate-900">Điều kiện tìm kiếm</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium text-slate-700">Thời gian nhận xe
          <input type="datetime-local" value={pickupAt} min={localDateTime(new Date())} onChange={e=>setPickupAt(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2"/>
        </label>
        <label className="text-sm font-medium text-slate-700">Thời gian trả xe
          <input type="datetime-local" value={returnAt} min={pickupAt} onChange={e=>setReturnAt(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2"/>
        </label>
        <label className="text-sm font-medium text-slate-700">Điểm thuê
          <select value={stationId} onChange={e=>setStationId(e.target.value)} className="mt-1 w-full rounded-lg border bg-white px-3 py-2">
            <option value="">Tất cả điểm thuê</option>
            {stations.map(station=><option key={station.id} value={station.id}>{station.name}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">Dòng xe
          <select value={modelId} onChange={e=>setModelId(e.target.value)} className="mt-1 w-full rounded-lg border bg-white px-3 py-2">
            <option value="">Tất cả dòng xe</option>
            {models.map(model=><option key={model.id} value={model.id}>{model.brand} {model.name}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">Giá thuê tối thiểu / 24 giờ
          <input type="number" min="0" value={minDailyRate} onChange={e=>setMinDailyRate(e.target.value)} placeholder="Không giới hạn" className="mt-1 w-full rounded-lg border px-3 py-2"/>
        </label>
        <label className="text-sm font-medium text-slate-700">Giá thuê tối đa / 24 giờ
          <input type="number" min="0" value={maxDailyRate} onChange={e=>setMaxDailyRate(e.target.value)} placeholder="Không giới hạn" className="mt-1 w-full rounded-lg border px-3 py-2"/>
        </label>
      </div>
      <label className="block text-sm font-medium text-slate-700">Tìm theo tên xe, mã xe hoặc biển số
        <input value={keyword} onChange={e=>setKeyword(e.target.value)} placeholder="Ví dụ: VinFast, EV001..." className="mt-1 w-full rounded-lg border px-3 py-2"/>
      </label>
      <button type="submit" disabled={searching} className="w-full rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">
        {searching ? 'Đang tìm xe...' : 'Tìm xe còn trống'}
      </button>
    </form>

    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="font-semibold text-slate-900">Kết quả tìm kiếm</h2>
      {!loading && <p className="text-sm text-slate-500">{visible.length} xe phù hợp · {rentalDays} ngày tính phí</p>}
    </div>
    {loading || searching ? <p className="py-8 text-center text-sm text-slate-500">Đang tải dữ liệu...</p> :
      visible.length === 0 ? <div className="rounded-xl border bg-white p-8 text-center text-sm text-slate-500">Không có xe phù hợp. Hãy đổi thời gian hoặc điều kiện tìm kiếm.</div> :
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {visible.map(vehicle=><article key={vehicle.id} className="flex flex-col rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div><p className="text-xs font-semibold uppercase text-blue-700">{vehicle.model?.brand || 'Xe điện'}</p>
              <h3 className="mt-1 text-lg font-bold text-slate-900">{vehicle.model?.name || vehicle.code}</h3></div>
            <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">Còn trống</span>
          </div>
          <p className="mt-2 text-sm text-slate-500">{vehicle.code} · {vehicle.licensePlate}</p>
          <p className="mt-3 text-sm text-slate-600">{vehicle.station?.name || 'Chưa xác định điểm thuê'}</p>
          <div className="mt-4 space-y-1 border-t pt-3">
            <p className="text-xl font-bold text-slate-900">{money(vehicle.dailyRate)}<span className="text-xs font-normal text-slate-500"> / 24 giờ</span></p>
            <p className="text-sm text-slate-500">Tiền cọc: {money(vehicle.depositAmount)}</p>
            <p className="text-sm font-semibold text-blue-700">Tạm tính {rentalDays} ngày: {money(vehicle.estimatedRentalAmount)}</p>
          </div>
          <button onClick={()=>{setSelected(vehicle);setError('');}} className="mt-5 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800">Đặt xe này</button>
        </article>)}
      </div>}

    {selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6 shadow-xl">
        <div><h2 className="text-lg font-bold">Đặt thuê {selected.model?.brand} {selected.model?.name}</h2>
          <p className="mt-1 text-sm text-slate-500">{selected.station?.name} · {money(selected.dailyRate)}/24 giờ · Cọc {money(selected.depositAmount)}</p></div>
        <div className="rounded-lg bg-slate-50 p-3 text-sm">
          <p>Nhận: {new Date(pickupAt).toLocaleString('vi-VN')}</p>
          <p>Trả: {new Date(returnAt).toLocaleString('vi-VN')}</p>
          <p className="mt-2 font-semibold">Tiền thuê dự kiến: {money((selected as AvailabilityResponse['items'][number]).estimatedRentalAmount)}</p>
        </div>
        <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">Đơn sẽ ở trạng thái chờ xác nhận. Giá được chốt tại thời điểm tạo đơn; kết quả tìm kiếm không giữ xe cho đến khi tạo đơn thành công.</p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2"><button onClick={()=>setSelected(null)} className="rounded-lg border px-4 py-2 text-sm">Đóng</button>
          <button disabled={submitting} onClick={()=>void book()} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{submitting?'Đang tạo đơn...':'Xác nhận đặt thuê'}</button></div>
      </div>
    </div>}
  </section>;
}
