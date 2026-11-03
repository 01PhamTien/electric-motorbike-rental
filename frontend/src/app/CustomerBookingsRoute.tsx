import { Navigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import { MyBookingsPage } from '../features/bookings/MyBookingsPage';

/** Only customers have /bookings/my; staff/admin use the operations queue. */
export function CustomerBookingsRoute() {
  const { user, loading } = useAuth();
  if (loading) return <div role="status" className="container-page py-24 text-center text-slate-600">Đang xác minh tài khoản...</div>;
  if (user?.role === 'ADMIN' || user?.role === 'STAFF') {
    return <Navigate to="/operations" replace />;
  }
  return <MyBookingsPage />;
}
