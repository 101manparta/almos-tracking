import { useQuery } from '@tanstack/react-query';
import { Archive, Search } from 'lucide-react';
import { useState } from 'react';
import type { AppRoute } from '../../components/layout/AppShell.tsx';
import {
  EmptyState,
  ErrorBanner,
  LoadingSkeleton,
  PaginationBar,
  StatusBadge,
} from '../../components/ui/Primitives.tsx';
import { apiFetch } from '../../lib/api.ts';
import { formatDateTime, ORDER_CATEGORY_LABELS } from '../../lib/labels.ts';
import type { OrderCategory } from '../../shared/types.ts';

interface ArchiveOrderItem {
  id: string;
  orderCode: string;
  customerName: string;
  customerPhone: string;
  orderCategory: OrderCategory;
  archivedAt: string | null;
  pickupRecord: {
    recipientName: string;
    garmentCount: number;
    pickedUpAt: string;
    confirmedByName: string | null;
  } | null;
}

export function ArchivePage({ onNavigate }: { onNavigate: (p: AppRoute) => void }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['archive', page, search, category],
    queryFn: async () => {
      const qs = new URLSearchParams({ page: String(page), perPage: '20' });
      if (search.trim()) qs.set('search', search.trim());
      if (category) qs.set('category', category);
      return apiFetch<ArchiveOrderItem[]>(`/api/v1/archive?${qs.toString()}`);
    },
  });

  const items = data?.data || [];
  const meta = data?.meta;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[#12345A]">Arsip Pesanan & Riwayat Permanen</h1>
        <p className="text-sm text-slate-500">
          Pesanan yang telah diambil tidak pernah dihapus—seluruh data barang, foto, dan riwayat
          tetap tersimpan untuk penelusuran.
        </p>
      </div>

      <div className="rounded-2xl bg-white border border-slate-200/90 p-3.5 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Cari kode arsip pesanan, pelanggan, vendor, atau telepon..."
            className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#0756B8]"
          />
        </div>
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
          className="h-10 px-3 rounded-xl border border-slate-200 text-sm bg-white"
        >
          <option value="">Semua Kategori</option>
          {Object.entries(ORDER_CATEGORY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <LoadingSkeleton rows={5} />
      ) : isError ? (
        <ErrorBanner
          message={error instanceof Error ? error.message : 'Gagal memuat arsip.'}
          onRetry={() => refetch()}
        />
      ) : items.length === 0 ? (
        <EmptyState
          title="Belum ada pesanan yang diarsipkan."
          description="Pesanan yang telah selesai diproses dan dikonfirmasi pengambilannya akan tersimpan di sini."
          icon={<Archive className="h-6 w-6" />}
        />
      ) : (
        <div className="rounded-2xl bg-white border border-slate-200/90 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-[#F5F8FC] text-xs font-semibold text-slate-500">
                  <th className="py-3 px-4">Kode Pesanan</th>
                  <th className="py-3 px-4">Pelanggan / Vendor</th>
                  <th className="py-3 px-4">Penerima</th>
                  <th className="py-3 px-4 text-right">Barang</th>
                  <th className="py-3 px-4">Waktu Pengambilan</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {items.map((o) => (
                  <tr
                    key={o.id}
                    onClick={() => onNavigate(`/pesanan/${o.id}`)}
                    className="hover:bg-[#EAF3FF]/40 cursor-pointer transition-colors"
                  >
                    <td className="py-3.5 px-4 font-mono font-semibold text-[#0756B8] whitespace-nowrap">
                      {o.orderCode}
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-[#12345A]">{o.customerName}</p>
                      <p className="text-xs text-slate-500">
                        {ORDER_CATEGORY_LABELS[o.orderCategory]}
                      </p>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-600">
                      <p className="font-semibold text-[#12345A]">
                        {o.pickupRecord?.recipientName || '—'}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Dikonfirmasi: {o.pickupRecord?.confirmedByName || '—'}
                      </p>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold tabular-nums">
                      {o.pickupRecord?.garmentCount ?? 0}
                    </td>
                    <td className="py-3.5 px-4 text-xs font-mono text-slate-500 tabular-nums whitespace-nowrap">
                      {formatDateTime(o.pickupRecord?.pickedUpAt || o.archivedAt)}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status="ARCHIVED" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {meta && (
            <div className="px-4 pb-4">
              <PaginationBar
                page={meta.page}
                totalPages={meta.totalPages}
                total={meta.total}
                onPageChange={setPage}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
