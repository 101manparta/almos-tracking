import type { ApiErrorResponse, ApiResponse } from '../shared/types.ts';

let inMemorySessionToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

export function setInMemorySessionToken(token: string | null) {
  inMemorySessionToken = token;
}

export function getInMemorySessionToken(): string | null {
  return inMemorySessionToken;
}

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

export class ApiClientError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const headers = new Headers(options.headers || {});
  headers.set('X-Requested-With', 'XMLHttpRequest');

  if (
    options.body &&
    !(options.body instanceof FormData) &&
    !headers.has('Content-Type')
  ) {
    headers.set('Content-Type', 'application/json');
  }

  if (inMemorySessionToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${inMemorySessionToken}`);
  }

  let res: Response;
  try {
    res = await fetch(path, {
      ...options,
      headers,
      credentials: 'include',
    });
  } catch {
    throw new ApiClientError(
      0,
      'NETWORK_ERROR',
      'Koneksi ke server terputus atau server sedang tidak tersedia. Periksa jaringan Anda lalu coba lagi.'
    );
  }

  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    const errPayload = json as ApiErrorResponse | null;
    if (
      res.status === 401 &&
      !path.startsWith('/api/v1/auth/login') &&
      !path.startsWith('/api/v1/auth/firebase-login') &&
      !path.startsWith('/api/v1/auth/bootstrap-admin') &&
      !path.startsWith('/api/v1/auth/me')
    ) {
      unauthorizedHandler?.();
    }
    throw new ApiClientError(
      res.status,
      errPayload?.error?.code || 'REQUEST_FAILED',
      errPayload?.error?.message ||
        (res.status >= 500
          ? 'Terjadi kesalahan pada server. Silakan coba beberapa saat lagi.'
          : `Permintaan gagal (${res.status}).`),
      errPayload?.error?.details
    );
  }

  return json as ApiResponse<T>;
}

export function getAuthenticatedPhotoUrl(url: string): string {
  return url;
}
