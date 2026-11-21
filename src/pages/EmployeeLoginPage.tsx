import { zodResolver } from '@hookform/resolvers/zod';
import {
  AlertCircle,
  Check,
  Eye,
  EyeOff,
  Loader2,
  PackageCheck,
  Shield,
  Shirt,
  UserCheck,
} from 'lucide-react';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useAuth } from '../contexts/AuthContext.tsx';
import { ApiClientError } from '../lib/api.ts';
import type { OperationalDepartment } from '../shared/types.ts';

function IronIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 17h16l-1.8-6.2A2 2 0 0 0 16.3 9H9.5a3.5 3.5 0 0 0-3.3 2.3L4 17Z" />
      <path d="M9 9V7a2 2 0 0 1 2-2h4.5a1.5 1.5 0 0 1 1.4 1l.6 1.8" />
      <path d="M4 19h16" />
    </svg>
  );
}

interface DivisionCardConfig {
  id: OperationalDepartment;
  title: string;
  description: string;
  icon: React.ReactNode;
  accentSelected: string;
  iconBgSelected: string;
  iconBgIdle: string;
  checkColor: string;
}

const DIVISION_CARDS: DivisionCardConfig[] = [
  {
    id: 'SPOTTING',
    title: 'SPOTTING',
    description: 'Garment inspection & stain treatment',
    icon: <Shirt className="h-5 w-5" />,
    accentSelected: 'border-[#F7941D] bg-[#FFF3E4]/75 ring-2 ring-[#F7941D]/20',
    iconBgSelected: 'bg-[#F7941D] text-white',
    iconBgIdle: 'bg-[#FFF3E4] text-[#B45309]',
    checkColor: 'text-[#F7941D]',
  },
  {
    id: 'IRONING',
    title: 'IRONING',
    description: 'Garment ironing & finishing',
    icon: <IronIcon className="h-5 w-5" />,
    accentSelected: 'border-[#0756B8] bg-[#EAF3FF]/80 ring-2 ring-[#0756B8]/20',
    iconBgSelected: 'bg-[#0756B8] text-white',
    iconBgIdle: 'bg-[#EAF3FF] text-[#0756B8]',
    checkColor: 'text-[#0756B8]',
  },
  {
    id: 'PACKING',
    title: 'PACKING',
    description: 'Garment checking & packaging',
    icon: <PackageCheck className="h-5 w-5" />,
    accentSelected: 'border-emerald-600 bg-emerald-50/80 ring-2 ring-emerald-500/20',
    iconBgSelected: 'bg-emerald-600 text-white',
    iconBgIdle: 'bg-emerald-50 text-emerald-700',
    checkColor: 'text-emerald-600',
  },
];

const employeeLoginSchema = z.object({
  identifier: z.string().trim().min(2, 'Masukkan username atau email Anda'),
  password: z.string().min(1, 'Masukkan kata sandi'),
});

type EmployeeLoginValues = z.infer<typeof employeeLoginSchema>;

export function EmployeeLoginPage({
  onSwitchToAdmin,
}: {
  onSwitchToAdmin: () => void;
}) {
  const { needsBootstrap, loginWithPassword, loginWithGoogle } = useAuth();
  const [selectedDivision, setSelectedDivision] = useState<OperationalDepartment | null>(null);
  const [divisionError, setDivisionError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);

  const form = useForm<EmployeeLoginValues>({
    resolver: zodResolver(employeeLoginSchema),
    defaultValues: { identifier: '', password: '' },
  });

  const isBusy = form.formState.isSubmitting || googleLoading;

  const handleSelectDivision = (division: OperationalDepartment) => {
    setSelectedDivision(division);
    setDivisionError(null);
    setErrorMsg(null);
  };

  const handleSubmit = async (values: EmployeeLoginValues) => {
    setErrorMsg(null);
    if (!selectedDivision) {
      setDivisionError('Silakan pilih divisi Anda terlebih dahulu sebelum masuk.');
      return;
    }

    try {
      await loginWithPassword({
        identifier: values.identifier,
        password: values.password,
        portal: 'EMPLOYEE',
        selectedDivision,
      });
    } catch (err) {
      setErrorMsg(
        err instanceof ApiClientError
          ? err.message
          : 'Gagal terhubung ke server. Periksa koneksi Anda lalu coba lagi.'
      );
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    if (!selectedDivision) {
      setDivisionError('Silakan pilih divisi Anda terlebih dahulu sebelum masuk dengan Google.');
      return;
    }

    setGoogleLoading(true);
    try {
      await loginWithGoogle({
        portal: 'EMPLOYEE',
        selectedDivision,
      });
    } catch (err) {
      setErrorMsg(
        err instanceof ApiClientError
          ? err.message
          : 'Gagal masuk dengan Google. Pastikan pop-up diizinkan dan email Anda terdaftar di divisi yang dipilih.'
      );
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F8FC] flex flex-col justify-between px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-3xl bg-white rounded-3xl border border-slate-200/90 shadow-lg p-5 sm:p-8 lg:p-10">
          {/* Top Brand Header */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 pb-6 border-b border-slate-100">
            <img
              src="/assets/aistudio/image_515944f0.png"
              alt="Logo ALMOS Laundry Detailing"
              className="h-14 w-14 rounded-2xl object-contain bg-[#0756B8] p-1 shadow-xs shrink-0"
            />
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#12345A] tracking-tight font-display">
                Employee Login
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Masuk untuk mengakses pekerjaan dan tugas divisi Anda.
              </p>
            </div>
          </div>

          {needsBootstrap && (
            <div className="mt-5 rounded-2xl bg-[#FFF3E4] border border-[#F7941D]/30 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-xs sm:text-sm text-[#92400E]">
                Sistem belum memiliki akun Administrator utama. Aktifkan Admin pertama melalui
                Admin Portal sebelum karyawan dapat masuk.
              </p>
              <button
                type="button"
                onClick={onSwitchToAdmin}
                className="min-h-[40px] px-4 rounded-xl bg-[#0756B8] text-white text-xs font-semibold whitespace-nowrap shrink-0"
              >
                Buka Admin Portal
              </button>
            </div>
          )}

          {/* Division Selection */}
          <div className="mt-6">
            <div className="flex items-center justify-between gap-2 mb-3">
              <label className="text-xs font-bold uppercase tracking-wider text-[#12345A]">
                1. Pilih Divisi Kerja
              </label>
              {selectedDivision && (
                <span className="text-xs font-semibold text-[#0756B8]">
                  Dipilih: {selectedDivision}
                </span>
              )}
            </div>

            <div
              role="radiogroup"
              aria-label="Pilihan divisi karyawan"
              className="grid grid-cols-1 sm:grid-cols-3 gap-3"
            >
              {DIVISION_CARDS.map((card) => {
                const isSelected = selectedDivision === card.id;
                return (
                  <button
                    key={card.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    disabled={isBusy}
                    onClick={() => handleSelectDivision(card.id)}
                    className={`w-full text-left rounded-2xl border p-4 transition-all duration-150 min-h-[104px] flex flex-col justify-between ${
                      isSelected
                        ? card.accentSelected
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div
                        className={`h-10 w-10 rounded-xl flex items-center justify-center transition-colors ${
                          isSelected ? card.iconBgSelected : card.iconBgIdle
                        }`}
                      >
                        {card.icon}
                      </div>
                      {isSelected && (
                        <span
                          className={`h-6 w-6 rounded-full bg-white border border-current flex items-center justify-center ${card.checkColor}`}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </div>
                    <div className="mt-3">
                      <p className="text-sm font-extrabold text-[#12345A] tracking-tight">
                        {card.title}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500 leading-snug">
                        {card.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {divisionError && (
              <p role="alert" className="mt-2 text-xs font-medium text-red-600">
                {divisionError}
              </p>
            )}
          </div>

          {/* Credentials Form */}
          <form onSubmit={form.handleSubmit(handleSubmit)} className="mt-6 space-y-4">
            <p className="text-xs font-bold uppercase tracking-wider text-[#12345A]">
              2. Kredensial Akun
            </p>

            {errorMsg && (
              <div
                role="alert"
                className="rounded-xl bg-red-50 border border-red-200 px-3.5 py-3 flex items-start gap-2.5 text-xs sm:text-sm text-red-800"
              >
                <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errorMsg}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="employee-identifier"
                  className="block text-xs font-semibold text-[#12345A] mb-1.5"
                >
                  Username atau Email
                </label>
                <input
                  id="employee-identifier"
                  {...form.register('identifier')}
                  autoComplete="username"
                  disabled={isBusy}
                  placeholder="Contoh: staff01 atau email"
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-white text-sm text-[#12345A] placeholder:text-slate-400 focus:outline-none focus:border-[#0756B8] focus:ring-2 focus:ring-[#0756B8]/15 disabled:bg-slate-50"
                />
                {form.formState.errors.identifier && (
                  <p className="mt-1 text-xs text-red-600">
                    {form.formState.errors.identifier.message}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="employee-password"
                  className="block text-xs font-semibold text-[#12345A] mb-1.5"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="employee-password"
                    type={showPassword ? 'text' : 'password'}
                    {...form.register('password')}
                    autoComplete="current-password"
                    disabled={isBusy}
                    placeholder="Masukkan kata sandi"
                    className="w-full h-11 pl-3.5 pr-11 rounded-xl border border-slate-200 bg-white text-sm text-[#12345A] placeholder:text-slate-400 focus:outline-none focus:border-[#0756B8] focus:ring-2 focus:ring-[#0756B8]/15 disabled:bg-slate-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                    className="absolute right-0 top-0 h-11 w-11 flex items-center justify-center text-slate-400 hover:text-[#12345A] rounded-r-xl"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {form.formState.errors.password && (
                  <p className="mt-1 text-xs text-red-600">
                    {form.formState.errors.password.message}
                  </p>
                )}
              </div>
            </div>

            <div className="pt-1 flex flex-col sm:flex-row gap-3">
              <button
                type="submit"
                disabled={isBusy}
                className="flex-1 min-h-[48px] px-5 rounded-xl bg-[#0756B8] hover:bg-[#064596] text-white text-sm font-semibold shadow-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {form.formState.isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {form.formState.isSubmitting ? 'Memverifikasi...' : 'Masuk ke Dashboard'}
              </button>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isBusy}
                className="min-h-[48px] px-4 rounded-xl border border-slate-200 bg-[#F5F8FC] hover:bg-[#EAF3FF] text-sm font-semibold text-[#12345A] flex items-center justify-center gap-2 transition-colors disabled:opacity-60 whitespace-nowrap shrink-0"
              >
                <UserCheck className="h-4 w-4 text-[#0756B8]" />
                {googleLoading ? 'Menghubungkan...' : 'Masuk Google'}
              </button>
            </div>
          </form>

          {/* Footer link to Admin Portal */}
          <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
            <span>Akses hanya untuk staf aktif sesuai divisi terdaftar.</span>
            <button
              type="button"
              onClick={onSwitchToAdmin}
              className="min-h-[40px] px-2.5 inline-flex items-center gap-1.5 font-semibold text-[#0756B8] hover:text-[#12345A] hover:underline"
            >
              <Shield className="h-3.5 w-3.5" />
              Login Administrator (/admin)
            </button>
          </div>
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-slate-400">
        ALMOS Laundry Detailing · your professional detailing laundry
      </p>
    </div>
  );
}
