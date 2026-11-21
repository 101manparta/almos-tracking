import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useAuth } from '../../contexts/AuthContext.tsx';
import { apiFetch, ApiClientError } from '../../lib/api.ts';
import { prepareCompressedImageAndThumb } from '../../lib/image-utils.ts';
import { PHOTO_TYPE_LABELS } from '../../lib/labels.ts';
import type { PhotoType } from '../../shared/types.ts';
import { Modal } from '../ui/Primitives.tsx';

const garmentSchema = z.object({
  orderId: z.string().min(1, 'Pilih pesanan terlebih dahulu'),
  templateCode: z.string().min(1, 'Pilih alur layanan'),
  garmentName: z.string().min(2, 'Nama pakaian wajib diisi'),
  category: z.string().min(2, 'Kategori wajib diisi'),
  garmentType: z.string().min(2, 'Jenis pakaian wajib diisi'),
  brand: z.string().optional(),
  color: z.string().min(2, 'Warna wajib diisi'),
  size: z.string().optional(),
  physicalTagNumber: z.string().min(1, 'Nomor tag fisik wajib diisi'),
  distinctiveFeatures: z.string().optional(),
  initialCondition: z.string().min(2, 'Kondisi awal wajib diisi'),
  stainDescription: z.string().optional(),
  specialInstructions: z.string().optional(),
});

type GarmentFormValues = z.infer<typeof garmentSchema>;

interface QueuedPhoto {
  id: string;
  file: File;
  previewUrl: string;
  photoType: PhotoType;
  caption: string;
}

export function RegisterGarmentModal({
  open,
  onClose,
  defaultOrderId,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  defaultOrderId?: string;
  onSuccess?: (garmentId: string) => void;
}) {
  const { notify } = useAuth();
  const queryClient = useQueryClient();
  const [queuedPhotos, setQueuedPhotos] = useState<QueuedPhoto[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);

  const { data: templates } = useQuery({
    queryKey: ['workflow-templates'],
    queryFn: async () => {
      const res = await apiFetch<
        Array<{ id: string; code: string; name: string; description: string | null }>
      >('/api/v1/workflow-templates');
      return res.data;
    },
    enabled: open,
  });

  const { data: activeOrders } = useQuery({
    queryKey: ['orders-select-list'],
    queryFn: async () => {
      const res = await apiFetch<
        Array<{ id: string; orderCode: string; customerName: string }>
      >('/api/v1/orders?page=1&perPage=100&status=ALL_ACTIVE');
      return res.data;
    },
    enabled: open && !defaultOrderId,
  });

  const form = useForm<GarmentFormValues>({
    resolver: zodResolver(garmentSchema),
    defaultValues: {
      orderId: defaultOrderId || '',
      templateCode: 'FULL_DETAILING',
      garmentName: '',
      category: 'Pakaian Formal',
      garmentType: '',
      brand: '',
      color: '',
      size: '',
      physicalTagNumber: '',
      distinctiveFeatures: '',
      initialCondition: 'Baik, perlu pembersihan detailing',
      stainDescription: '',
      specialInstructions: '',
    },
  });

  const handleSelectFiles = (files: FileList | null) => {
    if (!files) return;
    const next: QueuedPhoto[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      next.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        file,
        previewUrl: URL.createObjectURL(file),
        photoType: queuedPhotos.length === 0 && next.length === 0 ? 'FRONT' : 'DETAIL',
        caption: '',
      });
    }
    setQueuedPhotos((prev) => [...prev, ...next]);
  };

  const removeQueuedPhoto = (id: string) => {
    setQueuedPhotos((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  };

  const createMutation = useMutation({
    mutationFn: async (values: GarmentFormValues) => {
      const res = await apiFetch<{ id: string }>('/api/v1/garments', {
        method: 'POST',
        body: JSON.stringify({
          ...values,
          orderId: defaultOrderId || values.orderId,
        }),
      });
      const garmentId = res.data.id;

      if (queuedPhotos.length > 0) {
        setUploadingPhotos(true);
        for (const p of queuedPhotos) {
          const { originalBlob, thumbnailBlob } = await prepareCompressedImageAndThumb(p.file);
          const fd = new FormData();
          fd.append('file', originalBlob, p.file.name);
          fd.append('thumbnail', thumbnailBlob, `thumb_${p.file.name}.webp`);
          fd.append('photoType', p.photoType);
          if (p.caption) fd.append('caption', p.caption);
          await apiFetch(`/api/v1/garments/${garmentId}/photos`, {
            method: 'POST',
            body: fd,
          });
        }
      }
      return garmentId;
    },
    onSuccess: (garmentId) => {
      setUploadingPhotos(false);
      queuedPhotos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
      setQueuedPhotos([]);
      form.reset({
        orderId: defaultOrderId || '',
        templateCode: 'FULL_DETAILING',
        garmentName: '',
        category: 'Pakaian Formal',
        garmentType: '',
        brand: '',
        color: '',
        size: '',
        physicalTagNumber: '',
        distinctiveFeatures: '',
        initialCondition: 'Baik, perlu pembersihan detailing',
        stainDescription: '',
        specialInstructions: '',
      });
      queryClient.invalidateQueries({ queryKey: ['garments'] });
      queryClient.invalidateQueries({ queryKey: ['order-detail'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
      notify('success', 'Barang dan foto referensi berhasil didaftarkan.');
      onClose();
      if (onSuccess) onSuccess(garmentId);
    },
    onError: (err) => {
      setUploadingPhotos(false);
      notify(
        'error',
        err instanceof ApiClientError ? err.message : 'Gagal mendaftarkan barang.'
      );
    },
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Daftarkan Barang Individual"
      subtitle="Setiap item pakaian wajib dicatat terpisah beserta nomor tag fisik dan foto referensi."
      maxWidth="max-w-2xl"
    >
      <form
        onSubmit={form.handleSubmit((vals) => createMutation.mutate(vals))}
        className="space-y-4"
      >
        {!defaultOrderId && (
          <div>
            <label className="block text-xs font-semibold text-[#12345A] mb-1">
              Pesanan Induk *
            </label>
            <select
              {...form.register('orderId')}
              className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:border-[#0756B8]"
            >
              <option value="">-- Pilih Pesanan Aktif --</option>
              {activeOrders?.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.orderCode} — {o.customerName}
                </option>
              ))}
            </select>
            {form.formState.errors.orderId && (
              <p className="mt-1 text-xs text-red-600">{form.formState.errors.orderId.message}</p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-semibold text-[#12345A] mb-1">
              Nomor Tag Fisik ALMOS *
            </label>
            <input
              {...form.register('physicalTagNumber')}
              placeholder="Contoh: TAG-4082"
              className="w-full h-11 px-3.5 rounded-xl border border-slate-200 font-mono text-sm focus:outline-none focus:border-[#0756B8]"
            />
            {form.formState.errors.physicalTagNumber && (
              <p className="mt-1 text-xs text-red-600">
                {form.formState.errors.physicalTagNumber.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#12345A] mb-1">
              Alur Layanan / Divisi *
            </label>
            <select
              {...form.register('templateCode')}
              className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:border-[#0756B8]"
            >
              {templates?.map((t) => (
                <option key={t.id} value={t.code}>
                  {t.name}
                </option>
              )) || <option value="FULL_DETAILING">Full Detailing (Spotting → Ironing → Packing)</option>}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-semibold text-[#12345A] mb-1">
              Nama Barang *
            </label>
            <input
              {...form.register('garmentName')}
              placeholder="Contoh: Blazer Hitam Zara"
              className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#0756B8]"
            />
            {form.formState.errors.garmentName && (
              <p className="mt-1 text-xs text-red-600">
                {form.formState.errors.garmentName.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#12345A] mb-1">
              Kategori Barang *
            </label>
            <select
              {...form.register('category')}
              className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:border-[#0756B8]"
            >
              <option value="Pakaian Formal">Pakaian Formal (Jas / Blazer / Gaun)</option>
              <option value="Pakaian Harian">Pakaian Harian (Kemeja / Celana / Kaos)</option>
              <option value="Busana Adat & Kebaya">Busana Adat & Kebaya</option>
              <option value="Linen Hotel & Villa">Linen Hotel & Villa (Handuk / Sprei / Duvet)</option>
              <option value="Aksesoris & Lainnya">Aksesoris & Lainnya</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[#12345A] mb-1">Jenis *</label>
            <input
              {...form.register('garmentType')}
              placeholder="Blazer / Dress"
              className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#0756B8]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#12345A] mb-1">Merek</label>
            <input
              {...form.register('brand')}
              placeholder="Zara / Lokal"
              className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#0756B8]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#12345A] mb-1">Warna *</label>
            <input
              {...form.register('color')}
              placeholder="Hitam / Putih"
              className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#0756B8]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#12345A] mb-1">Ukuran</label>
            <input
              {...form.register('size')}
              placeholder="M / L / King"
              className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#0756B8]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-semibold text-[#12345A] mb-1">
              Kondisi Awal *
            </label>
            <input
              {...form.register('initialCondition')}
              placeholder="Kancing lengkap, bahan halus"
              className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#0756B8]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#12345A] mb-1">
              Ciri Khusus / Pembeda
            </label>
            <input
              {...form.register('distinctiveFeatures')}
              placeholder="Contoh: Kancing emas, bordir di saku kiri"
              className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#0756B8]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-semibold text-[#12345A] mb-1">
              Deskripsi Noda
            </label>
            <textarea
              rows={2}
              {...form.register('stainDescription')}
              placeholder="Lokasi & jenis noda (jika ada)"
              className="w-full p-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#0756B8]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#12345A] mb-1">
              Instruksi Penanganan Khusus
            </label>
            <textarea
              rows={2}
              {...form.register('specialInstructions')}
              placeholder="Contoh: Jangan pakai suhu tinggi, steam saja"
              className="w-full p-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#0756B8]"
            />
          </div>
        </div>

        {/* Multi-Photo Reference Upload */}
        <div className="rounded-2xl border border-dashed border-[#0756B8]/40 bg-[#EAF3FF]/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold text-[#12345A]">Foto Referensi Barang (Opsional)</p>
              <p className="text-[11px] text-slate-500">
                Unggah foto tampak depan, belakang, label, tag fisik, atau detail noda.
              </p>
            </div>
            <label className="min-h-[40px] px-3.5 py-2 rounded-xl bg-white border border-[#0756B8]/30 text-xs font-semibold text-[#0756B8] hover:bg-[#EAF3FF] cursor-pointer inline-flex items-center gap-1.5">
              <Camera className="h-4 w-4" />
              Tambah Foto
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={(e) => handleSelectFiles(e.target.files)}
                className="hidden"
              />
            </label>
          </div>

          {queuedPhotos.length > 0 && (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {queuedPhotos.map((qp) => (
                <div
                  key={qp.id}
                  className="flex items-center gap-2.5 rounded-xl bg-white border border-slate-200 p-2"
                >
                  <img
                    src={qp.previewUrl}
                    alt="Pratinjau foto"
                    className="h-14 w-14 rounded-lg object-cover shrink-0"
                  />
                  <div className="flex-1 min-w-0 space-y-1">
                    <select
                      value={qp.photoType}
                      onChange={(e) =>
                        setQueuedPhotos((prev) =>
                          prev.map((item) =>
                            item.id === qp.id
                              ? { ...item, photoType: e.target.value as PhotoType }
                              : item
                          )
                        )
                      }
                      className="w-full h-8 px-2 rounded-lg border border-slate-200 text-xs bg-white"
                    >
                      {Object.entries(PHOTO_TYPE_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                    <input
                      value={qp.caption}
                      onChange={(e) =>
                        setQueuedPhotos((prev) =>
                          prev.map((item) =>
                            item.id === qp.id ? { ...item, caption: e.target.value } : item
                          )
                        )
                      }
                      placeholder="Keterangan singkat..."
                      className="w-full h-7 px-2 rounded-lg border border-slate-200 text-xs"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeQueuedPhoto(qp.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                    aria-label="Hapus foto dari antrean"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pt-2 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={createMutation.isPending || uploadingPhotos}
            className="min-h-[44px] px-5 rounded-xl bg-[#0756B8] hover:bg-[#064596] text-white text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            {uploadingPhotos
              ? 'Mengunggah Foto...'
              : createMutation.isPending
              ? 'Mendaftarkan...'
              : 'Simpan & Masuk Antrean'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
