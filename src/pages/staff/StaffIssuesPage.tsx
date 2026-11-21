import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight, CheckCircle2, Tag } from 'lucide-react';
import { useState } from 'react';
import type { AppRoute } from '../../components/layout/AppShell.tsx';
import {
  EmptyState,
  ErrorBanner,
  LoadingSkeleton,
  StatusBadge,
} from '../../components/ui/Primitives.tsx';
import { apiFetch } from '../../lib/api.ts';
import {
  formatDateTime,
  ISSUE_SEVERITY_LABELS,
  ISSUE_TYPE_LABELS,
} from '../../lib/labels.ts';
import type { IssueSeverity, IssueType, ResolutionStatus } from '../../shared/types.ts';

interface IssueListItem {
  id: string;
  garmentId: string;
  garmentCode: string;
  garmentName: string;
  physicalTagNumber: string;
  orderCode: string;
  customerName: string;
  department: string;
  issueType: IssueType;
  severity: IssueSeverity;
  description: string;
  putsGarmentOnHold: boolean;
  resolutionStatus: ResolutionStatus;
  reportedByName: string;
  resolutionNotes: string | null;
  createdAt: string;
}

export function StaffIssuesPage({ onNavigate }: { onNavigate: (p: AppRoute) => void }) {
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'RESOLVED'>('OPEN');

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['staff-issues', statusFilter],
    queryFn: async () => {
      const qs = statusFilter === 'ALL' ? '' : `?status=${statusFilter}`;
      const res = await apiFetch<IssueListItem[]>(`/api/v1/issues${qs}`);
      return res.data;
    },
  });

  const issues = data ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-[#12345A] font-display">
          Kendala Barang Divisi
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Daftar laporan noda membandel, kerusakan kain, atau tag hilang di divisi Anda.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-1.5 bg-white border border-slate-200 p-1.5 rounded-2xl">
        {[
          { value: 'OPEN' as const, label: 'Terbuka' },
          { value: 'RESOLVED' as const, label: 'Selesai' },
          { value: 'ALL' as const, label: 'Semua' },
        ].map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setStatusFilter(opt.value)}
            className={`min-h-[40px] rounded-xl text-xs font-semibold transition-colors ${
              statusFilter === opt.value
                ? 'bg-[#0756B8] text-white'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <LoadingSkeleton rows={4} />
      ) : isError ? (
        <ErrorBanner
          message={error instanceof Error ? error.message : 'Gagal memuat daftar kendala.'}
          onRetry={() => refetch()}
        />
      ) : issues.length === 0 ? (
        <EmptyState
          title="Tidak ada laporan kendala"
          description="Belum ada kendala yang tercatat pada filter status ini."
          icon={<CheckCircle2 className="h-6 w-6" />}
        />
      ) : (
        <div className="space-y-3">
          {issues.map((iss) => (
            <button
              key={iss.id}
              type="button"
              onClick={() => onNavigate(`/staff/barang/${iss.garmentId}`)}
              className="w-full text-left rounded-2xl bg-white border border-slate-200/90 p-4 shadow-xs hover:border-[#0756B8]/40 transition-colors flex items-start justify-between gap-3"
            >
              <div className="min-w-0 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#EAF3FF] text-[#0756B8] font-mono text-xs font-bold">
                    <Tag className="h-3 w-3" /> {iss.physicalTagNumber}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#FFF3E4] text-[#B45309] text-xs font-semibold">
                    <AlertTriangle className="h-3 w-3" />
                    {ISSUE_TYPE_LABELS[iss.issueType]} ({ISSUE_SEVERITY_LABELS[iss.severity]})
                  </span>
                  {iss.putsGarmentOnHold && <StatusBadge status="ON_HOLD" />}
                </div>
                <p className="text-sm font-bold text-[#12345A]">{iss.garmentName}</p>
                <p className="text-xs text-slate-600">{iss.description}</p>
                {iss.resolutionNotes && (
                  <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1">
                    Solusi Admin: {iss.resolutionNotes}
                  </p>
                )}
                <p className="text-[11px] text-slate-400">
                  {iss.customerName} · Pelapor: {iss.reportedByName} · {formatDateTime(iss.createdAt)}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400 shrink-0 mt-1" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
