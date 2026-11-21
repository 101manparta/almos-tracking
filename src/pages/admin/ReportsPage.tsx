import { useQuery } from '@tanstack/react-query';
import { BarChart3 } from 'lucide-react';
import { EmptyState, ErrorBanner, LoadingSkeleton } from '../../components/ui/Primitives.tsx';
import { apiFetch } from '../../lib/api.ts';
import {
  GARMENT_STATUS_LABELS,
  ISSUE_TYPE_LABELS,
  ORDER_CATEGORY_LABELS,
} from '../../lib/labels.ts';
import type { GarmentStatus, IssueType, OrderCategory } from '../../shared/types.ts';

interface CompletedReport {
  statusBreakdown: Array<{ status: GarmentStatus; total: number }>;
  categoryBreakdown: Array<{ category: OrderCategory; orderCount: number }>;
  issueSummary: Array<{ issueType: IssueType; resolutionStatus: string; total: number }>;
}

export function ReportsPage() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['reports-completed'],
    queryFn: async () => {
      const res = await apiFetch<CompletedReport>('/api/v1/reports/completed');
      return res.data;
    },
  });

  if (isLoading) return <LoadingSkeleton rows={5} />;
  if (isError) {
    return (
      <ErrorBanner
        message={error instanceof Error ? error.message : 'Gagal memuat laporan operasional.'}
        onRetry={() => refetch()}
      />
    );
  }

  const hasData =
    (data?.statusBreakdown.length ?? 0) > 0 || (data?.categoryBreakdown.length ?? 0) > 0;
  const maxStatus = Math.max(1, ...(data?.statusBreakdown.map((s) => s.total) || [1]));
  const maxCat = Math.max(1, ...(data?.categoryBreakdown.map((c) => c.orderCount) || [1]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#12345A]">Laporan Operasional ALMOS</h1>
        <p className="text-sm text-slate-500">
          Statistik langsung dari database PostgreSQL mengenai distribusi status barang, kategori
          pesanan, dan laporan kendala.
        </p>
      </div>

      {!hasData ? (
        <EmptyState
          title="Belum ada data laporan."
          description="Grafik dan rincian operasional akan muncul secara otomatis setelah pesanan dan barang didaftarkan."
          icon={<BarChart3 className="h-6 w-6" />}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="rounded-2xl bg-white border border-slate-200/90 p-5 shadow-xs">
            <h2 className="text-base font-bold text-[#12345A] mb-4">
              Distribusi Status Barang
            </h2>
            <div className="space-y-3">
              {data?.statusBreakdown.map((row) => (
                <div key={row.status}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-[#12345A]">
                      {GARMENT_STATUS_LABELS[row.status] || row.status}
                    </span>
                    <span className="font-mono font-bold tabular-nums text-[#0756B8]">
                      {row.total}
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-[#F5F8FC] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#0756B8]"
                      style={{ width: `${Math.max(6, Math.round((row.total / maxStatus) * 100))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-white border border-slate-200/90 p-5 shadow-xs">
            <h2 className="text-base font-bold text-[#12345A] mb-4">
              Pesanan per Kategori Pelanggan / Vendor
            </h2>
            <div className="space-y-3">
              {data?.categoryBreakdown.map((row) => (
                <div key={row.category}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-[#12345A]">
                      {ORDER_CATEGORY_LABELS[row.category] || row.category}
                    </span>
                    <span className="font-mono font-bold tabular-nums text-[#F7941D]">
                      {row.orderCount}
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-[#F5F8FC] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#F7941D]"
                      style={{
                        width: `${Math.max(6, Math.round((row.orderCount / maxCat) * 100))}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2 rounded-2xl bg-white border border-slate-200/90 p-5 shadow-xs">
            <h2 className="text-base font-bold text-[#12345A] mb-3">Ringkasan Laporan Kendala</h2>
            {!data?.issueSummary.length ? (
              <p className="text-sm text-slate-500">Belum ada catatan kendala yang tercatat.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {data.issueSummary.map((iss, idx) => (
                  <div
                    key={`${iss.issueType}-${iss.resolutionStatus}-${idx}`}
                    className="rounded-xl bg-[#F5F8FC] border border-slate-200/80 p-3.5"
                  >
                    <p className="text-xs font-bold text-[#12345A]">
                      {ISSUE_TYPE_LABELS[iss.issueType] || iss.issueType}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">Status: {iss.resolutionStatus}</p>
                    <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-[#0756B8]">
                      {iss.total}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
