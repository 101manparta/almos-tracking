import { zodResolver } from '@hookform/resolvers/zod';
import {
  AlertCircle,
  ArrowLeft,
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useAuth } from '../contexts/AuthContext.tsx';
import { ApiClientError } from '../lib/api.ts';

const adminLoginSchema = z.object({
  identifier: z.string().trim().min(2, 'Masukkan username atau email Admin'),
  password: z.string().min(1, 'Masukkan kata sandi'),
});

const bootstrapSchema = z.object({
  fullName: z.string().trim().min(2, 'Nama lengkap minimal 2 karakter'),
  username: z
    .string()
    .trim()
    .min(3, 'Username minimal 3 karakter')
    .regex(/^[a-zA-Z0-9._-]+$/, 'Hanya huruf, angka, titik, garis bawah, atau strip'),
  email: z.string().trim().email('Format email tidak valid'),
  password: z.string().min(8, 'Kata sandi minimal 8 karakter'),
});

type AdminLoginValues = z.infer<typeof adminLoginSchema>;
type BootstrapValues = z.infer<typeof bootstrapSchema>;

export function AdminLoginPage({
  onSwitchToEmployee,
}: {
  onSwitchToEmployee: () => void;
}) {
  const { needsBootstrap, loginWithPassword, loginWithGoogle, bootstrapAdmin } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [showBootstrapPassword, setShowBootstrapPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);

  const loginForm = useForm<AdminLoginValues>({
    resolver: zodResolver(adminLoginSchema),
    defaultValues: { identifier: '', password: '' },
  });

  const bootstrapForm = useForm<BootstrapValues>({
    resolver: zodResolver(bootstrapSchema),
    defaultValues: { fullName: '', username: '', email: '', password: '' },
  });

  const isBusy =
    loginForm.formState.isSubmitting ||
    bootstrapForm.formState.isSubmitting ||
    googleLoading;

  const handlePasswordSubmit = async (values: AdminLoginValues) => {
    setErrorMsg(null);
    try {
      await loginWithPassword({
        identifier: values.identifier,
        password: values.password,
        portal: 'ADMIN',
      });
    } catch (err) {
      setErrorMsg(
        err instanceof ApiClientError
          ? err.message
          : 'Gagal terhubung ke server. Silakan coba lagi.'
      );
    }
  };

  const handleBootstrapSubmit = async (values: BootstrapValues) => {
    setErrorMsg(null);
    try {
      await bootstrapAdmin(values);
    } catch (err) {
      setErrorMsg(
        err instanceof ApiClientError
          ? err.message
          : 'Gagal membuat akun Administrator pertama.'
      );
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setGoogleLoading(true);
    try {
      await loginWithGoogle({ portal: 'ADMIN' });
    } catch (err) {
      setErrorMsg(
        err instanceof ApiClientError
          ? err.message
          : 'Gagal masuk dengan Google. Pastikan pop-up diizinkan dan email terdaftar sebagai Admin.'
      );
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col justify-between px-4 py-8 sm:px-6 lg:px-8 relative overflow-hidden"
      style={{
        background:
          'linear-gradient(155deg, #FFFFFF 0%, #F5F8FC 48%, #EAF3FF 82%, #FFF3E4 100%)',
      }}
    >
      {/* Subtle top brand gradient bar */}
      <div
        aria-hidden="true"
        className="fixed top-0 left-0 right-0 h-1.5 z-10"
        style={{
          background: 'linear-gradient(90deg, #F7941D 0%, #0756B8 100%)',
        }}
      />

      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-md">
          {/* Glass-tinted Admin Card */}
          <div className="rounded-3xl bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-xl shadow-[#0756B8]/8 p-6 sm:p-8">
            {/* Brand Header */}
            <div className="flex flex-col items-center text-center">
              <div className="p-1.5 rounded-2xl bg-[#0756B8] shadow-sm">
                <img
                  src="/assets/aistudio/image_515944f0.png"
                  alt="Logo ALMOS Laundry Detailing"
                  className="h-14 w-14 rounded-xl object-contain"
                />
              </div>
              <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-[#12345A] font-display">
                Admin Portal
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Manage your laundry operations
              </p>
            </div>

            {/* Security Notice */}
            <div className="mt-5 rounded-xl bg-[#EAF3FF]/70 border border-[#0756B8]/15 px-3.5 py-2.5 flex items-start gap-2.5 text-left">
              <ShieldCheck className="h-4 w-4 text-[#0756B8] shrink-0 mt-0.5" />
              <p className="text-xs text-[#12345A]/85 leading-relaxed">
                Khusus akun <span className="font-semibold">Administrator</span>. Seluruh akses
                portal dan sesi diverifikasi oleh server.
              </p>
            </div>

            {errorMsg && (
              <div
                role="alert"
                className="mt-4 rounded-xl bg-red-50 border border-red-200 px-3.5 py-3 flex items-start gap-2.5 text-xs text-red-800"
              >
                <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errorMsg}</span>
              </div>
            )}

            {needsBootstrap ? (
              <div className="mt-5 space-y-4">
                <div className="rounded-xl bg-[#FFF3E4] border border-[#F7941D]/30 p-3 text-xs text-[#92400E]">
                  Belum ada akun Administrator di database. Buat akun Admin pertama untuk mulai
                  menggunakan sistem ALMOS.
                </div>

                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isBusy}
                  className="w-full min-h-[46px] rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-sm font-semibold text-[#12345A] flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
                >
                  <UserCheck className="h-4 w-4 text-[#0756B8]" />
                  {googleLoading ? 'Menghubungkan Google...' : 'Klaim Admin dengan Google'}
                </button>

                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <div className="h-px flex-1 bg-slate-200" />
                  <span>atau daftar manual</span>
                  <div className="h-px flex-1 bg-slate-200" />
                </div>

                <form
                  onSubmit={bootstrapForm.handleSubmit(handleBootstrapSubmit)}
                  className="space-y-3.5"
                >
                  <div>
                    <label className="block text-xs font-semibold text-[#12345A] mb-1">
                      Nama Lengkap
                    </label>
                    <input
                      {...bootstrapForm.register('fullName')}
                      placeholder="Nama Administrator"
                      className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-white text-sm text-[#12345A] focus:outline-none focus:border-[#0756B8]"
                    />
                    {bootstrapForm.formState.errors.fullName && (
                      <p className="mt-1 text-xs text-red-600">
                        {bootstrapForm.formState.errors.fullName.message}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#12345A] mb-1">
                        Username
                      </label>
                      <input
                        {...bootstrapForm.register('username')}
                        placeholder="admin01"
                        className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-white text-sm text-[#12345A] focus:outline-none focus:border-[#0756B8]"
                      />
                      {bootstrapForm.formState.errors.username && (
                        <p className="mt-1 text-xs text-red-600">
                          {bootstrapForm.formState.errors.username.message}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#12345A] mb-1">
                        Email
                      </label>
                      <input
                        type="email"
                        {...bootstrapForm.register('email')}
                        placeholder="admin@almos.id"
                        className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-white text-sm text-[#12345A] focus:outline-none focus:border-[#0756B8]"
                      />
                      {bootstrapForm.formState.errors.email && (
                        <p className="mt-1 text-xs text-red-600">
                          {bootstrapForm.formState.errors.email.message}
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#12345A] mb-1">
                      Kata Sandi (min. 8 karakter)
                    </label>
                    <div className="relative">
                      <input
                        type={showBootstrapPassword ? 'text' : 'password'}
                        {...bootstrapForm.register('password')}
                        placeholder="••••••••"
                        className="w-full h-11 pl-3.5 pr-11 rounded-xl border border-slate-200 bg-white text-sm text-[#12345A] focus:outline-none focus:border-[#0756B8]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowBootstrapPassword((v) => !v)}
                        aria-label={
                          showBootstrapPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'
                        }
                        className="absolute right-0 top-0 h-11 w-11 flex items-center justify-center text-slate-400 hover:text-[#12345A]"
                      >
                        {showBootstrapPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {bootstrapForm.formState.errors.password && (
                      <p className="mt-1 text-xs text-red-600">
                        {bootstrapForm.formState.errors.password.message}
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isBusy}
                    className="w-full min-h-[48px] rounded-xl text-white text-sm font-semibold shadow-sm transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
                    style={{
                      background: 'linear-gradient(135deg, #F7941D 0%, #0756B8 100%)',
                    }}
                  >
                    {bootstrapForm.formState.isSubmitting && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                    {bootstrapForm.formState.isSubmitting
                      ? 'Menyimpan Akun...'
                      : 'Aktifkan Akun Admin'}
                  </button>
                </form>
              </div>
            ) : (
              <>
                <form
                  onSubmit={loginForm.handleSubmit(handlePasswordSubmit)}
                  className="mt-5 space-y-4"
                >
                  <div>
                    <label
                      htmlFor="admin-identifier"
                      className="block text-xs font-semibold text-[#12345A] mb-1.5"
                    >
                      Username atau Email
                    </label>
                    <input
                      id="admin-identifier"
                      {...loginForm.register('identifier')}
                      autoComplete="username"
                      disabled={isBusy}
                      placeholder="Masukkan username atau email Admin"
                      className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-white text-sm text-[#12345A] placeholder:text-slate-400 focus:outline-none focus:border-[#0756B8] focus:ring-2 focus:ring-[#0756B8]/15 disabled:bg-slate-50"
                    />
                    {loginForm.formState.errors.identifier && (
                      <p className="mt-1 text-xs text-red-600">
                        {loginForm.formState.errors.identifier.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="admin-password"
                      className="block text-xs font-semibold text-[#12345A] mb-1.5"
                    >
                      Kata Sandi
                    </label>
                    <div className="relative">
                      <input
                        id="admin-password"
                        type={showPassword ? 'text' : 'password'}
                        {...loginForm.register('password')}
                        autoComplete="current-password"
                        disabled={isBusy}
                        placeholder="Masukkan kata sandi"
                        className="w-full h-11 pl-3.5 pr-11 rounded-xl border border-slate-200 bg-white text-sm text-[#12345A] placeholder:text-slate-400 focus:outline-none focus:border-[#0756B8] focus:ring-2 focus:ring-[#0756B8]/15 disabled:bg-slate-50"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={
                          showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'
                        }
                        className="absolute right-0 top-0 h-11 w-11 flex items-center justify-center text-slate-400 hover:text-[#12345A] rounded-r-xl"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {loginForm.formState.errors.password && (
                      <p className="mt-1 text-xs text-red-600">
                        {loginForm.formState.errors.password.message}
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isBusy}
                    className="w-full min-h-[48px] rounded-xl text-white text-sm font-semibold shadow-md shadow-[#0756B8]/15 transition-all hover:opacity-95 disabled:opacity-60 flex items-center justify-center gap-2"
                    style={{
                      background: 'linear-gradient(135deg, #F7941D 0%, #0756B8 100%)',
                    }}
                  >
                    {loginForm.formState.isSubmitting && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                    {loginForm.formState.isSubmitting ? 'Memverifikasi...' : 'Login'}
                  </button>
                </form>

                <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
                  <div className="h-px flex-1 bg-slate-200" />
                  <span>atau</span>
                  <div className="h-px flex-1 bg-slate-200" />
                </div>

                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isBusy}
                  className="w-full min-h-[46px] rounded-xl border border-slate-200 bg-white hover:bg-[#EAF3FF]/60 text-sm font-semibold text-[#12345A] flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
                >
                  <UserCheck className="h-4 w-4 text-[#0756B8]" />
                  {googleLoading ? 'Menghubungkan Google...' : 'Masuk dengan Google'}
                </button>
              </>
            )}

            <div className="mt-6 pt-5 border-t border-slate-100 text-center">
              <button
                type="button"
                onClick={onSwitchToEmployee}
                className="min-h-[44px] px-3 inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-[#0756B8] hover:text-[#12345A] hover:underline transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Kembali ke Login Karyawan
              </button>
            </div>
          </div>

          <p className="mt-5 text-center text-xs text-slate-400">
            ALMOS Laundry Detailing · your professional detailing laundry
          </p>
        </div>
      </div>
    </div>
  );
}
