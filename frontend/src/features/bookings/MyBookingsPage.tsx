import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { EmptyState, LoadingState, money, SectionHeading, timeText } from '../../components/Brand';
import { api } from '../../services/api';

type BookingStatus = 'PENDING' | 'CONFIRMED' | 'RENTING' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';
type Booking = {
  id: number; status: BookingStatus; pickupAt: string; returnAt: string;
  rentalAmount: string; baseRentalAmount?: string|null; discountAmount?: string; voucherId?:number|null; voucherCodeSnapshot?:string|null; cancellationFeeAmount?:string; cancellationType?:string|null; depositSnapshot: string; dailyRateSnapshot?: string; holdExpiresAt: string | null;
  cancelReason?: string | null;
  vehicle?: { code: string; licensePlate?: string; model?: { brand: string; name: string }; station?: { name: string; address?: string; phone?: string } };
};
type Payment = { id:number; purpose:string; method:string; amount:string; note?:string|null; createdAt:string };
type Handover = { id:number; kind:'PICKUP'|'RETURN'; batteryPercent:number; odometerKm:string; conditionNote:string; inspectionChecklist?:string|null; damageNotes?:string|null; photoUrls?:string|null; createdAt:string };
type Review = { id:number; rating:number; comment:string|null; createdAt:string };
type Issue = { id:number; issueType:string; severity:string; status:string; description:string; latitude:string|null; longitude:string|null; resolutionNote:string|null; createdAt:string; updatedAt:string };
const labels: Record<BookingStatus, string> = { PENDING: 'Chờ xác nhận', CONFIRMED: 'Đã xác nhận', RENTING: 'Đang thuê', COMPLETED: 'Hoàn thành', CANCELLED: 'Đã hủy', EXPIRED: 'Hết hạn' };
const badge: Record<BookingStatus, string> = { PENDING: 'bg-amber-50 text-amber-700', CONFIRMED: 'bg-blue-50 text-blue-700', RENTING: 'bg-emerald-50 text-emerald-700', COMPLETED: 'bg-slate-100 text-slate-700', CANCELLED: 'bg-rose-50 text-rose-700', EXPIRED: 'bg-slate-100 text-slate-600' };
const issueLabels: Record<string,string> = { BREAKDOWN:'Xe bị hỏng', LOW_BATTERY:'Xe sắp hết pin', ACCIDENT:'Tai nạn / va chạm', OTHER:'Vấn đề khác' };
const issueStatus: Record<string,string> = { OPEN:'Mới tiếp nhận', IN_PROGRESS:'Đang xử lý', RESOLVED:'Đã xử lý', CANCELLED:'Đã hủy' };
function parseStringList(value?: string | null): string[] { try { const parsed = JSON.parse(value || '[]'); return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []; } catch { return []; } }
function getError(error: unknown) {
  const message = (error as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  return Array.isArray(message) ? message.join(', ') : message || 'Không thể thực hiện thao tác. Vui lòng thử lại.';
}
export function MyBookingsPage() {
  const [items, setItems] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [filter, setFilter] = useState('ALL');
  const [params] = useSearchParams();
  const [detail, setDetail] = useState<Booking | null>(null);
  const detailRequestId = useRef(0);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [handovers, setHandovers] = useState<Handover[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [review, setReview] = useState<Review|null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [reviewRating,setReviewRating]=useState(5);
  const [reviewComment,setReviewComment]=useState('');
  const [reviewBusy,setReviewBusy]=useState(false);
  const [issueType,setIssueType]=useState('LOW_BATTERY');
  const [issueSeverity,setIssueSeverity]=useState('MEDIUM');
  const [issueDescription,setIssueDescription]=useState('');
  const [issueLocation,setIssueLocation]=useState<{latitude:number;longitude:number}|null>(null);
  const [issueBusy,setIssueBusy]=useState(false);
  const loggedIn = Boolean(localStorage.getItem('accessToken'));
  const load = useCallback(async () => {
    if (!loggedIn) { setLoading(false); return; }
    setLoading(true); setError('');
    try { const { data } = await api.get('/bookings/my'); setItems(Array.isArray(data) ? data : data?.items ?? []); }
    catch (err) { setError(getError(err)); }
    finally { setLoading(false); }
  }, [loggedIn]);
  useEffect(() => { void load(); }, [load]);
  const visible = filter === 'ALL' ? items : items.filter(b => b.status === filter);
  function closeDetails() {
    detailRequestId.current += 1;
    setDetail(null);
    setDetailLoading(false);
  }
  async function openDetails(booking: Booking) {
    const requestId = ++detailRequestId.current;
    setDetail(booking); setDetailLoading(true); setDetailError(''); setPayments([]); setHandovers([]); setIssues([]); setReview(null);
    setIssueDescription('');setIssueLocation(null);setReviewComment('');setReviewRating(5);
    const [bookingResult, paymentResult, handoverResult, reviewResult, issueResult] = await Promise.allSettled([
      api.get('/bookings/' + booking.id), api.get('/bookings/' + booking.id + '/payments'),
      api.get('/bookings/' + booking.id + '/handovers'), api.get('/bookings/' + booking.id + '/review'),
      api.get('/bookings/' + booking.id + '/issues'),
    ]);
    if (requestId !== detailRequestId.current) return;
    if (bookingResult.status === 'fulfilled') setDetail(bookingResult.value.data);
    else setDetailError(getError(bookingResult.reason));
    if (paymentResult.status === 'fulfilled') setPayments(Array.isArray(paymentResult.value.data) ? paymentResult.value.data : paymentResult.value.data?.items ?? []);
    if (handoverResult.status === 'fulfilled') setHandovers(Array.isArray(handoverResult.value.data) ? handoverResult.value.data : handoverResult.value.data?.items ?? []);
    if (reviewResult.status === 'fulfilled') setReview(reviewResult.value.data);
    if (issueResult.status === 'fulfilled') setIssues(Array.isArray(issueResult.value.data) ? issueResult.value.data : issueResult.value.data?.items ?? []);
    setDetailLoading(false);
  }
  async function cancel(booking: Booking) {
    const now = Date.now();
    const pickup = new Date(booking.pickupAt).getTime();
    if (now >= pickup) { setError('Đã đến giờ nhận xe. Vui lòng liên hệ nhân viên để được hỗ trợ.'); return; }
    const hoursUntilPickup = (pickup - now) / 3_600_000;
    const fee = booking.status === 'CONFIRMED' && hoursUntilPickup < 24
      ? Math.min(Math.round(Number(booking.rentalAmount) * 0.20 * 100) / 100, Number(booking.depositSnapshot))
      : 0;
    const policy = fee > 0
      ? 'Do hủy trong vòng 24 giờ trước giờ nhận xe, phí hủy dự kiến là ' + money(fee) + ' (20% tiền thuê, tối đa bằng tiền cọc).'
      : 'Đơn này được hủy miễn phí theo chính sách hiện tại.';
    if (!window.confirm('Bạn có chắc muốn hủy đơn #' + booking.id + '?\\n\\n' + policy + '\\n\\nPhí được ghi nhận để nhân viên đối soát thủ công; hệ thống không tự động thu tiền.')) return;
    setBusyId(booking.id); setError('');
    try { await api.patch('/bookings/' + booking.id + '/cancel', { reason: 'Khách hàng chủ động hủy' }); await load(); }
    catch (err) { setError(getError(err)); }
    finally { setBusyId(null); }
  }
  async function submitReview(event:React.FormEvent) {
    event.preventDefault(); if(!detail||detail.status!=='COMPLETED'||reviewBusy)return;
    setReviewBusy(true);setDetailError('');
    try { const {data}=await api.post('/bookings/'+detail.id+'/review',{rating:reviewRating,comment:reviewComment.trim()||undefined});setReview(data);setDetailError(''); }
    catch(e){setDetailError(getError(e));}
    finally{setReviewBusy(false);}
  }
  function captureIssueLocation() {
    if(!navigator.geolocation){setDetailError('Trình duyệt không hỗ trợ định vị. Bạn vẫn có thể gửi sự cố mà không kèm tọa độ.');return;}
    navigator.geolocation.getCurrentPosition(
      p=>{setIssueLocation({latitude:p.coords.latitude,longitude:p.coords.longitude});setDetailError('');},
      ()=>setDetailError('Không lấy được vị trí. Bạn vẫn có thể gửi báo cáo và mô tả vị trí trong nội dung.'),
      {enableHighAccuracy:true,timeout:10000,maximumAge:30000},
    );
  }
  async function submitIssue(event:React.FormEvent) {
    event.preventDefault();if(!detail||detail.status!=='RENTING'||issueBusy)return;
    setIssueBusy(true);setDetailError('');
    try {
      await api.post('/bookings/'+detail.id+'/issues',{issueType,severity:issueSeverity,description:issueDescription.trim(),...(issueLocation??{})});
      setIssueDescription('');setIssueLocation(null);
      const {data}=await api.get('/bookings/'+detail.id+'/issues');setIssues(Array.isArray(data)?data:data?.items??[]);
    } catch(e){setDetailError(getError(e));}
    finally{setIssueBusy(false);}
  }
  const paymentTotal = payments.filter(p=>p.purpose!=='REFUND').reduce((sum,p)=>sum+Number(p.amount),0);
  const refundTotal = payments.filter(p=>p.purpose==='REFUND').reduce((sum,p)=>sum+Number(p.amount),0);
  return <div className="container-page py-12 sm:py-16">
    <div className="flex flex-wrap items-end justify-between gap-6"><SectionHeading eyebrow="HÀNH TRÌNH CỦA TÔI" title="Quản lý đơn thuê" description="Theo dõi lịch nhận và trả xe, trạng thái đặt chỗ, chi phí, giao nhận và lịch sử thanh toán trong từng chuyến đi."/><Link to="/vehicles" className="btn-dark">+ Đặt xe mới</Link></div>
    {params.get('created') === '1' && <div role="status" className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm font-semibold text-emerald-800">✓ Yêu cầu đặt xe đã được gửi. Đơn đang chờ xác nhận; chưa có khoản tiền nào được tự động thu.</div>}
    {!loggedIn ? <div className="mt-8"><EmptyState title="Đăng nhập để xem đơn thuê" description="Bạn cần đăng nhập để theo dõi đơn và lịch sử đặt xe." action={<Link className="btn-primary" to="/login?redirect=%2Fbookings%2Fmy">Đăng nhập →</Link>} /></div> : <>
      <div className="mt-8 flex flex-wrap gap-2">{[{value:'ALL',label:'Tất cả'},...Object.entries(labels).map(([value,label]) => ({value,label}))].map(item => <button key={item.value} onClick={() => setFilter(item.value)} className={'rounded-full px-4 py-2 text-xs font-bold transition ' + (filter === item.value ? 'bg-[#102f33] text-white' : 'bg-white text-slate-500 hover:bg-emerald-50')}>{item.label}</button>)}</div>
      {error && <div role="alert" className="mt-6 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error} <button onClick={() => void load()} className="ml-2 font-bold underline">Thử lại</button></div>}
      {loading ? <div className="mt-6"><LoadingState label="Đang tải đơn thuê..." /></div> : !visible.length ? <div className="mt-6"><EmptyState title="Chưa có đơn thuê phù hợp" description="Khám phá danh sách xe và bắt đầu hành trình mới tại Đà Nẵng." action={<Link to="/vehicles" className="btn-primary">Khám phá xe ↗</Link>} /></div> : <div className="mt-6 space-y-5">{visible.map(b => <article key={b.id} className="panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-6"><div><span className="text-xs font-bold uppercase tracking-widest text-slate-400">MÃ ĐƠN #{b.id}</span><h3 className="mt-2 text-xl font-extrabold">{b.vehicle?.model ? b.vehicle.model.brand + ' ' + b.vehicle.model.name : 'Xe máy điện'}</h3><p className="mt-1 text-xs text-slate-500">{b.vehicle?.code} · {b.vehicle?.station?.name}</p></div><span className={'rounded-full px-4 py-2 text-xs font-bold ' + (badge[b.status] || 'bg-slate-100')}>{labels[b.status] || b.status}</span></div>
        <div className="grid gap-6 p-6 md:grid-cols-3"><div><p className="field-label">Nhận xe</p><p className="text-sm font-bold">{timeText(b.pickupAt)}</p></div><div><p className="field-label">Trả xe</p><p className="text-sm font-bold">{timeText(b.returnAt)}</p></div><div><p className="field-label">Tiền thuê</p><p className="text-xl font-extrabold text-emerald-700">{money(b.rentalAmount)}</p>{Number(b.discountAmount||0)>0&&<p className="mt-1 text-xs text-emerald-700">Voucher {b.voucherCodeSnapshot}: −{money(b.discountAmount)}</p>}<p className="mt-1 text-xs text-slate-400">Đặt cọc: {money(b.depositSnapshot)}</p>{b.status==='CANCELLED'&&b.cancellationType&&<p className="mt-1 text-xs text-rose-700">{b.cancellationType==='NO_SHOW'?'Khách không đến nhận xe (No-show)':'Đơn đã hủy'}{Number(b.cancellationFeeAmount||0)>0?' · Phí: '+money(b.cancellationFeeAmount):' · Không phát sinh phí'}</p>}</div></div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4"><button onClick={()=>void openDetails(b)} className="text-sm font-extrabold text-emerald-800 underline underline-offset-4">Xem chi tiết đơn →</button><div className="flex flex-wrap gap-2">{['PENDING', 'CONFIRMED'].includes(b.status) && (Date.now() < new Date(b.pickupAt).getTime() ? <button disabled={busyId === b.id} onClick={() => void cancel(b)} className="rounded-lg border border-rose-200 px-4 py-2 text-xs font-extrabold text-rose-700 hover:bg-rose-50">{busyId === b.id ? 'Đang hủy...' : 'Hủy đơn'}</button> : <span className="self-center text-xs text-slate-500">Liên hệ nhân viên để hủy</span>)}{b.status==='RENTING'&&<button onClick={()=>void openDetails(b)} className="rounded-lg bg-amber-100 px-4 py-2 text-xs font-extrabold text-amber-900">Báo sự cố / hết pin</button>}{b.status==='COMPLETED'&&<button onClick={()=>void openDetails(b)} className="rounded-lg bg-emerald-100 px-4 py-2 text-xs font-extrabold text-emerald-900">Đánh giá xe</button>}</div></div>
      </article>)}</div>}
    </>}
    {detail && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#071c21]/70 p-4 backdrop-blur-sm" onMouseDown={e=>{if(e.target===e.currentTarget)closeDetails();}}><section role="dialog" aria-modal="true" aria-labelledby="booking-detail-title" className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-[26px] bg-white p-6 shadow-2xl sm:p-8">
      <div className="flex items-start justify-between gap-4"><div><p className="eyebrow">CHI TIẾT CHUYẾN THUÊ</p><h2 id="booking-detail-title" className="mt-2 text-2xl font-extrabold">Đơn thuê #{detail.id}</h2><span className={'mt-3 inline-flex rounded-full px-3 py-1 text-xs font-bold '+badge[detail.status]}>{labels[detail.status]}</span></div><button onClick={closeDetails} className="rounded-lg bg-slate-100 px-3 py-2" aria-label="Đóng">✕</button></div>
      {detailLoading?<div className="mt-6"><LoadingState label="Đang tải thông tin đơn..."/></div>:<>
        {detailError&&<p role="alert" className="mt-4 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{detailError}</p>}
        <div className="mt-6 rounded-2xl bg-slate-50 p-5"><h3 className="font-extrabold">Thông tin phương tiện và điểm nhận</h3><p className="mt-3 text-lg font-bold">{detail.vehicle?.model?.brand} {detail.vehicle?.model?.name}</p><p className="mt-1 text-sm text-slate-600">Mã xe: {detail.vehicle?.code} · Biển số: {detail.vehicle?.licensePlate||'—'}</p><p className="mt-3 text-sm font-bold">{detail.vehicle?.station?.name}</p><p className="mt-1 text-sm text-slate-600">{detail.vehicle?.station?.address||'—'}</p>{detail.vehicle?.station?.phone&&<p className="mt-1 text-sm text-slate-600">☎ {detail.vehicle.station.phone}</p>}</div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2"><div className="rounded-xl border border-slate-100 p-4"><p className="field-label">Thời gian nhận</p><strong>{timeText(detail.pickupAt)}</strong></div><div className="rounded-xl border border-slate-100 p-4"><p className="field-label">Thời gian trả dự kiến</p><strong>{timeText(detail.returnAt)}</strong></div></div>
        <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50 p-5"><h3 className="font-extrabold">Chi phí theo đơn</h3><div className="mt-3 space-y-2 text-sm"><div className="flex justify-between"><span>Đơn giá/ngày</span><strong>{money(detail.dailyRateSnapshot)}</strong></div><div className="flex justify-between"><span>Tiền thuê gốc</span><strong>{money(detail.baseRentalAmount??detail.rentalAmount)}</strong></div>{Number(detail.discountAmount||0)>0&&<div className="flex justify-between text-emerald-800"><span>Voucher {detail.voucherCodeSnapshot}</span><strong>− {money(detail.discountAmount)}</strong></div>}<div className="flex justify-between"><span>Tiền thuê sau giảm</span><strong>{money(detail.rentalAmount)}</strong></div><div className="flex justify-between"><span>Tiền cọc</span><strong>{money(detail.depositSnapshot)}</strong></div><div className="flex justify-between border-t border-emerald-200 pt-3 font-extrabold"><span>Tổng dự kiến</span><strong>{money(Number(detail.rentalAmount)+Number(detail.depositSnapshot))}</strong></div>{Number(detail.cancellationFeeAmount||0)>0&&<div className="flex justify-between text-rose-700"><span>Phí hủy đã ghi nhận</span><strong>{money(detail.cancellationFeeAmount)}</strong></div>}</div><p className="mt-3 text-xs text-emerald-900/70">Tiền cọc được đối soát khi hoàn tất trả xe theo điều kiện thuê.</p></div>
        {detail.holdExpiresAt&&detail.status==='PENDING'&&<p className="mt-4 text-sm text-amber-800">Giữ chỗ đến: {timeText(detail.holdExpiresAt)}</p>}
        {detail.cancelReason&&<p className="mt-4 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">Lý do hủy: {detail.cancelReason}</p>}
        <div className="mt-6"><h3 className="font-extrabold">Biên bản giao nhận xe</h3>{!handovers.length?<p className="mt-2 text-sm text-slate-500">Chưa có biên bản giao nhận.</p>:<div className="mt-3 space-y-3">{handovers.map(h=><div key={h.id} className="rounded-xl border border-slate-100 p-4"><div className="flex justify-between gap-3"><strong>{h.kind==='PICKUP'?'Lúc nhận xe':'Lúc trả xe'}</strong><span className="text-xs text-slate-500">{timeText(h.createdAt)}</span></div><p className="mt-2 text-sm text-slate-600">Pin: {h.batteryPercent}% · ODO: {h.odometerKm} km</p><p className="mt-1 text-sm text-slate-600">{h.conditionNote}</p>{h.damageNotes&&<p className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Hư hỏng ghi nhận: {h.damageNotes}</p>}{parseStringList(h.inspectionChecklist).length>0&&<div className="mt-2"><p className="text-xs font-bold text-slate-500">Hạng mục đã kiểm tra</p><p className="mt-1 text-xs text-slate-600">{parseStringList(h.inspectionChecklist).join(' · ')}</p></div>}{parseStringList(h.photoUrls).length>0&&<div className="mt-2 flex flex-wrap gap-2">{parseStringList(h.photoUrls).map((url,index)=><a key={url} href={url} target="_blank" rel="noreferrer" className="text-xs font-bold text-emerald-700 underline">Ảnh bằng chứng {index+1} ↗</a>)}</div>}</div>)}</div>}</div>
        {detail.status==='RENTING'&&<div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-5"><h3 className="font-extrabold text-rose-950">Cần hỗ trợ trong chuyến đi?</h3><p className="mt-2 text-sm leading-6 text-rose-900">Nếu xe hỏng, gần hết pin hoặc xảy ra va chạm, hãy gửi báo cáo để nhân viên trạm tiếp nhận. Trường hợp nguy hiểm, hãy ưu tiên bảo đảm an toàn và gọi dịch vụ khẩn cấp phù hợp.</p><form onSubmit={submitIssue} className="mt-4 space-y-3"><div className="grid gap-3 sm:grid-cols-2"><label><span className="field-label">Vấn đề</span><select className="field" value={issueType} onChange={e=>setIssueType(e.target.value)}><option value="LOW_BATTERY">Xe sắp hết pin</option><option value="BREAKDOWN">Xe bị hỏng / không chạy</option><option value="ACCIDENT">Tai nạn / va chạm</option><option value="OTHER">Vấn đề khác</option></select></label><label><span className="field-label">Mức độ</span><select className="field" value={issueSeverity} onChange={e=>setIssueSeverity(e.target.value)}><option value="LOW">Thấp</option><option value="MEDIUM">Trung bình</option><option value="HIGH">Cao</option><option value="CRITICAL">Khẩn cấp</option></select></label></div><label><span className="field-label">Mô tả và vị trí hiện tại</span><textarea required minLength={10} maxLength={2000} className="field min-h-24" value={issueDescription} onChange={e=>setIssueDescription(e.target.value)} placeholder="Ví dụ: xe báo lỗi E03, còn 8% pin, đang ở gần..."/></label><div className="flex flex-wrap items-center justify-between gap-3"><button type="button" onClick={captureIssueLocation} className="text-xs font-bold text-sky-800 underline">{issueLocation?'✓ Đã đính kèm vị trí':'Đính kèm vị trí GPS (tùy chọn)'}</button><button disabled={issueBusy||issueDescription.trim().length<10} className="rounded-xl bg-rose-700 px-4 py-3 text-sm font-bold text-white">{issueBusy?'Đang gửi...':'Gửi yêu cầu hỗ trợ'}</button></div></form></div>}
        {detail.status==='COMPLETED'&&<div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5"><h3 className="font-extrabold text-amber-950">Đánh giá xe sau chuyến đi</h3>{review?<div className="mt-3"><p className="text-xl text-amber-600">{"★".repeat(review.rating)}{"☆".repeat(5-review.rating)}</p><p className="mt-2 text-sm text-slate-700">{review.comment||'Bạn đã gửi đánh giá cho chuyến thuê này.'}</p></div>:<form onSubmit={submitReview} className="mt-4 space-y-3"><label><span className="field-label">Mức đánh giá</span><select className="field" value={reviewRating} onChange={e=>setReviewRating(Number(e.target.value))}>{[5,4,3,2,1].map(n=><option key={n} value={n}>{n} sao</option>)}</select></label><label><span className="field-label">Nhận xét (không bắt buộc)</span><textarea maxLength={1200} className="field min-h-20" value={reviewComment} onChange={e=>setReviewComment(e.target.value)} placeholder="Chia sẻ trải nghiệm về xe..."/></label><button disabled={reviewBusy} className="btn-primary">{reviewBusy?'Đang gửi đánh giá...':'Gửi đánh giá'}</button></form>}</div>}
        <div className="mt-6"><h3 className="font-extrabold">Lịch sử báo cáo sự cố</h3>{!issues.length?<p className="mt-2 text-sm text-slate-500">Chưa có báo cáo sự cố.</p>:<div className="mt-3 space-y-3">{issues.map(issue=><div key={issue.id} className="rounded-xl border border-slate-100 p-4"><div className="flex flex-wrap justify-between gap-2"><strong className="text-sm">{issueLabels[issue.issueType]||issue.issueType} · {issue.severity}</strong><span className="text-xs font-bold text-sky-800">{issueStatus[issue.status]||issue.status}</span></div><p className="mt-2 text-sm text-slate-600">{issue.description}</p>{issue.resolutionNote&&<p className="mt-2 text-sm text-emerald-800">Xử lý: {issue.resolutionNote}</p>}<p className="mt-1 text-xs text-slate-400">{timeText(issue.createdAt)}</p></div>)}</div>}</div>
        <div className="mt-6"><h3 className="font-extrabold">Thanh toán và đối soát</h3>{!payments.length?<p className="mt-2 text-sm text-slate-500">Chưa có giao dịch được nhân viên ghi nhận.</p>:<><div className="mt-3 space-y-2">{payments.map(p=><div key={p.id} className="flex flex-wrap justify-between gap-3 rounded-xl border border-slate-100 p-3 text-sm"><div><strong>{p.purpose}</strong><p className="text-xs text-slate-500">{p.method} · {timeText(p.createdAt)}{p.note?' · '+p.note:''}</p></div><strong className={p.purpose==='REFUND'?'text-rose-600':'text-emerald-700'}>{p.purpose==='REFUND'?'-':'+'}{money(p.amount)}</strong></div>)}</div><p className="mt-3 text-sm text-slate-600">Đã thu/ghi nhận: {money(paymentTotal)} · Đã hoàn: {money(refundTotal)}</p></>}</div>
      </>}
      <div className="mt-7 flex flex-wrap justify-end gap-3"><Link to={'/bookings/'+detail.id+'/payments'} className="btn-outline">Mở trang giao dịch</Link><button onClick={closeDetails} className="btn-primary">Đóng</button></div>
    </section></div>}
  </div>;
}
