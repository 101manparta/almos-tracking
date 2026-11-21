import { useQueryClient } from '@tanstack/react-query';
import { signInWithPopup, signOut } from 'firebase/auth';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { apiFetch, setInMemorySessionToken, setUnauthorizedHandler } from '../lib/api.ts';
import { auth, googleAuthProvider } from '../lib/firebase.ts';
import type { AuthUser, OperationalDepartment } from '../shared/types.ts';

export type LoginPortal = 'ADMIN' | 'EMPLOYEE';

export interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  needsBootstrap: boolean;
  loginWithPassword: (params: {
    identifier: string;
    password: string;
    portal: LoginPortal;
    selectedDivision?: OperationalDepartment;
  }) => Promise<AuthUser>;
  loginWithGoogle: (params: {
    portal: LoginPortal;
    selectedDivision?: OperationalDepartment;
  }) => Promise<AuthUser>;
  bootstrapAdmin: (payload: {
    fullName: string;
    username: string;
    email: string;
    password: string;
  }) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  toasts: ToastItem[];
  notify: (type: ToastItem['type'], message: string) => void;
  dismissToast: (id: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [needsBootstrap, setNeedsBootstrap] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const userRef = useRef<AuthUser | null>(null);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback(
    (type: ToastItem['type'], message: string) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-3), { id, type, message }]);
      setTimeout(() => dismissToast(id), 4500);
    },
    [dismissToast]
  );

  useEffect(() => {
    setUnauthorizedHandler(() => {
      const previousRole = userRef.current?.role;
      setInMemorySessionToken(null);
      setUser(null);
      queryClient.clear();
      if (previousRole) {
        const targetLogin = previousRole === 'ADMIN' ? '/admin' : '/login';
        if (window.location.pathname !== targetLogin) {
          window.history.replaceState({}, '', targetLogin);
          window.dispatchEvent(new PopStateEvent('popstate'));
        }
        notify('error', 'Sesi Anda telah berakhir. Silakan masuk kembali.');
      }
    });
    return () => setUnauthorizedHandler(null);
  }, [notify, queryClient]);

  const refreshAuth = useCallback(async () => {
    setIsLoading(true);
    try {
      const statusRes = await apiFetch<{ needsBootstrap: boolean }>('/api/v1/auth/status');
      setNeedsBootstrap(statusRes.data.needsBootstrap);
      try {
        const meRes = await apiFetch<AuthUser>('/api/v1/auth/me');
        setUser(meRes.data);
      } catch {
        setInMemorySessionToken(null);
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAuth();
  }, [refreshAuth]);

  const loginWithPassword = useCallback(
    async (params: {
      identifier: string;
      password: string;
      portal: LoginPortal;
      selectedDivision?: OperationalDepartment;
    }) => {
      const res = await apiFetch<{ user: AuthUser; sessionToken: string }>(
        '/api/v1/auth/login',
        {
          method: 'POST',
          body: JSON.stringify(params),
        }
      );
      setInMemorySessionToken(res.data.sessionToken);
      setUser(res.data.user);
      setNeedsBootstrap(false);
      queryClient.clear();
      notify('success', `Selamat datang, ${res.data.user.fullName}.`);
      return res.data.user;
    },
    [notify, queryClient]
  );

  const loginWithGoogle = useCallback(
    async (params: {
      portal: LoginPortal;
      selectedDivision?: OperationalDepartment;
    }) => {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      const idToken = await cred.user.getIdToken();
      const res = await apiFetch<{ user: AuthUser; sessionToken: string }>(
        '/api/v1/auth/firebase-login',
        {
          method: 'POST',
          body: JSON.stringify({
            idToken,
            portal: params.portal,
            selectedDivision: params.selectedDivision,
          }),
        }
      );
      setInMemorySessionToken(res.data.sessionToken);
      setUser(res.data.user);
      setNeedsBootstrap(false);
      queryClient.clear();
      notify('success', `Masuk sebagai ${res.data.user.fullName}.`);
      return res.data.user;
    },
    [notify, queryClient]
  );

  const bootstrapAdmin = useCallback(
    async (payload: {
      fullName: string;
      username: string;
      email: string;
      password: string;
    }) => {
      const res = await apiFetch<{ user: AuthUser; sessionToken: string }>(
        '/api/v1/auth/bootstrap-admin',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      );
      setInMemorySessionToken(res.data.sessionToken);
      setUser(res.data.user);
      setNeedsBootstrap(false);
      queryClient.clear();
      notify('success', 'Akun Admin utama berhasil dibuat.');
      return res.data.user;
    },
    [notify, queryClient]
  );

  const logout = useCallback(async () => {
    const previousRole = userRef.current?.role;
    try {
      await apiFetch('/api/v1/auth/logout', { method: 'POST' });
    } catch {
      // continue local cleanup even if session already expired
    }
    try {
      await signOut(auth);
    } catch {
      // ignore if not signed into firebase
    }
    setInMemorySessionToken(null);
    setUser(null);
    queryClient.clear();
    const targetLogin = previousRole === 'ADMIN' ? '/admin' : '/login';
    if (window.location.pathname !== targetLogin) {
      window.history.pushState({}, '', targetLogin);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
    notify('info', 'Anda telah keluar dari sistem.');
  }, [notify, queryClient]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        needsBootstrap,
        loginWithPassword,
        loginWithGoogle,
        bootstrapAdmin,
        logout,
        refreshAuth,
        toasts,
        notify,
        dismissToast,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
