import { useQuery } from '@tanstack/react-query';
import { Plus, Search, Shirt } from 'lucide-react';
import { useState } from 'react';
import { RegisterGarmentModal } from '../../components/garments/RegisterGarmentModal.tsx';
import type { AppRoute } from '../../components/layout/AppShell.tsx';
import {
  AuthorizedImage,
  EmptyState,
  ErrorBanner,
  LoadingSkeleton,
  PaginationBar,
  StatusBadge,
} from '../../components/ui/Primitives.tsx';
import { apiFetch } from '../../lib/api.ts';
import { DEPARTMENT_LABELS } from '../../lib/labels.ts';
import type { Department } from '../../shared/types.ts';

interface GarmentRow {
  id: string;
  garmentCode: string;
  garmentName: string;
  garmentType: string;
  brand: string | null;
  color: string;
  physicalTagNumber: string;
  tagStatus: string;
  currentDepartment: Department;
  currentStatus: string;
  orderCode: string;
  customerName: string;
  templateName: string;
  thumbnailUrl: string | null;
}

export function GarmentsPage({ onNavigate }: { onNavigate: (p: AppRoute) => void }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [status, setStatus] = useState('');
  const [registerOpen, setRegisterOpen] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['garments', page, search, department, status],
    queryFn: async () => {
      const qs = new URLSearchParams({ page: String(page), perPage: '20' });
      if (search.trim()) qs.set('search', search.trim());
      if (department) qs.set('department', department);
      if (status) qs.set('status', status);
      return apiFetch<GarmentRow[]>(`/api/v1/garments?${qs.toString()}`);
    },
  });

  const list = data?.data || [];
  const meta = data?.meta;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#12345A]">Database Barang Individual</h1>
          <p className="text-sm text-slate-500">
            Lacak setiap item pakaian melalui nomor tag fisik, kode digital, warna, dan divisi.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setRegisterOpen(true)}
          className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#0756B8] hover:bg-[#064596] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 shrink-0"
        >
          <Plus className="h-4 w-4" />
          Daftarkan Barang
        </button>
      </div>

      <div className="rounded-2xl bg-white border border-slate-200/90 p-3.5 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Cari tag fisik, nama barang, merek, warna, atau pelanggan..."
            className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#0756B8]"
          />
        </div>
        <select
          value={department}
          onChange={(e) => {
            setDepartment(e.target.value);
            setPage(1);
          }}
          className="h-10 px-3 rounded-xl border border-slate-200 text-sm bg-white"
        >
          <option value="">Semua Divisi</option>
          <option value="SPOTTING">Spotting</option>
          <option value="IRONING">Ironing</option>
          <option value="PACKING">Packing</option>
          <option value="PICKUP">Siap Ambil / Pickup</option>
        </select>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="h-10 px-3 rounded-xl border border-slate-200 text-sm bg-white"
        >
          <option value="">Semua Status Aktif</option>
          <option value="WAITING_SPOTTING">Menunggu Spotting</option>
          <option value="SPOTTING_IN_PROGRESS">Proses Spotting</option>
          <option value="WAITING_IRONING">Menunggu Ironing</option>
          <option value="IRONING_IN_PROGRESS">Proses Ironing</option>
          <option value="WAITING_PACKING">Menunggu Packing</option>
          <option value="PACKING_IN_PROGRESS">Proses Packing</option>
          <option value="READY_FOR_PICKUP">Siap Diambil</option>
          <option value="ON_HOLD">Ditahan (On Hold)</option>
        </select>
      </div>

      {isLoading ? (
        <LoadingSkeleton rows={5} />
      ) : isError ? (
        <ErrorBanner
          message={error instanceof Error ? error.message : 'Gagal memuat database barang.'}
          onRetry={() => refetch()}
        />
      ) : list.length === 0 ? (
        <EmptyState
          title="Belum ada barang yang sesuai."
          description="Daftarkan barang melalui halaman pesanan atau tombol di atas untuk mulai melacak."
          icon={<Shirt className="h-6 w-6" />}
        />
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {list.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => onNavigate(`/barang/${g.id}`)}
                className="text-left rounded-2xl bg-white border border-slate-200/90 hover:border-[#0756B8]/40 p-3.5 shadow-xs hover:shadow-md transition-all flex items-center gap-3.5"
              >
                <div className="h-20 w-20 rounded-xl overflow-hidden bg-slate-100 shrink-0">
                  <AuthorizedImage src={g.thumbnailUrl} alt={g.garmentName} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-[#0756B8] truncate">
                      Tag {g.physicalTagNumber}
                    </span>
                    <StatusBadge status={g.currentStatus} />
                  </div>
                  <h3 className="mt-1 text-sm sm:text-base font-bold text-[#12345A] truncate">
                    {g.garmentName}
                  </h3>
                  <p className="text-xs text-slate-500 truncate">
                    {g.customerName} · {g.orderCode}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500 truncate">
                    {DEPARTMENT_LABELS[g.currentDepartment]} · {g.color}
                    {g.brand ? ` · ${g.brand}` : ''}
                  </p>
                </div>
              </button>
            ))}
          </div>

          {meta && (
            <PaginationBar
              page={meta.page}
              totalPages={meta.totalPages}
              total={meta.total}
              onPageChange={setPage}
            />
          )}
        </div>
      )}

      <RegisterGarmentModal
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        onSuccess={(id) => onNavigate(`/barang/${id}`)}
      />
    </div>
  );
}
