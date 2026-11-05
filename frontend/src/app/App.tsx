import { Link, Route, Routes } from 'react-router-dom';
import { LoginPage } from '../features/auth/LoginPage';
import { RegisterPage } from '../features/auth/RegisterPage';
import { CustomerBookingsRoute } from './CustomerBookingsRoute';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { HomePage } from '../features/home/HomePage';
import { PaymentsPage } from '../features/payments/PaymentsPage';
import { ProfilePage } from '../features/profile/ProfilePage';
import { StaffPage } from '../features/staff/StaffPage';
import { MaintenancePage } from '../features/maintenance/MaintenancePage';
import { OperationsPage } from '../features/operations/OperationsPage';
import { IssuesPage } from '../features/operations/IssuesPage';
import { LocationsPage } from '../features/locations/LocationsPage';
import { StationsPage } from '../features/stations/StationsPage';
import { VehiclesPage } from '../features/vehicles/VehiclesPage';
import { RoleRoute } from './RoleRoute';
import { AdminHomePage } from '../features/admin/AdminHomePage';
import { AdminVehiclesPage } from '../features/admin/AdminVehiclesPage';
import { AdminStationsPage } from '../features/admin/AdminStationsPage';
import { AdminModelsPage } from '../features/admin/AdminModelsPage';
import { AdminCustomersPage } from '../features/admin/AdminCustomersPage';
import { MainLayout } from '../layouts/MainLayout';
import { NotificationsPage } from '../features/notifications/NotificationsPage';
import { AuditLogsPage } from '../features/admin/AuditLogsPage';
import { VehicleTransfersPage } from '../features/operations/VehicleTransfersPage';

export function App() {
  return <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />
    <Route element={<MainLayout />}>
      <Route index element={<HomePage />} />
      <Route path="/stations" element={<StationsPage />} />
      <Route path="/vehicles" element={<VehiclesPage />} />
      <Route path="/bookings/my" element={<CustomerBookingsRoute />} />
      <Route path="/locations" element={<RoleRoute allowed={['ADMIN', 'STAFF']}><LocationsPage /></RoleRoute>} />
      <Route path="/bookings/:id/payments" element={<PaymentsPage />} />
      <Route path="/maintenance" element={<RoleRoute allowed={['ADMIN', 'STAFF']}><MaintenancePage /></RoleRoute>} />
      <Route path="/operations" element={<RoleRoute allowed={['ADMIN', 'STAFF']}><OperationsPage /></RoleRoute>} />
      <Route path="/vehicle-transfers" element={<RoleRoute allowed={['ADMIN', 'STAFF']}><VehicleTransfersPage /></RoleRoute>} />
      <Route path="/issues" element={<RoleRoute allowed={['ADMIN', 'STAFF']}><IssuesPage /></RoleRoute>} />
      <Route path="/notifications" element={<RoleRoute allowed={["ADMIN", "STAFF", "CUSTOMER"]}><NotificationsPage /></RoleRoute>} />
      <Route path="/profile" element={<RoleRoute allowed={['ADMIN', 'STAFF', 'CUSTOMER']}><ProfilePage /></RoleRoute>} />
      <Route path="/admin" element={<RoleRoute allowed={['ADMIN']}><AdminHomePage /></RoleRoute>} />
      <Route path="/admin/vehicles" element={<RoleRoute allowed={['ADMIN']}><AdminVehiclesPage /></RoleRoute>} />
      <Route path="/admin/stations" element={<RoleRoute allowed={['ADMIN']}><AdminStationsPage /></RoleRoute>} />
      <Route path="/admin/models" element={<RoleRoute allowed={['ADMIN']}><AdminModelsPage /></RoleRoute>} />
      <Route path="/admin/customers" element={<RoleRoute allowed={['ADMIN']}><AdminCustomersPage /></RoleRoute>} />
      <Route path="/admin/staff" element={<RoleRoute allowed={['ADMIN']}><StaffPage /></RoleRoute>} />
      <Route path="/admin/audit-logs" element={<RoleRoute allowed={["ADMIN"]}><AuditLogsPage /></RoleRoute>} />
      <Route path="/admin/dashboard" element={<RoleRoute allowed={['ADMIN']}><DashboardPage /></RoleRoute>} />
      <Route path="*" element={<div className="container-page py-32 text-center"><p className="eyebrow">404 · KHÔNG TÌM THẤY</p><h1 className="mt-4 text-4xl font-extrabold">Có vẻ bạn đã rẽ nhầm đường.</h1><p className="mt-3 text-slate-500">Trang này không tồn tại hoặc đã được thay đổi.</p><Link to="/" className="btn-primary mt-8">Về trang chủ →</Link></div>} />
    </Route>
  </Routes>;
}
