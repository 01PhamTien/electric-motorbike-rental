import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LoadingState, SectionHeading, money } from '../../components/Brand';
import { api } from '../../services/api';

type Overview = {
  generatedAt: string;
  filters: { from: string | null; to: string | null };
  bookings: { total: number; byStatus: Record<string, number> };
  fleet: { total: number; active: number; maintenance: number; inactive: number };
  finance: {
    rentCollected: number; extrasCollected: number; refunds: number;
    recognizedRevenue: number; netCashIn: number;
    depositCollectedLifetime: number; depositRefundedLifetime: number; depositHeldNow: number;
    note: string;
  };
  customers: {uniqueInPeriod:number;newInPeriod:number;returningInPeriod:number;topCustomers:Array<{customerId:number;name:string;bookings:number;completed:number;bookingValue:number;firstBookingAt:string}>};
  monthly: Array<{month:string;rentCollected:number;extrasCollected:number;refunds:number;netCashIn:number;bookings:number}>;
  topVehicles: Array<{vehicleId:number;code:string;model:string;station:string;bookings:number;completed:number;bookingValue:number}>;
  stations: Array<{stationId:number;name:string;bookings:number;completed:number;renting:number;bookingValue:number}>;
  notes: string[];
};
const statusLabels: Record<string,string> = { PENDING:'Chờ xác nhận', CONFIRMED:'Đã xác nhận', RENTING:'Đang thuê', COMPLETED:'Hoàn thành', CANCELLED:'Đã hủy', EXPIRED:'Hết hạn' };
const dateValue = (date: Date) => date.getFullYear() + '-' + String(date.getMonth()+1).padStart(2,'0') + '-' + String(date.getDate()).padStart(2,'0');
const csvCell = (value: unknown) => '"' + String(value ?? '').replace(/"/g, '""') + '"';

export function DashboardPage() {
  const [data,setData] = useState<Overview | null>(null);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [from,setFrom] = useState(() => dateValue(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [to,setTo] = useState(() => dateValue(new Date()));

  async function load() {
    setLoading(true);setError('');
    try {
      const params = new URLSearchParams();
      if (from) params.set('from',from);
      if (to) params.set('to',to);
      const { data } = await api.get('/reports/overview?' + params.toString());
      setData(data);
    } catch(err: unknown) {
      const message = (err as {response?:{data?:{message?:string}}})?.response?.data?.message;
      setError(message || 'Không thể tải báo cáo. API chỉ cho tài khoản quản trị viên.');
    } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  function exportCsv() {
    if (!data) return;
    const rows: unknown[][] = [
      ['BAO CAO KINH DOANH VOLTGO'],
      ['Tu ngay',from,'Den ngay',to],
      [],
      ['CHI SO TAI CHINH','VND'],
      ['Doanh thu tien thue da thu',data.finance.rentCollected],
      ['Phu phi da thu',data.finance.extrasCollected],
      ['Doanh thu ghi nhan',data.finance.recognizedRevenue],
      ['Hoan tien',data.finance.refunds],
      ['Dong tien rong trong ky',data.finance.netCashIn],
      ['Coc da thu luy ke',data.finance.depositCollectedLifetime],
      ['Coc da hoan luy ke',data.finance.depositRefundedLifetime],
      ['Coc dang giu',data.finance.depositHeldNow],
      [],
      ['THONG KE THEO THANG'],
      ['Thang','Tien thue da thu','Phu phi','Hoan tien','Dong tien rong','So don'],
      ...data.monthly.map(m=>[m.month,m.rentCollected,m.extrasCollected,m.refunds,m.netCashIn,m.bookings]),
      [],
      ['PHAN TICH KHACH HANG'],
      ['Khach co don',data.customers.uniqueInPeriod],
      ['Khach moi',data.customers.newInPeriod],
      ['Khach quay lai',data.customers.returningInPeriod],
      ['Khach hang','So don','Hoan thanh','Gia tri don (VND)'],
      ...data.customers.topCustomers.map(c=>[c.name,c.bookings,c.completed,c.bookingValue]),
      [],
      ['HIEU QUA TRAM'],
      ['Tram','So don','Da hoan thanh','Dang thue','Gia tri don thue (VND)'],
      ...data.stations.map(s=>[s.name,s.bookings,s.completed,s.renting,s.bookingValue]),
      [],
      ['TOP XE'],
      ['Ma xe','Mau xe','Tram','So don','Da hoan thanh','Gia tri don thue (VND)'],
      ...data.topVehicles.map(v=>[v.code,v.model,v.station,v.bookings,v.completed,v.bookingValue]),
    ];
    const csv = '\uFEFF' + rows.map(row=>row.map(csvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));
    const anchor = document.createElement('a');
    anchor.href=url;anchor.download='voltgo-bao-cao-'+from+'-den-'+to+'.csv';anchor.click();
    URL.revokeObjectURL(url);
  }

  const metrics = data ? [
    {label:'Doanh thu ghi nhận',value:money(data.finance.recognizedRevenue),detail:'Tiền thuê + phụ phí đã thu',tone:'text-emerald-700'},
    {label:'Dòng tiền ròng',value:money(data.finance.netCashIn),detail:'Đã trừ khoản hoàn trong kỳ',tone:'text-sky-700'},
    {label:'Tiền cọc đang giữ',value:money(data.finance.depositHeldNow),detail:'Số dư cọc lũy kế toàn hệ thống',tone:'text-amber-700'},
    {label:'Tổng đơn thuê',value:data.bookings.total.toLocaleString('vi-VN'),detail:'Đơn tạo trong khoảng đã chọn',tone:'text-slate-900'},
  ] : [];
  const statuses = data ? Object.entries(data.bookings.byStatus) : [];
  const max = Math.max(1,...(data?.monthly.map(m=>m.netCashIn) ?? [0]));
  return <div className="container-page py-12 sm:py-16">
    <div className="flex flex-wrap items-end justify-between gap-6">
      <SectionHeading eyebrow="QUẢN TRỊ VOLTGO" title="Báo cáo kinh doanh" description="Doanh thu, tiền cọc, lượt thuê và hiệu quả đội xe dựa trên dữ liệu giao dịch đã ghi nhận."/>
      <div className="flex flex-wrap gap-3"><Link to="/admin" className="btn-outline">← Trung tâm quản trị</Link><button onClick={()=>void load()} className="btn-outline">↻ Làm mới</button><button disabled={!data} onClick={exportCsv} className="btn-dark">↓ Xuất Excel (CSV)</button></div>
    </div>
    <section className="panel mt-8 flex flex-wrap items-end gap-4 p-5">
      <label className="min-w-[180px] flex-1"><span className="field-label">Từ ngày</span><input type="date" className="field mt-2" value={from} max={to || undefined} onChange={e=>setFrom(e.target.value)}/></label>
      <label className="min-w-[180px] flex-1"><span className="field-label">Đến ngày</span><input type="date" className="field mt-2" value={to} min={from || undefined} onChange={e=>setTo(e.target.value)}/></label>
      <button onClick={()=>void load()} disabled={loading || Boolean(from&&to&&from>to)} className="btn-primary">Áp dụng bộ lọc</button>
    </section>
    {error && <div role="alert" className="mt-7 rounded-xl border border-rose-100 bg-rose-50 p-5 text-sm text-rose-700">{error}</div>}
    {loading ? <div className="mt-8"><LoadingState label="Đang tổng hợp báo cáo..." /></div> : data && <>
      <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(m=><article key={m.label} className="panel p-6"><p className="text-sm font-semibold text-slate-500">{m.label}</p><p className={'mt-5 text-3xl font-extrabold tracking-tight '+m.tone}>{typeof m.value==='number'?money(m.value):m.value}</p><p className="mt-2 text-xs text-slate-400">{m.detail}</p></article>)}</div>
      <div className="mt-7 grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
        <section className="panel p-7"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-extrabold">Dòng tiền theo tháng</h2><p className="mt-2 text-sm text-slate-500">Tiền thuê và phụ phí đã thu, trừ hoàn tiền đã ghi nhận.</p></div><span className="tag">VND</span></div>
          {!data.monthly.length ? <p className="mt-8 text-sm text-slate-400">Chưa có giao dịch trong khoảng thời gian này.</p> : <div className="mt-8 space-y-5">{data.monthly.map(m=><div key={m.month}><div className="mb-2 flex items-center justify-between gap-3 text-sm"><strong>{m.month}</strong><span className="font-semibold text-emerald-700">{money(m.netCashIn)}</span></div><div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{width:Math.max(0,m.netCashIn)/max*100+'%'}}/></div><p className="mt-1 text-xs text-slate-400">{m.bookings} đơn được tạo · Thu thuê {money(m.rentCollected)} · Phụ phí {money(m.extrasCollected)} · Hoàn {money(m.refunds)}</p></div>)}</div>}
        </section>
        <section className="rounded-[22px] bg-[#10383b] p-7 text-white"><p className="text-xs font-extrabold uppercase tracking-[.16em] text-emerald-300">ĐỐI SOÁT TIỀN CỌC</p><h2 className="mt-3 text-2xl font-extrabold">Số dư tiền cọc</h2><p className="mt-3 text-3xl font-extrabold text-emerald-300">{money(data.finance.depositHeldNow)}</p><p className="mt-2 text-sm leading-6 text-emerald-50/75">Số tiền cọc đã thu trừ các khoản hoàn cọc được ghi nhận trên toàn hệ thống.</p><div className="mt-7 grid grid-cols-2 gap-3"><div className="rounded-xl bg-white/10 p-4"><p className="text-xs text-emerald-100/70">Đã thu lũy kế</p><strong className="mt-2 block text-lg">{money(data.finance.depositCollectedLifetime)}</strong></div><div className="rounded-xl bg-white/10 p-4"><p className="text-xs text-emerald-100/70">Đã hoàn lũy kế</p><strong className="mt-2 block text-lg">{money(data.finance.depositRefundedLifetime)}</strong></div></div></section>
      </div>
      <section className="panel mt-7 overflow-hidden">
        <div className="flex flex-wrap items-end justify-between gap-4 p-7">
          <div><h2 className="text-xl font-extrabold">Phân tích khách hàng</h2><p className="mt-2 text-sm text-slate-500">Khách hàng có phát sinh đơn trong khoảng thời gian đã chọn; khách quay lại có từ hai đơn trở lên trong kỳ.</p></div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-slate-50 px-4 py-3"><strong className="block text-xl">{data.customers.uniqueInPeriod}</strong><span className="text-xs text-slate-500">Khách có đơn</span></div>
            <div className="rounded-xl bg-emerald-50 px-4 py-3"><strong className="block text-xl text-emerald-800">{data.customers.newInPeriod}</strong><span className="text-xs text-emerald-700">Khách mới</span></div>
            <div className="rounded-xl bg-sky-50 px-4 py-3"><strong className="block text-xl text-sky-800">{data.customers.returningInPeriod}</strong><span className="text-xs text-sky-700">Khách quay lại</span></div>
          </div>
        </div>
        <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-7 py-4">Khách hàng</th><th className="px-4 py-4">Số đơn</th><th className="px-4 py-4">Hoàn thành</th><th className="px-7 py-4 text-right">Giá trị đơn</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{data.customers.topCustomers.map(c=><tr key={c.customerId}><td className="px-7 py-4 font-bold">{c.name}</td><td className="px-4 py-4">{c.bookings}</td><td className="px-4 py-4">{c.completed}</td><td className="px-7 py-4 text-right font-semibold">{money(c.bookingValue)}</td></tr>)}{!data.customers.topCustomers.length&&<tr><td colSpan={4} className="px-7 py-8 text-center text-slate-400">Chưa có khách hàng phát sinh đơn trong kỳ.</td></tr>}</tbody>
        </table></div>
      </section>
      <div className="mt-7 grid gap-6 lg:grid-cols-2">
        <section className="panel p-7"><h2 className="text-xl font-extrabold">Đơn thuê theo trạng thái</h2><p className="mt-2 text-sm text-slate-500">Theo ngày tạo đơn trong khoảng đã chọn.</p><div className="mt-7 space-y-5">{statuses.map(([status,count])=><div key={status}><div className="mb-2 flex justify-between text-sm"><span className="font-semibold text-slate-600">{statusLabels[status]||status}</span><strong>{count}</strong></div><div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{width:count/Math.max(1,data.bookings.total)*100+'%'}}/></div></div>)}</div></section>
        <section className="panel p-7"><h2 className="text-xl font-extrabold">Tình trạng đội xe</h2><p className="mt-2 text-sm text-slate-500">Số liệu hiện tại, không phụ thuộc bộ lọc ngày.</p><div className="mt-7 grid grid-cols-2 gap-4"><div className="rounded-xl bg-slate-50 p-5"><p className="text-sm text-slate-500">Tổng số xe</p><strong className="mt-2 block text-3xl">{data.fleet.total}</strong></div><div className="rounded-xl bg-emerald-50 p-5"><p className="text-sm text-emerald-700">Sẵn sàng</p><strong className="mt-2 block text-3xl text-emerald-800">{data.fleet.active}</strong></div><div className="rounded-xl bg-amber-50 p-5"><p className="text-sm text-amber-700">Bảo trì</p><strong className="mt-2 block text-3xl text-amber-800">{data.fleet.maintenance}</strong></div><div className="rounded-xl bg-slate-100 p-5"><p className="text-sm text-slate-500">Ngừng khai thác</p><strong className="mt-2 block text-3xl">{data.fleet.inactive}</strong></div></div></section>
      </div>
      <section className="panel mt-7 overflow-hidden"><div className="p-7"><h2 className="text-xl font-extrabold">Hiệu quả từng trạm</h2><p className="mt-2 text-sm text-slate-500">Giá trị đơn thuê là tổng giá thuê theo hợp đồng, không đồng nghĩa số tiền đã thu.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-7 py-4">Trạm</th><th className="px-4 py-4">Tổng đơn</th><th className="px-4 py-4">Hoàn thành</th><th className="px-4 py-4">Đang thuê</th><th className="px-7 py-4 text-right">Giá trị đơn</th></tr></thead><tbody className="divide-y divide-slate-100">{data.stations.map(s=><tr key={s.stationId}><td className="px-7 py-4 font-bold">{s.name}</td><td className="px-4 py-4">{s.bookings}</td><td className="px-4 py-4">{s.completed}</td><td className="px-4 py-4">{s.renting}</td><td className="px-7 py-4 text-right font-semibold">{money(s.bookingValue)}</td></tr>)}{!data.stations.length&&<tr><td colSpan={5} className="px-7 py-8 text-center text-slate-400">Chưa có dữ liệu trạm trong kỳ.</td></tr>}</tbody></table></div></section>
      <section className="panel mt-7 overflow-hidden"><div className="p-7"><h2 className="text-xl font-extrabold">Top xe được thuê nhiều</h2><p className="mt-2 text-sm text-slate-500">Xếp hạng theo số đơn thuê được tạo trong kỳ.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-7 py-4">Phương tiện</th><th className="px-4 py-4">Trạm</th><th className="px-4 py-4">Số đơn</th><th className="px-4 py-4">Hoàn thành</th><th className="px-7 py-4 text-right">Giá trị đơn</th></tr></thead><tbody className="divide-y divide-slate-100">{data.topVehicles.map(v=><tr key={v.vehicleId}><td className="px-7 py-4"><strong>{v.code}</strong><p className="mt-1 text-xs text-slate-500">{v.model}</p></td><td className="px-4 py-4">{v.station}</td><td className="px-4 py-4">{v.bookings}</td><td className="px-4 py-4">{v.completed}</td><td className="px-7 py-4 text-right font-semibold">{money(v.bookingValue)}</td></tr>)}{!data.topVehicles.length&&<tr><td colSpan={5} className="px-7 py-8 text-center text-slate-400">Chưa có dữ liệu phương tiện trong kỳ.</td></tr>}</tbody></table></div></section>
      <div className="mt-7 rounded-2xl border border-amber-100 bg-amber-50 p-5 text-sm leading-7 text-amber-950"><strong>Quy ước báo cáo:</strong> {data.finance.note} {data.notes.join(' ')}</div>
      <p className="mt-6 text-xs text-slate-400">Dữ liệu tổng hợp lúc: {new Date(data.generatedAt).toLocaleString('vi-VN')}</p>
    </>}
  </div>;
}
