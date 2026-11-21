import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Images, Search, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { AppRoute } from '../../components/layout/AppShell.tsx';
import {
  AuthorizedImage,
  ConfirmDialog,
  EmptyState,
  ErrorBanner,
  LoadingSkeleton,
  Modal,
  PaginationBar,
} from '../../components/ui/Primitives.tsx';
import { useAuth } from '../../contexts/AuthContext.tsx';
import { apiFetch, ApiClientError } from '../../lib/api.ts';
import { PHOTO_TYPE_LABELS } from '../../lib/labels.ts';
import type { PhotoType } from '../../shared/types.ts';

interface GalleryItem {
  id: string;
  garmentId: string;
  photoType: PhotoType;
  caption: string | null;
  garmentCode: string;
  garmentName: string;
  physicalTagNumber: string;
  color: string;
  brand: string | null;
  orderCode: string;
  customerName: string;
  thumbnailUrl: string;
  originalUrl: string;
}

export function PhotoGalleryPage({ onNavigate }: { onNavigate: (p: AppRoute) => void }) {
  const { notify } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [photoType, setPhotoType] = useState('');
  const [search, setSearch] = useState('');
  const [lightbox, setLightbox] = useState<GalleryItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['photo-gallery', page, photoType, search],
    queryFn: async () => {
      const qs = new URLSearchParams({ page: String(page), perPage: '24' });
      if (photoType) qs.set('photoType', photoType);
      if (search.trim()) qs.set('search', search.trim());
      return apiFetch<GalleryItem[]>(`/api/v1/photos?${qs.toString()}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiFetch(`/api/v1/photos/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      setDeleteId(null);
      queryClient.invalidateQueries({ queryKey: ['photo-gallery'] });
      notify('info', 'Foto dihapus dan dicatat dalam audit log.');
    },
    onError: (err) => {
      notify('error', err instanceof ApiClientError ? err.message : 'Gagal menghapus foto.');
    },
  });

  const items = data?.data || [];
  const meta = data?.meta;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[#12345A]">Galeri Foto Referensi</h1>
        <p className="text-sm text-slate-500">
          Foto terkompresi (thumbnail) dimuat cepat untuk identifikasi cadangan jika tag fisik lepas.
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
            placeholder="Cari tag fisik, barang, merek, atau pelanggan..."
            className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#0756B8]"
          />
        </div>
        <select
          value={photoType}
          onChange={(e) => {
            setPhotoType(e.target.value);
            setPage(1);
          }}
          className="h-10 px-3 rounded-xl border border-slate-200 text-sm bg-white"
        >
          <option value="">Semua Jenis Foto</option>
          {Object.entries(PHOTO_TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <LoadingSkeleton rows={4} />
      ) : isError ? (
        <ErrorBanner
          message={error instanceof Error ? error.message : 'Gagal memuat galeri foto.'}
          onRetry={() => refetch()}
        />
      ) : items.length === 0 ? (
        <EmptyState
          title="Belum ada foto referensi."
          description="Foto barang yang diunggah saat registrasi atau inspeksi staf akan tampil di sini."
          icon={<Images className="h-6 w-6" />}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5">
            {items.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl bg-white border border-slate-200/90 overflow-hidden shadow-xs flex flex-col"
              >
                <button
                  type="button"
                  onClick={() => setLightbox(item)}
                  className="aspect-[4/3] w-full overflow-hidden bg-slate-100"
                >
                  <AuthorizedImage src={item.thumbnailUrl} alt={item.garmentName} />
                </button>
                <div className="p-3 flex-1 flex flex-col justify-between gap-2">
                  <div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[11px] font-bold text-[#0756B8]">
                        {PHOTO_TYPE_LABELS[item.photoType]}
                      </span>
                      <span className="font-mono text-[11px] text-slate-500">
                        Tag {item.physicalTagNumber}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onNavigate(`/barang/${item.garmentId}`)}
                      className="mt-1 text-left text-xs font-bold text-[#12345A] hover:text-[#0756B8] line-clamp-1"
                    >
                      {item.garmentName}
                    </button>
                    <p className="text-[11px] text-slate-500 truncate">{item.customerName}</p>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setDeleteId(item.id)}
                      className="text-[11px] text-slate-400 hover:text-red-600 inline-flex items-center gap-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Hapus
                    </button>
                  </div>
                </div>
              </div>
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
        </>
      )}

      <Modal
        open={Boolean(lightbox)}
        onClose={() => setLightbox(null)}
        title={lightbox ? `${lightbox.garmentName} — ${PHOTO_TYPE_LABELS[lightbox.photoType]}` : ''}
        subtitle={
          lightbox
            ? `Tag ${lightbox.physicalTagNumber} · ${lightbox.customerName} (${lightbox.orderCode})`
            : undefined
        }
        maxWidth="max-w-3xl"
      >
        {lightbox && (
          <div className="space-y-3">
            <div className="rounded-xl overflow-hidden bg-slate-950 max-h-[65vh] flex items-center justify-center">
              <AuthorizedImage
                src={lightbox.originalUrl}
                alt={lightbox.garmentName}
                className="max-h-[63vh] w-auto object-contain"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  const id = lightbox.garmentId;
                  setLightbox(null);
                  onNavigate(`/barang/${id}`);
                }}
                className="min-h-[40px] px-4 rounded-xl bg-[#0756B8] text-white text-xs font-semibold"
              >
                Buka Detail Barang
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteId)}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        title="Hapus Foto"
        message="Foto akan dihapus secara lembut (soft delete) dan tercatat di audit log."
        confirmLabel="Hapus"
        danger
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}
