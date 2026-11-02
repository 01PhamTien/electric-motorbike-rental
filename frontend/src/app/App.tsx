import { Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from '../features/auth/LoginPage';
import { RegisterPage } from '../features/auth/RegisterPage';
import { MyBookingsPage } from '../features/bookings/MyBookingsPage';
import { LocationsPage } from '../features/locations/LocationsPage';
import { StationsPage } from '../features/stations/StationsPage';
import { VehiclesPage } from '../features/vehicles/VehiclesPage';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { StaffPage } from '../features/staff/StaffPage';
import { MainLayout } from '../layouts/MainLayout';

export function App() {
  return <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />
    <Route element={<MainLayout />}>
      <Route path="/" element={<Navigate to="/vehicles" replace />} />
      <Route path="/stations" element={<StationsPage />} />
      <Route path="/vehicles" element={<VehiclesPage />} />
      <Route path="/bookings/my" element={<MyBookingsPage />} />
      <Route path="/locations" element={<LocationsPage />} />
      <Route path="/admin/dashboard" element={<DashboardPage />} />
      <Route path="/admin/staff" element={<StaffPage />} />
    </Route>
  </Routes>;
}
