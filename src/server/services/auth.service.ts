import { and, count, eq, or } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import { roles, userSessions, users } from '../../db/schema.ts';
import type { AuthUser, RoleCode } from '../../shared/types.ts';
import { AppError } from '../errors/app-error.ts';
import { adminAuth } from '../lib/firebase-admin.ts';
import {
  generateOpaqueToken,
  hashPassword,
  hashToken,
  verifyPassword,
} from '../utils/crypto.ts';
import { writeAuditLog } from './audit.service.ts';

export type LoginPortal = 'ADMIN' | 'EMPLOYEE';
export type EmployeeDivision = 'SPOTTING' | 'IRONING' | 'PACKING';

export function validateLoginPortalAccess(params: {
  actualRole: RoleCode;
  portal?: LoginPortal;
  selectedDivision?: EmployeeDivision;
}) {
  if (params.portal === 'ADMIN') {
    if (params.actualRole !== 'ADMIN') {
      throw new AppError(
        403,
        'ROLE_PORTAL_MISMATCH',
        'Akses ditolak. Akun karyawan tidak dapat masuk melalui Admin Portal. Silakan gunakan halaman Login Karyawan (/login).'
      );
    }
    return;
  }

  if (params.portal === 'EMPLOYEE') {
    if (params.actualRole === 'ADMIN') {
      throw new AppError(
        403,
        'ROLE_PORTAL_MISMATCH',
        'Akun Administrator tidak dapat masuk melalui halaman Login Karyawan. Silakan masuk melalui Admin Portal (/admin).'
      );
    }
    if (!params.selectedDivision) {
      throw new AppError(
        400,
        'DIVISION_REQUIRED',
        'Silakan pilih divisi kerja Anda terlebih dahulu.'
      );
    }
    if (params.actualRole !== params.selectedDivision) {
      throw new AppError(
        403,
        'DIVISION_MISMATCH',
        'Divisi yang dipilih tidak sesuai dengan akun Anda. Silakan pilih divisi yang benar.'
      );
    }
    return;
  }

  if (params.selectedDivision && params.actualRole !== params.selectedDivision) {
    throw new AppError(
      403,
      'DIVISION_MISMATCH',
      'Divisi yang dipilih tidak sesuai dengan akun Anda. Silakan pilih divisi yang benar.'
    );
  }
}

async function getRoleByCode(roleCode: RoleCode) {
  const rows = await db.select().from(roles).where(eq(roles.code, roleCode)).limit(1);
  if (!rows.length) {
    throw new AppError(400, 'INVALID_ROLE', `Peran '${roleCode}' tidak ditemukan.`);
  }
  return rows[0];
}

async function createSessionForUser(userId: string, userAgent?: string) {
  const rawToken = generateOpaqueToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 12); // 12 hours

  await db.insert(userSessions).values({
    userId,
    tokenHash,
    userAgent: userAgent?.slice(0, 300) ?? null,
    expiresAt,
  });

  await db
    .update(users)
    .set({ lastLoginAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, userId));

  return { rawToken, expiresAt };
}

export async function getSystemAuthStatus() {
  const adminRole = await db.select().from(roles).where(eq(roles.code, 'ADMIN')).limit(1);
  if (!adminRole.length) {
    return { needsBootstrap: true };
  }
  const [{ total }] = await db
    .select({ total: count() })
    .from(users)
    .where(and(eq(users.roleId, adminRole[0].id), eq(users.isActive, true)));

  return {
    needsBootstrap: Number(total) === 0,
  };
}

export async function bootstrapFirstAdmin(params: {
  fullName: string;
  username: string;
  email: string;
  password: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<{ user: AuthUser; sessionToken: string }> {
  const status = await getSystemAuthStatus();
  if (!status.needsBootstrap) {
    throw new AppError(
      409,
      'ADMIN_ALREADY_EXISTS',
      'Akun Admin pertama sudah dibuat. Gunakan halaman masuk normal.'
    );
  }

  const adminRole = await getRoleByCode('ADMIN');
  const passwordHash = await hashPassword(params.password);
  const normalizedUsername = params.username.trim().toLowerCase();
  const normalizedEmail = params.email.trim().toLowerCase();

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(or(eq(users.username, normalizedUsername), eq(users.email, normalizedEmail)))
    .limit(1);
  if (existing.length) {
    throw new AppError(409, 'USER_EXISTS', 'Username atau email sudah digunakan.');
  }

  const created = await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(users)
      .values({
        roleId: adminRole.id,
        fullName: params.fullName.trim(),
        username: normalizedUsername,
        email: normalizedEmail,
        passwordHash,
        isActive: true,
      })
      .returning();

    await writeAuditLog(tx, {
      actorUserId: inserted.id,
      action: 'FIRST_ADMIN_BOOTSTRAPPED',
      entityType: 'USER',
      entityId: inserted.id,
      metadata: { email: normalizedEmail, username: normalizedUsername },
      ipAddress: params.ipAddress,
    });

    return inserted;
  });

  const { rawToken } = await createSessionForUser(created.id, params.userAgent);

  return {
    user: {
      id: created.id,
      uid: created.uid,
      fullName: created.fullName,
      username: created.username,
      email: created.email,
      role: 'ADMIN',
      roleName: adminRole.name,
      isActive: created.isActive,
    },
    sessionToken: rawToken,
  };
}

export async function loginWithPassword(params: {
  identifier: string;
  password: string;
  portal?: LoginPortal;
  selectedDivision?: EmployeeDivision;
  ipAddress?: string;
  userAgent?: string;
}): Promise<{ user: AuthUser; sessionToken: string }> {
  const cleanIdentifier = params.identifier.trim().toLowerCase();

  const rows = await db
    .select({
      user: users,
      roleCode: roles.code,
      roleName: roles.name,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(or(eq(users.username, cleanIdentifier), eq(users.email, cleanIdentifier)))
    .limit(1);

  if (!rows.length || !rows[0].user.passwordHash) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Username/email atau kata sandi salah.');
  }

  const { user, roleCode, roleName } = rows[0];
  if (!user.isActive) {
    throw new AppError(403, 'ACCOUNT_DISABLED', 'Akun Anda telah dinonaktifkan oleh Admin.');
  }

  if (!user.passwordHash) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Username/email atau kata sandi salah.');
  }
  const valid = await verifyPassword(params.password, user.passwordHash);
  if (!valid) {
    await writeAuditLog(db, {
      actorUserId: user.id,
      action: 'LOGIN_FAILED',
      entityType: 'USER',
      entityId: user.id,
      metadata: { reason: 'WRONG_PASSWORD', portal: params.portal ?? null },
      ipAddress: params.ipAddress,
    });
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Username/email atau kata sandi salah.');
  }

  try {
    validateLoginPortalAccess({
      actualRole: roleCode as RoleCode,
      portal: params.portal,
      selectedDivision: params.selectedDivision,
    });
  } catch (err) {
    await writeAuditLog(db, {
      actorUserId: user.id,
      action: 'LOGIN_PORTAL_DENIED',
      entityType: 'USER',
      entityId: user.id,
      metadata: {
        actualRole: roleCode,
        portal: params.portal ?? null,
        selectedDivision: params.selectedDivision ?? null,
      },
      ipAddress: params.ipAddress,
    });
    throw err;
  }

  const { rawToken } = await createSessionForUser(user.id, params.userAgent);

  await writeAuditLog(db, {
    actorUserId: user.id,
    action: 'USER_LOGIN',
    entityType: 'USER',
    entityId: user.id,
    metadata: {
      method: 'PASSWORD',
      portal: params.portal ?? null,
      selectedDivision: params.selectedDivision ?? null,
    },
    ipAddress: params.ipAddress,
  });

  return {
    user: {
      id: user.id,
      uid: user.uid,
      fullName: user.fullName,
      username: user.username,
      email: user.email,
      role: roleCode as RoleCode,
      roleName,
      isActive: user.isActive,
    },
    sessionToken: rawToken,
  };
}

export async function loginWithFirebaseToken(params: {
  idToken: string;
  portal?: LoginPortal;
  selectedDivision?: EmployeeDivision;
  ipAddress?: string;
  userAgent?: string;
}): Promise<{ user: AuthUser; sessionToken: string }> {
  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(params.idToken);
  } catch {
    throw new AppError(401, 'INVALID_FIREBASE_TOKEN', 'Token Google Sign-In tidak valid.');
  }

  const email = decoded.email?.trim().toLowerCase();
  if (!email) {
    throw new AppError(400, 'EMAIL_REQUIRED', 'Akun Google tidak memiliki alamat email.');
  }

  // Check if user exists by uid or pre-invited email
  const existingRows = await db
    .select({
      user: users,
      roleCode: roles.code,
      roleName: roles.name,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(or(eq(users.uid, decoded.uid), eq(users.email, email)))
    .limit(1);

  if (existingRows.length) {
    const { user, roleCode, roleName } = existingRows[0];
    if (!user.isActive) {
      throw new AppError(403, 'ACCOUNT_DISABLED', 'Akun Anda dinonaktifkan oleh Administrator.');
    }

    try {
      validateLoginPortalAccess({
        actualRole: roleCode as RoleCode,
        portal: params.portal,
        selectedDivision: params.selectedDivision,
      });
    } catch (err) {
      await writeAuditLog(db, {
        actorUserId: user.id,
        action: 'LOGIN_PORTAL_DENIED',
        entityType: 'USER',
        entityId: user.id,
        metadata: {
          actualRole: roleCode,
          portal: params.portal ?? null,
          selectedDivision: params.selectedDivision ?? null,
        },
        ipAddress: params.ipAddress,
      });
      throw err;
    }

    // Link Firebase UID if pre-invited by email
    if (!user.uid || user.uid !== decoded.uid) {
      await db
        .update(users)
        .set({ uid: decoded.uid, updatedAt: new Date() })
        .where(eq(users.id, user.id));
    }

    const { rawToken } = await createSessionForUser(user.id, params.userAgent);
    await writeAuditLog(db, {
      actorUserId: user.id,
      action: 'USER_LOGIN',
      entityType: 'USER',
      entityId: user.id,
      metadata: {
        method: 'GOOGLE_FIREBASE',
        portal: params.portal ?? null,
        selectedDivision: params.selectedDivision ?? null,
      },
      ipAddress: params.ipAddress,
    });

    return {
      user: {
        id: user.id,
        uid: decoded.uid,
        fullName: user.fullName,
        username: user.username,
        email: user.email,
        role: roleCode as RoleCode,
        roleName,
        isActive: user.isActive,
      },
      sessionToken: rawToken,
    };
  }

  // Only allow first-run Google admin claim from Admin portal (never Employee portal)
  if (params.portal === 'EMPLOYEE') {
    throw new AppError(
      403,
      'USER_NOT_INVITED',
      'Akun Google Anda belum terdaftar sebagai karyawan. Hubungi Admin ALMOS untuk pendaftaran akun.'
    );
  }

  // If no ADMIN exists in DB yet, bootstrap this Google user as first ADMIN
  const status = await getSystemAuthStatus();
  if (!status.needsBootstrap) {
    throw new AppError(
      403,
      'USER_NOT_INVITED',
      'Akun Google Anda belum terdaftar. Hubungi Admin ALMOS untuk menambahkan email Anda di Manajemen Pengguna.'
    );
  }

  const adminRole = await getRoleByCode('ADMIN');
  const baseUsername = email.split('@')[0].replace(/[^a-z0-9._-]/g, '') || 'admin';

  const created = await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(users)
      .values({
        uid: decoded.uid,
        roleId: adminRole.id,
        fullName: decoded.name?.trim() || baseUsername,
        username: baseUsername,
        email,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: { email, updatedAt: new Date() },
      })
      .returning();

    await writeAuditLog(tx, {
      actorUserId: inserted.id,
      action: 'FIRST_ADMIN_BOOTSTRAPPED_GOOGLE',
      entityType: 'USER',
      entityId: inserted.id,
      metadata: { email },
      ipAddress: params.ipAddress,
    });

    return inserted;
  });

  const { rawToken } = await createSessionForUser(created.id, params.userAgent);

  return {
    user: {
      id: created.id,
      uid: created.uid,
      fullName: created.fullName,
      username: created.username,
      email: created.email,
      role: 'ADMIN',
      roleName: adminRole.name,
      isActive: created.isActive,
    },
    sessionToken: rawToken,
  };
}

export async function revokeSession(tokenHash?: string, actorUserId?: string, ipAddress?: string) {
  if (tokenHash) {
    await db
      .update(userSessions)
      .set({ revokedAt: new Date() })
      .where(eq(userSessions.tokenHash, tokenHash));
  }
  if (actorUserId) {
    await writeAuditLog(db, {
      actorUserId,
      action: 'USER_LOGOUT',
      entityType: 'USER',
      entityId: actorUserId,
      ipAddress,
    });
  }
}

export async function listUsers() {
  const rows = await db
    .select({
      id: users.id,
      uid: users.uid,
      fullName: users.fullName,
      username: users.username,
      email: users.email,
      isActive: users.isActive,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
      roleCode: roles.code,
      roleName: roles.name,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .orderBy(users.createdAt);

  return rows.map((r) => ({
    id: r.id,
    uid: r.uid,
    fullName: r.fullName,
    username: r.username,
    email: r.email,
    isActive: r.isActive,
    lastLoginAt: r.lastLoginAt,
    createdAt: r.createdAt,
    role: r.roleCode as RoleCode,
    roleName: r.roleName,
  }));
}

export async function getUserById(userId: string) {
  const rows = await db
    .select({
      id: users.id,
      uid: users.uid,
      fullName: users.fullName,
      username: users.username,
      email: users.email,
      isActive: users.isActive,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
      roleCode: roles.code,
      roleName: roles.name,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(eq(users.id, userId))
    .limit(1);

  if (!rows.length) {
    throw new AppError(404, 'USER_NOT_FOUND', 'Pengguna tidak ditemukan.');
  }
  const r = rows[0];
  return {
    id: r.id,
    uid: r.uid,
    fullName: r.fullName,
    username: r.username,
    email: r.email,
    isActive: r.isActive,
    lastLoginAt: r.lastLoginAt,
    createdAt: r.createdAt,
    role: r.roleCode as RoleCode,
    roleName: r.roleName,
  };
}

export async function createStaffUser(params: {
  actorUserId: string;
  fullName: string;
  username: string;
  email: string;
  role: RoleCode;
  password?: string;
  ipAddress?: string;
}) {
  const roleRow = await getRoleByCode(params.role);
  const cleanUsername = params.username.trim().toLowerCase();
  const cleanEmail = params.email.trim().toLowerCase();

  const dup = await db
    .select({ id: users.id })
    .from(users)
    .where(or(eq(users.username, cleanUsername), eq(users.email, cleanEmail)))
    .limit(1);
  if (dup.length) {
    throw new AppError(409, 'USER_EXISTS', 'Username atau email sudah terdaftar.');
  }

  const passwordHash = params.password ? await hashPassword(params.password) : null;

  const created = await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(users)
      .values({
        roleId: roleRow.id,
        fullName: params.fullName.trim(),
        username: cleanUsername,
        email: cleanEmail,
        passwordHash,
        isActive: true,
      })
      .returning();

    await writeAuditLog(tx, {
      actorUserId: params.actorUserId,
      action: 'USER_CREATED',
      entityType: 'USER',
      entityId: inserted.id,
      metadata: { role: params.role, username: cleanUsername, email: cleanEmail },
      ipAddress: params.ipAddress,
    });

    return inserted;
  });

  return {
    id: created.id,
    uid: created.uid,
    fullName: created.fullName,
    username: created.username,
    email: created.email,
    role: params.role,
    roleName: roleRow.name,
    isActive: created.isActive,
    createdAt: created.createdAt,
  };
}

export async function updateStaffUser(params: {
  actorUserId: string;
  targetUserId: string;
  fullName?: string;
  role?: RoleCode;
  isActive?: boolean;
  password?: string;
  ipAddress?: string;
}) {
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.id, params.targetUserId))
    .limit(1);

  if (!existing.length) {
    throw new AppError(404, 'USER_NOT_FOUND', 'Pengguna tidak ditemukan.');
  }

  if (params.targetUserId === params.actorUserId && params.isActive === false) {
    throw new AppError(400, 'CANNOT_DISABLE_SELF', 'Anda tidak dapat menonaktifkan akun Anda sendiri.');
  }

  const updates: Partial<typeof users.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (params.fullName !== undefined) updates.fullName = params.fullName.trim();
  if (params.isActive !== undefined) updates.isActive = params.isActive;
  if (params.role !== undefined) {
    const roleRow = await getRoleByCode(params.role);
    updates.roleId = roleRow.id;
  }
  if (params.password && params.password.length >= 8) {
    updates.passwordHash = await hashPassword(params.password);
  }

  await db.transaction(async (tx) => {
    await tx.update(users).set(updates).where(eq(users.id, params.targetUserId));

    if (params.isActive === false || params.password || params.role !== undefined) {
      await tx
        .update(userSessions)
        .set({ revokedAt: new Date() })
        .where(eq(userSessions.userId, params.targetUserId));
    }

    await writeAuditLog(tx, {
      actorUserId: params.actorUserId,
      action: 'USER_UPDATED',
      entityType: 'USER',
      entityId: params.targetUserId,
      metadata: {
        role: params.role,
        isActive: params.isActive,
        passwordChanged: Boolean(params.password),
      },
      ipAddress: params.ipAddress,
    });
  });

  return getUserById(params.targetUserId);
}
