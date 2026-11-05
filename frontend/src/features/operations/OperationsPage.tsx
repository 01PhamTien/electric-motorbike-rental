import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, LoadingState, money, SectionHeading, timeText } from '../../components/Brand';
import { api } from '../../services/api';
import { useAuth } from '../auth/AuthContext';

type CalendarEvent = { type:'BOOKING'|'MAINTENANCE'; id:number; vehicleId:number; vehicleCode:string; model:string; stationName:string; customerName:string; title:string; status:string; start:string; end:string|null };
function localDateInput(date:Date) { const offset=date.getTimezoneOffset(); return new Date(date.getTime()-offset*60000).toISOString().slice(0,10); }
type Booking = {
  id: number; status: string; pickupAt: string; returnAt: string;
  rentalAmount: string; depositSnapshot: string; cancellationFeeAmount?:string; cancellationType?:string|null;
  customer?: { fullName: string; email: string };
  vehicle?: { code: string; model?: { name: string; brand: string }; station?: { name: string } };
};
const statuses: Record<string,string> = { PENDING:'Chờ xác nhận', CONFIRMED:'Đã xác nhận', RENTING:'Đang thuê', COMPLETED:'Hoàn thành', CANCELLED:'Đã hủy', EXPIRED:'Hết hạn' };
const apiError = (e: unknown) => {
  const m = (e as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  return Array.isArray(m) ? m.join(', ') : m || 'Thao tác chưa thành công. Vui lòng thử lại.';
};
export function OperationsPage() {
  const { user } = useAuth();
  const [items,setItems] = useState<Booking[]>([]);
  const [calendar,setCalendar] = useState<CalendarEvent[]>([]);
  const [calendarFrom,setCalendarFrom] = useState(()=>localDateInput(new Date()));
  const [calendarTo,setCalendarTo] = useState(()=>localDateInput(new Date(Date.now()+6*86_400_000)));
  const [calendarLoading,setCalendarLoading] = useState(false);
  const [calendarError,setCalendarError] = useState('');
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const [filter,setFilter] = useState('ALL');
  const [busy,setBusy] = useState<number | null>(null);
  const [handover,setHandover] = useState<{ id: number; kind: 'pickup' | 'return' } | null>(null);
  const [battery,setBattery] = useState('80');
  const [odometer,setOdometer] = useState('');
  const [condition,setCondition] = useState('Xe hoạt động bình thường');
  const [checkedItems,setCheckedItems] = useState<string[]>([]);
  const [damageNotes,setDamageNotes] = useState('');
  const [photoUrlsText,setPhotoUrlsText] = useState('');
  const inspectionItems = [
    ['BODY','Thân vỏ, khung và yếm xe'],['LIGHTS','Đèn trước, đèn sau và xi-nhan'],
    ['BRAKES','Phanh trước và phanh sau'],['TIRES','Lốp và vành xe'],
    ['MIRRORS','Gương và tay lái'],['HORN','Còi và công tắc'],
    ['BATTERY','Pin và cổng sạc'],['CHARGER','Bộ sạc và phụ kiện'],['KEYS','Chìa khóa / khóa xe'],
  ] as const;
  const load = useCallback(async () => {
    setLoading(true);
    try { const { data } = await api.get('/bookings/operations'); setItems(Array.isArray(data) ? data : data?.items ?? []); setError(''); }
    catch(e) { setError(apiError(e)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); },[load]);
  async function loadCalendar() {
    if (!calendarFrom || !calendarTo || calendarTo < calendarFrom) { setCalendarError('Vui lòng chọn khoảng ngày hợp lệ.'); return; }
    const span=(new Date(calendarTo+'T00:00:00').getTime()-new Date(calendarFrom+'T00:00:00').getTime())/86_400_000;
    if (span>30) { setCalendarError('Mỗi lần chỉ xem tối đa 31 ngày.'); return; }
    setCalendarLoading(true); setCalendarError('');
    try { const {data}=await api.get('/bookings/calendar',{params:{from:calendarFrom,to:calendarTo}}); setCalendar(Array.isArray(data)?data:data?.items??[]); }
    catch(e) { setCalendarError(apiError(e)); }
    finally { setCalendarLoading(false); }
  }
  useEffect(() => { void loadCalendar(); }, []);
  const visible = filter === 'ALL' ? items : items.filter(item => item.status === filter);
  const queue = { pending: items.filter(x=>x.status==='PENDING').length, confirmed: items.filter(x=>x.status==='CONFIRMED').length, renting: items.filter(x=>x.status==='RENTING').length, attention: items.filter(x=>x.status==='PENDING'||x.status==='CONFIRMED').length };
  function beginHandover(id: number, kind: 'pickup' | 'return') {
    setBattery('80'); setOdometer(''); setCondition(kind === 'pickup' ? 'Xe hoạt động bình thường, đã kiểm tra ngoại quan và phụ kiện.' : 'Đã kiểm tra xe khi nhận trả.');
    setCheckedItems([]); setDamageNotes(''); setPhotoUrlsText('');
    setHandover({id,kind}); setError(''); setNotice('');
  }
  async function confirm(id: number) {
    if (!window.confirm('Xác nhận đơn thuê #' + id + '?')) return;
    setBusy(id);setError('');setNotice('');
    try { await api.patch('/bookings/' + id + '/confirm'); setNotice('Đã xác nhận đơn #' + id); await load(); }
    catch(e){setError(apiError(e));}
    finally{setBusy(null);}
  }
  async function markNoShow(id:number) {
    if (!window.confirm('Ghi nhận khách không đến nhận xe cho đơn #' + id + '? Phí No-show sẽ được tính theo chính sách và cần đối soát thủ công.')) return;
    setBusy(id);setError('');setNotice('');
    try { const {data}=await api.patch('/bookings/'+id+'/no-show'); setNotice('Đã ghi nhận No-show cho đơn #'+id+'. Phí hủy: '+money(data?.cancellationFeeAmount)+'.'); await load(); }
    catch(e){setError(apiError(e));}
    finally{setBusy(null);}
  }
  async function submitHandover(event: React.FormEvent) {
    event.preventDefault();
    if (!handover) return;
    const percent = Number(battery), km = Number(odometer);
    if (!Number.isInteger(percent) || percent < 0 || percent > 100 || !Number.isFinite(km) || km < 0) { setError('Vui lòng nhập mức pin 0–100% và số km hợp lệ.'); return; }
    const photoUrls = photoUrlsText.split(String.fromCharCode(10)).map(url => url.trim()).filter(Boolean);
    if (photoUrls.length > 8 || photoUrls.some(url => { try { const parsed = new URL(url); return !['http:', 'https:'].includes(parsed.protocol); } catch { return true; } })) {
      setError('Tối đa 8 đường dẫn ảnh hợp lệ (http/https), mỗi đường dẫn một dòng.'); return;
    }
    if (!condition.trim()) { setError('Vui lòng ghi nhận tình trạng tổng quát của xe.'); return; }
    setBusy(handover.id);setError('');setNotice('');
    try {
      await api.post('/bookings/' + handover.id + '/' + handover.kind, {
        batteryPercent: percent, odometerKm: km, conditionNote: condition.trim(),
        inspectionChecklist: checkedItems, damageNotes: damageNotes.trim() || undefined,
        photoUrls: photoUrls.length ? photoUrls : undefined,
      });
      setNotice(handover.kind === 'pickup' ? 'Đã bàn giao xe thành công.' : 'Đã ghi nhận nhận lại xe.');
      setHandover(null); await load();
    } catch(e) { setError(apiError(e)); } finally { setBusy(null); }
  }
  return <div className="container-page py-12 sm:py-16">
    <div className="flex flex-wrap items-end justify-between gap-6"><SectionHeading eyebrow="TRUNG TÂM VẬN HÀNH" title="Điều phối đơn thuê" description="Xác nhận đặt xe, ghi nhận bàn giao và nhận trả phương tiện. Danh sách giới hạn 100 đơn gần nhất theo quyền tài khoản."/><div className="flex flex-wrap gap-2"><Link to="/vehicle-transfers" className="btn-outline">Điều chuyển xe ↗</Link><Link to="/issues" className="btn-outline">Sự cố khách báo ↗</Link><Link to="/maintenance" className="btn-outline">Bảo dưỡng ↗</Link><Link to="/locations" className="btn-outline">Vị trí xe ↗</Link>{user?.role==='ADMIN'&&<Link to="/admin/dashboard" className="btn-outline">Báo cáo ↗</Link>}</div></div>
    <section className="mt-8 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow">CA LÀM VIỆC HÔM NAY</p><h2 className="mt-2 text-xl font-extrabold">Xin chào, {user?.fullName||'nhân viên'}!</h2><p className="mt-1 text-sm text-slate-500">{user?.stationId ? 'Dữ liệu nghiệp vụ được giới hạn theo trạm được phân công.' : user?.role==='ADMIN' ? 'Bạn đang xem phạm vi toàn hệ thống.' : 'Đang tải phạm vi công việc của bạn.'}</p></div><span className="tag">{new Date().toLocaleDateString('vi-VN',{weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'})}</span></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[{label:'Đơn chờ xác nhận',value:queue.pending,detail:'Cần kiểm tra yêu cầu',filter:'PENDING',tone:'text-amber-700'},{label:'Chờ bàn giao xe',value:queue.confirmed,detail:'Đơn đã xác nhận',filter:'CONFIRMED',tone:'text-sky-700'},{label:'Xe đang được thuê',value:queue.renting,detail:'Đang trong chuyến thuê',filter:'RENTING',tone:'text-emerald-700'},{label:'Việc cần chú ý',value:queue.attention,detail:'Chờ xác nhận hoặc bàn giao',filter:'ALL',tone:'text-slate-900'}].map(card=><button key={card.label} onClick={()=>setFilter(card.filter)} className="panel p-5 text-left transition hover:-translate-y-0.5 hover:border-emerald-300"><p className="text-sm font-semibold text-slate-500">{card.label}</p><strong className={'mt-3 block text-3xl font-extrabold '+card.tone}>{card.value}</strong><span className="mt-1 block text-xs text-slate-400">{card.detail}</span></button>)}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Link to="/issues" className="rounded-xl border border-rose-100 bg-rose-50 p-4 text-sm font-bold text-rose-800">🚨 Tiếp nhận sự cố <span className="float-right">↗</span></Link>
        <Link to="/maintenance" className="rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm font-bold text-amber-800">🔧 Lịch bảo dưỡng <span className="float-right">↗</span></Link>
        <Link to="/batteries" className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">🔋 Kho pin & đổi pin <span className="float-right">↗</span></Link>
        <Link to="/vehicle-transfers" className="rounded-xl border border-sky-100 bg-sky-50 p-4 text-sm font-bold text-sky-800">🔀 Điều chuyển xe <span className="float-right">↗</span></Link>
      </div>
    </section>
    <section className="mt-8 panel p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow">ĐIỀU PHỐI THEO THỜI GIAN</p><h2 className="mt-2 text-xl font-extrabold">Lịch xe và lịch bảo dưỡng</h2><p className="mt-1 text-sm text-slate-500">Tổng hợp các đơn đang giữ chỗ/đã xác nhận/đang thuê và lịch bảo dưỡng theo trạm được phân quyền.</p></div><div className="flex flex-wrap items-end gap-2"><label><span className="field-label">Từ ngày</span><input className="field" type="date" value={calendarFrom} onChange={e=>setCalendarFrom(e.target.value)}/></label><label><span className="field-label">Đến ngày</span><input className="field" type="date" value={calendarTo} onChange={e=>setCalendarTo(e.target.value)}/></label><button className="btn-dark" onClick={()=>void loadCalendar()} disabled={calendarLoading}>{calendarLoading?'Đang tải...':'Xem lịch'}</button></div></div>{calendarError&&<p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{calendarError}</p>}{calendarLoading?<div className="mt-5"><LoadingState label="Đang tổng hợp lịch xe..."/></div>:!calendar.length?<p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Không có đơn thuê hoặc lịch bảo dưỡng trong khoảng ngày đã chọn.</p>:<div className="mt-5 space-y-3">{calendar.map(event=><article key={event.type+'-'+event.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-100 p-4"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={'rounded-full px-2.5 py-1 text-[10px] font-extrabold '+(event.type==='BOOKING'?'bg-sky-50 text-sky-800':'bg-amber-50 text-amber-800')}>{event.type==='BOOKING'?'ĐƠN THUÊ':'BẢO DƯỠNG'}</span><span className="text-xs font-bold text-slate-400">#{event.id} · {event.vehicleCode}</span><span className="text-xs text-slate-500">{event.status}</span></div><h3 className="mt-2 truncate font-extrabold">{event.model||event.title}</h3><p className="mt-1 text-xs text-slate-500">{event.stationName}{event.customerName?' · '+event.customerName:''}</p></div><div className="text-right text-sm"><p className="font-bold">{timeText(event.start)}</p><p className="mt-1 text-xs text-slate-500">{event.end?'Đến '+timeText(event.end):'Lịch thực hiện'}</p></div></article>)}</div>}</section>
    <div className="mt-8 flex flex-wrap items-center justify-between gap-4"><div className="flex flex-wrap gap-2">{[{value:'ALL',label:'Tất cả'},...Object.entries(statuses).map(([value,label])=>({value,label}))].map(x => <button key={x.value} onClick={()=>setFilter(x.value)} className={'rounded-full px-4 py-2 text-xs font-extrabold '+(filter===x.value?'bg-[#10373b] text-white':'bg-white text-slate-600')}>{x.label}</button>)}</div><button className="btn-outline" onClick={()=>void load()}>↻ Làm mới</button></div>
    {notice && <div role="status" className="mt-6 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</div>}
    {error && <div role="alert" className="mt-6 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
    {loading ? <div className="mt-6"><LoadingState label="Đang tải danh sách đơn..." /></div> : !visible.length ? <div className="mt-6"><EmptyState title="Không có đơn thuê phù hợp" description="Đơn mới sẽ xuất hiện sau khi khách gửi yêu cầu đặt xe." /></div> : <div className="mt-6 grid gap-5">{visible.map(b => <article key={b.id} className="panel flex flex-wrap items-center justify-between gap-6 p-6"><div><p className="text-xs font-extrabold tracking-wider text-slate-400">ĐƠN #{b.id} · {statuses[b.status] || b.status}</p><h3 className="mt-2 text-lg font-extrabold">{b.vehicle?.model?.brand} {b.vehicle?.model?.name} <span className="text-slate-400">({b.vehicle?.code})</span></h3><p className="mt-2 text-sm text-slate-600">Khách: {b.customer?.fullName || b.customer?.email || '—'}</p><p className="mt-2 text-sm text-slate-500">{timeText(b.pickupAt)} → {timeText(b.returnAt)}</p><p className="mt-2 text-sm font-bold text-emerald-700">Tiền thuê: {money(b.rentalAmount)} · Cọc: {money(b.depositSnapshot)}</p>{Number(b.cancellationFeeAmount||0)>0&&<p className="mt-1 text-sm font-bold text-rose-700">Phí hủy / No-show cần đối soát: {money(b.cancellationFeeAmount)}</p>}<p className="mt-1 text-xs text-slate-500">{b.vehicle?.station?.name}</p></div><div className="flex flex-wrap gap-2"><Link to={'/bookings/' + b.id + '/payments'} className="btn-outline">Thanh toán</Link>{b.status==='PENDING' && <button disabled={busy===b.id} onClick={()=>void confirm(b.id)} className="btn-primary">Xác nhận đơn</button>}{b.status==='CONFIRMED' && <button onClick={()=>beginHandover(b.id,'pickup')} className="btn-dark">Bàn giao xe →</button>}{b.status==='CONFIRMED' && Date.now() >= new Date(b.pickupAt).getTime()+30*60_000 && <button disabled={busy===b.id} onClick={()=>void markNoShow(b.id)} className="rounded-lg border border-rose-200 px-4 py-2 text-xs font-extrabold text-rose-700 hover:bg-rose-50">Ghi nhận No-show</button>}{b.status==='RENTING' && <button onClick={()=>beginHandover(b.id,'return')} className="btn-dark">Nhận trả xe →</button>}</div></article>)}</div>}
    {handover && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#071c21]/70 p-4" onMouseDown={e=>{if(e.target===e.currentTarget)setHandover(null);}}><form onSubmit={submitHandover} role="dialog" aria-modal="true" aria-labelledby="handover-title" className="w-full max-w-lg rounded-3xl bg-white p-7 shadow-2xl"><div className="flex justify-between"><div><p className="eyebrow">BIÊN BẢN XE</p><h2 id="handover-title" className="mt-2 text-2xl font-extrabold">{handover.kind==='pickup'?'Bàn giao xe':'Nhận xe trả'} · #{handover.id}</h2></div><button type="button" onClick={()=>setHandover(null)} className="self-start rounded-lg bg-slate-100 px-3 py-2" aria-label="Đóng">✕</button></div><div className="mt-7 grid gap-5"><label><span className="field-label">Pin hiện tại (%)</span><input type="number" min="0" max="100" step="1" required className="field" value={battery} onChange={e=>setBattery(e.target.value)}/></label><label><span className="field-label">Số km đồng hồ</span><input type="number" min="0" step="0.1" required className="field" value={odometer} onChange={e=>setOdometer(e.target.value)}/></label><div><span className="field-label">Checklist kiểm tra xe</span><p className="mb-3 text-xs text-slate-500">Đánh dấu các hạng mục đã kiểm tra thực tế ở lần giao hoặc nhận xe này.</p><div className="grid gap-2 sm:grid-cols-2">{inspectionItems.map(([key,label])=><label key={key} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3 text-sm"><input type="checkbox" checked={checkedItems.includes(key)} onChange={e=>setCheckedItems(old=>e.target.checked?[...old,key]:old.filter(x=>x!==key))} className="h-4 w-4 accent-emerald-700"/>{label}</label>)}</div></div><label><span className="field-label">Tình trạng tổng quát</span><textarea maxLength={1000} required className="field min-h-24" value={condition} onChange={e=>setCondition(e.target.value)}/></label><label><span className="field-label">Hư hỏng / trầy xước ghi nhận</span><textarea maxLength={1000} className="field min-h-20" value={damageNotes} onChange={e=>setDamageNotes(e.target.value)} placeholder="Mô tả vị trí, mức độ hư hỏng; để trống nếu không có."/></label><label><span className="field-label">Đường dẫn ảnh bằng chứng (tối đa 8 ảnh)</span><textarea className="field min-h-20" value={photoUrlsText} onChange={e=>setPhotoUrlsText(e.target.value)} placeholder="Mỗi dòng một URL ảnh"/><span className="mt-1 block text-xs text-slate-500">Mỗi dòng một URL ảnh http/https. Tính năng tải ảnh trực tiếp lên máy chủ chưa được cấu hình; dùng đường dẫn ảnh đã tải lên kho lưu trữ.</span></label>{error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}<button disabled={busy===handover.id} className="btn-primary w-full">{busy===handover.id?'Đang lưu...':'Lưu biên bản →'}</button></div></form></div>}
  </div>;
}
