import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  CheckCircle2,
  CheckSquare,
  Edit3,
  PauseCircle,
  Play,
  PlayCircle,
  Send,
  Trash2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { AppRoute } from '../../components/layout/AppShell.tsx';
import {
  AuthorizedImage,
  ConfirmDialog,
  ErrorBanner,
  LoadingSkeleton,
  Modal,
  StatusBadge,
} from '../../components/ui/Primitives.tsx';
import { useAuth } from '../../contexts/AuthContext.tsx';
import { apiFetch, ApiClientError } from '../../lib/api.ts';
import { prepareCompressedImageAndThumb } from '../../lib/image-utils.ts';
import {
  DEPARTMENT_LABELS,
  formatDateTime,
  ISSUE_SEVERITY_LABELS,
  ISSUE_TYPE_LABELS,
  PHOTO_TYPE_LABELS,
} from '../../lib/labels.ts';
import type {
  Department,
  GarmentStatus,
  IssueSeverity,
  IssueType,
  PhotoType,
  TagStatus,
} from '../../shared/types.ts';

interface GarmentDetailData {
  id: string;
  garmentCode: string;
  orderId: string;
  orderCode: string;
  customerName: string;
  customerPhone: string;
  orderCategory: string;
  garmentName: string;
  category: string;
  garmentType: string;
  brand: string | null;
  color: string;
  size: string | null;
  physicalTagNumber: string;
  tagStatus: TagStatus;
  distinctiveFeatures: string | null;
  initialCondition: string;
  stainDescription: string | null;
  specialInstructions: string | null;
  currentDepartment: Department;
  currentStatus: GarmentStatus;
  templateName: string;
  registrantName: string;
  version: number;
  createdAt: string;
  stages: Array<{
    id: string;
    department: string;
    stageOrder: number;
    status: string;
    startedAt: string | null;
    completedAt: string | null;
  }>;
  photos: Array<{
    id: string;
    photoType: PhotoType;
    caption: string | null;
    uploadedByName: string;
    createdAt: string;
    thumbnailUrl: string;
    originalUrl: string;
  }>;
  history: Array<{
    id: string;
    previousStatus: string;
    newStatus: string;
    fromDepartment: string | null;
    toDepartment: string | null;
    performedByName: string;
    notes: string | null;
    createdAt: string;
  }>;
  issues: Array<{
    id: string;
    department: string;
    issueType: IssueType;
    severity: IssueSeverity;
    description: string;
    resolutionStatus: string;
    reportedByName: string;
    resolutionNotes: string | null;
    createdAt: string;
  }>;
  handovers: Array<{
    id: string;
    fromDepartment: string;
    toDepartment: string;
    handedOverByName: string;
    physicalTagVerified: boolean;
    conditionNotes: string | null;
    handedOverAt: string;
  }>;
  checklists: Array<{
    id: string;
    department: string;
    identityVerified: boolean;
    verificationMethod: 'PHYSICAL_TAG' | 'PHOTO_AND_DETAILS_BACKUP';
    isComplete: boolean;
    items: Array<{
      id: string;
      itemKey: string;
      label: string;
      isChecked: boolean;
      note: string | null;
    }>;
  }>;
}

export function GarmentDetailPage({
  garmentId,
  onNavigate,
}: {
  garmentId: string;
  onNavigate: (p: AppRoute) => void;
}) {
  const { user, notify } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'ADMIN';

  const [lightboxPhoto, setLightboxPhoto] = useState<{ url: string; label: string } | null>(null);
  const [deletePhotoId, setDeletePhotoId] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadType, setUploadType] = useState<PhotoType>('FRONT');
  const [uploadCaption, setUploadCaption] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const [startMethod, setStartMethod] = useState<'PHYSICAL_TAG' | 'PHOTO_AND_DETAILS_BACKUP'>(
    'PHYSICAL_TAG'
  );
  const [startConfirmOpen, setStartConfirmOpen] = useState(false);
  const [handoverOpen, setHandoverOpen] = useState(false);
  const [handoverNotes, setHandoverNotes] = useState('');

  const [holdOpen, setHoldOpen] = useState(false);
  const [holdReason, setHoldReason] = useState('');

  const [issueOpen, setIssueOpen] = useState(false);
  const [issueType, setIssueType] = useState<IssueType>('STAIN_PERSISTS');
  const [issueSeverity, setIssueSeverity] = useState<IssueSeverity>('MEDIUM');
  const [issueDesc, setIssueDesc] = useState('');
  const [issueHold, setIssueHold] = useState(false);

  const [editTagOpen, setEditTagOpen] = useState(false);
  const [editTagValue, setEditTagValue] = useState('');
  const [editTagStatus, setEditTagStatus] = useState<TagStatus>('ATTACHED');

  // Local checklist state synced with active department checklist
  const [identityVerified, setIdentityVerified] = useState(false);
  const [verificationMethod, setVerificationMethod] = useState<
    'PHYSICAL_TAG' | 'PHOTO_AND_DETAILS_BACKUP'
  >('PHYSICAL_TAG');
  const [checkedMap, setCheckedMap] = useState<Record<string, boolean>>({});

  const { data: garment, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['garment-detail', garmentId],
    queryFn: async () => {
      const res = await apiFetch<GarmentDetailData>(`/api/v1/garments/${garmentId}`);
      return res.data;
    },
  });

  const activeStaffChecklist = garment?.checklists.find((c) => c.department === user?.role);

  useEffect(() => {
    if (garment?.tagStatus === 'MISSING') {
      setStartMethod('PHOTO_AND_DETAILS_BACKUP');
      setVerificationMethod('PHOTO_AND_DETAILS_BACKUP');
    }
    if (activeStaffChecklist) {
      setIdentityVerified(activeStaffChecklist.identityVerified);
      setVerificationMethod(activeStaffChecklist.verificationMethod);
      const nextMap: Record<string, boolean> = {};
      for (const item of activeStaffChecklist.items) {
        nextMap[item.itemKey] = item.isChecked;
      }
      setCheckedMap(nextMap);
    }
  }, [garment?.id, garment?.tagStatus, activeStaffChecklist?.id, activeStaffChecklist?.isComplete]);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['garment-detail', garmentId] });
    queryClient.invalidateQueries({ queryKey: ['staff-queue'] });
    queryClient.invalidateQueries({ queryKey: ['staff-dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['garments'] });
    queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
    queryClient.invalidateQueries({ queryKey: ['header-open-issues'] });
  };

  const startMutation = useMutation({
    mutationFn: async () => {
      if (!garment) return;
      return apiFetch(`/api/v1/garments/${garment.id}/start`, {
        method: 'POST',
        body: JSON.stringify({
          version: garment.version,
          verificationMethod: startMethod,
        }),
      });
    },
    onSuccess: () => {
      setStartConfirmOpen(false);
      invalidateAll();
      notify('success', 'Tugas divisi dimulai. Silakan lengkapi checklist pengerjaan.');
    },
    onError: (err) => {
      notify('error', err instanceof ApiClientError ? err.message : 'Gagal memulai pekerjaan.');
    },
  });

  const saveChecklistMutation = useMutation({
    mutationFn: async () => {
      if (!garment || !activeStaffChecklist) return;
      return apiFetch(`/api/v1/garments/${garment.id}/checklist`, {
        method: 'POST',
        body: JSON.stringify({
          identityVerified,
          verificationMethod,
          items: activeStaffChecklist.items.map((item) => ({
            itemKey: item.itemKey,
            isChecked: Boolean(checkedMap[item.itemKey]),
            note: null,
          })),
        }),
      });
    },
    onSuccess: () => {
      invalidateAll();
      notify('success', 'Checklist divisi berhasil disimpan.');
    },
    onError: (err) => {
      notify('error', err instanceof ApiClientError ? err.message : 'Gagal menyimpan checklist.');
    },
  });

  const handoverMutation = useMutation({
    mutationFn: async () => {
      if (!garment) return;
      return apiFetch(`/api/v1/garments/${garment.id}/handover`, {
        method: 'POST',
        body: JSON.stringify({
          version: garment.version,
          physicalTagVerified: identityVerified,
          conditionNotes: handoverNotes || null,
          idempotencyKey: `ho-${garment.id}-${garment.version}`,
        }),
      });
    },
    onSuccess: () => {
      setHandoverOpen(false);
      setHandoverNotes('');
      invalidateAll();
      notify('success', 'Pekerjaan selesai dan barang berhasil diserahterimakan.');
    },
    onError: (err) => {
      notify('error', err instanceof ApiClientError ? err.message : 'Gagal serah terima barang.');
    },
  });

  const holdMutation = useMutation({
    mutationFn: async () => {
      if (!garment) return;
      return apiFetch(`/api/v1/garments/${garment.id}/hold`, {
        method: 'POST',
        body: JSON.stringify({ version: garment.version, reason: holdReason }),
      });
    },
    onSuccess: () => {
      setHoldOpen(false);
      setHoldReason('');
      invalidateAll();
      notify('info', 'Barang dipindahkan ke status ON_HOLD.');
    },
    onError: (err) => {
      notify('error', err instanceof ApiClientError ? err.message : 'Gagal menahan barang.');
    },
  });

  const resumeMutation = useMutation({
    mutationFn: async () => {
      if (!garment) return;
      return apiFetch(`/api/v1/garments/${garment.id}/resume`, {
        method: 'POST',
        body: JSON.stringify({
          version: garment.version,
          notes: 'Dilanjutkan oleh Administrator',
        }),
      });
    },
    onSuccess: () => {
      invalidateAll();
      notify('success', 'Barang dikembalikan ke antrean divisi.');
    },
    onError: (err) => {
      notify('error', err instanceof ApiClientError ? err.message : 'Gagal melanjutkan proses.');
    },
  });

  const issueMutation = useMutation({
    mutationFn: async () => {
      if (!garment) return;
      return apiFetch(`/api/v1/garments/${garment.id}/issues`, {
        method: 'POST',
        body: JSON.stringify({
          issueType,
          severity: issueSeverity,
          description: issueDesc,
          putsGarmentOnHold: issueHold,
          version: garment.version,
        }),
      });
    },
    onSuccess: () => {
      setIssueOpen(false);
      setIssueDesc('');
      setIssueHold(false);
      invalidateAll();
      notify('success', 'Laporan kendala berhasil disimpan.');
    },
    onError: (err) => {
      notify('error', err instanceof ApiClientError ? err.message : 'Gagal melaporkan kendala.');
    },
  });

  const uploadPhotoMutation = useMutation({
    mutationFn: async () => {
      if (!garment || !uploadFile) return;
      const { originalBlob, thumbnailBlob } = await prepareCompressedImageAndThumb(uploadFile);
      const fd = new FormData();
      fd.append('file', originalBlob, uploadFile.name);
      fd.append('thumbnail', thumbnailBlob, `thumb_${uploadFile.name}.webp`);
      fd.append('photoType', uploadType);
      if (uploadCaption) fd.append('caption', uploadCaption);
      return apiFetch(`/api/v1/garments/${garment.id}/photos`, {
        method: 'POST',
        body: fd,
      });
    },
    onSuccess: () => {
      setUploadOpen(false);
      setUploadFile(null);
      setUploadCaption('');
      invalidateAll();
      notify('success', 'Foto referensi berhasil diunggah.');
    },
    onError: (err) => {
      notify('error', err instanceof ApiClientError ? err.message : 'Gagal mengunggah foto.');
    },
  });

  const deletePhotoMutation = useMutation({
    mutationFn: async (photoId: string) => {
      return apiFetch(`/api/v1/photos/${photoId}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      setDeletePhotoId(null);
      invalidateAll();
      notify('info', 'Foto dihapus dari galeri aktif (tercatat di audit log).');
    },
    onError: (err) => {
      notify('error', err instanceof ApiClientError ? err.message : 'Gagal menghapus foto.');
    },
  });

  const updateTagMutation = useMutation({
    mutationFn: async () => {
      if (!garment) return;
      return apiFetch(`/api/v1/garments/${garment.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          version: garment.version,
          physicalTagNumber: editTagValue,
          tagStatus: editTagStatus,
        }),
      });
    },
    onSuccess: () => {
      setEditTagOpen(false);
      invalidateAll();
      notify('success', 'Informasi tag fisik diperbarui.');
    },
    onError: (err) => {
      notify('error', err instanceof ApiClientError ? err.message : 'Gagal memperbarui tag.');
    },
  });

  if (isLoading) return <LoadingSkeleton rows={6} />;
  if (isError || !garment) {
    return (
      <ErrorBanner
        message={error instanceof Error ? error.message : 'Gagal memuat detail barang.'}
        onRetry={() => refetch()}
      />
    );
  }

  const isStaffOwnDept = !isAdmin && user?.role === garment.currentDepartment;
  const canStart = isStaffOwnDept && garment.currentStatus === `WAITING_${user?.role}`;
  const isInProgressHere =
    isStaffOwnDept && garment.currentStatus === `${user?.role}_IN_PROGRESS`;
  const allChecklistChecked =
    Boolean(activeStaffChecklist) &&
    activeStaffChecklist!.items.every((i) => Boolean(checkedMap[i.itemKey]));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => onNavigate(isAdmin ? '/barang' : '/staff/antrean')}
          className="min-h-[40px] px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-[#12345A] hover:bg-slate-50 inline-flex items-center gap-1.5"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            className="min-h-[42px] px-3.5 rounded-xl border border-[#0756B8]/30 bg-[#EAF3FF] text-xs font-semibold text-[#0756B8] hover:bg-[#dbeafe] inline-flex items-center gap-1.5"
          >
            <Camera className="h-4 w-4" />
            Unggah Foto
          </button>

          {garment.currentStatus !== 'PICKED_UP' && garment.currentStatus !== 'READY_FOR_PICKUP' && (
            <button
              type="button"
              onClick={() => setIssueOpen(true)}
              className="min-h-[42px] px-3.5 rounded-xl border border-[#F7941D]/40 bg-[#FFF3E4] text-xs font-semibold text-[#B45309] hover:bg-amber-100 inline-flex items-center gap-1.5"
            >
              <AlertTriangle className="h-4 w-4" />
              Lapor Kendala
            </button>
          )}

          {isAdmin && garment.currentStatus === 'ON_HOLD' && (
            <button
              type="button"
              onClick={() => resumeMutation.mutate()}
              disabled={resumeMutation.isPending}
              className="min-h-[42px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <PlayCircle className="h-4 w-4" />
              Lanjutkan dari Hold
            </button>
          )}

          {(isAdmin || isStaffOwnDept) &&
            garment.currentStatus !== 'ON_HOLD' &&
            garment.currentStatus !== 'READY_FOR_PICKUP' &&
            garment.currentStatus !== 'PICKED_UP' &&
            garment.currentStatus !== 'REGISTERED' && (
              <button
                type="button"
                onClick={() => setHoldOpen(true)}
                className="min-h-[42px] px-3.5 rounded-xl border border-red-200 bg-red-50 text-xs font-semibold text-red-700 hover:bg-red-100 inline-flex items-center gap-1.5"
              >
                <PauseCircle className="h-4 w-4" />
                Tahan (On Hold)
              </button>
            )}
        </div>
      </div>

      {/* Garment Identity & Tag Verification Header */}
      <div className="rounded-2xl bg-white border border-slate-200/90 p-5 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-mono font-bold text-[#0756B8]">{garment.garmentCode}</span>
              <span className="text-slate-300">·</span>
              <button
                type="button"
                onClick={() => isAdmin && onNavigate(`/pesanan/${garment.orderId}`)}
                className="font-mono text-slate-600 hover:text-[#0756B8]"
              >
                {garment.orderCode}
              </button>
              <span className="text-slate-300">·</span>
              <span className="font-semibold text-[#12345A]">{garment.customerName}</span>
            </div>
            <h1 className="mt-1.5 text-xl sm:text-2xl font-bold text-[#12345A]">
              {garment.garmentName}
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              {garment.category} · {garment.garmentType} · Warna: {garment.color}
              {garment.brand ? ` · Merek: ${garment.brand}` : ''}
              {garment.size ? ` · Ukuran: ${garment.size}` : ''}
            </p>
          </div>

          <div className="flex flex-col items-end gap-1.5">
            <StatusBadge status={garment.currentStatus} />
            <span className="text-xs text-slate-500">
              {DEPARTMENT_LABELS[garment.currentDepartment]}
            </span>
          </div>
        </div>

        {/* Physical Tag Banner */}
        <div
          className={`mt-4 rounded-xl border p-3.5 flex flex-wrap items-center justify-between gap-3 ${
            garment.tagStatus === 'MISSING'
              ? 'bg-red-50 border-red-200'
              : 'bg-[#F5F8FC] border-slate-200'
          }`}
        >
          <div>
            <p className="text-xs text-slate-500">Nomor Tag Fisik ALMOS</p>
            <p className="text-lg font-mono font-bold text-[#12345A] tabular-nums">
              {garment.physicalTagNumber}{' '}
              {garment.tagStatus === 'MISSING' && (
                <span className="text-xs font-sans font-bold text-red-700 ml-1">
                  (TAG HILANG — Wajib verifikasi foto & detail!)
                </span>
              )}
            </p>
          </div>
          {isAdmin && garment.currentStatus !== 'PICKED_UP' && (
            <button
              type="button"
              onClick={() => {
                setEditTagValue(garment.physicalTagNumber);
                setEditTagStatus(garment.tagStatus);
                setEditTagOpen(true);
              }}
              className="min-h-[38px] px-3 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-[#12345A] hover:bg-slate-50 inline-flex items-center gap-1.5"
            >
              <Edit3 className="h-3.5 w-3.5" />
              Perbarui Tag
            </button>
          )}
        </div>

        {/* Descriptive Verification Details */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 text-xs">
          <div className="rounded-xl bg-[#F5F8FC] p-3">
            <p className="text-slate-500">Alur Layanan</p>
            <p className="mt-0.5 font-semibold text-[#12345A]">{garment.templateName}</p>
          </div>
          <div className="rounded-xl bg-[#F5F8FC] p-3">
            <p className="text-slate-500">Kondisi Awal</p>
            <p className="mt-0.5 font-semibold text-[#12345A]">{garment.initialCondition}</p>
          </div>
          <div className="rounded-xl bg-[#F5F8FC] p-3">
            <p className="text-slate-500">Ciri Khusus</p>
            <p className="mt-0.5 font-semibold text-[#12345A]">
              {garment.distinctiveFeatures || '—'}
            </p>
          </div>
          <div className="rounded-xl bg-[#F5F8FC] p-3">
            <p className="text-slate-500">Catatan Noda / Instruksi</p>
            <p className="mt-0.5 font-semibold text-[#12345A]">
              {[garment.stainDescription, garment.specialInstructions]
                .filter(Boolean)
                .join(' · ') || '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Staff Operational Workstation Panel */}
      {isStaffOwnDept && (canStart || isInProgressHere) && (
        <div className="rounded-2xl bg-white border-2 border-[#0756B8]/30 p-5 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-[#12345A]">
                Panel Kerja Divisi {user?.role}
              </h2>
              <p className="text-xs text-slate-500">
                Verifikasi identitas pakaian sebelum memulai dan selesaikan checklist sebelum serah
                terima.
              </p>
            </div>
            {canStart && (
              <button
                type="button"
                onClick={() => setStartConfirmOpen(true)}
                className="min-h-[48px] px-5 rounded-xl bg-[#0756B8] hover:bg-[#064596] text-white text-sm font-semibold inline-flex items-center gap-2 shadow-sm"
              >
                <Play className="h-4 w-4" />
                Terima & Mulai Kerjakan
              </button>
            )}
          </div>

          {isInProgressHere && activeStaffChecklist && (
            <div className="space-y-4 pt-2 border-t border-slate-100">
              <div className="rounded-xl bg-[#EAF3FF]/60 border border-[#0756B8]/20 p-3.5 space-y-2.5">
                <label className="flex items-start gap-3 cursor-pointer min-h-[44px]">
                  <input
                    type="checkbox"
                    checked={identityVerified}
                    onChange={(e) => setIdentityVerified(e.target.checked)}
                    className="mt-1 h-5 w-5 rounded border-slate-300 text-[#0756B8]"
                  />
                  <span className="text-xs sm:text-sm font-semibold text-[#12345A]">
                    Saya telah memverifikasi kecocokan barang (Tag fisik{' '}
                    <span className="font-mono">{garment.physicalTagNumber}</span>, warna{' '}
                    {garment.color}, pemilik {garment.customerName}, dan foto referensi).
                  </span>
                </label>

                <div className="flex flex-wrap items-center gap-3 text-xs pl-8">
                  <label className="inline-flex items-center gap-1.5">
                    <input
                      type="radio"
                      name="verifMethod"
                      checked={verificationMethod === 'PHYSICAL_TAG'}
                      disabled={garment.tagStatus === 'MISSING'}
                      onChange={() => setVerificationMethod('PHYSICAL_TAG')}
                    />
                    Tag Fisik Cocok
                  </label>
                  <label className="inline-flex items-center gap-1.5">
                    <input
                      type="radio"
                      name="verifMethod"
                      checked={verificationMethod === 'PHOTO_AND_DETAILS_BACKUP'}
                      onChange={() => setVerificationMethod('PHOTO_AND_DETAILS_BACKUP')}
                    />
                    Verifikasi Cadangan (Foto + Detail)
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold text-[#12345A] flex items-center gap-1.5">
                  <CheckSquare className="h-4 w-4 text-[#0756B8]" />
                  Checklist Divisi {user?.role}
                </p>
                {activeStaffChecklist.items.map((item) => (
                  <label
                    key={item.id}
                    className="flex items-center gap-3 min-h-[48px] px-3.5 py-2.5 rounded-xl border border-slate-200 hover:bg-[#F5F8FC] cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(checkedMap[item.itemKey])}
                      onChange={(e) =>
                        setCheckedMap((prev) => ({
                          ...prev,
                          [item.itemKey]: e.target.checked,
                        }))
                      }
                      className="h-5 w-5 rounded border-slate-300 text-[#0756B8] shrink-0"
                    />
                    <span className="text-sm text-[#12345A]">{item.label}</span>
                  </label>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => saveChecklistMutation.mutate()}
                  disabled={saveChecklistMutation.isPending}
                  className="min-h-[46px] px-4 rounded-xl border border-[#0756B8] text-[#0756B8] hover:bg-[#EAF3FF] text-sm font-semibold"
                >
                  {saveChecklistMutation.isPending ? 'Menyimpan...' : 'Simpan Progress Checklist'}
                </button>
                <button
                  type="button"
                  disabled={
                    !identityVerified ||
                    !allChecklistChecked ||
                    !activeStaffChecklist.isComplete
                  }
                  onClick={() => setHandoverOpen(true)}
                  className="min-h-[46px] px-5 rounded-xl bg-[#F7941D] hover:bg-[#e08312] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-45"
                >
                  <Send className="h-4 w-4" />
                  Selesai & Serah Terima
                </button>
              </div>
              {(!activeStaffChecklist.isComplete || !allChecklistChecked || !identityVerified) && (
                <p className="text-[11px] text-slate-500">
                  Centang seluruh checklist dan klik "Simpan Progress Checklist" untuk mengaktifkan
                  tombol Serah Terima.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Reference Photos */}
      <div className="rounded-2xl bg-white border border-slate-200/90 p-5 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-[#12345A]">
            Foto Referensi ({garment.photos.length})
          </h2>
          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            className="text-xs font-semibold text-[#0756B8] hover:underline"
          >
            + Unggah Foto Baru
          </button>
        </div>
        {garment.photos.length === 0 ? (
          <p className="text-sm text-slate-500 py-4">
            Belum ada foto referensi yang diunggah untuk barang ini.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {garment.photos.map((p) => (
              <div
                key={p.id}
                className="rounded-xl border border-slate-200 overflow-hidden bg-[#F5F8FC] flex flex-col"
              >
                <button
                  type="button"
                  onClick={() =>
                    setLightboxPhoto({
                      url: p.originalUrl,
                      label: `${PHOTO_TYPE_LABELS[p.photoType]}${p.caption ? ` — ${p.caption}` : ''}`,
                    })
                  }
                  className="aspect-[4/3] w-full overflow-hidden bg-slate-100"
                >
                  <AuthorizedImage src={p.thumbnailUrl} alt={PHOTO_TYPE_LABELS[p.photoType]} />
                </button>
                <div className="p-2.5 flex items-center justify-between gap-2 text-xs">
                  <div className="min-w-0">
                    <p className="font-semibold text-[#12345A] truncate">
                      {PHOTO_TYPE_LABELS[p.photoType]}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {p.caption || p.uploadedByName}
                    </p>
                  </div>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => setDeletePhotoId(p.id)}
                      aria-label="Hapus foto"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stage Sequence & Visual Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-5 rounded-2xl bg-white border border-slate-200/90 p-5 shadow-xs space-y-4">
          <h2 className="text-base font-bold text-[#12345A]">Tahapan Divisi Barang Ini</h2>
          <div className="space-y-2.5">
            {garment.stages.map((s) => (
              <div
                key={s.id}
                className="rounded-xl border border-slate-200/80 p-3 flex items-center justify-between gap-3"
              >
                <div>
                  <p className="text-sm font-semibold text-[#12345A]">
                    {s.stageOrder}. {DEPARTMENT_LABELS[s.department as Department] || s.department}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                    {s.completedAt
                      ? `Selesai: ${formatDateTime(s.completedAt)}`
                      : s.startedAt
                      ? `Mulai: ${formatDateTime(s.startedAt)}`
                      : 'Belum dimulai'}
                  </p>
                </div>
                <StatusBadge status={s.status} />
              </div>
            ))}
          </div>

          {garment.issues.length > 0 && (
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <h3 className="text-sm font-bold text-[#12345A]">Laporan Kendala</h3>
              {garment.issues.map((iss) => (
                <div
                  key={iss.id}
                  className="rounded-xl bg-[#FFF3E4]/60 border border-[#F7941D]/30 p-3 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-[#B45309]">
                      {ISSUE_TYPE_LABELS[iss.issueType]} ({ISSUE_SEVERITY_LABELS[iss.severity]})
                    </span>
                    <span className="font-mono text-[11px]">{iss.resolutionStatus}</span>
                  </div>
                  <p className="mt-1 text-[#12345A]">{iss.description}</p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Dilaporkan oleh {iss.reportedByName} · {formatDateTime(iss.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Chronological Workflow History */}
        <div className="lg:col-span-7 rounded-2xl bg-white border border-slate-200/90 p-5 shadow-xs">
          <h2 className="text-base font-bold text-[#12345A] mb-4">
            Riwayat Tracking Kronologis
          </h2>
          <ol className="space-y-4 relative border-l border-slate-200 ml-3 pl-5">
            {garment.history.map((h) => (
              <li key={h.id} className="relative">
                <span className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full bg-[#0756B8] ring-4 ring-white" />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <StatusBadge status={h.newStatus} />
                  <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                    {formatDateTime(h.createdAt)}
                  </span>
                </div>
                <p className="mt-1.5 text-sm text-[#12345A]">{h.notes}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Oleh <span className="font-semibold text-[#0756B8]">{h.performedByName}</span>
                </p>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* Start Confirmation Modal */}
      <Modal
        open={startConfirmOpen}
        onClose={() => setStartConfirmOpen(false)}
        title="Mulai Pekerjaan Divisi"
        subtitle="Konfirmasi kecocokan fisik pakaian sebelum memproses."
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <div className="rounded-xl bg-[#F5F8FC] border border-slate-200 p-3.5 text-xs space-y-1">
            <p className="font-bold text-[#12345A]">{garment.garmentName}</p>
            <p className="font-mono text-[#0756B8]">Tag Fisik: {garment.physicalTagNumber}</p>
            <p className="text-slate-600">
              Pemilik: {garment.customerName} · Warna: {garment.color}
            </p>
          </div>
          <div className="space-y-2 text-xs">
            <p className="font-semibold text-[#12345A]">Metode Verifikasi:</p>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={startMethod === 'PHYSICAL_TAG'}
                disabled={garment.tagStatus === 'MISSING'}
                onChange={() => setStartMethod('PHYSICAL_TAG')}
              />
              Tag fisik masih terpasang dan cocok
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={startMethod === 'PHOTO_AND_DETAILS_BACKUP'}
                onChange={() => setStartMethod('PHOTO_AND_DETAILS_BACKUP')}
              />
              Verifikasi foto referensi + detail barang & pemilik
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setStartConfirmOpen(false)}
              className="min-h-[44px] px-4 rounded-xl border border-slate-200 text-sm font-semibold"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={startMutation.isPending}
              onClick={() => startMutation.mutate()}
              className="min-h-[44px] px-5 rounded-xl bg-[#0756B8] text-white text-sm font-semibold"
            >
              {startMutation.isPending ? 'Memulai...' : 'Ya, Mulai Sekarang'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Handover Modal */}
      <Modal
        open={handoverOpen}
        onClose={() => setHandoverOpen(false)}
        title="Konfirmasi Selesai & Serah Terima"
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Barang akan dipindahkan ke antrean divisi berikutnya dan riwayat serah terima akan
            dicatat secara permanen.
          </p>
          <textarea
            rows={3}
            value={handoverNotes}
            onChange={(e) => setHandoverNotes(e.target.value)}
            placeholder="Catatan serah terima (opsional)..."
            className="w-full p-3 rounded-xl border border-slate-200 text-sm"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setHandoverOpen(false)}
              className="min-h-[44px] px-4 rounded-xl border border-slate-200 text-sm font-semibold"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={handoverMutation.isPending}
              onClick={() => handoverMutation.mutate()}
              className="min-h-[44px] px-5 rounded-xl bg-[#F7941D] text-white text-sm font-semibold"
            >
              {handoverMutation.isPending ? 'Mengirim...' : 'Konfirmasi Serah Terima'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Hold Modal */}
      <Modal
        open={holdOpen}
        onClose={() => setHoldOpen(false)}
        title="Tahan Barang (On Hold)"
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <textarea
            rows={3}
            value={holdReason}
            onChange={(e) => setHoldReason(e.target.value)}
            placeholder="Wajib tuliskan alasan penahanan barang..."
            className="w-full p-3 rounded-xl border border-slate-200 text-sm"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setHoldOpen(false)}
              className="min-h-[44px] px-4 rounded-xl border border-slate-200 text-sm font-semibold"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={holdReason.trim().length < 3 || holdMutation.isPending}
              onClick={() => holdMutation.mutate()}
              className="min-h-[44px] px-4 rounded-xl bg-red-600 text-white text-sm font-semibold disabled:opacity-50"
            >
              {holdMutation.isPending ? 'Menahan...' : 'Tahan Barang'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Report Issue Modal */}
      <Modal
        open={issueOpen}
        onClose={() => setIssueOpen(false)}
        title="Laporkan Kendala Barang"
        maxWidth="max-w-md"
      >
        <div className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-[#12345A] mb-1">Jenis Kendala</label>
            <select
              value={issueType}
              onChange={(e) => setIssueType(e.target.value as IssueType)}
              className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm bg-white"
            >
              {Object.entries(ISSUE_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#12345A] mb-1">Tingkat</label>
            <select
              value={issueSeverity}
              onChange={(e) => setIssueSeverity(e.target.value as IssueSeverity)}
              className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm bg-white"
            >
              {Object.entries(ISSUE_SEVERITY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#12345A] mb-1">Deskripsi *</label>
            <textarea
              rows={3}
              value={issueDesc}
              onChange={(e) => setIssueDesc(e.target.value)}
              placeholder="Jelaskan kendala secara rinci..."
              className="w-full p-3 rounded-xl border border-slate-200 text-sm"
            />
          </div>
          <label className="flex items-center gap-2.5 text-xs font-semibold text-[#12345A] cursor-pointer">
            <input
              type="checkbox"
              checked={issueHold}
              onChange={(e) => setIssueHold(e.target.checked)}
              className="h-4 w-4 rounded"
            />
            Pindahkan barang ke status ON_HOLD sampai Admin menyelesaikan kendala
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIssueOpen(false)}
              className="min-h-[44px] px-4 rounded-xl border border-slate-200 text-sm font-semibold"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={issueDesc.trim().length < 5 || issueMutation.isPending}
              onClick={() => issueMutation.mutate()}
              className="min-h-[44px] px-4 rounded-xl bg-[#F7941D] text-white text-sm font-semibold disabled:opacity-50"
            >
              {issueMutation.isPending ? 'Mengirim...' : 'Kirim Laporan'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Upload Photo Modal */}
      <Modal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        title="Unggah Foto Referensi"
        maxWidth="max-w-md"
      >
        <div className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-[#12345A] mb-1">Kategori Foto</label>
            <select
              value={uploadType}
              onChange={(e) => setUploadType(e.target.value as PhotoType)}
              className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm bg-white"
            >
              {Object.entries(PHOTO_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#12345A] mb-1">Pilih Gambar *</label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              className="w-full text-xs file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-[#EAF3FF] file:text-[#0756B8] file:font-semibold"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#12345A] mb-1">Keterangan</label>
            <input
              value={uploadCaption}
              onChange={(e) => setUploadCaption(e.target.value)}
              placeholder="Contoh: Noda tinta di lengan kanan"
              className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setUploadOpen(false)}
              className="min-h-[44px] px-4 rounded-xl border border-slate-200 text-sm font-semibold"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={!uploadFile || uploadPhotoMutation.isPending}
              onClick={() => uploadPhotoMutation.mutate()}
              className="min-h-[44px] px-4 rounded-xl bg-[#0756B8] text-white text-sm font-semibold disabled:opacity-50"
            >
              {uploadPhotoMutation.isPending ? 'Mengunggah...' : 'Unggah Foto'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit Tag Modal (Admin) */}
      <Modal
        open={editTagOpen}
        onClose={() => setEditTagOpen(false)}
        title="Perbarui Tag Fisik"
        maxWidth="max-w-md"
      >
        <div className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-[#12345A] mb-1">
              Nomor Tag Fisik
            </label>
            <input
              value={editTagValue}
              onChange={(e) => setEditTagValue(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl border border-slate-200 font-mono text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#12345A] mb-1">Status Tag</label>
            <select
              value={editTagStatus}
              onChange={(e) => setEditTagStatus(e.target.value as TagStatus)}
              className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm bg-white"
            >
              <option value="ATTACHED">Terpasang</option>
              <option value="MISSING">Hilang / Lepas</option>
              <option value="REPLACED">Diganti Tag Baru</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setEditTagOpen(false)}
              className="min-h-[44px] px-4 rounded-xl border border-slate-200 text-sm font-semibold"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={!editTagValue.trim() || updateTagMutation.isPending}
              onClick={() => updateTagMutation.mutate()}
              className="min-h-[44px] px-4 rounded-xl bg-[#0756B8] text-white text-sm font-semibold"
            >
              Simpan
            </button>
          </div>
        </div>
      </Modal>

      {/* Lightbox Modal */}
      <Modal
        open={Boolean(lightboxPhoto)}
        onClose={() => setLightboxPhoto(null)}
        title={lightboxPhoto?.label || 'Pratinjau Foto'}
        maxWidth="max-w-3xl"
      >
        {lightboxPhoto && (
          <div className="rounded-xl overflow-hidden bg-slate-950 max-h-[70vh] flex items-center justify-center">
            <AuthorizedImage
              src={lightboxPhoto.url}
              alt={lightboxPhoto.label}
              className="max-h-[68vh] w-auto object-contain"
            />
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deletePhotoId)}
        onClose={() => setDeletePhotoId(null)}
        onConfirm={() => deletePhotoId && deletePhotoMutation.mutate(deletePhotoId)}
        title="Hapus Foto Referensi"
        message="Foto akan dihapus dari tampilan aktif dan tindakan penghapusan dicatat dalam log audit."
        confirmLabel="Hapus Foto"
        danger
        isPending={deletePhotoMutation.isPending}
      />
    </div>
  );
}
