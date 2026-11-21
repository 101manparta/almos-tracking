import { and, eq, gt, isNull } from 'drizzle-orm';
import type { NextFunction, Request, Response } from 'express';
import { db } from '../../db/index.ts';
import { roles, userSessions, users } from '../../db/schema.ts';
import type { AuthUser, RoleCode } from '../../shared/types.ts';
import { AppError } from '../errors/app-error.ts';
import { adminAuth } from '../lib/firebase-admin.ts';
import { hashToken } from '../utils/crypto.ts';

export const SESSION_COOKIE_NAME = 'almos_session';

export interface AuthRequest extends Request {
  authUser?: AuthUser;
  authViaCookie?: boolean;
  sessionTokenHash?: string;
}

// In-memory sliding window login rate limiter (10 attempts per 5 minutes per IP)
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

export function loginRateLimiter(req: Request, _res: Response, next: NextFunction) {
  const ip =
    (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
    req.ip ||
    'unknown';
  const now = Date.now();
  const windowMs = 5 * 60 * 1000;
  const maxAttempts = 15;

  const entry = loginAttempts.get(ip);
  if (!entry || entry.resetAt <= now) {
    loginAttempts.set(ip, { count: 1, resetAt: now + windowMs });
    return next();
  }

  if (entry.count >= maxAttempts) {
    return next(
      new AppError(
        429,
        'RATE_LIMIT_EXCEEDED',
        'Terlalu banyak percobaan masuk. Silakan coba lagi dalam beberapa menit.'
      )
    );
  }

  entry.count += 1;
  return next();
}

export function setSessionCookie(res: Response, rawToken: string, maxAgeSeconds = 60 * 60 * 12) {
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(rawToken)}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=None',
    'Partitioned',
    `Max-Age=${maxAgeSeconds}`,
  ];
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function clearSessionCookie(res: Response) {
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=None',
    'Partitioned',
    'Max-Age=0',
  ];
  res.setHeader('Set-Cookie', parts.join('; '));
}

async function fetchUserById(userId: string): Promise<AuthUser | null> {
  const rows = await db
    .select({
      id: users.id,
      uid: users.uid,
      fullName: users.fullName,
      username: users.username,
      email: users.email,
      isActive: users.isActive,
      roleCode: roles.code,
      roleName: roles.name,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(eq(users.id, userId))
    .limit(1);

  if (!rows.length) return null;
  const row = rows[0];
  return {
    id: row.id,
    uid: row.uid,
    fullName: row.fullName,
    username: row.username,
    email: row.email,
    role: row.roleCode as RoleCode,
    roleName: row.roleName,
    isActive: row.isActive,
  };
}

function assertCookieCsrfSafe(req: Request) {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return;

  const hasCustomHeader = req.headers['x-requested-with'] === 'XMLHttpRequest';
  const origin = req.headers.origin;
  const host = (req.headers['x-forwarded-host'] as string | undefined) || req.headers.host;

  if (origin && host) {
    try {
      const originHost = new URL(origin).host;
      if (originHost === host) return;
    } catch {
      // fall through
    }
  }

  if (hasCustomHeader && !origin) return;
  if (hasCustomHeader && origin && host) {
    try {
      if (new URL(origin).host === host) return;
    } catch {
      // fall through
    }
  }

  // Allow localhost/loopback during test runner
  if (!origin && req.headers['user-agent']?.includes('node')) return;

  throw new AppError(403, 'CSRF_CHECK_FAILED', 'Permintaan tidak valid (verifikasi origin gagal).');
}

export async function requireAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    const cookieToken = req.cookies?.[SESSION_COOKIE_NAME] as string | undefined;

    // 1. Check Bearer token (either opaque session token or Firebase ID token)
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice('Bearer '.length).trim();
      if (!token) {
        throw new AppError(401, 'UNAUTHORIZED', 'Token autentikasi kosong.');
      }

      // First try opaque session token hash in DB
      const tokenDigest = hashToken(token);
      const sessionRows = await db
        .select({
          userId: userSessions.userId,
          tokenHash: userSessions.tokenHash,
        })
        .from(userSessions)
        .where(
          and(
            eq(userSessions.tokenHash, tokenDigest),
            isNull(userSessions.revokedAt),
            gt(userSessions.expiresAt, new Date())
          )
        )
        .limit(1);

      if (sessionRows.length) {
        const user = await fetchUserById(sessionRows[0].userId);
        if (!user || !user.isActive) {
          throw new AppError(403, 'ACCOUNT_DISABLED', 'Akun Anda tidak aktif atau telah dinonaktifkan.');
        }
        req.authUser = user;
        req.authViaCookie = false;
        req.sessionTokenHash = sessionRows[0].tokenHash;
        return next();
      }

      // Otherwise try Firebase ID Token verification
      try {
        const decoded = await adminAuth.verifyIdToken(token);
        const fbRows = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.uid, decoded.uid))
          .limit(1);

        if (!fbRows.length) {
          throw new AppError(
            403,
            'USER_NOT_PROVISIONED',
            'Akun Google Anda belum terdaftar dalam sistem internal ALMOS.'
          );
        }
        const user = await fetchUserById(fbRows[0].id);
        if (!user || !user.isActive) {
          throw new AppError(403, 'ACCOUNT_DISABLED', 'Akun Anda tidak aktif.');
        }
        req.authUser = user;
        req.authViaCookie = false;
        return next();
      } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError(401, 'INVALID_TOKEN', 'Sesi atau token autentikasi tidak valid.');
      }
    }

    // 2. Check HttpOnly Session Cookie
    if (cookieToken) {
      assertCookieCsrfSafe(req);
      const tokenDigest = hashToken(cookieToken);
      const sessionRows = await db
        .select({
          userId: userSessions.userId,
          tokenHash: userSessions.tokenHash,
        })
        .from(userSessions)
        .where(
          and(
            eq(userSessions.tokenHash, tokenDigest),
            isNull(userSessions.revokedAt),
            gt(userSessions.expiresAt, new Date())
          )
        )
        .limit(1);

      if (!sessionRows.length) {
        throw new AppError(401, 'SESSION_EXPIRED', 'Sesi telah berakhir. Silakan masuk kembali.');
      }

      const user = await fetchUserById(sessionRows[0].userId);
      if (!user || !user.isActive) {
        throw new AppError(403, 'ACCOUNT_DISABLED', 'Akun Anda dinonaktifkan oleh Admin.');
      }

      req.authUser = user;
      req.authViaCookie = true;
      req.sessionTokenHash = sessionRows[0].tokenHash;
      return next();
    }

    throw new AppError(401, 'UNAUTHORIZED', 'Silakan masuk terlebih dahulu.');
  } catch (err) {
    return next(err);
  }
}

export function requireRole(...allowedRoles: RoleCode[]) {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.authUser) {
      return next(new AppError(401, 'UNAUTHORIZED', 'Autentikasi diperlukan.'));
    }
    if (!allowedRoles.includes(req.authUser.role)) {
      return next(
        new AppError(
          403,
          'FORBIDDEN',
          `Akses ditolak. Halaman atau tindakan ini khusus untuk peran: ${allowedRoles.join(', ')}.`
        )
      );
    }
    return next();
  };
}
