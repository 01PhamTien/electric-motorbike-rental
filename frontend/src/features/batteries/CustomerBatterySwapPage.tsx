import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, LoadingState, SectionHeading, timeText } from '../../components/Brand';
import { api } from '../../services/api';
import { ConfirmDialog } from '../../components/ConfirmDialog';

type Booking = {
  id:number; status:string; pickupAt:string; returnAt:string;
  vehicle?:{code:string;model?:{brand:string;name:string};station?:{id:number;name:string;address?:string}};
};
type Availability = {stationId:number;availableBatteryCount:number;supportsBatterySwap:boolean};
type Reservation = {
  id:number;bookingId:number;stationId:number;vehicleId:number;
  status:'RESERVED'|'REDEEMED'|'CANCELLED'|'EXPIRED';expiresAt:string;createdAt:string;
  station?:{name:string;address?:string};vehicle?:{code:string};
};
const errorText=(error:unknown)=>{
  const message=(error as {response?:{data?:{message?:string|string[]}}})?.response?.data?.message;
  return Array.isArray(message)?message.join(', '):message||'Không thể thực hiện thao tác. Vui lòng thử lại.';
};
const statusText:Record<Reservation['status'],string>={RESERVED:'Đang giữ pin',REDEEMED:'Đã đổi pin',CANCELLED:'Đã hủy',EXPIRED:'Đã hết hạn'};

export function CustomerBatterySwapPage(){
  const [bookings,setBookings]=useState<Booking[]>([]);
  const [availability,setAvailability]=useState<Availability[]>([]);
  const [reservations,setReservations]=useState<Reservation[]>([]);
  const [selectedBooking,setSelectedBooking]=useState('');
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [cancelReservation,setCancelReservation]=useState<Reservation|null>(null);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [clock,setClock]=useState(Date.now());

  const load=useCallback(async(silent=false)=>{
    if(!silent){setLoading(true);setError('');}
    try{
      const [bookingResponse,availabilityResponse,reservationResponse]=await Promise.all([
        api.get('/bookings/my'),api.get('/battery-swap/availability'),api.get('/batteries/reservations/my'),
      ]);
      const activeBookings=(Array.isArray(bookingResponse.data)?bookingResponse.data:bookingResponse.data?.items??[])
        .filter((item:Booking)=>item.status==='RENTING');
      setBookings(activeBookings);
      setAvailability(Array.isArray(availabilityResponse.data)?availabilityResponse.data:[]);
      setReservations(Array.isArray(reservationResponse.data)?reservationResponse.data:[]);
      setSelectedBooking(current=>activeBookings.some((item:Booking)=>String(item.id)===current)?current:String(activeBookings[0]?.id??''));
    }catch(e){setError(errorText(e));}
    finally{if(!silent)setLoading(false);}
  },[]);
  useEffect(()=>{void load();const timer=window.setInterval(()=>void load(true),15000);return()=>window.clearInterval(timer);},[load]);
  useEffect(()=>{const timer=window.setInterval(()=>setClock(Date.now()),1000);return()=>window.clearInterval(timer);},[]);

  const booking=useMemo(()=>bookings.find(item=>String(item.id)===selectedBooking),[bookings,selectedBooking]);
  const stationId=booking?.vehicle?.station?.id;
  const stationAvailability=availability.find(item=>item.stationId===stationId);
  const activeReservation=reservations.find(item=>item.status==='RESERVED'&&new Date(item.expiresAt).getTime()>clock);
  const remaining=activeReservation?Math.max(0,Math.ceil((new Date(activeReservation.expiresAt).getTime()-clock)/1000)):0;
  const countdown=String(Math.floor(remaining/60)).padStart(2,'0')+':'+String(remaining%60).padStart(2,'0');

  async function reserve(){
    if(!booking||!stationId||busy||activeReservation)return;
    setBusy(true);setError('');setNotice('');
    try{
      await api.post('/batteries/reservations',{bookingId:booking.id,stationId});
      setNotice('Đã giữ pin thành công. Vui lòng đến đúng trạm trước khi thời gian giữ pin kết thúc.');
      await load();
    }catch(e){setError(errorText(e));}
    finally{setBusy(false);}
  }
  async function cancel(id:number){
    setBusy(true);setError('');setNotice('');
    try{
      await api.patch('/batteries/reservations/'+id+'/cancel');
      setNotice('Đã hủy lượt giữ pin. Số pin được trả lại kho khả dụng.');
      setCancelReservation(null);
      await load();
    }catch(e){setError(errorText(e));}
    finally{setBusy(false);}
  }

  return <div className="container-page py-8 sm:py-12">
    <ConfirmDialog open={Boolean(cancelReservation)} title="Hủy lượt giữ pin" description={cancelReservation?`Bạn muốn hủy lượt giữ pin #${cancelReservation.id} tại ${cancelReservation.station?.name??'trạm đổi pin'}?\n\nSau khi hủy, lượt giữ sẽ không còn hiệu lực. Bạn cần đặt lại nếu muốn đổi pin.`:''} confirmLabel="Hủy lượt giữ pin" tone="danger" busy={busy} onCancel={()=>setCancelReservation(null)} onConfirm={()=>{if(cancelReservation)void cancel(cancelReservation.id);}}/>
    <div className="flex flex-wrap items-end justify-between gap-5">
      <SectionHeading eyebrow="DỊCH VỤ TRONG HÀNH TRÌNH" title="Đổi pin nhanh" description="Giữ trước một viên pin đầy tại trạm xe đang thuê để tiết kiệm thời gian chờ khi cần tiếp tục di chuyển."/>
      <Link to="/bookings/my" className="btn-outline">← Đơn thuê của tôi</Link>
    </div>
    <div className="mt-6 rounded-2xl border border-[#dfebe2] bg-[#f7faf7] p-5 text-sm leading-6 text-[#416c53]">
      <strong>Thời gian giữ pin có giới hạn.</strong> Sau khi đặt trước, bạn cần đến trạm và nhờ nhân viên xác nhận đổi pin trước khi lượt giữ hết hạn. Việc đặt trước không phát sinh thanh toán.
    </div>
    {error&&<p role="alert" className="mt-5 rounded-xl border border-[#f0e4e1] bg-[#fcf8f7] p-4 text-sm text-[#87534b]">{error}</p>}
    {notice&&<p role="status" className="mt-5 rounded-xl border border-[#dfebe2] bg-[#f7faf7] p-4 text-sm text-[#416c53]">{notice}</p>}
    {loading?<div className="mt-8"><LoadingState label="Đang kiểm tra đơn thuê và lượng pin tại trạm..."/></div>:<>
      {activeReservation&&<section className="panel mt-7 border-[#dfebe2] p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="eyebrow">LƯỢT GIỮ PIN ĐANG HIỆU LỰC</p><h2 className="mt-2 text-xl font-extrabold">Mã giữ pin #{activeReservation.id}</h2><p className="mt-2 text-sm text-slate-600">{activeReservation.station?.name??'Trạm đổi pin'} · {activeReservation.vehicle?.code??'Xe đang thuê'}</p></div>
          <div className="rounded-2xl border border-[#dfebe2] bg-[#f7faf7] px-5 py-3 text-center"><p className="text-xs font-bold text-emerald-700">THỜI GIAN CÒN LẠI</p><p className="mt-1 font-mono text-3xl font-black text-emerald-800">{countdown}</p></div>
        </div>
        <p className="mt-4 text-sm text-slate-500">Hết hạn lúc {timeText(activeReservation.expiresAt)}. Vui lòng đến quầy nhân viên tại trạm để hoàn tất đổi pin.</p>
        <button disabled={busy} onClick={()=>setCancelReservation(activeReservation)} className="btn-outline mt-5 border-rose-200 text-rose-700">Hủy lượt giữ pin</button>
      </section>}

      <section className="panel mt-7 p-6 sm:p-8">
        <p className="eyebrow">TÌM PIN TẠI TRẠM</p><h2 className="mt-2 text-xl font-extrabold">Chọn đơn thuê đang sử dụng</h2>
        {!bookings.length?<div className="mt-5"><EmptyState title="Bạn chưa có chuyến đi đang hoạt động" description="Chức năng đổi pin chỉ khả dụng khi bạn đang thuê xe. Khi nhận xe và đơn chuyển sang trạng thái Đang thuê, bạn có thể giữ pin tại đây." action={<Link to="/bookings/my" className="btn-primary">Xem đơn thuê →</Link>}/></div>:<>
          <label className="mt-5 block max-w-2xl"><span className="field-label">Đơn thuê</span><select className="field mt-2" value={selectedBooking} onChange={e=>setSelectedBooking(e.target.value)} disabled={Boolean(activeReservation)}>{bookings.map(item=><option key={item.id} value={item.id}>#{item.id} · {item.vehicle?.code??'Xe'} · {item.vehicle?.model?.name??''}</option>)}</select></label>
          {booking&&<div className="mt-5 grid gap-4 rounded-2xl bg-slate-50 p-5 sm:grid-cols-2">
            <div><p className="field-label">Xe đang thuê</p><p className="mt-1 font-bold">{booking.vehicle?.code??'—'} · {booking.vehicle?.model?.brand} {booking.vehicle?.model?.name}</p></div>
            <div><p className="field-label">Trạm hiện tại của xe</p><p className="mt-1 font-bold">{booking.vehicle?.station?.name??'Chưa xác định'}</p><p className="mt-1 text-xs text-slate-500">{booking.vehicle?.station?.address??''}</p></div>
          </div>}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-100 p-5">
            <div><p className="font-bold">Pin đầy có thể đổi</p><p className="mt-1 text-sm text-slate-500">{stationAvailability?stationAvailability.availableBatteryCount+' viên đang sẵn sàng tại trạm':'Không có dữ liệu tồn kho của trạm'}</p></div>
            <button disabled={busy||Boolean(activeReservation)||!stationId||!stationAvailability?.supportsBatterySwap} onClick={()=>void reserve()} className="btn-primary">{busy?'Đang xử lý...':'Giữ pin ngay'}</button>
          </div>
          {!stationId&&<p className="mt-3 text-sm text-amber-700">Đơn thuê chưa có thông tin trạm hiện tại. Vui lòng liên hệ nhân viên để cập nhật vị trí xe.</p>}
          {stationId&&stationAvailability&&!stationAvailability.supportsBatterySwap&&<p className="mt-3 text-sm text-amber-700">Trạm hiện chưa có pin đầy khả dụng. Bạn có thể thử lại sau khi nhân viên cập nhật kho pin.</p>}
          {stationId&&!stationAvailability&&<p className="mt-3 text-sm text-slate-500">Chưa nhận được dữ liệu pin từ trạm này.</p>}
        </>}
      </section>

      <section className="panel mt-7 overflow-hidden">
        <div className="p-6"><p className="eyebrow">LỊCH SỬ</p><h2 className="mt-2 text-xl font-extrabold">Các lượt giữ pin của bạn</h2></div>
        {!reservations.length?<p className="px-6 pb-6 text-sm text-slate-500">Bạn chưa có lượt giữ pin nào.</p>:<div className="divide-y divide-slate-100">{reservations.map(item=><div key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4"><div><p className="font-bold">Lượt #{item.id} · {item.station?.name??'Trạm đổi pin'}</p><p className="mt-1 text-xs text-slate-500">Đơn thuê #{item.bookingId} · {timeText(item.createdAt)}</p></div><span className={'rounded-full px-3 py-1.5 text-xs font-bold '+(item.status==='RESERVED'?'bg-emerald-50 text-emerald-700':item.status==='REDEEMED'?'bg-blue-50 text-blue-700':'bg-slate-100 text-slate-600')}>{item.status==='RESERVED'&&new Date(item.expiresAt).getTime()<=clock?'Đã hết hạn':statusText[item.status]}</span></div>)}</div>}
      </section>
    </>}
  </div>;
}
