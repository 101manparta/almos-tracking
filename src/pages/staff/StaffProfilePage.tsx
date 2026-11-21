import { AlertTriangle, History, LogOut, Mail, ShieldCheck, UserCircle } from 'lucide-react';
import type { AppRoute } from '../../components/layout/AppShell.tsx';
import { useAuth } from '../../contexts/AuthContext.tsx';
import { ROLE_LABELS } from '../../lib/labels.ts';

export function StaffProfilePage({ onNavigate }: { onNavigate: (p: AppRoute) => void }) {
  const { user, logout } = useAuth();

  return (
    <div className="space-y-5 max-w-xl mx-auto">
      <div className="rounded-2xl bg-white border border-slate-200/90 p-5 sm:p-6 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-[#0756B8] text-white flex items-center justify-center text-xl font-bold shrink-0">
            {user?.fullName.slice(0, 1).toUpperCase() || 'S'}
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-[#12345A] truncate">
              {user?.fullName}
            </h1>
            <p className="text-xs font-semibold text-[#0756B8] mt-0.5">
              {user ? ROLE_LABELS[user.role] : ''}
            </p>
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-slate-100 space-y-3 text-sm">
          <div className="flex items-center gap-3 text-slate-600">
            <UserCircle className="h-4 w-4 text-slate-400 shrink-0" />
            <span className="text-xs text-slate-500 w-24">Username</span>
            <span className="font-mono font-semibold text-[#12345A]">{user?.username}</span>
          </div>
          <div className="flex items-center gap-3 text-slate-600">
            <Mail className="h-4 w-4 text-slate-400 shrink-0" />
            <span className="text-xs text-slate-500 w-24">Email</span>
            <span className="text-[#12345A] truncate">{user?.email}</span>
          </div>
          <div className="flex items-center gap-3 text-slate-600">
            <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
            <span className="text-xs text-slate-500 w-24">Status Akun</span>
            <span className="font-semibold text-emerald-700">Aktif</span>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-white border border-slate-200/90 p-3 space-y-2">
        <button
          type="button"
          onClick={() => onNavigate('/staff/riwayat')}
          className="w-full min-h-[48px] px-4 rounded-xl hover:bg-[#EAF3FF]/60 flex items-center gap-3 text-sm font-semibold text-[#12345A] transition-colors"
        >
          <History className="h-4 w-4 text-[#0756B8]" />
          Lihat Riwayat Pengerjaan Saya
        </button>
        <button
          type="button"
          onClick={() => onNavigate('/staff/kendala')}
          className="w-full min-h-[48px] px-4 rounded-xl hover:bg-[#FFF3E4]/70 flex items-center gap-3 text-sm font-semibold text-[#12345A] transition-colors"
        >
          <AlertTriangle className="h-4 w-4 text-[#F7941D]" />
          Lihat Daftar Kendala Divisi
        </button>
      </div>

      <button
        type="button"
        onClick={logout}
        className="w-full min-h-[48px] rounded-2xl border border-red-200 bg-red-50 text-red-700 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-red-100 transition-colors"
      >
        <LogOut className="h-4 w-4" />
        Keluar dari Akun
      </button>
    </div>
  );
}
