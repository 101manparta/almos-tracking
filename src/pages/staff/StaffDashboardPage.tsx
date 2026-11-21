import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Clock,
  PauseCircle,
  PlayCircle,
  Search,
  Tag,
} from 'lucide-react';
import type { AppRoute } from '../../components/layout/AppShell.tsx';
import {
  AuthorizedImage,
  EmptyState,
  ErrorBanner,
  LoadingSkeleton,
  StatCard,
  StatusBadge,
} from '../../components/ui/Primitives.tsx';
import { useAuth } from '../../contexts/AuthContext.tsx';
import { apiFetch } from '../../lib/api.ts';
import { formatDateTime, ROLE_LABELS } from '../../lib/labels.ts';

interface StaffDashboardSummary {
  waiting: number;
  inProgress: number;
  onHold: number;
  completedToday: number;
}

interface QueueGarment {
  id: string;
  garmentCode: string;
  garmentName: string;
  physicalTagNumber: string;
  tagStatus: string;
  color: string;
  brand: string | null;
  currentStatus: string;
  dueAt: string | null;
  orderCode: string;
  customerName: string;
  thumbnailUrl: string | null;
}

export function StaffDashboardPage({ onNavigate }: { onNavigate: (p: AppRoute) => void }) {
  const { user } = useAuth();

  const summaryQuery = useQuery({
    queryKey: ['staff-dashboard'],
    queryFn: async () => {
      const res = await apiFetch<StaffDashboardSummary>('/api/v1/staff/dashboard');
      return res.data;
    },
  });

  const activeQueueQuery = useQuery({
    queryKey: ['staff-queue', 'IN_PROGRESS'],
    queryFn: async () => {
      const res = await apiFetch<QueueGarment[]>('/api/v1/staff/queue?status=IN_PROGRESS');
      return res.data;
    },
  });

  const waitingQueueQuery = useQuery({
    queryKey: ['staff-queue', 'WAITING'],
    queryFn: async () => {
      const res = await apiFetch<QueueGarment[]>('/api/v1/staff/queue?status=WAITING');
      return res.data;
    },
  });

  if (summaryQuery.isLoading) return <LoadingSkeleton rows={5} />;
  if (summaryQuery.isError) {
    return (
      <ErrorBanner
        message={
          summaryQuery.error instanceof Error
            ? summaryQuery.error.message
            : 'Gagal memuat ringkasan tugas staf.'
        }
        onRetry={() => summaryQuery.refetch()}
      />
    );
  }

  const summary = summaryQuery.data!;
  const inProgressItems = activeQueueQuery.data ?? [];
  const nextWaitingItems = (waitingQueueQuery.data ?? []).slice(0, 4);

  return (
    <div className="space-y-5">
      {/* Hero Banner */}
      <div
        className="rounded-2xl p-5 sm:p-6 text-white shadow-sm"
        style={{
          background: 'linear-gradient(135deg, #0756B8 0%, #2474D8 65%, #12345A 100%)',
        }}
      >
        <p className="text-xs font-semibold uppercase tracking-wider text-blue-100">
          {user ? ROLE_LABELS[user.role] : 'Staf Operasional'}
        </p>
        <h1 className="mt-1 text-xl sm:text-2xl font-bold font-display">
          Halo, {user?.fullName}
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-blue-100/90">
          Cocokkan nomor tag fisik & foto referensi sebelum memulai pengerjaan barang.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => onNavigate('/staff/antrean')}
            className="min-h-[46px] rounded-xl bg-white text-[#0756B8] font-semibold text-sm px-4 flex items-center justify-center gap-2 shadow-xs hover:bg-blue-50 transition-colors"
          >
            <ClipboardList className="h-4 w-4" />
            Buka Antrean
          </button>
          <button
            type="button"
            onClick={() => onNavigate('/staff/cari')}
            className="min-h-[46px] rounded-xl bg-[#F7941D] text-white font-semibold text-sm px-4 flex items-center justify-center gap-2 shadow-xs hover:bg-[#e08212] transition-colors"
          >
            <Search className="h-4 w-4" />
            Cari Barang
          </button>
        </div>
      </div>

      {/* KPI Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Menunggu"
          value={summary.waiting}
          tone="orange"
          icon={<Clock className="h-5 w-5 text-[#B45309]" />}
          onClick={() => onNavigate('/staff/antrean')}
        />
        <StatCard
          label="Sedang Dikerjakan"
          value={summary.inProgress}
          tone="primary"
          icon={<PlayCircle className="h-5 w-5 text-[#0756B8]" />}
          onClick={() => onNavigate('/staff/antrean')}
        />
        <StatCard
          label="Selesai Hari Ini"
          value={summary.completedToday}
          tone="success"
          icon={<CheckCircle2 className="h-5 w-5 text-emerald-700" />}
          onClick={() => onNavigate('/staff/riwayat')}
        />
        <StatCard
          label="On Hold"
          value={summary.onHold}
          tone={summary.onHold > 0 ? 'danger' : 'default'}
          icon={<PauseCircle className="h-5 w-5 text-red-600" />}
          onClick={() => onNavigate('/staff/kendala')}
        />
      </div>

      {/* In-Progress Quick Resume */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-[#12345A]">Sedang Dikerjakan</h2>
          <button
            type="button"
            onClick={() => onNavigate('/staff/antrean')}
            className="text-xs font-semibold text-[#0756B8] hover:underline flex items-center gap-1"
          >
            Semua Antrean <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {inProgressItems.length === 0 ? (
          <EmptyState
            title="Belum ada barang yang sedang dikerjakan"
            description="Pilih barang dari daftar menunggu di bawah untuk memulai proses pengerjaan."
            icon={<PlayCircle className="h-6 w-6" />}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {inProgressItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(`/staff/barang/${item.id}`)}
                className="w-full text-left rounded-2xl bg-white border border-[#0756B8]/30 p-3.5 shadow-xs hover:shadow-md transition-all flex items-center gap-3.5"
              >
                <div className="h-16 w-16 rounded-xl overflow-hidden bg-slate-100 shrink-0">
                  <AuthorizedImage src={item.thumbnailUrl} alt={item.garmentName} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 text-xs font-mono font-bold text-[#0756B8] bg-[#EAF3FF] px-2 py-0.5 rounded-md">
                      <Tag className="h-3 w-3" /> {item.physicalTagNumber}
                    </span>
                    <StatusBadge status={item.currentStatus} />
                  </div>
                  <p className="mt-1 text-sm font-bold text-[#12345A] truncate">
                    {item.garmentName}
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    {item.customerName} · {item.orderCode}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Next Waiting Queue Preview */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-[#12345A]">Antrean Menunggu Berikutnya</h2>
          <button
            type="button"
            onClick={() => onNavigate('/staff/kendala')}
            className="text-xs font-semibold text-[#B45309] hover:underline flex items-center gap-1"
          >
            <AlertTriangle className="h-3.5 w-3.5" /> Kendala Divisi
          </button>
        </div>

        {nextWaitingItems.length === 0 ? (
          <EmptyState
            title="Antrean menunggu kosong"
            description="Saat ini tidak ada barang baru yang menunggu di divisi Anda."
            icon={<ClipboardList className="h-6 w-6" />}
          />
        ) : (
          <div className="space-y-2.5">
            {nextWaitingItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(`/staff/barang/${item.id}`)}
                className="w-full text-left rounded-2xl bg-white border border-slate-200/90 p-3.5 hover:border-[#0756B8]/40 transition-colors flex items-center gap-3.5"
              >
                <div className="h-14 w-14 rounded-xl overflow-hidden bg-slate-100 shrink-0">
                  <AuthorizedImage src={item.thumbnailUrl} alt={item.garmentName} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono font-bold text-[#12345A] bg-slate-100 px-2 py-0.5 rounded-md">
                      Tag {item.physicalTagNumber}
                    </span>
                    {item.tagStatus === 'MISSING' && (
                      <span className="text-[11px] font-semibold text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">
                        Tag Hilang
                      </span>
                    )}
                    <StatusBadge status={item.currentStatus} />
                  </div>
                  <p className="mt-1 text-sm font-semibold text-[#12345A] truncate">
                    {item.garmentName} ({item.color})
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    {item.customerName} · Target: {formatDateTime(item.dueAt)}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-400 shrink-0" />
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
