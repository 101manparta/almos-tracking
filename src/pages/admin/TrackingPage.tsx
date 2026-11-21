import { useQuery } from '@tanstack/react-query';
import { Route as RouteIcon, Search } from 'lucide-react';
import { useState } from 'react';
import type { AppRoute } from '../../components/layout/AppShell.tsx';
import {
  AuthorizedImage,
  EmptyState,
  LoadingSkeleton,
  StatusBadge,
} from '../../components/ui/Primitives.tsx';
import { apiFetch } from '../../lib/api.ts';
import { DEPARTMENT_LABELS } from '../../lib/labels.ts';
import type { Department } from '../../shared/types.ts';

export function TrackingPage({ onNavigate }: { onNavigate: (p: AppRoute) => void }) {
  const [query, setQuery] = useState('');

  const { data: searchResults, isLoading } = useQuery({
    queryKey: ['tracking-search', query],
    queryFn: async () => {
      if (query.trim().length < 2) {
        const recent = await apiFetch<
          Array<{
            id: string;
            garmentCode: string;
            garmentName: string;
            garmentType: string;
            brand: string | null;
            color: string;
            physicalTagNumber: string;
            currentStatus: string;
            currentDepartment: Department;
            orderCode: string;
            customerName: string;
            thumbnailUrl: string | null;
          }>
        >('/api/v1/garments?page=1&perPage=20');
        return recent.data;
      }
      const res = await apiFetch<{
        garments: Array<{
          id: string;
          garmentCode: string;
          garmentName: string;
          garmentType: string;
          brand: string | null;
          color: string;
          physicalTagNumber: string;
          currentStatus: string;
          currentDepartment: Department;
          orderCode: string;
          customerName: string;
          thumbnailUrl: string | null;
        }>;
      }>(`/api/v1/search?q=${encodeURIComponent(query.trim())}`);
      return res.data.garments;
    },
  });

  const garments = searchResults || [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[#12345A]">Pelacakan & Pencarian Global</h1>
        <p className="text-sm text-slate-500">
          Cari berdasarkan ID barang, ID pesanan, tag fisik, nama pelanggan/vendor, merek, atau
          warna.
        </p>
      </div>

      <div className="rounded-2xl bg-white border border-slate-200/90 p-4">
        <div className="relative">
          <Search className="h-5 w-5 text-[#0756B8] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ketik nomor tag fisik, kode ALM/GRM, jenis pakaian, merek, atau nama pemilik..."
            className="w-full h-12 pl-11 pr-4 rounded-xl bg-[#F5F8FC] border border-slate-200 text-sm text-[#12345A] focus:outline-none focus:border-[#0756B8] focus:bg-white"
          />
        </div>
      </div>

      {isLoading ? (
        <LoadingSkeleton rows={5} />
      ) : garments.length === 0 ? (
        <EmptyState
          title="Tidak ada hasil tracking."
          description={
            query.trim()
              ? `Tidak ditemukan barang untuk kata kunci "${query}".`
              : 'Belum ada barang aktif yang sedang dilacak.'
          }
          icon={<RouteIcon className="h-6 w-6" />}
        />
      ) : (
        <div className="space-y-2.5">
          {garments.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => onNavigate(`/barang/${g.id}`)}
              className="w-full text-left rounded-2xl bg-white border border-slate-200/90 hover:border-[#0756B8]/40 p-3.5 shadow-xs hover:shadow-md transition-all flex items-center gap-3.5"
            >
              <div className="h-16 w-16 rounded-xl overflow-hidden bg-slate-100 shrink-0">
                <AuthorizedImage src={g.thumbnailUrl} alt={g.garmentName} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-mono font-bold text-[#0756B8]">
                    Tag: {g.physicalTagNumber}
                  </span>
                  <span className="text-slate-300">·</span>
                  <span className="font-mono text-slate-500">{g.garmentCode}</span>
                  <span className="text-slate-300">·</span>
                  <span className="font-mono text-slate-500">{g.orderCode}</span>
                </div>
                <p className="mt-0.5 text-sm sm:text-base font-bold text-[#12345A] truncate">
                  {g.garmentName}
                </p>
                <p className="text-xs text-slate-500 truncate">
                  {g.customerName} · {DEPARTMENT_LABELS[g.currentDepartment]}
                </p>
              </div>
              <StatusBadge status={g.currentStatus} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
