import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { useState } from 'react';
import type { AppRoute } from '../../components/layout/AppShell.tsx';
import {
  ErrorBanner,
  LoadingSkeleton,
  Modal,
  StatusBadge,
} from '../../components/ui/Primitives.tsx';
import { useAuth } from '../../contexts/AuthContext.tsx';
import { apiFetch, ApiClientError } from '../../lib/api.ts';
import { ISSUE_SEVERITY_LABELS, ISSUE_TYPE_LABELS } from '../../lib/labels.ts';
import type { IssueSeverity, IssueType } from '../../shared/types.ts';

interface DeptMetric {
  department: 'SPOTTING' | 'IRONING' | 'PACKING';
  waiting: number;
  inProgress: number;
  onHold: number;
  delayed: number;
}

interface IssueItem {
  id: string;
  garmentId: string;
  department: string;
  issueType: IssueType;
  severity: IssueSeverity;
  description: string;
  resolutionStatus: string;
  garmentCode: string;
  garmentName: string;
  physicalTagNumber: string;
  orderCode: string;
  customerName: string;
  reportedByName: string;
}

export function DepartmentsPage({ onNavigate }: { onNavigate: (p: AppRoute) => void }) {
  const { notify } = useAuth();
  const queryClient = useQueryClient();
  const [resolveTarget, setResolveTarget] = useState<IssueItem | null>(null);
  const [resolveNotes, setResolveNotes] = useState('');

  const { data: depts, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['report-departments'],
    queryFn: async () => {
      const res = await apiFetch<DeptMetric[]>('/api/v1/reports/departments');
      return res.data;
    },
  });

  const { data: issues } = useQuery({
    queryKey: ['issues-list'],
    queryFn: async () => {
      const res = await apiFetch<IssueItem[]>('/api/v1/issues?status=OPEN');
      return res.data;
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async () => {
      if (!resolveTarget) return;
      return apiFetch(`/api/v1/issues/${resolveTarget.id}/resolve`, {
        method: 'PATCH',
        body: JSON.stringify({ resolutionNotes: resolveNotes }),
      });
    },
    onSuccess: () => {
      setResolveTarget(null);
      setResolveNotes('');
      queryClient.invalidateQueries({ queryKey: ['issues-list'] });
      queryClient.invalidateQueries({ queryKey: ['header-open-issues'] });
      queryClient.invalidateQueries({ queryKey: ['report-departments'] });
      notify('success', 'Laporan kendala ditandai selesai.');
    },
    onError: (err) => {
      notify('error', err instanceof ApiClientError ? err.message : 'Gagal menyelesaikan kendala.');
    },
  });

  if (isLoading) return <LoadingSkeleton rows={4} />;
  if (isError) {
    return (
      <ErrorBanner
        message={error instanceof Error ? error.message : 'Gagal memuat pemantauan divisi.'}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#12345A]">Pemantauan Divisi Operasional</h1>
        <p className="text-sm text-slate-500">
          Pantau antrean per departemen (Spotting, Ironing, Packing) serta selesaikan laporan
          kendala.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {depts?.map((d) => (
          <div
            key={d.department}
            className="rounded-2xl bg-white border border-slate-200/90 p-5 shadow-xs space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#12345A]">Divisi {d.department}</h2>
              <span className="text-xs font-mono font-bold text-[#0756B8] tabular-nums">
                {d.waiting + d.inProgress + d.onHold} total
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="rounded-xl bg-[#FFF3E4]/70 p-3">
                <p className="text-[#B45309]">Menunggu</p>
                <p className="mt-1 text-xl font-bold font-mono tabular-nums text-[#12345A]">
                  {d.waiting}
                </p>
              </div>
              <div className="rounded-xl bg-[#EAF3FF]/80 p-3">
                <p className="text-[#0756B8]">Diproses</p>
                <p className="mt-1 text-xl font-bold font-mono tabular-nums text-[#12345A]">
                  {d.inProgress}
                </p>
              </div>
              <div className="rounded-xl bg-red-50 p-3">
                <p className="text-red-700">On Hold</p>
                <p className="mt-1 text-xl font-bold font-mono tabular-nums text-red-800">
                  {d.onHold}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-slate-500 flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Terlambat
                </p>
                <p className="mt-1 text-xl font-bold font-mono tabular-nums text-[#12345A]">
                  {d.delayed}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Open Issues Queue */}
      <div className="rounded-2xl bg-white border border-slate-200/90 p-5 shadow-xs">
        <h2 className="text-base font-bold text-[#12345A] mb-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-[#F7941D]" />
          Laporan Kendala Terbuka ({issues?.length ?? 0})
        </h2>

        {!issues?.length ? (
          <div className="rounded-xl bg-[#F5F8FC] p-6 text-center text-sm text-slate-500">
            <CheckCircle2 className="h-6 w-6 text-emerald-600 mx-auto mb-2" />
            Tidak ada kendala terbuka yang perlu ditindaklanjuti.
          </div>
        ) : (
          <div className="space-y-3">
            {issues.map((iss) => (
              <div
                key={iss.id}
                className="rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-bold text-[#B45309]">
                      {ISSUE_TYPE_LABELS[iss.issueType]} ({ISSUE_SEVERITY_LABELS[iss.severity]})
                    </span>
                    <span className="text-slate-300">·</span>
                    <span className="font-mono text-[#0756B8]">Tag {iss.physicalTagNumber}</span>
                    <span className="text-slate-300">·</span>
                    <span className="text-slate-500">Divisi {iss.department}</span>
                  </div>
                  <p className="mt-1 text-sm font-bold text-[#12345A]">{iss.garmentName}</p>
                  <p className="mt-0.5 text-xs text-slate-600">{iss.description}</p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Dilaporkan oleh {iss.reportedByName} · {iss.customerName} ({iss.orderCode})
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge status={iss.resolutionStatus} />
                  <button
                    type="button"
                    onClick={() => onNavigate(`/barang/${iss.garmentId}`)}
                    className="min-h-[38px] px-3 rounded-xl border border-slate-200 text-xs font-semibold text-[#12345A] hover:bg-slate-50"
                  >
                    Buka Barang
                  </button>
                  <button
                    type="button"
                    onClick={() => setResolveTarget(iss)}
                    className="min-h-[38px] px-3 rounded-xl bg-[#0756B8] text-white text-xs font-semibold"
                  >
                    Selesaikan
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={Boolean(resolveTarget)}
        onClose={() => setResolveTarget(null)}
        title="Selesaikan Laporan Kendala"
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600">
            Barang: <span className="font-bold text-[#12345A]">{resolveTarget?.garmentName}</span>
          </p>
          <textarea
            rows={3}
            value={resolveNotes}
            onChange={(e) => setResolveNotes(e.target.value)}
            placeholder="Catatan penyelesaian atau hasil konfirmasi pelanggan..."
            className="w-full p-3 rounded-xl border border-slate-200 text-sm"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setResolveTarget(null)}
              className="min-h-[44px] px-4 rounded-xl border border-slate-200 text-sm font-semibold"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={resolveNotes.trim().length < 3 || resolveMutation.isPending}
              onClick={() => resolveMutation.mutate()}
              className="min-h-[44px] px-4 rounded-xl bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50"
            >
              {resolveMutation.isPending ? 'Menyimpan...' : 'Tandai Selesai'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
