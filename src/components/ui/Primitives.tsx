import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ImageOff,
  X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { getInMemorySessionToken } from '../../lib/api.ts';
import { getStatusVisualStyle } from '../../lib/labels.ts';

export function StatusBadge({ status }: { status: string }) {
  const style = getStatusVisualStyle(status);
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium border whitespace-nowrap ${style.bg} ${style.text} ${style.border}`}
    >
      {style.label}
    </span>
  );
}

export function StatCard({
  label,
  value,
  sublabel,
  tone = 'default',
  icon,
  onClick,
}: {
  label: string;
  value: number | string;
  sublabel?: string;
  tone?: 'default' | 'primary' | 'orange' | 'danger' | 'success';
  icon?: React.ReactNode;
  onClick?: () => void;
}) {
  const toneStyles: Record<string, string> = {
    default: 'bg-white border-slate-200/90 text-[#12345A]',
    primary: 'bg-[#EAF3FF]/70 border-[#0756B8]/20 text-[#0756B8]',
    orange: 'bg-[#FFF3E4]/80 border-[#F7941D]/30 text-[#B45309]',
    danger: 'bg-red-50/70 border-red-200 text-red-700',
    success: 'bg-emerald-50/70 border-emerald-200 text-emerald-800',
  };

  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`w-full text-left rounded-2xl border p-4 sm:p-5 shadow-xs transition-all duration-150 ${
        toneStyles[tone]
      } ${onClick ? 'hover:shadow-md hover:-translate-y-0.5 cursor-pointer' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-600 truncate">{label}</p>
          <p className="mt-1.5 text-2xl sm:text-3xl font-bold tracking-tight tabular-nums font-display">
            {value}
          </p>
          {sublabel && <p className="mt-1 text-xs text-slate-500 truncate">{sublabel}</p>}
        </div>
        {icon && (
          <div className="p-2.5 rounded-xl bg-white/80 border border-slate-200/60 shrink-0">
            {icon}
          </div>
        )}
      </div>
    </Comp>
  );
}

export function EmptyState({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200/90 p-8 sm:p-10 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[#EAF3FF] text-[#0756B8]">
        {icon || <CheckCircle2 className="h-6 w-6" />}
      </div>
      <h3 className="text-base font-semibold text-[#12345A]">{title}</h3>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-500">{description}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export function LoadingSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Memuat data">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-16 rounded-xl bg-white border border-slate-200/80 animate-pulse p-4 flex items-center gap-4"
        >
          <div className="h-10 w-10 rounded-lg bg-slate-200/80 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-1/3 rounded bg-slate-200/80" />
            <div className="h-3 w-1/2 rounded bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
        <p className="text-sm text-red-800">{message}</p>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white text-red-700 border border-red-200 hover:bg-red-100 shrink-0 min-h-[36px]"
        >
          Coba Lagi
        </button>
      )}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'max-w-xl',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#12345A]/50 backdrop-blur-xs p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`w-full ${maxWidth} rounded-t-3xl sm:rounded-2xl bg-white border border-slate-200 shadow-2xl max-h-[92vh] flex flex-col overflow-hidden`}
      >
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-100">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-[#12345A] truncate">{title}</h2>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup dialog"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-[#12345A]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Konfirmasi',
  danger = false,
  isPending = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  isPending?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} maxWidth="max-w-md">
      <p className="text-sm text-slate-600 leading-relaxed">{message}</p>
      <div className="mt-6 flex flex-col-reverse sm:flex-row justify-end gap-2.5">
        <button
          type="button"
          onClick={onClose}
          disabled={isPending}
          className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Batal
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isPending}
          className={`min-h-[44px] px-5 py-2 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-60 ${
            danger
              ? 'bg-red-600 hover:bg-red-700'
              : 'bg-[#0756B8] hover:bg-[#064596]'
          }`}
        >
          {isPending ? 'Memproses...' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

export function PaginationBar({
  page,
  totalPages,
  total,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (nextPage: number) => void;
}) {
  if (total === 0) return null;
  return (
    <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-200/80 text-sm">
      <p className="text-xs sm:text-sm text-slate-500 tabular-nums">
        Halaman <span className="font-semibold text-[#12345A]">{page}</span> dari{' '}
        <span className="font-semibold text-[#12345A]">{totalPages}</span> ({total} data)
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 flex items-center gap-1 text-xs font-semibold"
        >
          <ChevronLeft className="h-4 w-4" />
          Sebelumnya
        </button>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 flex items-center gap-1 text-xs font-semibold"
        >
          Berikutnya
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function AuthorizedImage({
  src,
  alt,
  className = 'w-full h-full object-cover',
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!src) {
      setBlobUrl(null);
      return;
    }
    let active = true;
    let objectUrl: string | null = null;
    setFailed(false);

    const token = getInMemorySessionToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    fetch(src, { credentials: 'include', headers })
      .then((res) => {
        if (!res.ok) throw new Error('Image fetch failed');
        return res.blob();
      })
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
      })
      .catch(() => {
        if (active) setFailed(true);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  if (!src || failed) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#EAF3FF]/60 text-[#0756B8]/60 p-2 text-center">
        <ImageOff className="h-5 w-5 mb-1" />
        <span className="text-[10px] font-medium">Tidak ada foto</span>
      </div>
    );
  }

  if (!blobUrl) {
    return <div className="w-full h-full bg-slate-100 animate-pulse" />;
  }

  return (
    <img
      src={blobUrl}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      className={className}
    />
  );
}
