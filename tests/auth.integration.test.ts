import fs from 'node:fs/promises';
import type { Server } from 'node:http';
import path from 'node:path';
import { eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { db } from '../src/db/index.ts';
import {
  auditLogs,
  checklists,
  garmentPhotos,
  garments,
  garmentWorkflowStages,
  handoverRecords,
  orders,
  roles,
  userSessions,
  users,
  workflowHistory,
} from '../src/db/schema.ts';
import { createBackendApp } from '../src/server/app.ts';
import { hashPassword, hashToken } from '../src/server/utils/crypto.ts';

const hasSqlEnv = Boolean(process.env.SQL_HOST && process.env.SQL_DB_NAME);

describe.skipIf(!hasSqlEnv)('Controlled Login, RBAC, Session & Regression Integration Tests', () => {
  let server: Server;
  let baseUrl = '';
  const runSuffix = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const testPassword = 'AlmosTest#2026';

  const createdUserIds: string[] = [];
  const createdOrderIds: string[] = [];
  const createdGarmentIds: string[] = [];

  const accounts = {
    admin: { username: `__test_admin_${runSuffix}`, email: `admin_${runSuffix}@test.local`, id: '' },
    spotting: {
      username: `__test_spot_${runSuffix}`,
      email: `spot_${runSuffix}@test.local`,
      id: '',
    },
    ironing: {
      username: `__test_iron_${runSuffix}`,
      email: `iron_${runSuffix}@test.local`,
      id: '',
    },
    packing: {
      username: `__test_pack_${runSuffix}`,
      email: `pack_${runSuffix}@test.local`,
      id: '',
    },
    disabled: {
      username: `__test_disabled_${runSuffix}`,
      email: `disabled_${runSuffix}@test.local`,
      id: '',
    },
  };

  beforeAll(async () => {
    const app = createBackendApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        if (addr && typeof addr === 'object') {
          baseUrl = `http://127.0.0.1:${addr.port}`;
        }
        resolve();
      });
    });

    const roleRows = await db.select().from(roles);
    const roleMap = new Map(roleRows.map((r) => [r.code, r.id]));
    const passwordHash = await hashPassword(testPassword);

    const seedDefs = [
      { key: 'admin' as const, roleCode: 'ADMIN', isActive: true, fullName: 'Test Admin' },
      { key: 'spotting' as const, roleCode: 'SPOTTING', isActive: true, fullName: 'Test Spotting' },
      { key: 'ironing' as const, roleCode: 'IRONING', isActive: true, fullName: 'Test Ironing' },
      { key: 'packing' as const, roleCode: 'PACKING', isActive: true, fullName: 'Test Packing' },
      { key: 'disabled' as const, roleCode: 'SPOTTING', isActive: false, fullName: 'Test Disabled' },
    ];

    for (const def of seedDefs) {
      const roleId = roleMap.get(def.roleCode);
      if (!roleId) throw new Error(`Missing role ${def.roleCode} in DB`);
      const [inserted] = await db
        .insert(users)
        .values({
          roleId,
          fullName: def.fullName,
          username: accounts[def.key].username,
          email: accounts[def.key].email,
          passwordHash,
          isActive: def.isActive,
        })
        .returning({ id: users.id });
      accounts[def.key].id = inserted.id;
      createdUserIds.push(inserted.id);
    }
  });

  afterAll(async () => {
    if (createdGarmentIds.length) {
      const photos = await db
        .select({ storagePath: garmentPhotos.storagePath, thumbnailPath: garmentPhotos.thumbnailPath })
        .from(garmentPhotos)
        .where(inArray(garmentPhotos.garmentId, createdGarmentIds));

      for (const p of photos) {
        const base = path.resolve(process.cwd(), 'storage', 'photos');
        for (const rel of [p.storagePath, p.thumbnailPath]) {
          const full = path.resolve(base, rel);
          if (full.startsWith(base + path.sep)) {
            await fs.unlink(full).catch(() => {});
          }
        }
      }

      await db.delete(handoverRecords).where(inArray(handoverRecords.garmentId, createdGarmentIds));
      await db.delete(checklists).where(inArray(checklists.garmentId, createdGarmentIds));
      await db.delete(garmentPhotos).where(inArray(garmentPhotos.garmentId, createdGarmentIds));
      await db.delete(workflowHistory).where(inArray(workflowHistory.garmentId, createdGarmentIds));
      await db
        .delete(garmentWorkflowStages)
        .where(inArray(garmentWorkflowStages.garmentId, createdGarmentIds));
      await db.delete(garments).where(inArray(garments.id, createdGarmentIds));
    }
    if (createdOrderIds.length) {
      await db.delete(orders).where(inArray(orders.id, createdOrderIds));
    }
    if (createdUserIds.length) {
      await db.delete(auditLogs).where(inArray(auditLogs.actorUserId, createdUserIds));
      await db.delete(userSessions).where(inArray(userSessions.userId, createdUserIds));
      await db.delete(users).where(inArray(users.id, createdUserIds));
    }
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  async function apiCall(path: string, init: RequestInit = {}, token?: string) {
    const headers = new Headers(init.headers || {});
    headers.set('X-Requested-With', 'XMLHttpRequest');
    if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const res = await fetch(`${baseUrl}${path}`, { ...init, headers });
    const json = await res.json();
    return { status: res.status, headers: res.headers, body: json };
  }

  let sharedAdminToken = '';
  let sharedSpotToken = '';
  let sharedIronToken = '';

  it('allows valid ADMIN login on /admin portal and rejects employee accounts on /admin portal', async () => {
    const okAdmin = await apiCall('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        identifier: accounts.admin.username,
        password: testPassword,
        portal: 'ADMIN',
      }),
    });
    expect(okAdmin.status).toBe(200);
    expect(okAdmin.body.data.user.role).toBe('ADMIN');
    expect(okAdmin.headers.get('set-cookie')).toContain('HttpOnly');

    const adminToken = okAdmin.body.data.sessionToken as string;
    sharedAdminToken = adminToken;
    const overviewRes = await apiCall('/api/v1/reports/overview', {}, adminToken);
    expect(overviewRes.status).toBe(200);

    const rejectedEmp = await apiCall('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        identifier: accounts.spotting.username,
        password: testPassword,
        portal: 'ADMIN',
      }),
    });
    expect(rejectedEmp.status).toBe(403);
    expect(rejectedEmp.body.error.code).toBe('ROLE_PORTAL_MISMATCH');
  });

  it('authenticates SPOTTING, IRONING, PACKING with matching division and rejects wrong division or ADMIN on /login', async () => {
    const spotRes = await apiCall('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        identifier: accounts.spotting.username,
        password: testPassword,
        portal: 'EMPLOYEE',
        selectedDivision: 'SPOTTING',
      }),
    });
    expect(spotRes.status).toBe(200);
    expect(spotRes.body.data.user.role).toBe('SPOTTING');
    sharedSpotToken = spotRes.body.data.sessionToken as string;

    const ironRes = await apiCall('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        identifier: accounts.ironing.email,
        password: testPassword,
        portal: 'EMPLOYEE',
        selectedDivision: 'IRONING',
      }),
    });
    expect(ironRes.status).toBe(200);
    expect(ironRes.body.data.user.role).toBe('IRONING');
    sharedIronToken = ironRes.body.data.sessionToken as string;

    const packRes = await apiCall('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        identifier: accounts.packing.username,
        password: testPassword,
        portal: 'EMPLOYEE',
        selectedDivision: 'PACKING',
      }),
    });
    expect(packRes.status).toBe(200);
    expect(packRes.body.data.user.role).toBe('PACKING');

    // Wrong division selected
    const mismatchRes = await apiCall('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        identifier: accounts.spotting.username,
        password: testPassword,
        portal: 'EMPLOYEE',
        selectedDivision: 'IRONING',
      }),
    });
    expect(mismatchRes.status).toBe(403);
    expect(mismatchRes.body.error.code).toBe('DIVISION_MISMATCH');
    expect(mismatchRes.body.error.message).toBe(
      'Divisi yang dipilih tidak sesuai dengan akun Anda. Silakan pilih divisi yang benar.'
    );

    // Admin trying employee portal
    const adminOnEmpRes = await apiCall('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        identifier: accounts.admin.username,
        password: testPassword,
        portal: 'EMPLOYEE',
        selectedDivision: 'SPOTTING',
      }),
    });
    expect(adminOnEmpRes.status).toBe(403);
    expect(adminOnEmpRes.body.error.code).toBe('ROLE_PORTAL_MISMATCH');

    // Disabled user blocked
    const disabledRes = await apiCall('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        identifier: accounts.disabled.username,
        password: testPassword,
        portal: 'EMPLOYEE',
        selectedDivision: 'SPOTTING',
      }),
    });
    expect(disabledRes.status).toBe(403);
    expect(disabledRes.body.error.code).toBe('ACCOUNT_DISABLED');

    // Employee blocked from Admin endpoints
    const usersCheck = await apiCall('/api/v1/users', {}, sharedSpotToken);
    expect(usersCheck.status).toBe(403);
    const ordersCheck = await apiCall('/api/v1/orders', {}, sharedSpotToken);
    expect(ordersCheck.status).toBe(403);
  });

  it('maintains session across /auth/me, revokes on logout, rejects expired sessions, and supports admin password reset', async () => {
    const loginRes = await apiCall('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        identifier: accounts.ironing.username,
        password: testPassword,
        portal: 'EMPLOYEE',
        selectedDivision: 'IRONING',
      }),
    });
    expect(loginRes.status).toBe(200);
    const token = loginRes.body.data.sessionToken as string;

    const meRes = await apiCall('/api/v1/auth/me', {}, token);
    expect(meRes.status).toBe(200);
    expect(meRes.body.data.role).toBe('IRONING');

    // Logout revokes session
    const logoutRes = await apiCall('/api/v1/auth/logout', { method: 'POST' }, token);
    expect(logoutRes.status).toBe(200);

    const afterLogoutMe = await apiCall('/api/v1/auth/me', {}, token);
    expect(afterLogoutMe.status).toBe(401);

    // Expired session rejected
    const login2 = await apiCall('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        identifier: accounts.ironing.username,
        password: testPassword,
        portal: 'EMPLOYEE',
        selectedDivision: 'IRONING',
      }),
    });
    expect(login2.status).toBe(200);
    const token2 = login2.body.data.sessionToken as string;
    await db
      .update(userSessions)
      .set({ expiresAt: new Date(Date.now() - 60_000) })
      .where(eq(userSessions.tokenHash, hashToken(token2)));

    const expiredMe = await apiCall('/api/v1/auth/me', {}, token2);
    expect(expiredMe.status).toBe(401);

    // Admin password reset works and revokes old session
    const empFresh = await apiCall('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        identifier: accounts.packing.username,
        password: testPassword,
        portal: 'EMPLOYEE',
        selectedDivision: 'PACKING',
      }),
    });
    expect(empFresh.status).toBe(200);
    const oldPackToken = empFresh.body.data.sessionToken as string;

    const resetRes = await apiCall(
      `/api/v1/users/${accounts.packing.id}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ password: 'NewPackPass#2026' }),
      },
      sharedAdminToken
    );
    expect(resetRes.status).toBe(200);

    const revokedAfterReset = await apiCall('/api/v1/auth/me', {}, oldPackToken);
    expect(revokedAfterReset.status).toBe(401);

    const loginNewPass = await apiCall('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        identifier: accounts.packing.username,
        password: 'NewPackPass#2026',
        portal: 'EMPLOYEE',
        selectedDivision: 'PACKING',
      }),
    });
    expect(loginNewPass.status).toBe(200);
  });

  it('preserves operational regression: order, garment, photo upload, spotting->ironing workflow, and cross-division protection', async () => {
    const adminToken = sharedAdminToken;
    const spotToken = sharedSpotToken;
    const ironToken = sharedIronToken;

    // 1. Create order
    const orderRes = await apiCall(
      '/api/v1/orders',
      {
        method: 'POST',
        body: JSON.stringify({
          customerName: `__Test Pelanggan ${runSuffix}`,
          customerPhone: '081200009999',
          orderCategory: 'INDIVIDUAL',
        }),
      },
      adminToken
    );
    expect(orderRes.status).toBe(201);
    const orderId = orderRes.body.data.id as string;
    createdOrderIds.push(orderId);

    // 2. Register garment (FULL_DETAILING -> WAITING_SPOTTING)
    const garmentRes = await apiCall(
      '/api/v1/garments',
      {
        method: 'POST',
        body: JSON.stringify({
          orderId,
          templateCode: 'FULL_DETAILING',
          garmentName: 'Jas Test Regresi',
          category: 'Formal',
          garmentType: 'Jas',
          color: 'Navy',
          physicalTagNumber: `T-${runSuffix.slice(-4)}`,
          initialCondition: 'Baik, perlu pembersihan kerah',
        }),
      },
      adminToken
    );
    expect(garmentRes.status).toBe(201);
    const garmentId = garmentRes.body.data.id as string;
    let version = garmentRes.body.data.version as number;
    createdGarmentIds.push(garmentId);
    expect(garmentRes.body.data.currentStatus).toBe('WAITING_SPOTTING');

    // 3. Upload 1x1 valid PNG photo
    const pngBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    const form = new FormData();
    form.append('photoType', 'FRONT');
    form.append('file', new Blob([Buffer.from(pngBase64, 'base64')], { type: 'image/png' }), 'test.png');
    const photoRes = await fetch(`${baseUrl}/api/v1/garments/${garmentId}/photos`, {
      method: 'POST',
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        Authorization: `Bearer ${adminToken}`,
      },
      body: form,
    });
    expect(photoRes.status).toBe(201);

    // 4. Ironing staff CANNOT start a garment waiting in Spotting
    const wrongDeptStart = await apiCall(
      `/api/v1/garments/${garmentId}/start`,
      {
        method: 'POST',
        body: JSON.stringify({ version, verificationMethod: 'PHYSICAL_TAG' }),
      },
      ironToken
    );
    expect(wrongDeptStart.status).toBe(403);

    // 5. Spotting staff sees garment in queue and completes workflow -> WAITING_IRONING
    const spotQueue = await apiCall('/api/v1/staff/queue?status=WAITING', {}, spotToken);
    expect(spotQueue.status).toBe(200);
    expect(spotQueue.body.data.some((g: { id: string }) => g.id === garmentId)).toBe(true);

    const startRes = await apiCall(
      `/api/v1/garments/${garmentId}/start`,
      {
        method: 'POST',
        body: JSON.stringify({ version, verificationMethod: 'PHYSICAL_TAG' }),
      },
      spotToken
    );
    expect(startRes.status).toBe(200);
    version = startRes.body.data.version as number;

    const checklistGet = await apiCall(`/api/v1/garments/${garmentId}/checklist`, {}, spotToken);
    expect(checklistGet.status).toBe(200);
    const items = checklistGet.body.data[0].items.map((i: { itemKey: string }) => ({
      itemKey: i.itemKey,
      isChecked: true,
    }));

    const checklistSave = await apiCall(
      `/api/v1/garments/${garmentId}/checklist`,
      {
        method: 'POST',
        body: JSON.stringify({
          identityVerified: true,
          verificationMethod: 'PHYSICAL_TAG',
          items,
        }),
      },
      spotToken
    );
    expect(checklistSave.status).toBe(200);

    const handoverRes = await apiCall(
      `/api/v1/garments/${garmentId}/handover`,
      {
        method: 'POST',
        body: JSON.stringify({
          version,
          physicalTagVerified: true,
          conditionNotes: 'Spotting selesai',
        }),
      },
      spotToken
    );
    expect(handoverRes.status).toBe(200);
    expect(handoverRes.body.data.currentDepartment).toBe('IRONING');
    expect(handoverRes.body.data.currentStatus).toBe('WAITING_IRONING');
  });
});
