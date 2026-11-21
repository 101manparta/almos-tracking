import type { AppRoute } from '../components/layout/AppShell.tsx';
import type { RoleCode } from '../shared/types.ts';

const ADMIN_EXACT_ROUTES = new Set<string>([
  '/admin/dashboard',
  '/pesanan',
  '/barang',
  '/tracking',
  '/galeri',
  '/divisi',
  '/pengambilan',
  '/arsip',
  '/laporan',
  '/pengguna',
  '/pengaturan',
]);

const STAFF_EXACT_ROUTES = new Set<string>([
  '/staff/antrean',
  '/staff/cari',
  '/staff/riwayat',
  '/staff/profil',
  '/staff/kendala',
]);

export function getDivisionDashboardRoute(role: RoleCode): AppRoute {
  if (role === 'ADMIN') return '/admin/dashboard';
  if (role === 'SPOTTING') return '/spotting/dashboard';
  if (role === 'IRONING') return '/ironing/dashboard';
  return '/packing/dashboard';
}

export function normalizePublicRoute(rawPath: string): '/admin' | '/login' {
  const path = rawPath.replace(/\/+$/, '') || '/';
  if (path === '/admin' || path === '/admin/dashboard') {
    return '/admin';
  }
  return '/login';
}

export function normalizeRouteForRole(rawPath: string, role: RoleCode): AppRoute {
  const path = rawPath === '/' ? '' : rawPath.replace(/\/+$/, '');
  if (role === 'ADMIN') {
    if (ADMIN_EXACT_ROUTES.has(path)) return path as AppRoute;
    if (/^\/pesanan\/[0-9a-f-]+$/i.test(path)) return path as AppRoute;
    if (/^\/barang\/[0-9a-f-]+$/i.test(path)) return path as AppRoute;
    return '/admin/dashboard';
  }

  const ownDashboard = getDivisionDashboardRoute(role);
  if (path === ownDashboard) return ownDashboard;
  if (STAFF_EXACT_ROUTES.has(path)) return path as AppRoute;
  if (/^\/staff\/barang\/[0-9a-f-]+$/i.test(path)) return path as AppRoute;
  if (/^\/staff\/checklist\/[0-9a-f-]+$/i.test(path)) return path as AppRoute;
  return ownDashboard;
}
