import { Link, Route, Routes } from 'react-router-dom';
import { LoginPage } from '../features/auth/LoginPage';
import { RegisterPage } from '../features/auth/RegisterPage';
import { MyBookingsPage } from '../features/bookings/MyBookingsPage';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { HomePage } from '../features/home/HomePage';
import { LocationsPage } from '../features/locations/LocationsPage';
import { StationsPage } from '../features/stations/StationsPage';
import { VehiclesPage } from '../features/vehicles/VehiclesPage';
import { MainLayout } from '../layouts/MainLayout';

export function App() {
  return <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />
    <Route element={<MainLayout />}>
      <Route index element={<HomePage />} />
      <Route path="/stations" element={<StationsPage />} />
      <Route path="/vehicles" element={<VehiclesPage />} />
      <Route path="/bookings/my" element={<MyBookingsPage />} />
      <Route path="/locations" element={<LocationsPage />} />
      <Route path="/admin/dashboard" element={<DashboardPage />} />
      <Route path="*" element={<div className="container-page py-32 text-center"><p className="eyebrow">404 · KHÔNG TÌM THẤY</p><h1 className="mt-4 text-4xl font-extrabold">Có vẻ bạn đã rẽ nhầm đường.</h1><p className="mt-3 text-slate-500">Trang này không tồn tại hoặc đã được thay đổi.</p><Link to="/" className="btn-primary mt-8">Về trang chủ →</Link></div>} />
    </Route>
  </Routes>;
}
