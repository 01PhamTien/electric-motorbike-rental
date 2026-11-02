import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../services/api';
import type { Vehicle } from '../../types';

const money = (value: string | number) => Number(value).toLocaleString('vi-VN', { maximumFractionDigits: 0 }) + ' đ';
const statusLabels: Record<string, string> = {
  ACTIVE: 'Sẵn sàng cho thuê',
  CHARGING: 'Đang sạc',
  MAINTENANCE: 'Đang bảo dưỡng',
  INACTIVE: 'Ngừng khai thác',
};

export function VehicleDetailPage() {
  const { id } = useParams();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [activeImage, setActiveImage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError('');
    api.get<Vehicle>('/vehicles/' + id)
      .then(response => {
        if (mounted) {
          setVehicle(response.data);
          setActiveImage(0);
        }
      })
      .catch((err: any) => {
        if (mounted) setError(err.response?.data?.message || 'Không tải được thông tin phương tiện.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [id]);

  if (loading) return <section className="space-y-5">
    <div className="h-8 w-40 animate-pulse rounded-lg bg-slate-200" />
    <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="h-[420px] animate-pulse rounded-3xl bg-slate-200" />
      <div className="h-[420px] animate-pulse rounded-3xl bg-slate-200" />
    </div>
  </section>;

  if (error || !vehicle) return <section className="space-y-4 rounded-3xl border border-rose-200 bg-white p-8 text-center">
    <p className="font-semibold text-rose-700">{error || 'Không tìm thấy phương tiện.'}</p>
    <Link to="/vehicles" className="inline-flex rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white hover:bg-blue-800">Quay lại danh sách xe</Link>
  </section>;

  const images = vehicle.images || [];
  const availableForBooking = vehicle.status === 'ACTIVE' && vehicle.isActive !== false;

  return <section className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Link to="/vehicles" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-blue-700">← Quay lại danh sách xe</Link>
      <span className={availableForBooking ? 'rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200' : 'rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 ring-1 ring-slate-200'}>
        {statusLabels[vehicle.status] || vehicle.status}
      </span>
    </div>

    <div className="grid items-start gap-5 lg:grid-cols-[1.15fr_0.85fr]">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="relative flex min-h-[300px] items-center justify-center bg-gradient-to-br from-slate-100 via-blue-50 to-slate-100 sm:min-h-[440px]">
          {images[activeImage]?.imageUrl
            ? <img src={images[activeImage].imageUrl} alt={(vehicle.model?.brand || '') + ' ' + (vehicle.model?.name || '')} className="h-full max-h-[560px] min-h-[300px] w-full object-cover sm:min-h-[440px]" />
            : <div className="flex h-28 w-28 items-center justify-center rounded-[2rem] border border-white bg-white/80 text-5xl font-black text-blue-700 shadow-sm">EV</div>}
          {images.length > 0 && <span className="absolute bottom-4 right-4 rounded-full bg-slate-950/75 px-3 py-1.5 text-xs font-semibold text-white">{activeImage + 1}/{images.length} ảnh</span>}
        </div>
        {images.length > 1 && <div className="grid grid-cols-4 gap-2 p-3 sm:grid-cols-5">
          {images.map((image, index) => <button key={image.id} type="button" onClick={() => setActiveImage(index)} aria-label={'Xem ảnh ' + (index + 1)} className={'overflow-hidden rounded-xl border-2 ' + (activeImage === index ? 'border-blue-600' : 'border-transparent')}>
            <img src={image.imageUrl} alt={'Ảnh xe ' + (index + 1)} loading="lazy" className="h-16 w-full object-cover sm:h-20" />
          </button>)}
        </div>}
      </section>

      <section className="space-y-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">{vehicle.model?.brand || 'Xe máy điện'}</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{vehicle.model?.name || vehicle.code}</h1>
          <p className="mt-2 text-sm text-slate-500">Mã xe {vehicle.code} · Biển số {vehicle.licensePlate}</p>
        </div>

        <div className="rounded-2xl bg-slate-950 p-5 text-white">
          <p className="text-xs font-medium text-slate-300">Giá thuê</p>
          <p className="mt-1 text-3xl font-bold tracking-tight">{money(vehicle.dailyRate)}<span className="ml-1 text-sm font-normal text-slate-300">/ 24 giờ</span></p>
          <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4 text-sm">
            <span className="text-slate-300">Tiền cọc</span><strong>{money(vehicle.depositAmount)}</strong>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="font-bold text-slate-900">Điểm nhận và trả xe</h2>
          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="font-semibold text-slate-900">{vehicle.station?.name || 'Chưa xác định điểm thuê'}</p>
            <p className="mt-1 text-sm leading-5 text-slate-600">{vehicle.station?.address || 'Địa chỉ đang được cập nhật'}</p>
            {vehicle.station?.phone && <p className="mt-2 text-xs text-slate-500">Điện thoại: {vehicle.station.phone}</p>}
          </div>
        </div>

        {availableForBooking
          ? <Link to={'/vehicles?vehicleId=' + vehicle.id} className="flex w-full items-center justify-center rounded-xl bg-blue-700 px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-800">Chọn thời gian và đặt xe</Link>
          : <button disabled className="w-full cursor-not-allowed rounded-xl bg-slate-200 px-5 py-3.5 text-sm font-bold text-slate-500">Xe hiện chưa thể đặt thuê</button>}
        <p className="text-xs leading-5 text-slate-500">Tình trạng trống được xác nhận lại theo thời gian nhận/trả khi bạn tìm xe. Xe chỉ được giữ sau khi tạo đơn thuê thành công.</p>
      </section>
    </div>

    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <h2 className="text-lg font-bold text-slate-950">Thông số kỹ thuật</h2>
      {vehicle.model?.specifications
        ? <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-600">{vehicle.model.specifications}</p>
        : <p className="mt-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Dòng xe chưa được cập nhật thông số kỹ thuật.</p>}
    </section>
  </section>;
}
