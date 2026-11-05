import { Link } from 'react-router-dom';
import { SectionHeading } from '../../components/Brand';

const items = [
  { to: '/admin/vehicles', icon: '🛵', name: 'Quản lý đội xe', info: 'Thêm, sửa, điều chuyển trạm, giá thuê và tình trạng xe' },
  { to: '/admin/models', icon: '⚙️', name: 'Dòng xe', info: 'Danh mục hãng, mẫu xe và thông số' },
  { to: '/admin/stations', icon: '📍', name: 'Điểm thuê', info: 'Quản lý vị trí, thông tin và trạng thái hoạt động của trạm' },
  { to: '/admin/staff', icon: '👥', name: 'Nhân viên', info: 'Phân công điểm thuê, quản lý tài khoản nhân viên' },
  { to: '/admin/customers', icon: '🪪', name: 'Khách hàng', info: 'Xem danh sách và khóa/mở khóa tài khoản khách hàng' },
  { to: '/admin/vouchers', icon: '🎟️', name: 'Voucher & khuyến mãi', info: 'Tạo mã giảm giá, giới hạn lượt dùng và xem lịch sử áp dụng' },
  { to: '/operations', icon: '📋', name: 'Đơn thuê', info: 'Xác nhận đơn, giao xe, nhận xe trả' },
  { to: '/maintenance', icon: '🔧', name: 'Bảo dưỡng', info: 'Theo dõi bảo trì và tình trạng xe' },
  { to: '/locations', icon: '🧭', name: 'Vị trí xe', info: 'Theo dõi cập nhật vị trí xe' },
  { to: '/admin/dashboard', icon: '📊', name: 'Báo cáo', info: 'Theo dõi hoạt động hệ thống' },
] as const;

export function AdminHomePage() {
  return <section className="container-page space-y-9 py-12 sm:py-16">
    <SectionHeading eyebrow="TRUNG TÂM QUẢN TRỊ" title="Điều hành VoltGo" description="Tất cả công cụ quản lý tập trung tại một nơi. Chọn phân hệ để xem danh sách và thực hiện nghiệp vụ." />
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {items.map(item => <Link to={item.to} key={item.to} className="panel group flex min-h-[175px] flex-col p-6 transition hover:-translate-y-1 hover:border-emerald-300 hover:shadow-lg">
        <span className="text-3xl" aria-hidden="true">{item.icon}</span>
        <h2 className="mt-4 text-lg font-extrabold text-slate-900 group-hover:text-emerald-700">{item.name} <span aria-hidden="true">↗</span></h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">{item.info}</p>
      </Link>)}
    </div>
  </section>;
}
