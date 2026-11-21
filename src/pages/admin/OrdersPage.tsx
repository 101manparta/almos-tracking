import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import type { AppRoute } from '../../components/layout/AppShell.tsx';
import {
  EmptyState,
  ErrorBanner,
  LoadingSkeleton,
  Modal,
  PaginationBar,
  StatusBadge,
} from '../../components/ui/Primitives.tsx';
import { useAuth } from '../../contexts/AuthContext.tsx';
import { apiFetch, ApiClientError } from '../../lib/api.ts';
import { formatDateOnly, ORDER_CATEGORY_LABELS } from '../../lib/labels.ts';
import type { OrderCategory, OrderStatus } from '../../shared/types.ts';

const createOrderSchema = z.object({
  customerName: z.string().min(2, 'Nama pelanggan atau vendor minimal 2 karakter'),
  customerPhone: z.string().min(6, 'Nomor telepon minimal 6 digit'),
  orderCategory: z.enum([
    'INDIVIDUAL',
    'VILLA',
    'HOTEL',
    'WEDDING_ORGANIZER',
    'SALON',
    'OTHER_VENDOR',
  ]),
  expectedCompletionAt: z.string().optional(),
  notes: z.string().optional(),
});

type CreateOrderValues = z.infer<typeof createOrderSchema>;

interface OrderItem {
  id: string;
  orderCode: string;
  customerName: string;
  customerPhone: string;
  orderCategory: OrderCategory;
  expectedCompletionAt: string | null;
  status: OrderStatus;
  createdAt: string;
  creatorName: string;
  garmentCount: number;
  readyCount: number;
  onHoldCount: number;
  isPickupEligible: boolean;
}

export function OrdersPage({ onNavigate }: { onNavigate: (p: AppRoute) => void }) {
  const { notify } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL_ACTIVE');
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['orders', page, search, categoryFilter, statusFilter],
    queryFn: async () => {
      const qs = new URLSearchParams({
        page: String(page),
        perPage: '20',
        status: statusFilter,
      });
      if (search.trim()) qs.set('search', search.trim());
      if (categoryFilter) qs.set('category', categoryFilter);
      return apiFetch<OrderItem[]>(`/api/v1/orders?${qs.toString()}`);
    },
  });

  const form = useForm<CreateOrderValues>({
    resolver: zodResolver(createOrderSchema),
    defaultValues: {
      customerName: '',
      customerPhone: '',
      orderCategory: 'INDIVIDUAL',
      expectedCompletionAt: '',
      notes: '',
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: CreateOrderValues) => {
      const res = await apiFetch<{ id: string }>('/api/v1/orders', {
        method: 'POST',
        body: JSON.stringify({
          ...values,
          expectedCompletionAt: values.expectedCompletionAt
            ? new Date(values.expectedCompletionAt).toISOString()
            : null,
        }),
      });
      return res.data;
    },
    onSuccess: (created) => {
      form.reset();
      setCreateOpen(false);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
      notify('success', 'Pesanan baru berhasil dibuat.');
      onNavigate(`/pesanan/${created.id}`);
    },
    onError: (err) => {
      notify('error', err instanceof ApiClientError ? err.message : 'Gagal membuat pesanan.');
    },
  });

  const ordersList = data?.data || [];
  const meta = data?.meta;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#12345A]">Manajemen Pesanan</h1>
          <p className="text-sm text-slate-500">
            Kelola pesanan pelanggan pribadi, villa, hotel, wedding organizer, dan vendor.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#0756B8] hover:bg-[#064596] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 shrink-0"
        >
          <Plus className="h-4 w-4" />
          Buat Pesanan Baru
        </button>
      </div>

      {/* Filters */}
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
            placeholder="Cari kode pesanan, nama pelanggan/vendor, nomor telepon..."
            className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#0756B8]"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value);
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
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="h-10 px-3 rounded-xl border border-slate-200 text-sm bg-white"
        >
          <option value="ALL_ACTIVE">Semua Pesanan Aktif</option>
          <option value="ACTIVE">Sedang Diproses</option>
          <option value="READY_FOR_PICKUP">Siap Diambil</option>
          <option value="CANCELLED">Dibatalkan</option>
        </select>
      </div>

      {isLoading ? (
        <LoadingSkeleton rows={5} />
      ) : isError ? (
        <ErrorBanner
          message={error instanceof Error ? error.message : 'Gagal memuat daftar pesanan.'}
          onRetry={() => refetch()}
        />
      ) : ordersList.length === 0 ? (
        <EmptyState
          title="Belum ada data pesanan."
          description="Pesanan baru akan muncul di sini setelah didaftarkan."
          icon={<ClipboardList className="h-6 w-6" />}
          action={
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-[#0756B8] text-white text-sm font-semibold inline-flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Buat Pesanan Baru
            </button>
          }
        />
      ) : (
        <div className="rounded-2xl bg-white border border-slate-200/90 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-[#F5F8FC] text-xs font-semibold text-slate-500">
                  <th className="py-3 px-4">Kode Pesanan</th>
                  <th className="py-3 px-4">Pelanggan / Vendor</th>
                  <th className="py-3 px-4">Kategori</th>
                  <th className="py-3 px-4 text-right">Barang</th>
                  <th className="py-3 px-4">Target Selesai</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {ordersList.map((o) => (
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
                      <p className="text-xs text-slate-500 font-mono">{o.customerPhone}</p>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-600">
                      {ORDER_CATEGORY_LABELS[o.orderCategory]}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                      <span className="font-bold text-[#12345A]">{o.readyCount}</span>
                      <span className="text-slate-400">/{o.garmentCount}</span>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-600 tabular-nums whitespace-nowrap">
                      {formatDateOnly(o.expectedCompletionAt)}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={o.status} />
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

      {/* Create Order Modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Buat Pesanan Baru"
        subtitle="Setelah pesanan dibuat, Anda dapat mendaftarkan setiap barang secara individual."
      >
        <form
          onSubmit={form.handleSubmit((vals) => createMutation.mutate(vals))}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-semibold text-[#12345A] mb-1">
              Nama Pelanggan / Vendor *
            </label>
            <input
              {...form.register('customerName')}
              placeholder="Contoh: Ibu Rina Wijaya / Villa Serenity"
              className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#0756B8]"
            />
            {form.formState.errors.customerName && (
              <p className="mt-1 text-xs text-red-600">
                {form.formState.errors.customerName.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-[#12345A] mb-1">
                Nomor Telepon / WhatsApp *
              </label>
              <input
                {...form.register('customerPhone')}
                placeholder="0812xxxxxxxx"
                className="w-full h-11 px-3.5 rounded-xl border border-slate-200 font-mono text-sm focus:outline-none focus:border-[#0756B8]"
              />
              {form.formState.errors.customerPhone && (
                <p className="mt-1 text-xs text-red-600">
                  {form.formState.errors.customerPhone.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#12345A] mb-1">
                Kategori Pesanan *
              </label>
              <select
                {...form.register('orderCategory')}
                className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:border-[#0756B8]"
              >
                {Object.entries(ORDER_CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#12345A] mb-1">
              Target Tanggal Selesai
            </label>
            <input
              type="datetime-local"
              {...form.register('expectedCompletionAt')}
              className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#0756B8]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#12345A] mb-1">
              Catatan Pesanan
            </label>
            <textarea
              rows={2}
              {...form.register('notes')}
              placeholder="Catatan khusus pelanggan atau jadwal pengiriman vendor..."
              className="w-full p-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#0756B8]"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="min-h-[44px] px-4 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="min-h-[44px] px-5 rounded-xl bg-[#0756B8] hover:bg-[#064596] text-white text-sm font-semibold disabled:opacity-60"
            >
              {createMutation.isPending ? 'Menyimpan...' : 'Simpan Pesanan'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
