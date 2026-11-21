import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Plus, Shield, UserCheck, UserX } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  ErrorBanner,
  LoadingSkeleton,
  Modal,
} from '../../components/ui/Primitives.tsx';
import { useAuth } from '../../contexts/AuthContext.tsx';
import { apiFetch, ApiClientError } from '../../lib/api.ts';
import { formatDateTime, ROLE_LABELS } from '../../lib/labels.ts';
import type { RoleCode } from '../../shared/types.ts';

const createUserSchema = z.object({
  fullName: z.string().min(2, 'Nama lengkap minimal 2 karakter'),
  username: z
    .string()
    .min(3, 'Username minimal 3 karakter')
    .regex(/^[a-zA-Z0-9._-]+$/, 'Hanya huruf, angka, titik, garis bawah, atau strip'),
  email: z.string().email('Format email tidak valid'),
  role: z.enum(['ADMIN', 'SPOTTING', 'IRONING', 'PACKING']),
  password: z.string().min(8, 'Kata sandi minimal 8 karakter'),
});

type CreateUserValues = z.infer<typeof createUserSchema>;

interface UserRow {
  id: string;
  fullName: string;
  username: string;
  email: string;
  role: RoleCode;
  roleName: string;
  isActive: boolean;
  lastLoginAt: string | null;
}

export function UsersPage() {
  const { user: currentUser, notify } = useAuth();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<UserRow | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editPassword, setEditPassword] = useState('');

  const { data: usersList, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['users-list'],
    queryFn: async () => {
      const res = await apiFetch<UserRow[]>('/api/v1/users');
      return res.data;
    },
  });

  const form = useForm<CreateUserValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      fullName: '',
      username: '',
      email: '',
      role: 'SPOTTING',
      password: '',
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: CreateUserValues) =>
      apiFetch('/api/v1/users', { method: 'POST', body: JSON.stringify(values) }),
    onSuccess: () => {
      form.reset();
      setCreateOpen(false);
      queryClient.invalidateQueries({ queryKey: ['users-list'] });
      notify('success', 'Akun pengguna baru berhasil dibuat.');
    },
    onError: (err) => {
      notify('error', err instanceof ApiClientError ? err.message : 'Gagal membuat akun.');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (u: UserRow) =>
      apiFetch(`/api/v1/users/${u.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !u.isActive }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-list'] });
      notify('success', 'Status akun diperbarui.');
    },
    onError: (err) => {
      notify('error', err instanceof ApiClientError ? err.message : 'Gagal mengubah status.');
    },
  });

  const roleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: RoleCode }) =>
      apiFetch(`/api/v1/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-list'] });
      notify('success', 'Peran pengguna diperbarui.');
    },
    onError: (err) => {
      notify('error', err instanceof ApiClientError ? err.message : 'Gagal mengubah peran.');
    },
  });

  const editAccountMutation = useMutation({
    mutationFn: async ({
      id,
      fullName,
      password,
    }: {
      id: string;
      fullName: string;
      password?: string;
    }) =>
      apiFetch(`/api/v1/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          fullName,
          ...(password && password.length >= 8 ? { password } : {}),
        }),
      }),
    onSuccess: () => {
      setEditTarget(null);
      setEditPassword('');
      queryClient.invalidateQueries({ queryKey: ['users-list'] });
      notify('success', 'Informasi akun / kata sandi berhasil diperbarui.');
    },
    onError: (err) => {
      notify('error', err instanceof ApiClientError ? err.message : 'Gagal memperbarui akun.');
    },
  });

  if (isLoading) return <LoadingSkeleton rows={4} />;
  if (isError) {
    return (
      <ErrorBanner
        message={error instanceof Error ? error.message : 'Gagal memuat daftar pengguna.'}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#12345A]">Manajemen Pengguna & Peran</h1>
          <p className="text-sm text-slate-500">
            Kelola akun Admin, Staf Spotting, Staf Ironing, dan Staf Packing.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#0756B8] hover:bg-[#064596] text-white text-sm font-semibold inline-flex items-center gap-2 shrink-0"
        >
          <Plus className="h-4 w-4" />
          Tambah Staf / Admin
        </button>
      </div>

      <div className="rounded-2xl bg-white border border-slate-200/90 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-[#F5F8FC] text-xs font-semibold text-slate-500">
                <th className="py-3 px-4">Nama & Username</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Peran / Divisi</th>
                <th className="py-3 px-4">Login Terakhir</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {usersList?.map((u) => (
                <tr key={u.id}>
                  <td className="py-3.5 px-4">
                    <p className="font-semibold text-[#12345A]">{u.fullName}</p>
                    <p className="font-mono text-xs text-slate-500">@{u.username}</p>
                  </td>
                  <td className="py-3.5 px-4 text-xs text-slate-600">{u.email}</td>
                  <td className="py-3.5 px-4">
                    <select
                      value={u.role}
                      disabled={u.id === currentUser?.id}
                      onChange={(e) =>
                        roleMutation.mutate({ id: u.id, role: e.target.value as RoleCode })
                      }
                      className="h-9 px-2.5 rounded-lg border border-slate-200 text-xs font-semibold bg-white disabled:opacity-60"
                    >
                      {Object.entries(ROLE_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-3.5 px-4 text-xs font-mono text-slate-500">
                    {formatDateTime(u.lastLoginAt)}
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-semibold ${
                        u.isActive ? 'text-emerald-700' : 'text-red-600'
                      }`}
                    >
                      {u.isActive ? (
                        <UserCheck className="h-3.5 w-3.5" />
                      ) : (
                        <UserX className="h-3.5 w-3.5" />
                      )}
                      {u.isActive ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="inline-flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditTarget(u);
                          setEditFullName(u.fullName);
                          setEditPassword('');
                        }}
                        className="min-h-[36px] px-2.5 rounded-lg border border-slate-200 text-xs font-semibold text-[#12345A] hover:bg-[#EAF3FF] inline-flex items-center gap-1"
                      >
                        <KeyRound className="h-3.5 w-3.5 text-[#0756B8]" />
                        Edit / Reset Sandi
                      </button>
                      {u.id !== currentUser?.id ? (
                        <button
                          type="button"
                          onClick={() => toggleMutation.mutate(u)}
                          className={`min-h-[36px] px-3 rounded-lg border text-xs font-semibold ${
                            u.isActive
                              ? 'border-red-200 text-red-700 hover:bg-red-50'
                              : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                          }`}
                        >
                          {u.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400 inline-flex items-center gap-1 px-1">
                          <Shield className="h-3.5 w-3.5" /> Anda
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Tambah Akun Staf / Admin"
        subtitle="Staf dapat masuk menggunakan username/email & kata sandi, atau Google Sign-In dengan email yang sama."
      >
        <form
          onSubmit={form.handleSubmit((vals) => createMutation.mutate(vals))}
          className="space-y-3.5"
        >
          <div>
            <label className="block text-xs font-semibold text-[#12345A] mb-1">
              Nama Lengkap *
            </label>
            <input
              {...form.register('fullName')}
              className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm"
            />
            {form.formState.errors.fullName && (
              <p className="mt-1 text-xs text-red-600">{form.formState.errors.fullName.message}</p>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#12345A] mb-1">
                Username *
              </label>
              <input
                {...form.register('username')}
                placeholder="spotting.ani"
                className="w-full h-11 px-3.5 rounded-xl border border-slate-200 font-mono text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#12345A] mb-1">Email *</label>
              <input
                type="email"
                {...form.register('email')}
                placeholder="ani@almos.id"
                className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#12345A] mb-1">
                Peran / Divisi *
              </label>
              <select
                {...form.register('role')}
                className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm bg-white"
              >
                {Object.entries(ROLE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#12345A] mb-1">
                Kata Sandi Awal *
              </label>
              <input
                type="password"
                {...form.register('password')}
                placeholder="Min. 8 karakter"
                className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm"
              />
            </div>
          </div>
          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="min-h-[44px] px-4 rounded-xl border border-slate-200 text-sm font-semibold"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="min-h-[44px] px-5 rounded-xl bg-[#0756B8] text-white text-sm font-semibold"
            >
              {createMutation.isPending ? 'Menyimpan...' : 'Simpan Akun'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(editTarget)}
        onClose={() => setEditTarget(null)}
        title="Ubah Akun & Reset Kata Sandi"
        subtitle={editTarget ? `@${editTarget.username} · ${ROLE_LABELS[editTarget.role]}` : ''}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!editTarget) return;
            if (editFullName.trim().length < 2) {
              notify('error', 'Nama lengkap minimal 2 karakter.');
              return;
            }
            if (editPassword && editPassword.length < 8) {
              notify('error', 'Kata sandi baru minimal 8 karakter.');
              return;
            }
            editAccountMutation.mutate({
              id: editTarget.id,
              fullName: editFullName.trim(),
              password: editPassword || undefined,
            });
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-semibold text-[#12345A] mb-1">
              Nama Lengkap *
            </label>
            <input
              value={editFullName}
              onChange={(e) => setEditFullName(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#12345A] mb-1">
              Kata Sandi Baru (kosongkan jika tidak ingin mereset)
            </label>
            <input
              type="password"
              value={editPassword}
              onChange={(e) => setEditPassword(e.target.value)}
              placeholder="Minimal 8 karakter"
              className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm"
            />
          </div>
          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditTarget(null)}
              className="min-h-[44px] px-4 rounded-xl border border-slate-200 text-sm font-semibold"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={editAccountMutation.isPending}
              className="min-h-[44px] px-5 rounded-xl bg-[#0756B8] text-white text-sm font-semibold"
            >
              {editAccountMutation.isPending ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
