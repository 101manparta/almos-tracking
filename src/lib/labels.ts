import type {
  Department,
  GarmentStatus,
  IssueSeverity,
  IssueType,
  OrderCategory,
  OrderStatus,
  PhotoType,
  RoleCode,
} from '../shared/types.ts';

export const ROLE_LABELS: Record<RoleCode, string> = {
  ADMIN: 'Administrator',
  SPOTTING: 'Staf Spotting',
  IRONING: 'Staf Ironing',
  PACKING: 'Staf Packing',
};

export const DEPARTMENT_LABELS: Record<Department, string> = {
  ADMIN: 'Admin / Penerimaan',
  SPOTTING: 'Divisi Spotting',
  IRONING: 'Divisi Ironing',
  PACKING: 'Divisi Packing',
  PICKUP: 'Pengambilan / Selesai',
};

export const ORDER_CATEGORY_LABELS: Record<OrderCategory, string> = {
  INDIVIDUAL: 'Pelanggan Pribadi',
  VILLA: 'Villa',
  HOTEL: 'Hotel',
  WEDDING_ORGANIZER: 'Wedding Organizer',
  SALON: 'Salon',
  OTHER_VENDOR: 'Vendor Lainnya',
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  ACTIVE: 'Aktif Diproses',
  READY_FOR_PICKUP: 'Siap Diambil',
  ARCHIVED: 'Diarsipkan (Sudah Diambil)',
  CANCELLED: 'Dibatalkan',
};

export const GARMENT_STATUS_LABELS: Record<GarmentStatus, string> = {
  REGISTERED: 'Terdaftar',
  WAITING_SPOTTING: 'Menunggu Spotting',
  SPOTTING_IN_PROGRESS: 'Proses Spotting',
  WAITING_IRONING: 'Menunggu Ironing',
  IRONING_IN_PROGRESS: 'Proses Ironing',
  WAITING_PACKING: 'Menunggu Packing',
  PACKING_IN_PROGRESS: 'Proses Packing',
  READY_FOR_PICKUP: 'Siap Diambil',
  ON_HOLD: 'Ditahan (On Hold)',
  PICKED_UP: 'Sudah Diambil',
};

export const PHOTO_TYPE_LABELS: Record<PhotoType, string> = {
  FRONT: 'Tampak Depan',
  BACK: 'Tampak Belakang',
  LABEL: 'Label / Merek',
  TAG: 'Tag Fisik',
  DETAIL: 'Detail Noda / Kerusakan',
  OTHER: 'Lainnya',
};

export const ISSUE_TYPE_LABELS: Record<IssueType, string> = {
  STAIN_PERSISTS: 'Noda Membandel',
  FABRIC_DAMAGE: 'Kerusakan Bahan / Robek',
  MISSING_TAG: 'Tag Fisik Hilang / Lepas',
  MISSING_BUTTON_TRIM: 'Kancing / Aksesoris Lepas',
  COLOR_BLEED_RISK: 'Risiko Luntur Warna',
  OTHER: 'Kendala Lainnya',
};

export const ISSUE_SEVERITY_LABELS: Record<IssueSeverity, string> = {
  LOW: 'Rendah',
  MEDIUM: 'Sedang',
  HIGH: 'Tinggi',
  CRITICAL: 'Kritis',
};

export function formatDateTime(iso: string | Date | null | undefined): string {
  if (!iso) return '—';
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatDateOnly(iso: string | Date | null | undefined): string {
  if (!iso) return '—';
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function getStatusVisualStyle(status: string): {
  bg: string;
  text: string;
  border: string;
  label: string;
} {
  if (status === 'READY_FOR_PICKUP' || status === 'COMPLETED') {
    return {
      bg: 'bg-emerald-50',
      text: 'text-emerald-800',
      border: 'border-emerald-200',
      label: GARMENT_STATUS_LABELS[status as GarmentStatus] || status,
    };
  }
  if (status === 'ON_HOLD' || status === 'CANCELLED') {
    return {
      bg: 'bg-red-50',
      text: 'text-red-800',
      border: 'border-red-200',
      label: GARMENT_STATUS_LABELS[status as GarmentStatus] || ORDER_STATUS_LABELS[status as OrderStatus] || status,
    };
  }
  if (status.endsWith('_IN_PROGRESS') || status === 'IN_PROGRESS') {
    return {
      bg: 'bg-[#EAF3FF]',
      text: 'text-[#0756B8]',
      border: 'border-[#0756B8]/25',
      label: GARMENT_STATUS_LABELS[status as GarmentStatus] || status,
    };
  }
  if (status.startsWith('WAITING_') || status === 'PENDING' || status === 'ACTIVE') {
    return {
      bg: 'bg-[#FFF3E4]',
      text: 'text-[#B45309]',
      border: 'border-[#F7941D]/30',
      label:
        GARMENT_STATUS_LABELS[status as GarmentStatus] ||
        ORDER_STATUS_LABELS[status as OrderStatus] ||
        status,
    };
  }
  return {
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-200',
    label:
      GARMENT_STATUS_LABELS[status as GarmentStatus] ||
      ORDER_STATUS_LABELS[status as OrderStatus] ||
      status,
  };
}
