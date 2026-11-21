import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Ban,
  Edit3,
  PackageCheck,
  Plus,
  Shirt,
} from 'lucide-react';
import { useState } from 'react';
import { RegisterGarmentModal } from '../../components/garments/RegisterGarmentModal.tsx';
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
import {
  DEPARTMENT_LABELS,
  formatDateTime,
  ORDER_CATEGORY_LABELS,
} from '../../lib/labels.ts';
import type { Department, OrderCategory, OrderStatus } from '../../shared/types.ts';

interface OrderDetailData {
  id: string;
  orderCode: string;
  customerName: string;
  customerPhone: string;
  orderCategory: OrderCategory;
  expectedCompletionAt: string | null;
  notes: string | null;
  status: OrderStatus;
  version: number;
  createdAt: string;
  creatorName: string;
  garmentCount: number;
  readyCount: number;
  onHoldCount: number;
  isPickupEligible: boolean;
  cancelReason: string | null;
  pickupRecord: {
    recipientName: string;
    recipientPhone: string | null;
    verificationNotes: string | null;
    garmentCount: number;
    pickedUpAt: string;
    confirmedByName: string;
  } | null;
  garments: Array<{
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
  }>;
}

export function OrderDetailPage({
  orderId,
  onNavigate,
}: {
  orderId: string;
  onNavigate: (p: AppRoute) => void;
}) {
  const { notify } = useAuth();
  const queryClient = useQueryClient();
  const [addGarmentOpen, setAddGarmentOpen] = useState(false);
  const [pickupOpen, setPickupOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [pickupNotes, setPickupNotes] = useState('');
  const [cancelReason, setCancelReason] = useState('');

  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const { data: order, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['order-detail', orderId],
    queryFn: async () => {
      const res = await apiFetch<OrderDetailData>(`/api/v1/orders/${orderId}`);
      return res.data;
    },
  });

  const pickupMutation = useMutation({
    mutationFn: async () => {
      if (!order) return;
      return apiFetch(`/api/v1/orders/${order.id}/pickup`, {
        method: 'POST',
        body: JSON.stringify({
          recipientName,
          recipientPhone: recipientPhone || null,
          verificationNotes: pickupNotes || null,
          expectedGarmentCount: order.garmentCount,
          idempotencyKey: `pickup-${order.id}`,
        }),
      });
    },
    onSuccess: () => {
      setPickupOpen(false);
      queryClient.invalidateQueries({ queryKey: ['order-detail', orderId] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['archive'] });
      queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
      notify('success', 'Pengambilan dikonfirmasi. Pesanan dipindahkan ke Arsip.');
    },
    onError: (err) => {
      notify('error', err instanceof ApiClientError ? err.message : 'Gagal konfirmasi pengambilan.');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      return apiFetch(`/api/v1/orders/${orderId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: cancelReason }),
      });
    },
    onSuccess: () => {
      setCancelOpen(false);
      queryClient.invalidateQueries({ queryKey: ['order-detail', orderId] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      notify('info', 'Pesanan berhasil dibatalkan.');
    },
    onError: (err) => {
      notify('error', err instanceof ApiClientError ? err.message : 'Gagal membatalkan pesanan.');
    },
  });

  const editMutation = useMutation({
    mutationFn: async () => {
      if (!order) return;
      return apiFetch(`/api/v1/orders/${order.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          version: order.version,
          customerName: editName,
          customerPhone: editPhone,
          notes: editNotes || null,
        }),
      });
    },
    onSuccess: () => {
      setEditOpen(false);
      queryClient.invalidateQueries({ queryKey: ['order-detail', orderId] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      notify('success', 'Informasi pesanan diperbarui.');
    },
    onError: (err) => {
      notify('error', err instanceof ApiClientError ? err.message : 'Gagal memperbarui pesanan.');
    },
  });

  if (isLoading) return <LoadingSkeleton rows={5} />;
  if (isError || !order) {
    return (
      <ErrorBanner
        message={error instanceof Error ? error.message : 'Gagal memuat detail pesanan.'}
        onRetry={() => refetch()}
      />
    );
  }

  const isClosed = order.status === 'ARCHIVED' || order.status === 'CANCELLED';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => onNavigate('/pesanan')}
          className="min-h-[40px] px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-[#12345A] hover:bg-slate-50 inline-flex items-center gap-1.5"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke Daftar Pesanan
        </button>

        {!isClosed && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setEditName(order.customerName);
                setEditPhone(order.customerPhone);
                setEditNotes(order.notes || '');
                setEditOpen(true);
              }}
              className="min-h-[42px] px-3.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-[#12345A] hover:bg-slate-50 inline-flex items-center gap-1.5"
            >
              <Edit3 className="h-4 w-4" />
              Ubah Info
            </button>
            <button
              type="button"
              onClick={() => setAddGarmentOpen(true)}
              className="min-h-[42px] px-4 rounded-xl bg-[#0756B8] hover:bg-[#064596] text-white text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" />
              Tambah Barang
            </button>
            {order.isPickupEligible && (
              <button
                type="button"
                onClick={() => {
                  setRecipientName(order.customerName);
                  setRecipientPhone(order.customerPhone);
                  setPickupOpen(true);
                }}
                className="min-h-[42px] px-4 rounded-xl bg-[#F7941D] hover:bg-[#e08312] text-white text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <PackageCheck className="h-4 w-4" />
                Konfirmasi Pengambilan
              </button>
            )}
            <button
              type="button"
              onClick={() => setCancelOpen(true)}
              className="min-h-[42px] px-3.5 rounded-xl border border-red-200 bg-red-50 text-xs font-semibold text-red-700 hover:bg-red-100 inline-flex items-center gap-1.5"
            >
              <Ban className="h-4 w-4" />
              Batalkan
            </button>
          </div>
        )}
      </div>

      {/* Order Summary Card */}
      <div className="rounded-2xl bg-white border border-slate-200/90 p-5 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="font-mono text-sm font-bold text-[#0756B8]">{order.orderCode}</span>
              <span className="text-slate-300">·</span>
              <span className="text-xs text-slate-500">
                {ORDER_CATEGORY_LABELS[order.orderCategory]}
              </span>
            </div>
            <h1 className="mt-1 text-xl sm:text-2xl font-bold text-[#12345A]">
              {order.customerName}
            </h1>
            <p className="mt-1 text-xs text-slate-500 font-mono">
              Kontak: {order.customerPhone} · Didaftarkan oleh {order.creatorName} pada{' '}
              {formatDateTime(order.createdAt)}
            </p>
          </div>
          <StatusBadge status={order.status} />
        </div>

        <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <p className="text-slate-500">Jumlah Barang</p>
            <p className="mt-0.5 text-base font-bold font-mono tabular-nums text-[#12345A]">
              {order.garmentCount} item
            </p>
          </div>
          <div>
            <p className="text-slate-500">Siap Diambil</p>
            <p className="mt-0.5 text-base font-bold font-mono tabular-nums text-emerald-700">
              {order.readyCount} / {order.garmentCount}
            </p>
          </div>
          <div>
            <p className="text-slate-500">Target Selesai</p>
            <p className="mt-0.5 font-semibold text-[#12345A]">
              {formatDateTime(order.expectedCompletionAt)}
            </p>
          </div>
          <div>
            <p className="text-slate-500">Catatan</p>
            <p className="mt-0.5 text-[#12345A]">{order.notes || '—'}</p>
          </div>
        </div>

        {order.pickupRecord && (
          <div className="mt-4 rounded-xl bg-emerald-50 border border-emerald-200 p-3.5 text-xs text-emerald-900">
            <p className="font-bold">Riwayat Pengambilan (Arsip Permanen)</p>
            <p className="mt-1">
              Diambil oleh <span className="font-semibold">{order.pickupRecord.recipientName}</span>{' '}
              ({order.pickupRecord.garmentCount} barang) pada{' '}
              {formatDateTime(order.pickupRecord.pickedUpAt)} · Dikonfirmasi oleh{' '}
              {order.pickupRecord.confirmedByName}
            </p>
            {order.pickupRecord.verificationNotes && (
              <p className="mt-1 opacity-80">Catatan: {order.pickupRecord.verificationNotes}</p>
            )}
          </div>
        )}

        {order.cancelReason && (
          <div className="mt-4 rounded-xl bg-red-50 border border-red-200 p-3.5 text-xs text-red-900">
            <p className="font-bold">Pesanan Dibatalkan</p>
            <p className="mt-0.5">Alasan: {order.cancelReason}</p>
          </div>
        )}
      </div>

      {/* Garments List inside Order */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-[#12345A]">
            Daftar Barang Individual ({order.garments.length})
          </h2>
        </div>

        {order.garments.length === 0 ? (
          <EmptyState
            title="Belum ada barang terdaftar pada pesanan ini."
            description="Daftarkan setiap item pakaian secara terpisah agar memiliki nomor tag fisik dan alur divisi masing-masing."
            icon={<Shirt className="h-6 w-6" />}
            action={
              !isClosed ? (
                <button
                  type="button"
                  onClick={() => setAddGarmentOpen(true)}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-[#0756B8] text-white text-sm font-semibold inline-flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Daftarkan Barang Pertama
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {order.garments.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => onNavigate(`/barang/${g.id}`)}
                className="text-left rounded-2xl bg-white border border-slate-200/90 hover:border-[#0756B8]/40 p-4 shadow-xs hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-bold text-[#0756B8]">{g.garmentCode}</p>
                    <h3 className="mt-0.5 text-base font-bold text-[#12345A] truncate">
                      {g.garmentName}
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {g.garmentType} · {g.color}
                      {g.brand ? ` · ${g.brand}` : ''}
                    </p>
                  </div>
                  <StatusBadge status={g.currentStatus} />
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="font-mono font-semibold text-[#12345A]">
                    Tag Fisik: {g.physicalTagNumber}
                    {g.tagStatus === 'MISSING' ? ' (HILANG)' : ''}
                  </span>
                  <span className="text-slate-500">
                    {DEPARTMENT_LABELS[g.currentDepartment]}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Add Garment Modal */}
      <RegisterGarmentModal
        open={addGarmentOpen}
        onClose={() => setAddGarmentOpen(false)}
        defaultOrderId={order.id}
      />

      {/* Pickup Confirmation Modal */}
      <Modal
        open={pickupOpen}
        onClose={() => setPickupOpen(false)}
        title="Konfirmasi Pengambilan Pesanan"
        subtitle={`Rekonsiliasi seluruh ${order.garmentCount} barang sebelum penyerahan dan pengarsipan.`}
      >
        <div className="space-y-4">
          <div className="rounded-xl bg-[#EAF3FF] border border-[#0756B8]/20 p-3.5 text-xs text-[#12345A]">
            Semua <span className="font-bold">{order.garmentCount} barang</span> dalam pesanan{' '}
            <span className="font-mono font-bold">{order.orderCode}</span> telah berstatus{' '}
            <span className="font-bold">Siap Diambil</span>. Setelah dikonfirmasi, pesanan akan
            dipindahkan ke <span className="font-bold">Arsip</span> secara permanen tanpa menghapus
            riwayat atau foto.
          </div>

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
              No. Telepon Penerima
            </label>
            <input
              value={recipientPhone}
              onChange={(e) => setRecipientPhone(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl border border-slate-200 font-mono text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#12345A] mb-1">
              Catatan Verifikasi Fisik
            </label>
            <textarea
              rows={2}
              value={pickupNotes}
              onChange={(e) => setPickupNotes(e.target.value)}
              placeholder="Contoh: Jumlah hanger dan tag fisik cocok semua saat serah terima."
              className="w-full p-3 rounded-xl border border-slate-200 text-sm"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setPickupOpen(false)}
              className="min-h-[44px] px-4 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={!recipientName.trim() || pickupMutation.isPending}
              onClick={() => pickupMutation.mutate()}
              className="min-h-[44px] px-5 rounded-xl bg-[#F7941D] hover:bg-[#e08312] text-white text-sm font-semibold disabled:opacity-60"
            >
              {pickupMutation.isPending ? 'Memproses...' : 'Konfirmasi & Arsipkan'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Cancel Order Modal */}
      <Modal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Batalkan Pesanan"
        subtitle="Pembatalan hanya diizinkan jika belum ada barang yang mulai diproses."
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <textarea
            rows={3}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Tuliskan alasan pembatalan pesanan..."
            className="w-full p-3 rounded-xl border border-slate-200 text-sm"
          />
          <div className="flex justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setCancelOpen(false)}
              className="min-h-[44px] px-4 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={cancelReason.trim().length < 3 || cancelMutation.isPending}
              onClick={() => cancelMutation.mutate()}
              className="min-h-[44px] px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold disabled:opacity-60"
            >
              {cancelMutation.isPending ? 'Membatalkan...' : 'Ya, Batalkan Pesanan'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit Order Modal */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Ubah Informasi Pesanan"
        maxWidth="max-w-md"
      >
        <div className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-[#12345A] mb-1">
              Nama Pelanggan / Vendor
            </label>
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#12345A] mb-1">
              Nomor Telepon
            </label>
            <input
              value={editPhone}
              onChange={(e) => setEditPhone(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl border border-slate-200 font-mono text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#12345A] mb-1">Catatan</label>
            <textarea
              rows={2}
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-200 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setEditOpen(false)}
              className="min-h-[44px] px-4 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={editMutation.isPending}
              onClick={() => editMutation.mutate()}
              className="min-h-[44px] px-4 rounded-xl bg-[#0756B8] text-white text-sm font-semibold"
            >
              {editMutation.isPending ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
