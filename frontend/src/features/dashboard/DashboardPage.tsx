import { useCallback, useEffect, useState } from 'react';
import { api } from '../../services/api';

type Overview = {
  generatedAt: string;
  filters: { from: string|null; to: string|null };
  bookings: { total: number; byStatus: Record<string, number> };
  fleet: { total: number; active: number; maintenance: number; inactive: number };
  payments: {
    transactionCount: number;
    rentCollected: number;
    depositCollected: number;
    extraCollected: number;
    refunded: number;
    totalCollected: number;
    netCashFlow: number;
  };
  utilization: { vehiclesUsed: number; scheduledMinutes: number };
  notes: string[];
};

const statusLabels: Record<string, string> = {
  PENDING: 'Chờ xác nhận', CONFIRMED: 'Đã xác nhận', RENTING: 'Đang thuê',
  COMPLETED: 'Hoàn thành', CANCELLED: 'Đã hủy', EXPIRED: 'Hết hạn',
};
const money=(value:number)=>value.toLocaleString('vi-VN',{maximumFractionDigits:0})+' đ';
const duration=(minutes:number)=> {
  const hours=Math.floor(minutes/60);
  const days=Math.floor(hours/24);
  return days>0?`${days} ngày ${hours%24} giờ`:`${hours} giờ ${minutes%60} phút`;
};

export function DashboardPage() {
  const [data,setData]=useState<Overview|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [from,setFrom]=useState('');
  const [to,setTo]=useState('');

  const load=useCallback(async()=>{
    setLoading(true);setError('');
    try{
      const params:Record<string,string>={};
      if(from)params.from=new Date(from+'T00:00:00').toISOString();
      if(to)params.to=new Date(to+'T23:59:59.999').toISOString();
      const response=await api.get('/reports/overview',{params});
      setData(response.data);
    }catch(err:any){
      setError(err.response?.data?.message||'Không tải được báo cáo. Hãy đăng nhập bằng tài khoản ADMIN và kiểm tra API GET /reports/overview.');
    }finally{setLoading(false);}
  },[from,to]);

  useEffect(()=>{void load();},[load]);

  const cards=data?[
    {label:'Tổng số xe',value:data.fleet.total,detail:'Toàn bộ đội xe'},
    {label:'Xe hoạt động',value:data.fleet.active,detail:'Đang sẵn sàng khai thác'},
    {label:'Xe bảo dưỡng',value:data.fleet.maintenance,detail:'Đang trong bảo dưỡng'},
    {label:'Tổng đơn thuê',value:data.bookings.total,detail:'Theo thời điểm tạo đơn'},
  ]:[];

  const statuses=data?Object.entries(data.bookings.byStatus):[];
  const maxStatus=Math.max(1,...statuses.map(([,count])=>count));
  const paymentCards=data?[
    {label:'Tiền thuê đã thu',value:data.payments.rentCollected},
    {label:'Tiền cọc đã nhận',value:data.payments.depositCollected},
    {label:'Phụ phí đã thu',value:data.payments.extraCollected},
    {label:'Tiền đã hoàn',value:data.payments.refunded},
  ]:[];

  return <section className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-sm font-medium text-blue-700">QUẢN TRỊ HỆ THỐNG</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Dashboard & báo cáo</h1>
        <p className="mt-1 text-sm text-slate-600">Tổng quan đơn thuê, dòng tiền ghi nhận và mức sử dụng đội xe.</p></div>
      <button onClick={()=>void load()} disabled={loading} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50">Làm mới dữ liệu</button>
    </div>

    <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4">
      <label className="text-sm font-medium">Từ ngày<input type="date" value={from} max={to||undefined} onChange={e=>setFrom(e.target.value)} className="mt-1 block rounded-lg border px-3 py-2"/></label>
      <label className="text-sm font-medium">Đến ngày<input type="date" value={to} min={from||undefined} onChange={e=>setTo(e.target.value)} className="mt-1 block rounded-lg border px-3 py-2"/></label>
      <button onClick={()=>{setFrom('');setTo('');}} className="rounded-lg border px-4 py-2 text-sm">Xóa bộ lọc</button>
      <span className="text-xs text-slate-500">Đơn lọc theo ngày tạo; giao dịch lọc theo ngày ghi nhận.</span>
    </div>

    {error&&<div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{String(error)}</div>}
    {loading&&<div className="rounded-xl border bg-white p-6 text-sm text-slate-500">Đang tải báo cáo...</div>}

    {!loading&&data&&<>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(card=><div key={card.label} className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">{card.label}</p><p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{card.value.toLocaleString('vi-VN')}</p><p className="mt-2 text-xs text-slate-500">{card.detail}</p>
        </div>)}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900">Đơn thuê theo trạng thái</h2><p className="mt-1 text-xs text-slate-500">Số lượng đơn theo trạng thái hiện tại trong nhóm đơn được lọc.</p>
          <div className="mt-5 space-y-4">{statuses.map(([status,count])=><div key={status}>
            <div className="mb-1 flex justify-between gap-3 text-sm"><span className="text-slate-700">{statusLabels[status]||status}</span><strong>{count}</strong></div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{width:`${count/maxStatus*100}%`}}/></div>
          </div>)}</div>
        </div>
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900">Tình trạng đội xe</h2><p className="mt-1 text-xs text-slate-500">Trạng thái phương tiện tại thời điểm tạo báo cáo.</p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-green-50 p-4"><p className="text-xs text-green-700">Hoạt động</p><p className="mt-1 text-2xl font-bold text-green-800">{data.fleet.active}</p></div>
            <div className="rounded-lg bg-amber-50 p-4"><p className="text-xs text-amber-700">Bảo dưỡng</p><p className="mt-1 text-2xl font-bold text-amber-800">{data.fleet.maintenance}</p></div>
            <div className="rounded-lg bg-slate-100 p-4"><p className="text-xs text-slate-600">Ngừng khai thác</p><p className="mt-1 text-2xl font-bold text-slate-800">{data.fleet.inactive}</p></div>
            <div className="rounded-lg bg-blue-50 p-4"><p className="text-xs text-blue-700">Tổng đội xe</p><p className="mt-1 text-2xl font-bold text-blue-800">{data.fleet.total}</p></div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold">Tổng hợp giao dịch</h2><p className="mt-1 text-xs text-slate-500">{data.payments.transactionCount.toLocaleString('vi-VN')} giao dịch trong khoảng lọc</p></div>
          <div className="text-right"><p className="text-xs text-slate-500">Dòng tiền ròng</p><p className="text-2xl font-bold">{money(data.payments.netCashFlow)}</p></div></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{paymentCards.map(card=><div key={card.label} className="rounded-lg border p-4"><p className="text-xs text-slate-500">{card.label}</p><p className="mt-2 text-lg font-bold">{money(card.value)}</p></div>)}</div>
        <p className="mt-4 text-sm text-slate-600">Tổng tiền đã thu (bao gồm cọc): <strong>{money(data.payments.totalCollected)}</strong></p>
      </div>

      <div className="rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="font-semibold">Mức sử dụng đội xe</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg bg-slate-50 p-4"><p className="text-xs text-slate-500">Số xe có đơn hợp lệ</p><p className="mt-1 text-2xl font-bold">{data.utilization.vehiclesUsed}</p></div>
          <div className="rounded-lg bg-slate-50 p-4"><p className="text-xs text-slate-500">Tổng thời lượng thuê theo lịch</p><p className="mt-1 text-2xl font-bold">{duration(data.utilization.scheduledMinutes)}</p></div>
        </div>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <strong>Lưu ý khi đọc báo cáo:</strong>
        <ul className="mt-2 list-disc space-y-1 pl-5">{data.notes.map((note,index)=><li key={index}>{note}</li>)}</ul>
        <p className="mt-2">Chưa hiển thị một con số “doanh thu kế toán” vì quy ước ghi nhận doanh thu chưa được chốt trong đặc tả. Tiền cọc không được mặc định xem là doanh thu.</p>
      </div>
      <p className="text-xs text-slate-500">Cập nhật lúc: {new Date(data.generatedAt).toLocaleString('vi-VN')}</p>
    </>}
  </section>;
}
