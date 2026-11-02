import { useEffect, useState } from 'react';
import { api } from '../../services/api';

type Overview = {
  generatedAt: string;
  bookings: { total: number; byStatus: Record<string, number> };
  fleet: { total: number; active: number; maintenance: number; inactive: number };
  notes?: string[];
};

const statusLabels: Record<string, string> = {
  PENDING: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  RENTING: 'Đang thuê',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
  EXPIRED: 'Hết hạn',
};

export function DashboardPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/reports/overview');
      setData(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không tải được báo cáo. Hãy đăng nhập bằng tài khoản ADMIN và kiểm tra API GET /reports/overview.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const cards = data ? [
    { label: 'Tổng số xe', value: data.fleet.total, detail: 'Toàn bộ đội xe' },
    { label: 'Xe hoạt động', value: data.fleet.active, detail: 'Đang sẵn sàng khai thác' },
    { label: 'Xe bảo dưỡng', value: data.fleet.maintenance, detail: 'Đang trong bảo dưỡng' },
    { label: 'Tổng đơn thuê', value: data.bookings.total, detail: 'Theo thời điểm tạo đơn' },
  ] : [];

  const statuses = data ? Object.entries(data.bookings.byStatus) : [];
  const maxStatus = Math.max(1, ...statuses.map(([, count]) => count));

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-blue-700">QUẢN TRỊ HỆ THỐNG</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Dashboard vận hành</h1>
          <p className="mt-1 text-sm text-slate-600">Tổng quan đội xe và tình trạng đơn thuê.</p>
        </div>
        <button onClick={() => void load()} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50">
          Làm mới dữ liệu
        </button>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{String(error)}</div>}
      {loading && <div className="rounded-xl border bg-white p-6 text-sm text-slate-500">Đang tải báo cáo...</div>}

      {!loading && data && <>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">{card.label}</p>
              <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{card.value.toLocaleString('vi-VN')}</p>
              <p className="mt-2 text-xs text-slate-500">{card.detail}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-slate-900">Đơn thuê theo trạng thái</h2>
            <p className="mt-1 text-xs text-slate-500">Số lượng đơn theo trạng thái hiện tại.</p>
            <div className="mt-5 space-y-4">
              {statuses.map(([status, count]) => (
                <div key={status}>
                  <div className="mb-1 flex justify-between gap-3 text-sm">
                    <span className="text-slate-700">{statusLabels[status] || status}</span>
                    <strong className="text-slate-900">{count}</strong>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-blue-600" style={{ width: `${(count / maxStatus) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-slate-900">Tình trạng đội xe</h2>
            <p className="mt-1 text-xs text-slate-500">Thống kê theo dữ liệu phương tiện.</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-green-50 p-4">
                <p className="text-xs text-green-700">Hoạt động</p>
                <p className="mt-1 text-2xl font-bold text-green-800">{data.fleet.active}</p>
              </div>
              <div className="rounded-lg bg-amber-50 p-4">
                <p className="text-xs text-amber-700">Bảo dưỡng</p>
                <p className="mt-1 text-2xl font-bold text-amber-800">{data.fleet.maintenance}</p>
              </div>
              <div className="rounded-lg bg-slate-100 p-4">
                <p className="text-xs text-slate-600">Ngừng khai thác</p>
                <p className="mt-1 text-2xl font-bold text-slate-800">{data.fleet.inactive}</p>
              </div>
              <div className="rounded-lg bg-blue-50 p-4">
                <p className="text-xs text-blue-700">Tổng đội xe</p>
                <p className="mt-1 text-2xl font-bold text-blue-800">{data.fleet.total}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>Lưu ý báo cáo:</strong> Dữ liệu hiện tại là báo cáo vận hành, chưa phải báo cáo doanh thu. Chưa cộng tiền thuê, phụ phí, khấu trừ và hoàn cọc.
        </div>
        <p className="text-xs text-slate-500">Cập nhật lúc: {new Date(data.generatedAt).toLocaleString('vi-VN')}</p>
      </>}
    </section>
  );
}
