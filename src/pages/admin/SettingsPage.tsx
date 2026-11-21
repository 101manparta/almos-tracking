import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ErrorBanner, LoadingSkeleton } from '../../components/ui/Primitives.tsx';
import { useAuth } from '../../contexts/AuthContext.tsx';
import { apiFetch, ApiClientError } from '../../lib/api.ts';

export function SettingsPage() {
  const { notify } = useAuth();
  const queryClient = useQueryClient();
  const [spottingHours, setSpottingHours] = useState(12);
  const [ironingHours, setIroningHours] = useState(12);
  const [packingHours, setPackingHours] = useState(8);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['system-settings'],
    queryFn: async () => {
      const res = await apiFetch<Record<string, unknown>>('/api/v1/settings');
      return res.data;
    },
  });

  useEffect(() => {
    const sla = data?.sla_hours as Record<string, number> | undefined;
    if (sla) {
      if (typeof sla.SPOTTING === 'number') setSpottingHours(sla.SPOTTING);
      if (typeof sla.IRONING === 'number') setIroningHours(sla.IRONING);
      if (typeof sla.PACKING === 'number') setPackingHours(sla.PACKING);
    }
  }, [data]);

  const saveSlaMutation = useMutation({
    mutationFn: async () =>
      apiFetch('/api/v1/settings/sla_hours', {
        method: 'PATCH',
        body: JSON.stringify({
          value: {
            SPOTTING: spottingHours,
            IRONING: ironingHours,
            PACKING: packingHours,
          },
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-settings'] });
      notify('success', 'Pengaturan SLA divisi berhasil disimpan.');
    },
    onError: (err) => {
      notify('error', err instanceof ApiClientError ? err.message : 'Gagal menyimpan pengaturan.');
    },
  });

  if (isLoading) return <LoadingSkeleton rows={3} />;
  if (isError) {
    return (
      <ErrorBanner
        message={error instanceof Error ? error.message : 'Gagal memuat pengaturan.'}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-[#12345A]">Pengaturan Sistem</h1>
        <p className="text-sm text-slate-500">
          Konfigurasi batas waktu target (SLA) per divisi dan kebijakan operasional ALMOS.
        </p>
      </div>

      <div className="rounded-2xl bg-white border border-slate-200/90 p-5 shadow-xs space-y-4">
        <h2 className="text-base font-bold text-[#12345A]">Target SLA Pengerjaan per Divisi (Jam)</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#12345A] mb-1">
              Spotting (Jam)
            </label>
            <input
              type="number"
              min={1}
              max={168}
              value={spottingHours}
              onChange={(e) => setSpottingHours(Number(e.target.value))}
              className="w-full h-11 px-3.5 rounded-xl border border-slate-200 font-mono text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#12345A] mb-1">
              Ironing (Jam)
            </label>
            <input
              type="number"
              min={1}
              max={168}
              value={ironingHours}
              onChange={(e) => setIroningHours(Number(e.target.value))}
              className="w-full h-11 px-3.5 rounded-xl border border-slate-200 font-mono text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#12345A] mb-1">
              Packing (Jam)
            </label>
            <input
              type="number"
              min={1}
              max={168}
              value={packingHours}
              onChange={(e) => setPackingHours(Number(e.target.value))}
              className="w-full h-11 px-3.5 rounded-xl border border-slate-200 font-mono text-sm"
            />
          </div>
        </div>

        <div className="pt-2">
          <button
            type="button"
            disabled={saveSlaMutation.isPending}
            onClick={() => saveSlaMutation.mutate()}
            className="min-h-[44px] px-5 rounded-xl bg-[#0756B8] hover:bg-[#064596] text-white text-sm font-semibold inline-flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            {saveSlaMutation.isPending ? 'Menyimpan...' : 'Simpan Pengaturan SLA'}
          </button>
        </div>
      </div>

      <div className="rounded-2xl bg-white border border-slate-200/90 p-5 shadow-xs space-y-2 text-xs text-slate-600">
        <p className="text-sm font-bold text-[#12345A]">Kebijakan Tag Fisik & Penyimpanan Foto</p>
        <p>
          • Sistem mempertahankan nomor tag fisik manual ALMOS tanpa mewajibkan QR/barcode/RFID.
        </p>
        <p>
          • Foto disimpan secara privat (maksimal 10 MB, format JPEG/PNG/WebP dengan thumbnail
          terkompresi).
        </p>
      </div>
    </div>
  );
}
