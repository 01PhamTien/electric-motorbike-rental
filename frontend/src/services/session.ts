export type SessionRole = 'ADMIN' | 'STAFF' | 'CUSTOMER' | null;
export function getSessionRole(): SessionRole {
  const token = localStorage.getItem('accessToken');
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as { role?: string };
    return payload.role === 'ADMIN' || payload.role === 'STAFF' || payload.role === 'CUSTOMER' ? payload.role : null;
  } catch { return null; }
}
// Decoded claims only drive navigation. The NestJS API is responsible for authorization.
