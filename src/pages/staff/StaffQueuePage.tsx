import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight, ClipboardList, Search, Tag } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { AppRoute } from '../../components/layout/AppShell.tsx';
import {
  AuthorizedImage,
  EmptyState,
  ErrorBanner,
  LoadingSkeleton,
  StatusBadge,
} from '../../components/ui/Primitives.tsx';
import { useAuth } from '../../contexts/AuthContext.tsx';
import { apiFetch } from '../../lib/api.ts';
import { formatDateTime, ROLE_LABELS } from '../../lib/labels.ts';

type QueueFilter = 'ALL' | 'WAITING' | 'IN_PROGRESS' | 'ON_HOLD';

interface QueueGarment {
  id: string;
  garmentCode: string;
  garmentName: string;
  garmentType: string;
  color: string;
  brand: string | null;
  physicalTagNumber: string;
  tagStatus: string;
  initialCondition: string;
  stainDescription: string | null;
  currentStatus: string;
  dueAt: string | null;
  orderCode: string;
  customerName: string;
  thumbnailUrl: string | null;
}

const FILTER_OPTIONS: Array<{ value: QueueFilter; label: string }> = [
  { value: 'ALL', label: 'Semua' },
  { value: 'WAITING', label: 'Menunggu' },
  { value: 'IN_PROGRESS', label: 'Dikerjakan' },
  { value: 'ON_HOLD', label: 'Ditahan' },
];

export function StaffQueuePage({ onNavigate }: { onNavigate: (p: AppRoute) => void }) {
  const { user } = useAuth();
  const [filter, setFilter] = useState<QueueFilter>('ALL');
  const [search, setSearch] = useState('');

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['staff-queue', filter],
    queryFn: async () => {
      const res = await apiFetch<QueueGarment[]>(`/api/v1/staff/queue?status=${filter}`);
      return res.data;
    },
  });

  const filteredItems = useMemo(() => {
    const items = data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.physicalTagNumber.toLowerCase().includes(q) ||
        item.garmentCode.toLowerCase().includes(q) ||
        item.garmentName.toLowerCase().includes(q) ||
        item.customerName.toLowerCase().includes(q) ||
        item.orderCode.toLowerCase().includes(q) ||
        (item.brand && item.brand.toLowerCase().includes(q))
    );
  }, [data, search]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-[#12345A] font-display">
          Antrean Kerja {user ? ROLE_LABELS[user.role] : ''}
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Pilih barang untuk melihat foto referensi, checklist, dan melakukan serah terima.
        </p>
      </div>

      {/* Filter Tabs + Quick Local Filter */}
      <div className="space-y-3 bg-white rounded-2xl border border-slate-200/90 p-3.5">
        <div className="grid grid-cols-4 gap-1.5 bg-[#F5F8FC] p-1 rounded-xl">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setFilter(opt.value)}
              className={`min-h-[40px] rounded-lg text-xs font-semibold transition-colors ${
                filter === opt.value
                  ? 'bg-[#0756B8] text-white shadow-xs'
                  : 'text-slate-600 hover:text-[#12345A]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter cepat tag fisik, nama barang, atau pelanggan..."
            className="w-full min-h-[44px] pl-10 pr-4 rounded-xl bg-[#F5F8FC] border border-slate-200 text-sm text-[#12345A] focus:outline-none focus:border-[#0756B8] focus:bg-white"
          />
        </div>
      </div>

      {isLoading ? (
        <LoadingSkeleton rows={4} />
      ) : isError ? (
        <ErrorBanner
          message={error instanceof Error ? error.message : 'Gagal memuat antrean divisi.'}
          onRetry={() => refetch()}
        />
      ) : filteredItems.length === 0 ? (
        <EmptyState
          title="Tidak ada barang di antrean"
          description={
            search.trim()
              ? 'Tidak ada barang yang cocok dengan filter pencarian Anda.'
              : 'Belum ada barang yang perlu diproses pada filter status ini.'
          }
          icon={<ClipboardList className="h-6 w-6" />}
        />
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => {
            const isOverdue = item.dueAt ? new Date(item.dueAt).getTime() < Date.now() : false;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(`/staff/barang/${item.id}`)}
                className="w-full text-left rounded-2xl bg-white border border-slate-200/90 p-3.5 sm:p-4 shadow-xs hover:border-[#0756B8]/40 hover:shadow-md transition-all flex items-start gap-3.5"
              >
                <div className="h-20 w-20 rounded-xl overflow-hidden bg-slate-100 shrink-0 border border-slate-200/60">
                  <AuthorizedImage src={item.thumbnailUrl} alt={item.garmentName} />
                </div>

                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#EAF3FF] text-[#0756B8] font-mono text-xs font-bold">
                        <Tag className="h-3 w-3" />
                        {item.physicalTagNumber}
                      </span>
                      {item.tagStatus === 'MISSING' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-50 text-red-700 border border-red-200 text-[11px] font-semibold">
                          <AlertTriangle className="h-3 w-3" />
                          Tag Hilang
                        </span>
                      )}
                    </div>
                    <StatusBadge status={item.currentStatus} />
                  </div>

                  <div>
                    <p className="text-sm sm:text-base font-bold text-[#12345A] truncate">
                      {item.garmentName}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {item.customerName} · {item.orderCode} · {item.color}
                      {item.brand ? ` · ${item.brand}` : ''}
                    </p>
                  </div>

                  {item.stainDescription && (
                    <p className="text-xs text-[#B45309] bg-[#FFF3E4]/70 rounded-lg px-2.5 py-1 line-clamp-1">
                      Noda/Catatan: {item.stainDescription}
                    </p>
                  )}

                  <div className="flex items-center justify-between text-[11px] pt-0.5">
                    <span className="font-mono text-slate-400">{item.garmentCode}</span>
                    <span className={isOverdue ? 'text-red-600 font-semibold' : 'text-slate-500'}>
                      Target: {formatDateTime(item.dueAt)}
                    </span>
                  </div>
                </div>

                <ArrowRight className="h-4 w-4 text-slate-400 shrink-0 self-center hidden sm:block" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
