import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../services/api';
import { EmptyState, LoadingState, money, SectionHeading } from '../../components/Brand';
import { ModelPhoto } from '../../components/ModelPhoto';
import { useAuth } from '../auth/AuthContext';
import type { Vehicle } from '../../types';

function localDateTime(hoursAhead: number) {
  const d = new Date(Date.now() + hoursAhead * 3600_000);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}
function errorMessage(err: unknown): string {
  const response = (err as { response?: { status?: number; data?: { message?: string | string[] } } })?.response;
  if (response?.status === 403) return 'Tài khoản hiện tại không có quyền đặt xe. Vui lòng đăng nhập bằng tài khoản khách hàng (CUSTOMER).';
  const data = response?.data;
  return Array.isArray(data?.message) ? data.message.join(', ') : data?.message || 'Không thể xử lý yêu cầu. Vui lòng thử lại.';
}

export function VehiclesPage() {
  const [items, setItems] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');
  const [station, setStation] = useState('');
  const [availability, setAvailability] = useState('all');
  const [selected, setSelected] = useState<Vehicle | null>(null);
  const [pickup, setPickup] = useState(localDateTime(24));
  const [returnDate, setReturnDate] = useState(localDateTime(48));
  const [submitting, setSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const isOperator = user?.role === 'ADMIN' || user?.role === 'STAFF';

  useEffect(() => {
    let active = true;
    api.get('/vehicles').then(({ data }) => {
      if (!active) return;
      const list: Vehicle[] = Array.isArray(data) ? data : data?.items ?? [];
      setItems(list);
      const requested = Number(params.get('vehicle'));
      const chosen = list.find(item => item.id === requested);
      if (chosen) setSelected(chosen);
    }).catch(() => { if (active) setLoadError('Không thể tải danh sách xe. Vui lòng kiểm tra kết nối hoặc thử lại.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const stations = useMemo(() => [...new Set(items.map(v => v.station?.name).filter((s): s is string => Boolean(s)))], [items]);
  const filtered = useMemo(() => items.filter(v => {
    const name = [v.model?.brand, v.model?.name, v.code, v.licensePlate].join(' ').toLowerCase();
    return name.includes(query.trim().toLowerCase()) && (!station || v.station?.name === station) && (availability !== 'ready' || v.status === 'ACTIVE');
  }), [items, query, station, availability]);
  const close = () => { setSelected(null); setBookingError(''); if (params.has('vehicle')) { params.delete('vehicle'); setParams(params, { replace: true }); } };
  const estimatedDays = Math.max(0, Math.ceil((new Date(returnDate).getTime() - new Date(pickup).getTime()) / 86_400_000));
  async function book(event: React.FormEvent) {
    event.preventDefault();
    if (!selected || submitting || authLoading) return;
    if (isOperator) { setBookingError('Chỉ tài khoản khách hàng (CUSTOMER) được tạo đơn thuê. Hãy đăng xuất và đăng nhập tài khoản khách hàng để đặt xe.'); return; }
    if (!user || !localStorage.getItem('accessToken')) { navigate('/login?redirect=' + encodeURIComponent('/vehicles?vehicle=' + selected.id)); return; }
    if (new Date(pickup).getTime() <= Date.now() || estimatedDays < 1) { setBookingError('Hãy chọn thời gian nhận trong tương lai và thời gian trả sau thời gian nhận.'); return; }
    setSubmitting(true); setBookingError('');
    try {
      await api.post('/bookings', { vehicleId: selected.id, pickupAt: new Date(pickup).toISOString(), returnAt: new Date(returnDate).toISOString() });
      navigate('/bookings/my?created=1');
    } catch (err) { setBookingError(errorMessage(err)); }
    finally { setSubmitting(false); }
  }
  return <div className="container-page py-12 sm:py-16">
    <div className="flex flex-wrap items-end justify-between gap-5"><SectionHeading eyebrow="ĐỘI XE VOLTGO" title="Tìm chiếc xe dành cho bạn" description="Khám phá xe điện tại Đà Nẵng, so sánh mức giá và đặt lịch thuê trực tuyến."/><span className="tag">{items.length} xe trong hệ thống</span></div>
    <div className="panel mt-9 grid gap-4 p-5 md:grid-cols-[1.6fr_1fr_1fr]">
      <label><span className="field-label">Tìm xe</span><input className="field" value={query} onChange={e => setQuery(e.target.value)} placeholder="Tên xe, hãng xe, biển số..." /></label>
      <label><span className="field-label">Điểm nhận</span><select value={station} className="field" onChange={e => setStation(e.target.value)}><option value="">Tất cả điểm thuê</option>{stations.map(s => <option key={s}>{s}</option>)}</select></label>
      <label><span className="field-label">Tình trạng</span><select className="field" value={availability} onChange={e => setAvailability(e.target.value)}><option value="all">Tất cả xe</option><option value="ready">Xe sẵn sàng</option></select></label>
    </div>
    <div className="mt-8 flex items-center justify-between"><p className="text-sm font-semibold text-slate-500">Hiển thị <strong className="text-slate-900">{filtered.length}</strong> kết quả</p><span className="text-xs text-slate-400">Giá thuê tính theo ngày</span></div>
    {isOperator && <div className="mt-6 rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm leading-6 text-sky-900" role="status">Bạn đang dùng tài khoản {user?.role === 'ADMIN' ? 'quản trị viên' : 'nhân viên'}. Vai trò này chỉ quản lý đơn thuê; để đặt xe thử nghiệm, hãy đăng xuất và đăng nhập bằng tài khoản khách hàng. <Link className="font-bold underline underline-offset-2" to="/operations">Đến quản lý đơn thuê →</Link></div>}
    {loading ? <div className="mt-7"><LoadingState /></div> : loadError ? <div className="mt-7 rounded-2xl bg-rose-50 p-6 text-rose-700" role="alert">{loadError}</div> : !filtered.length ? <div className="mt-7"><EmptyState title="Chưa tìm thấy xe phù hợp" description="Thử thay đổi bộ lọc hoặc chọn điểm nhận khác." action={<button className="btn-dark" onClick={() => { setQuery(''); setStation(''); setAvailability('all'); }}>Xóa bộ lọc</button>} /></div> : <div className="mt-7 grid gap-6 md:grid-cols-2 xl:grid-cols-3">{filtered.map(v => <article key={v.id} className="panel group overflow-hidden"><div className="vehicle-art relative flex aspect-[1.55] items-center justify-center p-4"><div className="h-full w-full transition duration-300 group-hover:scale-[1.04]"><ModelPhoto url={v.model?.imageUrl} alt={[v.model?.brand, v.model?.name].filter(Boolean).join(" ")} /></div><span className={'absolute left-5 top-5 rounded-full px-3 py-1.5 text-xs font-bold ' + (v.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700')}>{v.status === 'ACTIVE' ? '● Sẵn sàng' : '● ' + v.status}</span></div><div className="p-6"><span className="text-xs font-bold uppercase tracking-[.15em] text-slate-400">{v.model?.brand} · {v.code}</span><h3 className="mt-2 text-2xl font-extrabold">{v.model?.name}</h3><p className="mt-2 text-sm text-slate-500">⌖ {v.station?.name || 'Đà Nẵng'}</p><div className="mt-5 flex items-end justify-between border-t border-slate-100 pt-5"><div><p className="text-2xl font-extrabold text-emerald-700">{money(v.dailyRate)}</p><p className="mt-1 text-xs text-slate-400">/ ngày · Cọc {money(v.depositAmount)}</p></div><button disabled={v.status !== 'ACTIVE' || authLoading || isOperator} title={isOperator ? 'Chỉ tài khoản khách hàng được đặt xe' : undefined} onClick={() => { setSelected(v); setBookingError(''); }} className="btn-dark">{isOperator ? 'Chỉ dành cho khách' : 'Đặt xe ↗'}</button></div></div></article>)}</div>}
    {selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#071c21]/70 p-4 backdrop-blur-sm" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) close(); }}><section role="dialog" aria-modal="true" aria-labelledby="booking-title" className="max-h-[95vh] w-full max-w-xl overflow-y-auto rounded-[26px] bg-white p-6 shadow-2xl sm:p-8"><div className="flex items-start justify-between gap-4"><div><p className="eyebrow">ĐẶT XE TRỰC TUYẾN</p><h2 id="booking-title" className="mt-2 text-2xl font-extrabold">{selected.model?.brand} {selected.model?.name}</h2><p className="mt-2 text-sm text-slate-500">{selected.station?.name} · {selected.code}</p></div><button className="rounded-lg bg-slate-100 px-3 py-2 text-slate-600" onClick={close} aria-label="Đóng">✕</button></div><form onSubmit={book} className="mt-7 space-y-5"><div className="grid gap-4 sm:grid-cols-2"><label><span className="field-label">Nhận xe</span><input type="datetime-local" required className="field" value={pickup} onChange={e => setPickup(e.target.value)} /></label><label><span className="field-label">Trả xe</span><input type="datetime-local" required className="field" value={returnDate} onChange={e => setReturnDate(e.target.value)} /></label></div><div className="rounded-2xl bg-emerald-50 p-5"><div className="flex justify-between text-sm text-slate-600"><span>Giá theo ngày</span><strong>{money(selected.dailyRate)}</strong></div><div className="mt-3 flex justify-between text-sm text-slate-600"><span>Số ngày dự kiến</span><strong>{estimatedDays} ngày</strong></div><div className="mt-3 flex justify-between text-sm text-slate-600"><span>Tiền cọc tham khảo</span><strong>{money(selected.depositAmount)}</strong></div><div className="mt-4 flex justify-between border-t border-emerald-200 pt-4"><strong>Tiền thuê dự kiến</strong><strong className="text-xl text-emerald-800">{money(estimatedDays * Number(selected.dailyRate))}</strong></div></div>{bookingError && <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{bookingError}</p>}<p className="text-xs leading-5 text-slate-500">Đơn đặt sẽ ở trạng thái chờ xác nhận. Giá hiển thị là dự kiến, số tiền chính thức được lưu khi hệ thống tạo đơn.</p><button disabled={submitting || authLoading || isOperator || estimatedDays < 1} className="btn-primary w-full">{submitting ? 'Đang tạo đơn...' : 'Xác nhận đặt xe →'}</button>{!localStorage.getItem('accessToken') && <p className="text-center text-xs text-slate-500">Bạn sẽ được chuyển đến trang đăng nhập trước khi đặt xe.</p>}</form></section></div>}
    <div className="mt-10 text-center text-sm text-slate-500">Bạn muốn xem nơi nhận xe? <Link to="/stations" className="font-bold text-emerald-700 underline underline-offset-4">Khám phá các điểm thuê ↗</Link></div>
  </div>;
}
