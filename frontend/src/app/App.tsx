import { Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from '../features/auth/LoginPage';
import { RegisterPage } from '../features/auth/RegisterPage';
import { RequireRole } from '../features/auth/RequireRole';
import { useAuth, roleHome } from '../features/auth/AuthContext';
import { MyBookingsPage } from '../features/bookings/MyBookingsPage';
import { LocationsPage } from '../features/locations/LocationsPage';
import { StationsPage } from '../features/stations/StationsPage';
import { VehiclesPage } from '../features/vehicles/VehiclesPage';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { StaffPage } from '../features/staff/StaffPage';
import { StaffWorkspacePage } from '../features/staff/StaffWorkspacePage';
import { StaffPaymentsPage } from '../features/staff/StaffPaymentsPage';
import { MaintenancePage } from '../features/maintenance/MaintenancePage';
import { MainLayout } from '../layouts/MainLayout';

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-10 text-center text-sm text-slate-500">Đang tải tài khoản...</div>;
  return <Navigate to={roleHome(user?.role)} replace />;
}

export function App() {
  return <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />
    <Route element={<MainLayout />}>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/stations" element={<StationsPage />} />
      <Route path="/vehicles" element={<VehiclesPage />} />

      <Route element={<RequireRole allowed={['CUSTOMER']} />}>
        <Route path="/bookings/my" element={<MyBookingsPage />} />
      </Route>

      <Route element={<RequireRole allowed={['STAFF', 'ADMIN']} />}>
        <Route path="/locations" element={<LocationsPage />} />
        <Route path="/maintenance" element={<MaintenancePage />} />
        <Route path="/staff/workspace" element={<StaffWorkspacePage />} />
        <Route path="/staff/payments" element={<StaffPaymentsPage />} />
      </Route>

      <Route element={<RequireRole allowed={['ADMIN']} />}>
        <Route path="/admin/dashboard" element={<DashboardPage />} />
        <Route path="/admin/staff" element={<StaffPage />} />
      </Route>

      <Route path="*" element={<HomeRedirect />} />
    </Route>
  </Routes>;
}
