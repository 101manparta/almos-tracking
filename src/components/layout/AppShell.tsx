import { useQuery } from '@tanstack/react-query';
import {
  Archive,
  BarChart3,
  Bell,
  Building2,
  ClipboardList,
  History,
  Home,
  Images,
  LayoutDashboard,
  LogOut,
  Menu,
  PackageCheck,
  Route,
  Search,
  Settings,
  Shirt,
  UserCircle,
  Users,
  X,
} from 'lucide-react';
import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext.tsx';
import { apiFetch } from '../../lib/api.ts';
import { ROLE_LABELS } from '../../lib/labels.ts';
import { AuthorizedImage, StatusBadge } from '../ui/Primitives.tsx';

export type AppRoute =
  | '/dashboard'
  | '/admin/dashboard'
  | '/pesanan'
  | `/pesanan/${string}`
  | '/barang'
  | `/barang/${string}`
  | '/tracking'
  | '/galeri'
  | '/divisi'
  | '/pengambilan'
  | '/arsip'
  | '/laporan'
  | '/pengguna'
  | '/pengaturan'
  | '/spotting/dashboard'
  | '/ironing/dashboard'
  | '/packing/dashboard'
  | '/staff/beranda'
  | '/staff/antrean'
  | '/staff/cari'
  | '/staff/riwayat'
  | '/staff/profil'
  | `/staff/barang/${string}`
  | `/staff/checklist/${string}`
  | '/staff/kendala';

interface NavItem {
  label: string;
  path: AppRoute;
  icon: React.ReactNode;
}

const ADMIN_NAV: NavItem[] = [
  { label: 'Dashboard', path: '/admin/dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
  { label: 'Pesanan', path: '/pesanan', icon: <ClipboardList className="h-4 w-4" /> },
  { label: 'Data Barang', path: '/barang', icon: <Shirt className="h-4 w-4" /> },
  { label: 'Tracking', path: '/tracking', icon: <Route className="h-4 w-4" /> },
  { label: 'Galeri Foto', path: '/galeri', icon: <Images className="h-4 w-4" /> },
  { label: 'Divisi', path: '/divisi', icon: <Building2 className="h-4 w-4" /> },
  { label: 'Pengambilan', path: '/pengambilan', icon: <PackageCheck className="h-4 w-4" /> },
  { label: 'Arsip', path: '/arsip', icon: <Archive className="h-4 w-4" /> },
  { label: 'Laporan', path: '/laporan', icon: <BarChart3 className="h-4 w-4" /> },
  { label: 'Manajemen Pengguna', path: '/pengguna', icon: <Users className="h-4 w-4" /> },
  { label: 'Pengaturan', path: '/pengaturan', icon: <Settings className="h-4 w-4" /> },
];

function getStaffNav(role?: string): NavItem[] {
  const homePath: AppRoute =
    role === 'IRONING'
      ? '/ironing/dashboard'
      : role === 'PACKING'
      ? '/packing/dashboard'
      : '/spotting/dashboard';
  return [
    { label: 'Beranda', path: homePath, icon: <Home className="h-5 w-5" /> },
    { label: 'Antrean', path: '/staff/antrean', icon: <ClipboardList className="h-5 w-5" /> },
    { label: 'Cari Barang', path: '/staff/cari', icon: <Search className="h-5 w-5" /> },
    { label: 'Riwayat', path: '/staff/riwayat', icon: <History className="h-5 w-5" /> },
    { label: 'Profil', path: '/staff/profil', icon: <UserCircle className="h-5 w-5" /> },
  ];
}

export function AppShell({
  currentPath,
  onNavigate,
  children,
}: {
  currentPath: AppRoute;
  onNavigate: (path: AppRoute) => void;
  children: React.ReactNode;
}) {
  const { user, logout, toasts, dismissToast } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const isAdmin = user?.role === 'ADMIN';
  const navItems = isAdmin ? ADMIN_NAV : getStaffNav(user?.role);

  const { data: searchData } = useQuery({
    queryKey: ['global-search', searchTerm],
    queryFn: async () => {
      const res = await apiFetch<{
        garments: Array<{
          id: string;
          garmentCode: string;
          garmentName: string;
          physicalTagNumber: string;
          customerName: string;
          orderCode: string;
          currentStatus: string;
          thumbnailUrl: string | null;
        }>;
      }>(`/api/v1/search?q=${encodeURIComponent(searchTerm.trim())}`);
      return res.data;
    },
    enabled: searchTerm.trim().length >= 2,
  });

  const { data: openIssuesData } = useQuery({
    queryKey: ['header-open-issues'],
    queryFn: async () => {
      const res = await apiFetch<
        Array<{
          id: string;
          garmentId: string;
          garmentCode: string;
          garmentName: string;
          issueType: string;
          severity: string;
        }>
      >('/api/v1/issues?status=OPEN');
      return res.data;
    },
    refetchInterval: 45000,
  });

  const openIssuesCount = openIssuesData?.length ?? 0;

  const isActive = (itemPath: AppRoute) => {
    if (currentPath === itemPath) return true;
    if (itemPath === '/pesanan' && currentPath.startsWith('/pesanan/')) return true;
    if (itemPath === '/barang' && currentPath.startsWith('/barang/')) return true;
    if (itemPath === '/staff/antrean' && (currentPath.startsWith('/staff/barang/') || currentPath.startsWith('/staff/checklist/'))) {
      return true;
    }
    return false;
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#F5F8FC]">
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-white border-r border-slate-200/90 z-30">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
          <img
            src="/assets/aistudio/image_515944f0.png"
            alt="Logo ALMOS Laundry Detailing"
            className="h-10 w-10 rounded-xl object-cover shrink-0 shadow-xs"
          />
          <div className="min-w-0">
            <p className="text-sm font-bold text-[#12345A] tracking-tight truncate">
              ALMOS Laundry
            </p>
            <p className="text-[11px] text-slate-500 truncate">
              Detailing Tracking
            </p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const active = isActive(item.path);
            return (
              <button
                key={item.path}
                type="button"
                onClick={() => onNavigate(item.path)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-[#0756B8] text-white shadow-xs'
                    : 'text-[#12345A]/80 hover:bg-[#EAF3FF] hover:text-[#0756B8]'
                }`}
              >
                <span className={active ? 'text-white' : 'text-[#0756B8]'}>{item.icon}</span>
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-100">
          <div className="rounded-xl bg-[#F5F8FC] border border-slate-200/80 p-3">
            <p className="text-xs font-bold text-[#12345A] truncate">{user?.fullName}</p>
            <p className="text-[11px] text-[#0756B8] font-medium truncate">
              {user ? ROLE_LABELS[user.role] : ''}
            </p>
            <button
              type="button"
              onClick={logout}
              className="mt-2.5 w-full flex items-center justify-center gap-2 min-h-[36px] rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              Keluar
            </button>
          </div>
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="sticky top-0 z-20 h-14 bg-white/95 backdrop-blur-md border-b border-slate-200/90 px-3 sm:px-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {isAdmin && (
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Buka menu navigasi"
                className="lg:hidden min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-[#12345A] hover:bg-slate-100"
              >
                <Menu className="h-5 w-5" />
              </button>
            )}
            <div className="flex items-center gap-2 lg:hidden min-w-0">
              <img
                src="/assets/aistudio/image_515944f0.png"
                alt="ALMOS"
                className="h-8 w-8 rounded-lg object-cover shrink-0"
              />
              <span className="font-display font-bold text-sm text-[#12345A] truncate">
                ALMOS
              </span>
            </div>

            {/* Global Search Bar */}
            <div className="relative flex-1 max-w-md hidden sm:block">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 180)}
                placeholder="Cari tag fisik, kode barang, pesanan, pelanggan..."
                className="w-full h-9 pl-9 pr-3 rounded-xl bg-[#F5F8FC] border border-slate-200 text-xs sm:text-sm text-[#12345A] placeholder:text-slate-400 focus:outline-none focus:border-[#0756B8] focus:bg-white"
              />
              {searchFocused && searchTerm.trim().length >= 2 && (
                <div className="absolute left-0 right-0 mt-1.5 rounded-2xl bg-white border border-slate-200 shadow-xl p-2 z-50 max-h-80 overflow-y-auto">
                  {!searchData?.garments?.length ? (
                    <p className="p-3 text-xs text-slate-500 text-center">
                      Tidak ada barang yang cocok dengan "{searchTerm}".
                    </p>
                  ) : (
                    searchData.garments.map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        onMouseDown={() => {
                          setSearchTerm('');
                          onNavigate(isAdmin ? `/barang/${g.id}` : `/staff/barang/${g.id}`);
                        }}
                        className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-[#EAF3FF]/60 text-left transition-colors"
                      >
                        <div className="h-10 w-10 rounded-lg overflow-hidden bg-slate-100 shrink-0">
                          <AuthorizedImage src={g.thumbnailUrl} alt={g.garmentName} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-[#12345A] truncate">
                            {g.garmentName}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate font-mono">
                            Tag: {g.physicalTagNumber} · {g.orderCode} · {g.customerName}
                          </p>
                        </div>
                        <StatusBadge status={g.currentStatus} />
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Notification Bell for Open Issues */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen((v) => !v)}
                aria-label="Notifikasi kendala terbuka"
                className="relative min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border border-slate-200 bg-white text-[#12345A] hover:bg-[#EAF3FF]"
              >
                <Bell className="h-4 w-4" />
                {openIssuesCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#F7941D] text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                    {openIssuesCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-white border border-slate-200 shadow-xl p-3 z-50">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="text-xs font-bold text-[#12345A]">
                      Laporan Kendala Terbuka ({openIssuesCount})
                    </span>
                    <button
                      type="button"
                      onClick={() => setNotifOpen(false)}
                      className="text-xs text-slate-400 hover:text-slate-700"
                    >
                      Tutup
                    </button>
                  </div>
                  <div className="mt-2 space-y-2 max-h-64 overflow-y-auto">
                    {openIssuesCount === 0 ? (
                      <p className="text-xs text-slate-500 py-3 text-center">
                        Tidak ada kendala terbuka saat ini.
                      </p>
                    ) : (
                      openIssuesData?.map((iss) => (
                        <button
                          key={iss.id}
                          type="button"
                          onClick={() => {
                            setNotifOpen(false);
                            onNavigate(
                              isAdmin ? `/barang/${iss.garmentId}` : `/staff/barang/${iss.garmentId}`
                            );
                          }}
                          className="w-full text-left p-2 rounded-xl bg-[#FFF3E4]/60 hover:bg-[#FFF3E4] transition-colors"
                        >
                          <p className="text-xs font-semibold text-[#12345A] truncate">
                            {iss.garmentName}
                          </p>
                          <p className="text-[11px] text-[#B45309] font-mono">
                            {iss.garmentCode} · {iss.severity}
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => onNavigate(isAdmin ? '/pengaturan' : '/staff/profil')}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50"
            >
              <span className="h-6 w-6 rounded-lg bg-[#0756B8] text-white text-xs font-bold flex items-center justify-center">
                {user?.fullName.slice(0, 1).toUpperCase()}
              </span>
              <span className="text-xs font-semibold text-[#12345A] max-w-[120px] truncate">
                {user?.fullName}
              </span>
            </button>
          </div>
        </header>

        {/* Page Viewport */}
        <main className={`flex-1 p-4 sm:p-6 ${isAdmin ? 'pb-8' : 'pb-24 lg:pb-8'}`}>
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>

      {/* Staff Mobile Bottom Navigation (15% Sticky Cap: 56px header + 64px bottom = 120px) */}
      {!isAdmin && (
        <nav
          aria-label="Navigasi Utama Staf"
          className="lg:hidden fixed bottom-0 left-0 right-0 z-30 h-16 bg-white/95 backdrop-blur-md border-t border-slate-200 grid grid-cols-5 items-center px-1"
        >
          {getStaffNav(user?.role).map((item) => {
            const active = isActive(item.path);
            return (
              <button
                key={item.path}
                type="button"
                onClick={() => onNavigate(item.path)}
                className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 rounded-xl transition-colors ${
                  active ? 'text-[#0756B8]' : 'text-slate-500 hover:text-[#12345A]'
                }`}
              >
                {item.icon}
                <span className="text-[10px] font-semibold tracking-tight whitespace-nowrap">
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>
      )}

      {/* Admin Mobile Drawer */}
      {isAdmin && mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-[#12345A]/50 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-72 max-w-[85vw] bg-white h-full flex flex-col z-10 shadow-2xl">
            <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <img
                  src="/assets/aistudio/image_515944f0.png"
                  alt="ALMOS"
                  className="h-9 w-9 rounded-xl object-cover"
                />
                <div>
                  <p className="text-sm font-bold text-[#12345A]">ALMOS Laundry</p>
                  <p className="text-[11px] text-slate-500">{user ? ROLE_LABELS[user.role] : ''}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
              {ADMIN_NAV.map((item) => {
                const active = isActive(item.path);
                return (
                  <button
                    key={item.path}
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onNavigate(item.path);
                    }}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium min-h-[44px] ${
                      active
                        ? 'bg-[#0756B8] text-white'
                        : 'text-[#12345A] hover:bg-[#EAF3FF]'
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="p-3 border-t border-slate-100">
              <button
                type="button"
                onClick={logout}
                className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 text-sm font-semibold text-red-700"
              >
                <LogOut className="h-4 w-4" />
                Keluar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Stack */}
      {toasts.length > 0 && (
        <div className="fixed bottom-20 lg:bottom-5 right-4 z-50 space-y-2 max-w-sm w-[calc(100%-2rem)]">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`rounded-xl border px-4 py-3 shadow-lg flex items-start justify-between gap-3 text-sm ${
                t.type === 'error'
                  ? 'bg-red-50 border-red-200 text-red-900'
                  : t.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-white border-slate-200 text-[#12345A]'
              }`}
            >
              <span className="leading-snug">{t.message}</span>
              <button
                type="button"
                onClick={() => dismissToast(t.id)}
                className="text-xs opacity-60 hover:opacity-100 shrink-0"
              >
                Tutup
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
