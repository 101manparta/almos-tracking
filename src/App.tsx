/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { AppShell, type AppRoute } from './components/layout/AppShell.tsx';
import { AuthProvider, useAuth } from './contexts/AuthContext.tsx';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage.tsx';
import { ArchivePage } from './pages/admin/ArchivePage.tsx';
import { DepartmentsPage } from './pages/admin/DepartmentsPage.tsx';
import { GarmentsPage } from './pages/admin/GarmentsPage.tsx';
import { OrderDetailPage } from './pages/admin/OrderDetailPage.tsx';
import { OrdersPage } from './pages/admin/OrdersPage.tsx';
import { PhotoGalleryPage } from './pages/admin/PhotoGalleryPage.tsx';
import { PickupPage } from './pages/admin/PickupPage.tsx';
import { ReportsPage } from './pages/admin/ReportsPage.tsx';
import { SettingsPage } from './pages/admin/SettingsPage.tsx';
import { TrackingPage } from './pages/admin/TrackingPage.tsx';
import { UsersPage } from './pages/admin/UsersPage.tsx';
import { AdminLoginPage } from './pages/AdminLoginPage.tsx';
import { EmployeeLoginPage } from './pages/EmployeeLoginPage.tsx';
import { GarmentDetailPage } from './pages/shared/GarmentDetailPage.tsx';
import { StaffDashboardPage } from './pages/staff/StaffDashboardPage.tsx';
import { StaffHistoryPage } from './pages/staff/StaffHistoryPage.tsx';
import { StaffIssuesPage } from './pages/staff/StaffIssuesPage.tsx';
import { StaffProfilePage } from './pages/staff/StaffProfilePage.tsx';
import { StaffQueuePage } from './pages/staff/StaffQueuePage.tsx';
import { StaffSearchPage } from './pages/staff/StaffSearchPage.tsx';
import {
  normalizePublicRoute,
  normalizeRouteForRole,
} from './lib/routing.ts';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 15_000,
      refetchOnWindowFocus: false,
    },
  },
});

function AuthenticatedWorkspace() {
  const { user, isLoading } = useAuth();
  const [rawPath, setRawPath] = useState<string>(() => window.location.pathname || '/');

  useEffect(() => {
    const onPopState = () => setRawPath(window.location.pathname || '/');
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((nextPath: AppRoute | '/admin' | '/login') => {
    setRawPath(nextPath);
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      const publicPath = normalizePublicRoute(rawPath);
      if (rawPath !== publicPath) {
        setRawPath(publicPath);
        window.history.replaceState({}, '', publicPath);
      }
      return;
    }

    const normalized = normalizeRouteForRole(rawPath, user.role);
    if (normalized !== rawPath) {
      setRawPath(normalized);
      window.history.replaceState({}, '', normalized);
    }
  }, [user, isLoading, rawPath]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F5F8FC] p-6">
        <img
          src="/assets/aistudio/image_515944f0.png"
          alt="ALMOS Laundry Detailing"
          className="h-16 w-16 rounded-2xl object-contain bg-[#0756B8] p-1 shadow-md animate-pulse"
        />
        <p className="mt-4 text-sm font-semibold text-[#12345A]">
          Memuat sistem ALMOS Laundry Detailing...
        </p>
      </div>
    );
  }

  if (!user) {
    const publicPath = normalizePublicRoute(rawPath);
    if (publicPath === '/admin') {
      return <AdminLoginPage onSwitchToEmployee={() => navigate('/login')} />;
    }
    return <EmployeeLoginPage onSwitchToAdmin={() => navigate('/admin')} />;
  }

  const isAdmin = user.role === 'ADMIN';
  const currentPath = normalizeRouteForRole(rawPath, user.role);

  const renderPage = () => {
    if (isAdmin) {
      if (currentPath === '/admin/dashboard' || currentPath === '/dashboard') {
        return <AdminDashboardPage onNavigate={navigate} />;
      }
      if (currentPath === '/pesanan') return <OrdersPage onNavigate={navigate} />;
      if (currentPath.startsWith('/pesanan/')) {
        const orderId = currentPath.slice('/pesanan/'.length);
        return <OrderDetailPage orderId={orderId} onNavigate={navigate} />;
      }
      if (currentPath === '/barang') return <GarmentsPage onNavigate={navigate} />;
      if (currentPath.startsWith('/barang/')) {
        const garmentId = currentPath.slice('/barang/'.length);
        return <GarmentDetailPage garmentId={garmentId} onNavigate={navigate} />;
      }
      if (currentPath === '/tracking') return <TrackingPage onNavigate={navigate} />;
      if (currentPath === '/galeri') return <PhotoGalleryPage onNavigate={navigate} />;
      if (currentPath === '/divisi') return <DepartmentsPage onNavigate={navigate} />;
      if (currentPath === '/pengambilan') return <PickupPage onNavigate={navigate} />;
      if (currentPath === '/arsip') return <ArchivePage onNavigate={navigate} />;
      if (currentPath === '/laporan') return <ReportsPage />;
      if (currentPath === '/pengguna') return <UsersPage />;
      if (currentPath === '/pengaturan') return <SettingsPage />;
      return <AdminDashboardPage onNavigate={navigate} />;
    }

    if (
      currentPath === '/spotting/dashboard' ||
      currentPath === '/ironing/dashboard' ||
      currentPath === '/packing/dashboard' ||
      currentPath === '/staff/beranda'
    ) {
      return <StaffDashboardPage onNavigate={navigate} />;
    }
    if (currentPath === '/staff/antrean') return <StaffQueuePage onNavigate={navigate} />;
    if (currentPath === '/staff/cari') return <StaffSearchPage onNavigate={navigate} />;
    if (currentPath === '/staff/riwayat') return <StaffHistoryPage onNavigate={navigate} />;
    if (currentPath === '/staff/kendala') return <StaffIssuesPage onNavigate={navigate} />;
    if (currentPath === '/staff/profil') return <StaffProfilePage onNavigate={navigate} />;
    if (currentPath.startsWith('/staff/barang/')) {
      const garmentId = currentPath.slice('/staff/barang/'.length);
      return <GarmentDetailPage garmentId={garmentId} onNavigate={navigate} />;
    }
    if (currentPath.startsWith('/staff/checklist/')) {
      const garmentId = currentPath.slice('/staff/checklist/'.length);
      return <GarmentDetailPage garmentId={garmentId} onNavigate={navigate} />;
    }
    return <StaffDashboardPage onNavigate={navigate} />;
  };

  return (
    <AppShell currentPath={currentPath} onNavigate={navigate}>
      {renderPage()}
    </AppShell>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthenticatedWorkspace />
      </AuthProvider>
    </QueryClientProvider>
  );
}
