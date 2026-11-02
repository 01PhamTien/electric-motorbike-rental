import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../services/api';

type Overview = {
  generatedAt: string;
  filters: { from: string | null; to: string | null };
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
const statusColors: Record<string, string> = {
  PENDING: 'bg-amber-500', CONFIRMED: 'bg-blue-500', RENTING: 'bg-violet-500',
  COMPLETED: 'bg-emerald-500', CANCELLED: 'bg-rose-500', EXPIRED: 'bg-slate-400',
};
const money = (value: number) => value.toLocaleString('vi-VN', { maximumFractionDigits: 0 }) + ' đ';
const duration = (minutes: number) => {
  const safe = Math.max(0, minutes);
  const hours = Math.floor(safe / 60);
  const days = Math.floor(hours / 24);
  return days > 0 ? `${days} ngày ${hours % 24} giờ` : `${hours} giờ ${safe % 60} phút`;
};

function MetricCard({ label, value, detail, icon, tone }: {
  label: string; value: string; detail: string; icon: string;
  tone: 'blue' | 'green' | 'amber' | 'violet';
}) {
  const tones = {
    blue: 'bg-blue-50 text-blue-700 ring-blue-100',
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    amber: 'bg-amber-50 text-amber-700 ring-amber-100',
    violet: 'bg-violet-50 text-violet-700 ring-violet-100',
  };
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0"><p className="text-sm font-medium text-slate-500">{label}</p>
        <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950">{value}</p>
        <p className="mt-2 text-xs text-slate-500">{detail}</p></div>
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg font-bold ring-1 ${tones[tone]}`}>{icon}</span>
    </div>
  </article>;
}

function Panel({ title, description, children, className = '' }: {
  title: string; description?: string; children: React.ReactNode; className?: string;
}) {
  return <section className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 ${className}`}>
    <div className="mb-5"><h2 className="font-bold text-slate-900">{title}</h2>
      {description && <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>}</div>
    {children}
  </section>;
}

export function DashboardPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, string> = {};
      if (from) params.from = new Date(from + 'T00:00:00').toISOString();
      if (to) params.to = new Date(to + 'T23:59:59.999').toISOString();
      const response = await api.get<Overview>('/reports/overview', { params });
      setData(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không tải được báo cáo. Hãy đăng nhập bằng tài khoản ADMIN và kiểm tra API GET /reports/overview.');
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { void load(); }, [load]);

  const statuses = useMemo(() => data ? Object.entries(data.bookings.byStatus).sort((a, b) => b[1] - a[1]) : [], [data]);
  const maxStatus = Math.max(1, ...statuses.map(([, count]) => count));
  const fleetRate = data && data.fleet.total > 0 ? Math.round(data.fleet.active / data.fleet.total * 100) : 0;
  const paymentCards = data ? [
    { label: 'Tiền thuê đã thu', value: data.payments.rentCollected, color: 'text-blue-700' },
    { label: 'Tiền cọc đã nhận', value: data.payments.depositCollected, color: 'text-violet-700' },
    { label: 'Phụ phí đã thu', value: data.payments.extraCollected, color: 'text-emerald-700' },
    { label: 'Tiền đã hoàn', value: data.payments.refunded, color: 'text-rose-700' },
  ] : [];

  return <section className="space-y-6">
    <header className="relative overflow-hidden rounded-3xl bg-slate-950 px-6 py-7 text-white shadow-lg sm:px-8 sm:py-9">
      <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-7rem] right-1/3 h-52 w-52 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="relative flex flex-wrap items-end justify-between gap-5">
        <div><div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-300/20 bg-blue-400/10 px-3 py-1 text-[11px] font-bold tracking-[0.16em] text-blue-200">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> TRUNG TÂM ĐIỀU HÀNH
        </div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Tổng quan hệ thống</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">Theo dõi hoạt động đội xe, đơn thuê và dòng tiền được ghi nhận trên toàn hệ thống.</p>
        </div>
        <button onClick={() => void load()} disabled={loading} className="rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15 disabled:opacity-50">
          {loading ? 'Đang cập nhật...' : '↻ Làm mới dữ liệu'}
        </button>
      </div>
    </header>

    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><h2 className="text-sm font-bold text-slate-900">Bộ lọc thời gian</h2><p className="mt-1 text-xs text-slate-500">Đơn thuê lọc theo ngày tạo; giao dịch lọc theo ngày ghi nhận.</p></div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs font-semibold text-slate-600">Từ ngày
            <input type="date" value={from} max={to || undefined} onChange={e => setFrom(e.target.value)} className="mt-1.5 block rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-normal text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100" />
          </label>
          <label className="text-xs font-semibold text-slate-600">Đến ngày
            <input type="date" value={to} min={from || undefined} onChange={e => setTo(e.target.value)} className="mt-1.5 block rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-normal text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100" />
          </label>
          <button onClick={() => { setFrom(''); setTo(''); }} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Xóa lọc</button>
        </div>
      </div>
    </section>

    {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{String(error)}</div>}
    {loading && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[1, 2, 3, 4].map(n => <div key={n} className="h-36 animate-pulse rounded-2xl border border-slate-200 bg-white" />)}</div>}

    {!loading && data && <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Tổng số phương tiện" value={data.fleet.total.toLocaleString('vi-VN')} detail="Toàn bộ đội xe" icon="EV" tone="blue" />
        <MetricCard label="Xe đang hoạt động" value={data.fleet.active.toLocaleString('vi-VN')} detail="Sẵn sàng khai thác" icon="✓" tone="green" />
        <MetricCard label="Xe đang bảo dưỡng" value={data.fleet.maintenance.toLocaleString('vi-VN')} detail="Đang trong quy trình bảo dưỡng" icon="⌁" tone="amber" />
        <MetricCard label="Tổng đơn thuê" value={data.bookings.total.toLocaleString('vi-VN')} detail="Theo khoảng thời gian đã chọn" icon="▤" tone="violet" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <Panel title="Đơn thuê theo trạng thái" description="Cơ cấu đơn thuê theo trạng thái hiện tại trong nhóm đơn được lọc.">
          {statuses.length === 0 ? <p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500">Chưa có dữ liệu đơn thuê trong khoảng thời gian này.</p> :
            <div className="space-y-5">{statuses.map(([status, count]) => <div key={status}>
              <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${statusColors[status] || 'bg-slate-400'}`} /><span className="font-medium text-slate-700">{statusLabels[status] || status}</span></div>
                <span className="font-bold tabular-nums text-slate-900">{count.toLocaleString('vi-VN')} <span className="font-normal text-slate-400">· {Math.round(count / Math.max(1, data.bookings.total) * 100)}%</span></span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full transition-all ${statusColors[status] || 'bg-slate-400'}`} style={{ width: `${count / maxStatus * 100}%` }} /></div>
            </div>)}</div>}
        </Panel>

        <Panel title="Sức khỏe đội xe" description="Trạng thái phương tiện tại thời điểm tạo báo cáo.">
          <div className="rounded-2xl bg-slate-950 p-5 text-white">
            <div className="flex items-end justify-between gap-3"><div><p className="text-xs font-medium text-slate-400">Tỷ lệ xe hoạt động</p><p className="mt-1 text-4xl font-bold tracking-tight">{fleetRate}%</p></div>
              <p className="text-sm text-slate-300">{data.fleet.active}/{data.fleet.total} xe</p></div>
            <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-emerald-400" style={{ width: `${fleetRate}%` }} /></div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-4"><p className="text-xs font-medium text-emerald-700">Hoạt động</p><p className="mt-1 text-2xl font-bold text-emerald-800">{data.fleet.active}</p></div>
            <div className="rounded-xl border border-amber-100 bg-amber-50/70 p-4"><p className="text-xs font-medium text-amber-700">Bảo dưỡng</p><p className="mt-1 text-2xl font-bold text-amber-800">{data.fleet.maintenance}</p></div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-medium text-slate-600">Ngừng khai thác</p><p className="mt-1 text-2xl font-bold text-slate-800">{data.fleet.inactive}</p></div>
            <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4"><p className="text-xs font-medium text-blue-700">Tổng đội xe</p><p className="mt-1 text-2xl font-bold text-blue-800">{data.fleet.total}</p></div>
          </div>
        </Panel>
      </div>

      <Panel title="Dòng tiền và giao dịch" description={`${data.payments.transactionCount.toLocaleString('vi-VN')} giao dịch trong khoảng thời gian đã chọn.`}>
        <div className="rounded-2xl bg-gradient-to-r from-blue-700 to-indigo-700 p-5 text-white sm:flex sm:items-center sm:justify-between">
          <div><p className="text-sm font-medium text-blue-100">Dòng tiền ròng</p><p className="mt-2 text-3xl font-bold tracking-tight">{money(data.payments.netCashFlow)}</p></div>
          <div className="mt-4 rounded-xl border border-white/20 bg-white/10 px-4 py-3 sm:mt-0"><p className="text-xs text-blue-100">Tổng tiền đã thu (bao gồm cọc)</p><p className="mt-1 text-lg font-bold">{money(data.payments.totalCollected)}</p></div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{paymentCards.map(card => <div key={card.label} className="rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-medium text-slate-500">{card.label}</p><p className={`mt-2 text-lg font-bold ${card.color}`}>{money(card.value)}</p>
        </div>)}</div>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Mức sử dụng đội xe" description="Tổng hợp thời lượng thuê theo lịch của các đơn hợp lệ.">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-medium text-slate-500">Số xe có đơn hợp lệ</p><p className="mt-2 text-2xl font-bold text-slate-900">{data.utilization.vehiclesUsed}</p></div>
            <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-medium text-slate-500">Thời lượng thuê theo lịch</p><p className="mt-2 text-2xl font-bold text-slate-900">{duration(data.utilization.scheduledMinutes)}</p></div>
          </div>
        </Panel>
        <Panel title="Thông tin báo cáo" description="Thời điểm tổng hợp và các giới hạn dữ liệu cần lưu ý.">
          <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-medium text-slate-500">Dữ liệu cập nhật lúc</p><p className="mt-1 font-semibold text-slate-900">{new Date(data.generatedAt).toLocaleString('vi-VN')}</p></div>
          <ul className="mt-3 space-y-2 text-sm leading-5 text-slate-600">{data.notes.map((note, index) => <li key={index} className="flex gap-2"><span className="mt-0.5 text-blue-600">•</span><span>{note}</span></li>)}</ul>
        </Panel>
      </div>
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
        <strong>Lưu ý kế toán:</strong> Chưa hiển thị chỉ tiêu “doanh thu kế toán” vì quy ước ghi nhận doanh thu chưa được chốt trong đặc tả. Tiền cọc không được mặc định xem là doanh thu.
      </div>
    </>}
  </section>;
}
