import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight, Search, Tag } from 'lucide-react';
import { useState } from 'react';
import type { AppRoute } from '../../components/layout/AppShell.tsx';
import {
  AuthorizedImage,
  EmptyState,
  ErrorBanner,
  LoadingSkeleton,
  StatusBadge,
} from '../../components/ui/Primitives.tsx';
import { apiFetch } from '../../lib/api.ts';
import { DEPARTMENT_LABELS } from '../../lib/labels.ts';
import type { Department } from '../../shared/types.ts';

interface SearchGarmentResult {
  id: string;
  garmentCode: string;
  garmentName: string;
  garmentType: string;
  brand: string | null;
  color: string;
  physicalTagNumber: string;
  tagStatus: string;
  currentStatus: string;
  currentDepartment: Department;
  orderId: string;
  orderCode: string;
  customerName: string;
  thumbnailUrl: string | null;
}

export function StaffSearchPage({ onNavigate }: { onNavigate: (p: AppRoute) => void }) {
  const [query, setQuery] = useState('');

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['staff-garment-search', query],
    queryFn: async () => {
      const q = query.trim();
      if (!q) {
        const res = await apiFetch<SearchGarmentResult[]>('/api/v1/garments?perPage=20');
        return res.data;
      }
      const res = await apiFetch<{ garments: SearchGarmentResult[] }>(
        `/api/v1/search?q=${encodeURIComponent(q)}`
      );
      return res.data.garments;
    },
  });

  const garments = data ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-[#12345A] font-display">
          Cari Barang & Verifikasi Tag
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Gunakan nomor tag fisik, ciri khusus, warna, merek, atau nama pelanggan (berguna jika tag fisik terlepas).
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/90 p-3.5">
        <div className="relative">
          <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ketik nomor tag fisik, warna, merek, nama barang, atau pelanggan..."
            className="w-full min-h-[48px] pl-10 pr-4 rounded-xl bg-[#F5F8FC] border border-slate-200 text-sm text-[#12345A] focus:outline-none focus:border-[#0756B8] focus:bg-white"
          />
        </div>
      </div>

      {isLoading ? (
        <LoadingSkeleton rows={5} />
      ) : isError ? (
        <ErrorBanner
          message={error instanceof Error ? error.message : 'Gagal mencari data barang.'}
          onRetry={() => refetch()}
        />
      ) : garments.length === 0 ? (
        <EmptyState
          title="Barang tidak ditemukan"
          description={
            query.trim()
              ? `Tidak ada barang yang cocok dengan kata kunci "${query}".`
              : 'Belum ada data barang yang terdaftar di sistem.'
          }
          icon={<Search className="h-6 w-6" />}
        />
      ) : (
        <div className="space-y-3">
          {garments.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(`/staff/barang/${item.id}`)}
              className="w-full text-left rounded-2xl bg-white border border-slate-200/90 p-3.5 shadow-xs hover:border-[#0756B8]/40 transition-all flex items-center gap-3.5"
            >
              <div className="h-20 w-20 rounded-xl overflow-hidden bg-slate-100 shrink-0">
                <AuthorizedImage src={item.thumbnailUrl} alt={item.garmentName} />
              </div>

              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#EAF3FF] text-[#0756B8] font-mono text-xs font-bold">
                      <Tag className="h-3 w-3" /> {item.physicalTagNumber}
                    </span>
                    {item.tagStatus === 'MISSING' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-50 text-red-700 border border-red-200 text-[11px] font-semibold">
                        <AlertTriangle className="h-3 w-3" /> Tag Hilang
                      </span>
                    )}
                  </div>
                  <StatusBadge status={item.currentStatus} />
                </div>

                <p className="text-sm font-bold text-[#12345A] truncate">{item.garmentName}</p>
                <p className="text-xs text-slate-600 truncate">
                  Warna: {item.color}
                  {item.brand ? ` · Merek: ${item.brand}` : ''} · {item.garmentType}
                </p>
                <p className="text-xs text-slate-500 truncate">
                  {item.customerName} ({item.orderCode}) ·{' '}
                  {DEPARTMENT_LABELS[item.currentDepartment] || item.currentDepartment}
                </p>
              </div>

              <ArrowRight className="h-4 w-4 text-slate-400 shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
