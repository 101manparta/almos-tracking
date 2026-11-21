import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  Layers,
  PackageCheck,
  PauseCircle,
  Plus,
  Shirt,
} from 'lucide-react';
import { useState } from 'react';
import type { AppRoute } from '../../components/layout/AppShell.tsx';
import {
  EmptyState,
  ErrorBanner,
  LoadingSkeleton,
  StatCard,
  StatusBadge,
} from '../../components/ui/Primitives.tsx';
import { apiFetch } from '../../lib/api.ts';
import { DEPARTMENT_LABELS, formatDateTime } from '../../lib/labels.ts';

interface OverviewResponse {
  counts: {
    totalActiveGarments: number;
    waitingGarments: number;
    inProgressGarments: number;
    readyForPickupGarments: number;
    onHoldGarments: number;
    ordersAwaitingPickup: number;
    ordersActive: number;
    ordersArchived: number;
    openIssues: number;
  };
  departments: {
    SPOTTING: number;
    IRONING: number;
    PACKING: number;
  };
  delayedGarments: Array<{
    id: string;
    garmentCode: string;
    garmentName: string;
    physicalTagNumber: string;
    currentDepartment: string;
    currentStatus: string;
    dueAt: string;
    orderCode: string;
    customerName: string;
  }>;
  onHoldGarments: Array<{
    id: string;
    garmentCode: string;
    garmentName: string;
    physicalTagNumber: string;
    currentDepartment: string;
    orderCode: string;
    customerName: string;
    updatedAt: string;
  }>;
  recentActivities: Array<{
    id: string;
    garmentId: string;
    previousStatus: string;
    newStatus: string;
    fromDepartment: string | null;
    toDepartment: string | null;
    notes: string | null;
    createdAt: string;
    garmentCode: string;
    garmentName: string;
    physicalTagNumber: string;
    performedByName: string;
  }>;
}

export function AdminDashboardPage({ onNavigate }: { onNavigate: (p: AppRoute) => void }) {
  const [creatingOrderRedirect] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin-overview'],
    queryFn: async () => {
      const res = await apiFetch<OverviewResponse>('/api/v1/reports/overview');
      return res.data;
    },
  });

  if (isLoading) return <LoadingSkeleton rows={6} />;
  if (isError) {
    return (
      <ErrorBanner
        message={error instanceof Error ? error.message : 'Gagal memuat ringkasan operasional.'}
        onRetry={() => refetch()}
      />
    );
  }

  const c = data!.counts;
  const maxDept = Math.max(
    1,
    data!.departments.SPOTTING,
    data!.departments.IRONING,
    data!.departments.PACKING
  );

  const isEmptySystem =
    c.totalActiveGarments === 0 && c.ordersActive === 0 && c.ordersArchived === 0;

  return (
    <div className="space-y-6">
      {/* Top Hero Header */}
      <div className="rounded-3xl almos-gradient-primary p-5 sm:p-7 border border-[#0756B8]/15 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-white/90 uppercase tracking-wider">
            Ringkasan Operasional Real-Time
          </p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-bold text-white">
            Dashboard ALMOS Laundry Detailing
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-white/90">
            Pantau antrean divisi, tag fisik barang, kendala operasional, dan kesiapan pengambilan.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            disabled={creatingOrderRedirect}
            onClick={() => onNavigate('/pesanan')}
            className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#F7941D] hover:bg-[#e08312] text-white text-sm font-semibold shadow-sm inline-flex items-center gap-2 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Kelola & Buat Pesanan
          </button>
        </div>
      </div>

      {isEmptySystem ? (
        <EmptyState
          title="Belum ada data pesanan."
          description="Pesanan baru akan muncul di sini setelah didaftarkan. Mulailah dengan membuat pesanan pelanggan atau vendor pertama Anda."
          icon={<Shirt className="h-6 w-6" />}
          action={
            <button
              type="button"
              onClick={() => onNavigate('/pesanan')}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#0756B8] hover:bg-[#064596] text-white text-sm font-semibold inline-flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Daftarkan Pesanan Pertama
            </button>
          }
        />
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
            <StatCard
              label="Total Barang Aktif"
              value={c.totalActiveGarments}
              tone="primary"
              icon={<Shirt className="h-5 w-5 text-[#0756B8]" />}
              onClick={() => onNavigate('/barang')}
            />
            <StatCard
              label="Menunggu Proses"
              value={c.waitingGarments}
              tone="orange"
              icon={<Clock className="h-5 w-5 text-[#F7941D]" />}
              onClick={() => onNavigate('/divisi')}
            />
            <StatCard
              label="Sedang Dikerjakan"
              value={c.inProgressGarments}
              icon={<Layers className="h-5 w-5 text-[#0756B8]" />}
              onClick={() => onNavigate('/tracking')}
            />
            <StatCard
              label="Barang Siap Diambil"
              value={c.readyForPickupGarments}
              tone="success"
              icon={<PackageCheck className="h-5 w-5 text-emerald-700" />}
              onClick={() => onNavigate('/pengambilan')}
            />
            <StatCard
              label="Ditahan (On Hold)"
              value={c.onHoldGarments}
              tone={c.onHoldGarments > 0 ? 'danger' : 'default'}
              icon={<PauseCircle className="h-5 w-5 text-red-600" />}
              onClick={() => onNavigate('/divisi')}
            />
            <StatCard
              label="Pesanan Siap Diambil"
              value={c.ordersAwaitingPickup}
              sublabel={`${c.ordersArchived} diarsipkan`}
              icon={<PackageCheck className="h-5 w-5 text-[#0756B8]" />}
              onClick={() => onNavigate('/pengambilan')}
            />
          </div>

          {/* Department Workload & Delayed / Hold Alerts */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Department Workload Chart Card */}
            <div className="lg:col-span-5 rounded-2xl bg-white border border-slate-200/90 p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-bold text-[#12345A]">Beban Kerja Divisi</h2>
                  <p className="text-xs text-slate-500">
                    Jumlah barang aktif di setiap stasiun kerja saat ini
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('/divisi')}
                  className="text-xs font-semibold text-[#0756B8] hover:underline inline-flex items-center gap-1"
                >
                  Detail Divisi <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="space-y-4">
                {(
                  [
                    { key: 'SPOTTING', label: 'Spotting', color: 'bg-[#0756B8]' },
                    { key: 'IRONING', label: 'Ironing', color: 'bg-[#3D8BE8]' },
                    { key: 'PACKING', label: 'Packing', color: 'bg-[#F7941D]' },
                  ] as const
                ).map((dept) => {
                  const val = data!.departments[dept.key];
                  const pct = Math.round((val / maxDept) * 100);
                  return (
                    <div key={dept.key}>
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="font-semibold text-[#12345A]">{dept.label}</span>
                        <span className="font-mono font-bold tabular-nums text-[#12345A]">
                          {val} barang
                        </span>
                      </div>
                      <div className="h-3 w-full rounded-full bg-[#F5F8FC] overflow-hidden border border-slate-100">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${dept.color}`}
                          style={{ width: `${val === 0 ? 0 : Math.max(8, pct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Delayed & On Hold Monitoring */}
            <div className="lg:col-span-7 rounded-2xl bg-white border border-slate-200/90 p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-bold text-[#12345A]">
                    Pemantauan Keterlambatan & On Hold
                  </h2>
                  <p className="text-xs text-slate-500">
                    Barang melewati batas waktu estimasi atau ditahan karena kendala
                  </p>
                </div>
              </div>

              {data!.delayedGarments.length === 0 && data!.onHoldGarments.length === 0 ? (
                <div className="rounded-xl bg-[#F5F8FC] border border-slate-200/70 p-6 text-center">
                  <p className="text-sm font-medium text-[#12345A]">
                    Tidak ada barang terlambat atau ditahan saat ini.
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Seluruh antrean berjalan sesuai jadwal estimasi.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                  {data!.onHoldGarments.map((g) => (
                    <button
                      key={`hold-${g.id}`}
                      type="button"
                      onClick={() => onNavigate(`/barang/${g.id}`)}
                      className="w-full text-left rounded-xl border border-red-200 bg-red-50/50 hover:bg-red-50 p-3 flex items-center justify-between gap-3 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                          <p className="text-sm font-semibold text-[#12345A] truncate">
                            {g.garmentName}
                          </p>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-600 font-mono truncate">
                          Tag: {g.physicalTagNumber} · {g.orderCode} · {g.customerName}
                        </p>
                      </div>
                      <StatusBadge status="ON_HOLD" />
                    </button>
                  ))}

                  {data!.delayedGarments.map((g) => (
                    <button
                      key={`delay-${g.id}`}
                      type="button"
                      onClick={() => onNavigate(`/barang/${g.id}`)}
                      className="w-full text-left rounded-xl border border-[#F7941D]/30 bg-[#FFF3E4]/50 hover:bg-[#FFF3E4] p-3 flex items-center justify-between gap-3 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#12345A] truncate">
                          {g.garmentName}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-600 font-mono truncate">
                          Tag: {g.physicalTagNumber} · Batas: {formatDateTime(g.dueAt)}
                        </p>
                      </div>
                      <StatusBadge status={g.currentStatus} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recent Activity Feed */}
          <div className="rounded-2xl bg-white border border-slate-200/90 p-5 shadow-xs">
            <h2 className="text-base font-bold text-[#12345A] mb-3">Aktivitas Terbaru</h2>
            {data!.recentActivities.length === 0 ? (
              <p className="text-sm text-slate-500 py-4">Belum ada riwayat perpindahan status.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {data!.recentActivities.map((act) => (
                  <button
                    key={act.id}
                    type="button"
                    onClick={() => onNavigate(`/barang/${act.garmentId}`)}
                    className="w-full py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-left hover:bg-[#F5F8FC] px-2 -mx-2 rounded-xl transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#12345A] truncate">
                        {act.garmentName}{' '}
                        <span className="font-mono text-xs font-normal text-slate-500">
                          (Tag {act.physicalTagNumber})
                        </span>
                      </p>
                      <p className="text-xs text-slate-600 mt-0.5">
                        {act.notes ||
                          `${act.fromDepartment ? DEPARTMENT_LABELS[act.fromDepartment as keyof typeof DEPARTMENT_LABELS] || act.fromDepartment : ''} → ${act.toDepartment || ''}`}
                        {' · '}
                        <span className="font-medium text-[#0756B8]">{act.performedByName}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <StatusBadge status={act.newStatus} />
                      <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                        {formatDateTime(act.createdAt)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
