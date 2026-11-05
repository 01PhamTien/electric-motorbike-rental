import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../services/api';
import { EmptyState, LoadingState, money, SectionHeading } from '../../components/Brand';
import { ModelPhoto } from '../../components/ModelPhoto';
import { useAuth } from '../auth/AuthContext';
import type { Vehicle } from '../../types';
type VehicleReview = { id:number; rating:number; comment:string|null; createdAt:string; customer?:{fullName:string} };

function localDateTime(hoursAhead: number) {
  const d = new Date(Date.now() + hoursAhead * 3600_000);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
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
  const [details, setDetails] = useState<Vehicle | null>(null);
  const [reviews, setReviews] = useState<VehicleReview[]>([]);
  const [reviewSummary, setReviewSummary] = useState<{total:number;averageRating:number|null}>({total:0,averageRating:null});
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [pickup, setPickup] = useState(localDateTime(24));
  const [returnDate, setReturnDate] = useState(localDateTime(48));
  const [selectedStationId, setSelectedStationId] = useState<number | ''>('');
  const [submitting, setSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
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
      if (chosen) openBooking(chosen);
    }).catch(() => { if (active) setLoadError('Không thể tải danh sách xe. Vui lòng kiểm tra kết nối hoặc thử lại.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const stations = useMemo(() => {
    const unique = new Map<number, {id:number;name:string}>();
    items.forEach(v => { if (v.station) unique.set(v.station.id, {id:v.station.id,name:v.station.name}); });
    return [...unique.values()].sort((a,b) => a.name.localeCompare(b.name));
  }, [items]);
  const filtered = useMemo(() => items.filter(v => {
    const name = [v.model?.brand, v.model?.name, v.code, v.licensePlate].join(' ').toLowerCase();
    return name.includes(query.trim().toLowerCase()) && (!station || v.station?.name === station) && (availability !== 'ready' || v.status === 'ACTIVE');
  }), [items, query, station, availability]);
  const availableAtSelectedStation = useMemo(() => items.filter(v => v.station?.id === selectedStationId && v.status === 'ACTIVE'), [items, selectedStationId]);
  const activeCountAtStation = (stationId: number) => items.filter(v => v.station?.id === stationId && v.status === 'ACTIVE').length;
  const closeBooking = () => {
    setSelected(null); setBookingError(''); setAcceptedTerms(false);
    if (params.has('vehicle')) { params.delete('vehicle'); setParams(params, { replace: true }); }
  };
  async function openDetails(vehicle: Vehicle) {
    setDetails(vehicle); setReviews([]); setReviewSummary({total:0,averageRating:null}); setReviewsLoading(true);
    try { const {data} = await api.get('/vehicles/'+vehicle.id+'/reviews'); setReviews(data?.items ?? []); setReviewSummary({total:data?.total ?? 0,averageRating:data?.averageRating ?? null}); }
    catch { setReviews([]); }
    finally { setReviewsLoading(false); }
  }
  function openBooking(vehicle: Vehicle) {
    setSelected(vehicle);
    setSelectedStationId(vehicle.station?.id ?? '');
    setBookingError('');
    setAcceptedTerms(false);
    setDetails(null);
  }
  const estimatedDays = Math.max(0, Math.ceil((new Date(returnDate).getTime() - new Date(pickup).getTime()) / 86_400_000));
  const rentalTotal = estimatedDays * Number(selected?.dailyRate ?? 0);
  const deposit = Number(selected?.depositAmount ?? 0);
  const initialDue = rentalTotal + deposit;
  const validPeriod = new Date(pickup).getTime() > Date.now() && new Date(returnDate).getTime() > new Date(pickup).getTime();

  async function book(event: React.FormEvent) {
    event.preventDefault();
    if (!selected || submitting || authLoading) return;
    if (isOperator) { setBookingError('Chỉ tài khoản khách hàng (CUSTOMER) được tạo đơn thuê. Hãy đăng xuất và đăng nhập tài khoản khách hàng để đặt xe.'); return; }
    if (!user || !localStorage.getItem('accessToken')) { navigate('/login?redirect=' + encodeURIComponent('/vehicles?vehicle=' + selected.id)); return; }
    if (!validPeriod || estimatedDays < 1) { setBookingError('Hãy chọn thời gian nhận trong tương lai và thời gian trả sau thời gian nhận.'); return; }
    if (!acceptedTerms) { setBookingError('Vui lòng xác nhận đã đọc thông tin chi phí và điều kiện đặt xe.'); return; }
    setSubmitting(true); setBookingError('');
    try {
      await api.post('/bookings', { vehicleId: selected.id, pickupAt: new Date(pickup).toISOString(), returnAt: new Date(returnDate).toISOString() });
      navigate('/bookings/my?created=1');
    } catch (err) { setBookingError(errorMessage(err)); }
    finally { setSubmitting(false); }
  }

  return <div className="container-page py-12 sm:py-16">
    <div className="flex flex-wrap items-end justify-between gap-5"><SectionHeading eyebrow="ĐỘI XE VOLTGO" title="Tìm chiếc xe dành cho bạn" description="Xem thông tin từng dòng xe, chọn trạm nhận, thời gian thuê và kiểm tra toàn bộ khoản dự kiến trước khi gửi yêu cầu."/><span className="tag">{items.length} xe trong hệ thống</span></div>
    <div className="panel mt-9 grid gap-4 p-5 md:grid-cols-[1.6fr_1fr_1fr]">
      <label><span className="field-label">Tìm xe</span><input className="field" value={query} onChange={e => setQuery(e.target.value)} placeholder="Tên xe, hãng xe, mã xe..." /></label>
      <label><span className="field-label">Điểm nhận</span><select value={station} className="field" onChange={e => setStation(e.target.value)}><option value="">Tất cả điểm thuê</option>{stations.map(s => <option key={s.id}>{s.name}</option>)}</select></label>
      <label><span className="field-label">Tình trạng</span><select className="field" value={availability} onChange={e => setAvailability(e.target.value)}><option value="all">Tất cả xe</option><option value="ready">Xe sẵn sàng</option></select></label>
    </div>
    <div className="mt-8 flex items-center justify-between"><p className="text-sm font-semibold text-slate-500">Hiển thị <strong className="text-slate-900">{filtered.length}</strong> kết quả</p><span className="text-xs text-slate-400">Giá thuê tính theo ngày</span></div>
    {isOperator && <div className="mt-6 rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm leading-6 text-sky-900" role="status">Bạn đang dùng tài khoản {user?.role === 'ADMIN' ? 'quản trị viên' : 'nhân viên'}. Vai trò này chỉ quản lý đơn thuê; để đặt xe thử nghiệm, hãy đăng xuất và đăng nhập bằng tài khoản khách hàng. <Link className="font-bold underline underline-offset-2" to="/operations">Đến quản lý đơn thuê →</Link></div>}
    {loading ? <div className="mt-7"><LoadingState /></div> : loadError ? <div className="mt-7 rounded-2xl bg-rose-50 p-6 text-rose-700" role="alert">{loadError}</div> : !filtered.length ? <div className="mt-7"><EmptyState title="Chưa tìm thấy xe phù hợp" description="Thử thay đổi bộ lọc hoặc chọn điểm nhận khác." action={<button className="btn-dark" onClick={() => { setQuery(''); setStation(''); setAvailability('all'); }}>Xóa bộ lọc</button>} /></div> : <div className="mt-7 grid gap-6 md:grid-cols-2 xl:grid-cols-3">{filtered.map(v => <article key={v.id} className="panel group overflow-hidden">
      <button className="vehicle-art relative flex aspect-[1.55] w-full items-center justify-center p-4 text-left" onClick={() => void openDetails(v)} aria-label={'Xem chi tiết ' + v.model?.name}><div className="h-full w-full transition duration-300 group-hover:scale-[1.04]"><ModelPhoto url={v.model?.imageUrl} alt={[v.model?.brand, v.model?.name].filter(Boolean).join(' ')}/></div><span className={'absolute left-5 top-5 rounded-full px-3 py-1.5 text-xs font-bold ' + (v.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700')}>{v.status === 'ACTIVE' ? '● Sẵn sàng' : '● ' + v.status}</span></button>
      <div className="p-6"><span className="text-xs font-bold uppercase tracking-[.15em] text-slate-400">{v.model?.brand} · {v.code}</span><button className="mt-2 block text-left text-2xl font-extrabold hover:text-emerald-700" onClick={() => void openDetails(v)}>{v.model?.name}</button><p className="mt-2 text-sm text-slate-500">⌖ {v.station?.name || 'Đà Nẵng'}</p><div className="mt-5 flex items-end justify-between border-t border-slate-100 pt-5"><div><p className="text-2xl font-extrabold text-emerald-700">{money(v.dailyRate)}</p><p className="mt-1 text-xs text-slate-400">/ ngày · Cọc {money(v.depositAmount)}</p></div><div className="flex flex-col items-end gap-2"><button onClick={() => void openDetails(v)} className="text-xs font-bold text-emerald-700 underline underline-offset-4">Xem chi tiết</button><button disabled={v.status !== 'ACTIVE' || authLoading || isOperator} title={isOperator ? 'Chỉ tài khoản khách hàng được đặt xe' : undefined} onClick={() => openBooking(v)} className="btn-dark">{isOperator ? 'Chỉ dành cho khách' : 'Đặt xe ↗'}</button></div></div></div>
    </article>)}</div>}

    {details && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#071c21]/70 p-4 backdrop-blur-sm" onMouseDown={e => {if(e.target===e.currentTarget)setDetails(null);}}><section role="dialog" aria-modal="true" aria-labelledby="vehicle-detail-title" className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-[26px] bg-white p-6 shadow-2xl sm:p-8">
      <div className="flex items-start justify-between gap-4"><div><p className="eyebrow">HỒ SƠ PHƯƠNG TIỆN</p><h2 id="vehicle-detail-title" className="mt-2 text-2xl font-extrabold">{details.model?.brand} {details.model?.name}</h2><p className="mt-2 text-sm text-slate-500">{details.code} · {details.station?.name}</p></div><button onClick={()=>setDetails(null)} className="rounded-lg bg-slate-100 px-3 py-2" aria-label="Đóng">✕</button></div>
      <div className="mt-6 grid gap-6 md:grid-cols-[.9fr_1.1fr]"><div className="vehicle-art flex min-h-56 items-center justify-center overflow-hidden rounded-2xl p-4"><ModelPhoto url={details.model?.imageUrl} alt={details.model?.name ?? 'Xe điện'}/></div><div><h3 className="text-lg font-extrabold">Thông tin xe</h3><div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div className="rounded-xl bg-slate-50 p-3"><p className="field-label">Hãng</p><strong>{details.model?.brand}</strong></div><div className="rounded-xl bg-slate-50 p-3"><p className="field-label">Mã xe</p><strong>{details.code}</strong></div><div className="rounded-xl bg-slate-50 p-3"><p className="field-label">Giá thuê/ngày</p><strong>{money(details.dailyRate)}</strong></div><div className="rounded-xl bg-slate-50 p-3"><p className="field-label">Tiền cọc</p><strong>{money(details.depositAmount)}</strong></div></div><p className="mt-4 text-sm leading-6 text-slate-600">Điểm nhận: {details.station?.name}. Tình trạng: {details.status === 'ACTIVE' ? 'Sẵn sàng' : details.status}.</p></div></div>
      <div className="mt-7"><h3 className="text-lg font-extrabold">Thông số kỹ thuật và mô tả</h3><div className="mt-3 whitespace-pre-line rounded-2xl bg-slate-50 p-5 text-sm leading-7 text-slate-700">{details.model?.specifications || 'Thông số và mô tả chi tiết của mẫu xe đang được cập nhật.'}</div></div>
      <div className="mt-6 rounded-2xl border border-amber-100 bg-amber-50 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-extrabold text-amber-950">Đánh giá từ khách đã thuê</h3><strong className="text-amber-900">{reviewSummary.averageRating===null?"Chưa có đánh giá":"★ "+reviewSummary.averageRating+"/5"} · {reviewSummary.total} lượt</strong></div>{reviewsLoading?<p className="mt-3 text-sm text-amber-800">Đang tải đánh giá...</p>:!reviews.length?<p className="mt-3 text-sm leading-6 text-amber-800">Chưa có đánh giá xác thực. Chỉ khách đã hoàn thành chuyến thuê mới được gửi đánh giá.</p>:<div className="mt-4 space-y-3">{reviews.map(review=><div key={review.id} className="rounded-xl bg-white/80 p-3"><div className="flex justify-between gap-3"><strong className="text-sm">{review.customer?.fullName||"Khách hàng VoltGo"}</strong><span className="text-amber-600">{"★".repeat(review.rating)}{"☆".repeat(5-review.rating)}</span></div>{review.comment&&<p className="mt-2 text-sm leading-6 text-slate-700">{review.comment}</p>}<p className="mt-1 text-xs text-slate-400">{new Date(review.createdAt).toLocaleDateString("vi-VN")}</p></div>)}</div>}</div>
      <div className="mt-7 flex flex-wrap justify-end gap-3"><button className="btn-outline" onClick={()=>setDetails(null)}>Đóng</button><button disabled={details.status!=='ACTIVE'||isOperator||authLoading} className="btn-primary" onClick={()=>openBooking(details)}>Chọn xe này →</button></div>
    </section></div>}

    {selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#071c21]/70 p-4 backdrop-blur-sm" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) closeBooking(); }}><section role="dialog" aria-modal="true" aria-labelledby="booking-title" className="max-h-[96vh] w-full max-w-2xl overflow-y-auto rounded-[26px] bg-white p-6 shadow-2xl sm:p-8">
      <div className="flex items-start justify-between gap-4"><div><p className="eyebrow">XÁC NHẬN YÊU CẦU THUÊ XE</p><h2 id="booking-title" className="mt-2 text-2xl font-extrabold">{selected.model?.brand} {selected.model?.name}</h2><p className="mt-2 text-sm text-slate-500">{selected.code}</p></div><button className="rounded-lg bg-slate-100 px-3 py-2 text-slate-600" onClick={closeBooking} aria-label="Đóng">✕</button></div>
      <form onSubmit={book} className="mt-6 space-y-5">
        <div className="grid gap-4 sm:grid-cols-2"><div className="flex items-center gap-4 rounded-2xl bg-slate-50 p-3"><div className="h-20 w-24 shrink-0"><ModelPhoto url={selected.model?.imageUrl} alt={selected.model?.name ?? 'Xe điện'}/></div><div><p className="font-extrabold">{selected.model?.name}</p><p className="mt-1 text-xs text-slate-500">{selected.code}</p><p className="mt-1 text-xs font-bold text-emerald-700">{money(selected.dailyRate)}/ngày</p></div></div>
          <label><span className="field-label">Trạm nhận xe</span><select required className="field" value={selectedStationId} onChange={e=>{const id=Number(e.target.value);setSelectedStationId(id);const first=items.find(v=>v.station?.id===id&&v.status==='ACTIVE');if(first)setSelected(first);}}>{stations.map(s=>{const count=activeCountAtStation(s.id);return <option key={s.id} value={s.id} disabled={count===0}>{s.name} · {count} xe sẵn sàng</option>;})}</select><span className="mt-1 block text-xs text-slate-500">Chỉ chọn được trạm đang có xe sẵn sàng. Số lượng xe được cập nhật từ danh sách xe hiện tại.</span></label>
        </div>
        <label><span className="field-label">Xe tại trạm đã chọn</span><select className="field" value={selected.id} onChange={e=>{const vehicle=availableAtSelectedStation.find(v=>v.id===Number(e.target.value));if(vehicle)setSelected(vehicle);}}>{availableAtSelectedStation.map(v=><option key={v.id} value={v.id}>{v.model?.brand} {v.model?.name} · {v.code} · {money(v.dailyRate)}/ngày</option>)}</select>{!availableAtSelectedStation.length&&<span className="mt-1 block text-xs text-rose-600">Trạm này hiện chưa có xe sẵn sàng.</span>}</label>
        <div className="grid gap-4 sm:grid-cols-2"><label><span className="field-label">Ngày giờ nhận xe</span><input type="datetime-local" required min={localDateTime(0)} className="field" value={pickup} onChange={e=>setPickup(e.target.value)}/></label><label><span className="field-label">Ngày giờ trả xe</span><input type="datetime-local" required min={pickup} className="field" value={returnDate} onChange={e=>setReturnDate(e.target.value)}/></label></div>
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
          <h3 className="font-extrabold text-emerald-950">Bảng kê chi phí dự kiến</h3>
          <div className="mt-4 space-y-3 text-sm"><div className="flex justify-between gap-3 text-slate-700"><span>{money(selected.dailyRate)} × {estimatedDays} ngày</span><strong>{money(rentalTotal)}</strong></div><div className="flex justify-between gap-3 text-slate-700"><span>Tiền cọc (hoàn lại theo điều kiện thuê)</span><strong>{money(deposit)}</strong></div><div className="flex justify-between gap-3 border-t border-emerald-200 pt-3 text-base font-extrabold text-emerald-950"><span>Tổng dự kiến cần chuẩn bị</span><strong>{money(initialDue)}</strong></div></div>
          <p className="mt-3 text-xs leading-5 text-emerald-900/75">Tổng trên gồm tiền thuê và tiền cọc, không phải khoản đã thu. Cọc được đối soát khi trả xe theo tình trạng xe và điều khoản thuê. Phụ phí (nếu có) phải được thông báo và xác nhận riêng.</p>
        </div>
        <div className="rounded-xl border border-sky-100 bg-sky-50 p-4 text-sm leading-6 text-sky-900"><strong>Thanh toán:</strong> Hiện VoltGo ghi nhận thanh toán tại quầy bởi nhân viên. Website chưa kết nối cổng thanh toán trực tuyến, nên thao tác này chỉ gửi yêu cầu đặt xe; chưa trừ tiền hoặc thu tiền cọc.</div>
        <label className="flex items-start gap-3 text-sm leading-6 text-slate-600"><input type="checkbox" className="mt-1" checked={acceptedTerms} onChange={e=>setAcceptedTerms(e.target.checked)}/><span>Tôi đã kiểm tra thông tin xe, trạm nhận, thời gian và bảng kê chi phí dự kiến trước khi gửi yêu cầu.</span></label>
        {bookingError && <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{bookingError}</p>}
        <div className="flex flex-wrap gap-3"><button type="button" onClick={closeBooking} className="btn-outline flex-1">Quay lại</button><button disabled={submitting||authLoading||isOperator||!validPeriod||!acceptedTerms||!availableAtSelectedStation.length} className="btn-primary flex-1">{submitting?'Đang gửi yêu cầu...':'Gửi yêu cầu đặt xe →'}</button></div>
      </form>
    </section></div>}
    <div className="mt-10 text-center text-sm text-slate-500">Bạn muốn xem nơi nhận xe? <Link to="/stations" className="font-bold text-emerald-700 underline underline-offset-4">Khám phá các điểm thuê ↗</Link></div>
  </div>;
}
