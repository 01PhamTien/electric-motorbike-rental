import { useEffect, useMemo, useState } from 'react';
import { api } from '../../services/api';
import type { Station, Vehicle } from '../../types';

function localDateTime(date: Date) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
const money = (value: string | number) => Number(value).toLocaleString('vi-VN') + ' đ';

export function VehiclesPage() {
  const [items, setItems] = useState<Vehicle[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [stationId, setStationId] = useState('');
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState<Vehicle | null>(null);
  const [pickupAt, setPickupAt] = useState(localDateTime(new Date(Date.now() + 60 * 60 * 1000)));
  const [returnAt, setReturnAt] = useState(localDateTime(new Date(Date.now() + 25 * 60 * 60 * 1000)));
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([api.get<Vehicle[]>('/vehicles'), api.get<Station[]>('/stations')])
      .then(([vehicleResponse, stationResponse]) => {
        setItems(vehicleResponse.data);
        setStations(stationResponse.data.filter((station: any) => station.isActive !== false));
      })
      .catch((err: any) => setError(err.response?.data?.message || 'Không tải được danh sách xe và điểm thuê.'))
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(() => items.filter(vehicle => {
    const matchesStation = !stationId || String(vehicle.station?.id) === stationId;
    const haystack = `${vehicle.code} ${vehicle.licensePlate} ${vehicle.model?.brand} ${vehicle.model?.name} ${vehicle.station?.name}`.toLowerCase();
    return matchesStation && haystack.includes(keyword.toLowerCase()) && vehicle.status === 'ACTIVE';
  }), [items, stationId, keyword]);

  async function book() {
    if (!selected) return;
    const start = new Date(pickupAt);
    const end = new Date(returnAt);
    if (!(end > start)) { setError('Thời gian trả phải sau thời gian nhận.'); return; }
    if (start.getTime() <= Date.now()) { setError('Thời gian nhận xe phải ở tương lai.'); return; }
    setSubmitting(true); setError(''); setMessage('');
    try {
      const response = await api.post('/bookings', {
        vehicleId: selected.id,
        pickupAt: start.toISOString(),
        returnAt: end.toISOString(),
      });
      setMessage(`Đã tạo đơn thuê #${response.data.id}. Đơn đang chờ nhân viên xác nhận.`);
      setSelected(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không thể tạo đơn thuê. Hãy đăng nhập bằng tài khoản khách hàng và kiểm tra lịch xe.');
    } finally { setSubmitting(false); }
  }

  return <section className="space-y-6">
    <div>
      <p className="text-sm font-semibold text-blue-700">THUÊ XE ĐIỆN</p>
      <h1 className="mt-1 text-2xl font-bold text-slate-900">Tìm xe và đặt thuê</h1>
      <p className="mt-1 text-sm text-slate-600">Chọn xe tại điểm thuê, thời gian nhận và trả. Mỗi đơn áp dụng cho một xe cụ thể.</p>
    </div>
    {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{Array.isArray(error) ? error.join(', ') : error}</div>}
    {message && <div role="status" className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">{message} <a className="ml-2 font-semibold underline" href="/bookings/my">Xem đơn thuê</a></div>}
    <div className="grid gap-3 rounded-xl border bg-white p-4 shadow-sm sm:grid-cols-[1fr_240px]">
      <label className="text-sm font-medium text-slate-700">Tìm theo tên xe, mã xe hoặc điểm thuê
        <input value={keyword} onChange={e=>setKeyword(e.target.value)} placeholder="Ví dụ: VinFast, EV001..." className="mt-1 w-full rounded-lg border px-3 py-2"/>
      </label>
      <label className="text-sm font-medium text-slate-700">Điểm thuê
        <select value={stationId} onChange={e=>setStationId(e.target.value)} className="mt-1 w-full rounded-lg border bg-white px-3 py-2">
          <option value="">Tất cả điểm thuê</option>
          {stations.map(station=><option key={station.id} value={station.id}>{station.name}</option>)}
        </select>
      </label>
    </div>
    {loading ? <p className="py-8 text-center text-sm text-slate-500">Đang tải danh sách xe...</p> :
      visible.length === 0 ? <div className="rounded-xl border bg-white p-8 text-center text-sm text-slate-500">Không có xe phù hợp với bộ lọc.</div> :
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {visible.map(vehicle=><article key={vehicle.id} className="flex flex-col rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div><p className="text-xs font-semibold uppercase text-blue-700">{vehicle.model?.brand || 'Xe điện'}</p>
              <h2 className="mt-1 text-lg font-bold text-slate-900">{vehicle.model?.name || vehicle.code}</h2></div>
            <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">Có thể đặt</span>
          </div>
          <p className="mt-2 text-sm text-slate-500">{vehicle.code} · {vehicle.licensePlate}</p>
          <p className="mt-3 text-sm text-slate-600">{vehicle.station?.name || 'Chưa xác định điểm thuê'}</p>
          <div className="mt-4 space-y-1 border-t pt-3">
            <p className="text-xl font-bold text-slate-900">{money(vehicle.dailyRate)}<span className="text-xs font-normal text-slate-500"> / 24 giờ</span></p>
            <p className="text-sm text-slate-500">Tiền cọc: {money(vehicle.depositAmount)}</p>
          </div>
          <button onClick={()=>{setSelected(vehicle);setError('');}} className="mt-5 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800">Đặt xe này</button>
        </article>)}
      </div>}
    {selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6 shadow-xl">
        <div><h2 className="text-lg font-bold">Đặt thuê {selected.model?.brand} {selected.model?.name}</h2>
          <p className="mt-1 text-sm text-slate-500">{selected.station?.name} · {money(selected.dailyRate)}/24 giờ · Cọc {money(selected.depositAmount)}</p></div>
        <label className="block text-sm font-medium">Thời gian nhận xe
          <input type="datetime-local" min={localDateTime(new Date())} value={pickupAt} onChange={e=>setPickupAt(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2"/>
        </label>
        <label className="block text-sm font-medium">Thời gian trả xe
          <input type="datetime-local" min={pickupAt} value={returnAt} onChange={e=>setReturnAt(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2"/>
        </label>
        <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">Đơn sẽ ở trạng thái chờ xác nhận. Tiền thuê được tính theo mỗi 24 giờ; thanh toán và tiền cọc được nhân viên ghi nhận tại điểm thuê.</p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2"><button onClick={()=>setSelected(null)} className="rounded-lg border px-4 py-2 text-sm">Đóng</button>
          <button disabled={submitting} onClick={()=>void book()} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{submitting?'Đang tạo đơn...':'Xác nhận đặt thuê'}</button></div>
      </div>
    </div>}
  </section>;
}
