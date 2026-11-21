import { useQuery } from '@tanstack/react-query';
import { ArrowRight, History, Tag } from 'lucide-react';
import type { AppRoute } from '../../components/layout/AppShell.tsx';
import {
  EmptyState,
  ErrorBanner,
  LoadingSkeleton,
  StatusBadge,
} from '../../components/ui/Primitives.tsx';
import { apiFetch } from '../../lib/api.ts';
import { DEPARTMENT_LABELS, formatDateTime } from '../../lib/labels.ts';
import type { Department } from '../../shared/types.ts';

interface StaffHistoryItem {
  id: string;
  garmentId: string;
  previousStatus: string;
  newStatus: string;
  fromDepartment: Department | null;
  toDepartment: Department | null;
  notes: string | null;
  createdAt: string;
  garmentCode: string;
  garmentName: string;
  physicalTagNumber: string;
  orderCode: string;
  customerName: string;
}

export function StaffHistoryPage({ onNavigate }: { onNavigate: (p: AppRoute) => void }) {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['staff-history'],
    queryFn: async () => {
      const res = await apiFetch<StaffHistoryItem[]>('/api/v1/staff/history');
      return res.data;
    },
  });

  if (isLoading) return <LoadingSkeleton rows={5} />;
  if (isError) {
    return (
      <ErrorBanner
        message={error instanceof Error ? error.message : 'Gagal memuat riwayat pengerjaan.'}
        onRetry={() => refetch()}
      />
    );
  }

  const items = data ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-[#12345A] font-display">
          Riwayat Pengerjaan Saya
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Catatan aktivitas terbaru yang telah Anda kerjakan dan serah terimakan.
        </p>
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="Belum ada riwayat pengerjaan"
          description="Riwayat tugas yang Anda mulai, selesaikan, atau laporkan akan tercatat di sini."
          icon={<History className="h-6 w-6" />}
        />
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(`/staff/barang/${item.garmentId}`)}
              className="w-full text-left rounded-2xl bg-white border border-slate-200/90 p-4 shadow-xs hover:border-[#0756B8]/40 transition-colors flex items-start justify-between gap-3"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#EAF3FF] text-[#0756B8] font-mono text-xs font-bold">
                    <Tag className="h-3 w-3" /> {item.physicalTagNumber}
                  </span>
                  <StatusBadge status={item.newStatus} />
                </div>
                <p className="text-sm font-bold text-[#12345A] truncate">{item.garmentName}</p>
                <p className="text-xs text-slate-500">
                  {item.customerName} · {item.orderCode} · {item.garmentCode}
                </p>
                {item.notes && <p className="text-xs text-slate-600 pt-0.5">{item.notes}</p>}
                <p className="text-[11px] text-slate-400">
                  {formatDateTime(item.createdAt)}
                  {item.toDepartment
                    ? ` · Tujuan: ${DEPARTMENT_LABELS[item.toDepartment] || item.toDepartment}`
                    : ''}
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
