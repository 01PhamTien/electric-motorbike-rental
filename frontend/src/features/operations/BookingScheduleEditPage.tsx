import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { LoadingState, money, SectionHeading, timeText } from '../../components/Brand';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { api } from '../../services/api';

type Booking={id:number;status:string;pickupAt:string;returnAt:string;rentalAmount:string;depositSnapshot:string;customer?:{fullName:string;email:string};vehicle?:{code:string;model?:{brand:string;name:string};station?:{name:string}}};
const localDateTimeInput=(value:string)=>{const date=new Date(value);const offset=date.getTimezoneOffset();return new Date(date.getTime()-offset*60000).toISOString().slice(0,16);};
const errorText=(error:unknown)=>{const message=(error as {response?:{data?:{message?:string|string[]}}})?.response?.data?.message;return Array.isArray(message)?message.join(', '):message||'Không thể cập nhật lịch thuê.';};

export function BookingScheduleEditPage(){
  const {id}=useParams();
  const navigate=useNavigate();
  const [booking,setBooking]=useState<Booking|null>(null);
  const [pickupAt,setPickupAt]=useState('');
  const [returnAt,setReturnAt]=useState('');
  const [reason,setReason]=useState('Khách yêu cầu điều chỉnh lịch thuê');
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [confirmOpen,setConfirmOpen]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  useEffect(()=>{
    let active=true;
    if(!id||!/^\\d+$/.test(id)){setError('Mã đơn thuê không hợp lệ.');setLoading(false);return;}
    api.get('/bookings/'+id).then(({data})=>{
      if(!active)return;
      setBooking(data);
      setPickupAt(localDateTimeInput(data.pickupAt));
      setReturnAt(localDateTimeInput(data.returnAt));
    }).catch(e=>{if(active)setError(errorText(e));}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[id]);
  function submit(event:React.FormEvent){
    event.preventDefault();
    if(!booking)return;
    if(!pickupAt||!returnAt||new Date(returnAt)<=new Date(pickupAt)){setError('Thời gian trả phải sau thời gian nhận.');return;}
    if(!reason.trim()){setError('Vui lòng nhập lý do điều chỉnh.');return;}
    setError('');setConfirmOpen(true);
  }
  async function save(){
    if(!booking||!id)return;
    setBusy(true);setError('');setNotice('');
    try{
      await api.patch('/bookings/'+id,{pickupAt:new Date(pickupAt).toISOString(),returnAt:new Date(returnAt).toISOString(),reason:reason.trim()});
      setNotice('Đã cập nhật lịch đơn thuê #'+id+'. Vui lòng kiểm tra lại số tiền còn phải thu.');
      setConfirmOpen(false);
      navigate('/operations',{replace:true,state:{notice:'Đã cập nhật lịch đơn thuê #'+id+'. Vui lòng kiểm tra lại số tiền còn phải thu.'}});
    }catch(e){setError(errorText(e));}
    finally{setBusy(false);}
  }
  return <div className="container-page py-8 sm:py-12">
    <ConfirmDialog open={confirmOpen} title="Xác nhận điều chỉnh lịch thuê" description={`Lưu thời gian nhận và trả mới cho đơn #${id}?

Hệ thống sẽ tính lại tiền thuê theo đơn giá đã chốt và giữ nguyên lịch sử thanh toán. Sau khi lưu, hãy kiểm tra số dư cần thu hoặc hoàn.`} confirmLabel="Lưu lịch mới" busy={busy} onCancel={()=>setConfirmOpen(false)} onConfirm={()=>void save()}/>
    <div className="mx-auto max-w-3xl"><div className="mb-6"><Link to="/operations" className="text-sm font-bold text-emerald-800 underline">← Quay lại vận hành</Link></div>
      <SectionHeading eyebrow="ĐIỀU CHỈNH ĐƠN THUÊ" title={'Cập nhật lịch đơn #'+(id??'')} description="Trang riêng để điều chỉnh thời gian nhận và trả xe, không mở biểu mẫu chen trong danh sách vận hành."/>
      {loading?<div className="mt-7"><LoadingState label="Đang tải thông tin đơn thuê..."/></div>:error&&!booking?<p role="alert" className="mt-6 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>:booking&&<section className="panel mt-7 p-5 sm:p-7">
        <div className="grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2"><div><span className="field-label">Khách hàng</span><p className="mt-1 font-bold">{booking.customer?.fullName??booking.customer?.email??'—'}</p></div><div><span className="field-label">Xe / Trạm</span><p className="mt-1 font-bold">{booking.vehicle?.model?.brand} {booking.vehicle?.model?.name} · {booking.vehicle?.code}</p><p className="text-xs text-slate-500">{booking.vehicle?.station?.name}</p></div><div><span className="field-label">Lịch hiện tại</span><p className="mt-1 font-semibold">{timeText(booking.pickupAt)} → {timeText(booking.returnAt)}</p></div><div><span className="field-label">Tiền thuê / Tiền cọc</span><p className="mt-1 font-semibold">{money(booking.rentalAmount)} / {money(booking.depositSnapshot)}</p></div></div>
        <form onSubmit={submit} className="mt-6 grid gap-4 sm:grid-cols-2">
          <label><span className="field-label">Giờ nhận mới</span><input type="datetime-local" required className="field mt-1" value={pickupAt} onChange={e=>setPickupAt(e.target.value)}/></label>
          <label><span className="field-label">Giờ trả mới</span><input type="datetime-local" required min={pickupAt||undefined} className="field mt-1" value={returnAt} onChange={e=>setReturnAt(e.target.value)}/></label>
          <label className="sm:col-span-2"><span className="field-label">Lý do điều chỉnh</span><input className="field mt-1" maxLength={255} value={reason} onChange={e=>setReason(e.target.value)}/></label>
          <p className="text-xs leading-5 text-slate-500 sm:col-span-2">Chỉ điều chỉnh trước khi bàn giao xe. Nếu đã thu tiền thuê và thay đổi làm thay đổi tổng tiền, hệ thống sẽ yêu cầu xử lý tài chính riêng.</p>
          {error&&<p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700 sm:col-span-2">{error}</p>}
          {notice&&<p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700 sm:col-span-2">{notice}</p>}
          <div className="flex flex-wrap gap-2 sm:col-span-2"><button disabled={busy} className="btn-primary">{busy?'Đang lưu...':'Kiểm tra và lưu lịch mới'}</button><Link to="/operations" className="btn-outline">Hủy, quay lại</Link></div>
        </form>
      </section>}
    </div>
  </div>;
}
