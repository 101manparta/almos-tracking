import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, PackageCheck } from 'lucide-react';
import { useState } from 'react';
import type { AppRoute } from '../../components/layout/AppShell.tsx';
import {
  EmptyState,
  ErrorBanner,
  LoadingSkeleton,
  Modal,
  StatusBadge,
} from '../../components/ui/Primitives.tsx';
import { useAuth } from '../../contexts/AuthContext.tsx';
import { apiFetch, ApiClientError } from '../../lib/api.ts';
import { formatDateTime, ORDER_CATEGORY_LABELS } from '../../lib/labels.ts';
import type { OrderCategory } from '../../shared/types.ts';

interface PickupOrderItem {
  id: string;
  orderCode: string;
  customerName: string;
  customerPhone: string;
  orderCategory: OrderCategory;
  status: string;
  garmentCount: number;
  readyCount: number;
  onHoldCount: number;
  isPickupEligible: boolean;
  createdAt: string;
}

export function PickupPage({ onNavigate }: { onNavigate: (p: AppRoute) => void }) {
  const { notify } = useAuth();
  const queryClient = useQueryClient();
  const [selectedOrder, setSelectedOrder] = useState<PickupOrderItem | null>(null);
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [notes, setNotes] = useState('');

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['pickup-ready-orders'],
    queryFn: async () => {
      const res = await apiFetch<PickupOrderItem[]>(
        '/api/v1/orders?page=1&perPage=50&status=ALL_ACTIVE'
      );
      return res.data;
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!selectedOrder) return;
      return apiFetch(`/api/v1/orders/${selectedOrder.id}/pickup`, {
        method: 'POST',
        body: JSON.stringify({
          recipientName,
          recipientPhone: recipientPhone || null,
          verificationNotes: notes || null,
          expectedGarmentCount: selectedOrder.garmentCount,
          idempotencyKey: `pickup-${selectedOrder.id}`,
        }),
      });
    },
    onSuccess: () => {
      setSelectedOrder(null);
      setRecipientName('');
      setRecipientPhone('');
      setNotes('');
      queryClient.invalidateQueries({ queryKey: ['pickup-ready-orders'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['archive'] });
      queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
      notify('success', 'Pengambilan pesanan berhasil dikonfirmasi dan diarsipkan.');
    },
    onError: (err) => {
      notify(
        'error',
        err instanceof ApiClientError ? err.message : 'Gagal mengonfirmasi pengambilan.'
      );
    },
  });

  if (isLoading) return <LoadingSkeleton rows={4} />;
  if (isError) {
    return (
      <ErrorBanner
        message={error instanceof Error ? error.message : 'Gagal memuat daftar pengambilan.'}
        onRetry={() => refetch()}
      />
    );
  }

  const readyOrders = (data || []).filter((o) => o.isPickupEligible);
  const incompleteOrders = (data || []).filter((o) => !o.isPickupEligible && o.garmentCount > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#12345A]">Manajemen Pengambilan Pelanggan</h1>
        <p className="text-sm text-slate-500">
          Pengambilan hanya dapat dikonfirmasi jika seluruh barang dalam pesanan sudah berstatus
          Siap Diambil.
        </p>
      </div>

      <div className="space-y-3">
        <h2 className="text-base font-bold text-[#12345A]">
          Siap Diambil & Lengkap ({readyOrders.length})
        </h2>

        {readyOrders.length === 0 ? (
          <EmptyState
            title="Belum ada pesanan yang siap diambil."
            description="Pesanan akan otomatis muncul di daftar ini setelah seluruh item pakaiannya menyelesaikan tahap Packing."
            icon={<PackageCheck className="h-6 w-6" />}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {readyOrders.map((o) => (
              <div
                key={o.id}
                className="rounded-2xl bg-white border border-emerald-200 p-5 shadow-xs flex flex-col justify-between gap-4"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-sm font-bold text-[#0756B8]">
                      {o.orderCode}
                    </span>
                    <StatusBadge status="READY_FOR_PICKUP" />
                  </div>
                  <h3 className="mt-1.5 text-lg font-bold text-[#12345A]">{o.customerName}</h3>
                  <p className="text-xs text-slate-500">
                    {ORDER_CATEGORY_LABELS[o.orderCategory]} · {o.customerPhone}
                  </p>
                  <p className="mt-2 text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" />
                    Seluruh {o.garmentCount} barang siap diserahkan
                  </p>
                </div>

                <div className="flex items-center gap-2.5 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => onNavigate(`/pesanan/${o.id}`)}
                    className="min-h-[42px] px-3.5 rounded-xl border border-slate-200 text-xs font-semibold text-[#12345A] hover:bg-slate-50"
                  >
                    Rincian Barang
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedOrder(o);
                      setRecipientName(o.customerName);
                      setRecipientPhone(o.customerPhone);
                    }}
                    className="flex-1 min-h-[42px] px-4 rounded-xl bg-[#F7941D] hover:bg-[#e08312] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5"
                  >
                    <PackageCheck className="h-4 w-4" />
                    Konfirmasi Pengambilan
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {incompleteOrders.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-base font-bold text-[#12345A]">
            Pesanan Belum Lengkap ({incompleteOrders.length})
          </h2>
          <div className="rounded-2xl bg-white border border-slate-200/90 divide-y divide-slate-100">
            {incompleteOrders.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => onNavigate(`/pesanan/${o.id}`)}
                className="w-full p-4 text-left flex flex-wrap items-center justify-between gap-3 hover:bg-[#F5F8FC]"
              >
                <div>
                  <p className="font-mono text-xs font-bold text-[#0756B8]">{o.orderCode}</p>
                  <p className="text-sm font-semibold text-[#12345A]">{o.customerName}</p>
                  <p className="text-xs text-slate-500">
                    Masuk: {formatDateTime(o.createdAt)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-xs font-bold text-[#12345A] tabular-nums">
                    {o.readyCount} / {o.garmentCount} barang siap
                  </p>
                  {o.onHoldCount > 0 && (
                    <p className="text-[11px] font-semibold text-red-600">
                      {o.onHoldCount} barang ditahan
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <Modal
        open={Boolean(selectedOrder)}
        onClose={() => setSelectedOrder(null)}
        title="Konfirmasi Pengambilan & Arsip"
        subtitle={
          selectedOrder
            ? `${selectedOrder.orderCode} — ${selectedOrder.customerName} (${selectedOrder.garmentCount} barang)`
            : undefined
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#12345A] mb-1">
              Nama Penerima *
            </label>
            <input
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#12345A] mb-1">
              Nomor Telepon Penerima
            </label>
            <input
              value={recipientPhone}
              onChange={(e) => setRecipientPhone(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl border border-slate-200 font-mono text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#12345A] mb-1">
              Catatan Rekonsiliasi Fisik
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Jumlah barang dan tag fisik sudah diperiksa lengkap."
              className="w-full p-3 rounded-xl border border-slate-200 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setSelectedOrder(null)}
              className="min-h-[44px] px-4 rounded-xl border border-slate-200 text-sm font-semibold"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={!recipientName.trim() || confirmMutation.isPending}
              onClick={() => confirmMutation.mutate()}
              className="min-h-[44px] px-5 rounded-xl bg-[#F7941D] text-white text-sm font-semibold disabled:opacity-50"
            >
              {confirmMutation.isPending ? 'Memproses...' : 'Konfirmasi & Pindah ke Arsip'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
