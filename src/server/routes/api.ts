import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { AppError, asyncHandler } from '../errors/app-error.ts';
import {
  type AuthRequest,
  clearSessionCookie,
  loginRateLimiter,
  requireAuth,
  requireRole,
  setSessionCookie,
} from '../middleware/auth.ts';
import {
  bootstrapFirstAdmin,
  createStaffUser,
  getSystemAuthStatus,
  getUserById,
  listUsers,
  loginWithFirebaseToken,
  loginWithPassword,
  revokeSession,
  updateStaffUser,
} from '../services/auth.service.ts';
import {
  addGarmentPhoto,
  getGarmentById,
  getGarmentHistory,
  getPhotoMetadata,
  listGarments,
  listPhotosGallery,
  listWorkflowTemplates,
  registerGarment,
  softDeletePhoto,
  updateGarmentDetails,
} from '../services/garment.service.ts';
import {
  cancelOrder,
  createOrder,
  getOrderById,
  listArchiveOrders,
  listOrders,
  updateOrder,
} from '../services/order.service.ts';
import { confirmOrderPickup } from '../services/pickup.service.ts';
import {
  getAdminOverview,
  getCompletedReport,
  getDepartmentsReport,
  getStaffDashboardSummary,
  getSystemSettings,
  globalSearch,
  updateSystemSetting,
} from '../services/report.service.ts';
import { readPhotoObject } from '../services/storage.service.ts';
import {
  completeGarmentStage,
  getGarmentCurrentChecklist,
  getStaffDepartmentQueue,
  getStaffWorkHistory,
  handoverGarmentStage,
  holdGarment,
  listIssues,
  reportGarmentIssue,
  resolveIssue,
  resumeGarment,
  saveGarmentChecklist,
  startGarmentStage,
} from '../services/workflow.service.ts';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 2 },
});

function parseBody<T extends z.ZodTypeAny>(schema: T, payload: unknown): z.infer<T> {
  const result = schema.safeParse(payload);
  if (!result.success) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Data masukan tidak valid.', {
      issues: result.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      })),
    });
  }
  return result.data;
}

function getClientIp(req: AuthRequest): string {
  return (
    (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
    req.ip ||
    'unknown'
  );
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function assertUuid(value: unknown, field = 'id'): string {
  if (typeof value !== 'string' || !UUID_REGEX.test(value)) {
    throw new AppError(400, 'INVALID_UUID', `Format ${field} tidak valid.`);
  }
  return value;
}

export function createApiV1Router(): Router {
  const router = Router();

  router.get('/health', (_req, res) => {
    res.json({ data: { status: 'ok', service: 'almos-tracking-api', version: 'v1' } });
  });

  // OpenAPI 3.0 specification endpoint
  router.get('/openapi.json', (_req, res) => {
    res.json({
      openapi: '3.0.3',
      info: {
        title: 'ALMOS Laundry Detailing — Garment Tracking API',
        version: '1.0.0',
        description: 'Internal operations, workflow state machine, and garment tracking REST API.',
      },
      paths: {
        '/api/v1/auth/status': { get: { summary: 'Check initial admin bootstrap state' } },
        '/api/v1/auth/bootstrap-admin': { post: { summary: 'Create first admin account when DB is empty' } },
        '/api/v1/auth/login': { post: { summary: 'Password login (HttpOnly cookie + Bearer token)' } },
        '/api/v1/auth/firebase-login': { post: { summary: 'Google Firebase ID token login' } },
        '/api/v1/auth/logout': { post: { summary: 'Revoke session & clear cookie' } },
        '/api/v1/auth/me': { get: { summary: 'Get authenticated user profile and role' } },
        '/api/v1/users': { get: { summary: 'List users (Admin)' }, post: { summary: 'Create staff/admin user (Admin)' } },
        '/api/v1/users/{id}': { get: { summary: 'Get user (Admin)' }, patch: { summary: 'Update user role/status (Admin)' } },
        '/api/v1/orders': { get: { summary: 'List active orders (Admin)' }, post: { summary: 'Create order (Admin)' } },
        '/api/v1/orders/{id}': { get: { summary: 'Order details' }, patch: { summary: 'Update order (Admin)' } },
        '/api/v1/orders/{id}/cancel': { post: { summary: 'Cancel order with reason (Admin)' } },
        '/api/v1/orders/{id}/pickup': { post: { summary: 'Confirm order pickup and archive (Admin)' } },
        '/api/v1/garments': { get: { summary: 'List garments' }, post: { summary: 'Register garment (Admin)' } },
        '/api/v1/garments/{id}': { get: { summary: 'Garment details' }, patch: { summary: 'Update descriptive fields (Admin)' } },
        '/api/v1/garments/{id}/history': { get: { summary: 'Garment workflow timeline & handovers' } },
        '/api/v1/garments/{id}/photos': { post: { summary: 'Upload garment photo' } },
        '/api/v1/photos': { get: { summary: 'Paginated photo gallery' } },
        '/api/v1/photos/{id}/file': { get: { summary: 'Authenticated private photo stream' } },
        '/api/v1/photos/{id}': { delete: { summary: 'Soft-delete photo with audit log (Admin)' } },
        '/api/v1/garments/{id}/start': { post: { summary: 'Start assigned department stage' } },
        '/api/v1/garments/{id}/checklist': { get: { summary: 'Get garment checklist' }, post: { summary: 'Save checklist progress' } },
        '/api/v1/garments/{id}/complete': { post: { summary: 'Complete stage & hand over' } },
        '/api/v1/garments/{id}/handover': { post: { summary: 'Idempotent handover to next stage' } },
        '/api/v1/garments/{id}/hold': { post: { summary: 'Place garment on hold' } },
        '/api/v1/garments/{id}/resume': { post: { summary: 'Resume garment from hold (Admin)' } },
        '/api/v1/garments/{id}/issues': { post: { summary: 'Report garment issue' } },
        '/api/v1/issues': { get: { summary: 'List issue reports' } },
        '/api/v1/issues/{id}/resolve': { patch: { summary: 'Resolve issue report (Admin)' } },
        '/api/v1/archive': { get: { summary: 'Search archived orders (Admin)' } },
        '/api/v1/reports/overview': { get: { summary: 'Admin live operational overview' } },
        '/api/v1/reports/departments': { get: { summary: 'Department queue metrics' } },
        '/api/v1/reports/completed': { get: { summary: 'Operational analytics breakdown' } },
        '/api/v1/search': { get: { summary: 'Global search across orders, garments, tags' } },
      },
    });
  });

  // ==========================================
  // AUTHENTICATION ROUTES
  // ==========================================
  router.get(
    '/auth/status',
    asyncHandler(async (_req, res) => {
      const status = await getSystemAuthStatus();
      res.json({ data: status });
    })
  );

  router.post(
    '/auth/bootstrap-admin',
    loginRateLimiter,
    asyncHandler(async (req, res) => {
      const body = parseBody(
        z.object({
          fullName: z.string().min(2, 'Nama lengkap minimal 2 karakter').max(120),
          username: z
            .string()
            .min(3, 'Username minimal 3 karakter')
            .max(48)
            .regex(/^[a-zA-Z0-9._-]+$/, 'Username hanya boleh huruf, angka, titik, garis bawah, atau strip'),
          email: z.string().email('Format email tidak valid'),
          password: z.string().min(8, 'Kata sandi minimal 8 karakter').max(128),
        }),
        req.body
      );

      const { user, sessionToken } = await bootstrapFirstAdmin({
        ...body,
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'],
      });
      setSessionCookie(res, sessionToken);
      res.status(201).json({ data: { user, sessionToken } });
    })
  );

  router.post(
    '/auth/login',
    loginRateLimiter,
    asyncHandler(async (req, res) => {
      const body = parseBody(
        z.object({
          identifier: z.string().min(2, 'Masukkan username atau email'),
          password: z.string().min(1, 'Masukkan kata sandi'),
          portal: z.enum(['ADMIN', 'EMPLOYEE']).optional(),
          selectedDivision: z.enum(['SPOTTING', 'IRONING', 'PACKING']).optional(),
        }),
        req.body
      );
      const { user, sessionToken } = await loginWithPassword({
        ...body,
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'],
      });
      setSessionCookie(res, sessionToken);
      res.json({ data: { user, sessionToken } });
    })
  );

  router.post(
    '/auth/firebase-login',
    loginRateLimiter,
    asyncHandler(async (req, res) => {
      const body = parseBody(
        z.object({
          idToken: z.string().min(10, 'Token Google tidak valid'),
          portal: z.enum(['ADMIN', 'EMPLOYEE']).optional(),
          selectedDivision: z.enum(['SPOTTING', 'IRONING', 'PACKING']).optional(),
        }),
        req.body
      );
      const { user, sessionToken } = await loginWithFirebaseToken({
        idToken: body.idToken,
        portal: body.portal,
        selectedDivision: body.selectedDivision,
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'],
      });
      setSessionCookie(res, sessionToken);
      res.json({ data: { user, sessionToken } });
    })
  );

  router.post(
    '/auth/logout',
    requireAuth,
    asyncHandler(async (req: AuthRequest, res) => {
      await revokeSession(req.sessionTokenHash, req.authUser?.id, getClientIp(req));
      clearSessionCookie(res);
      res.json({ data: { loggedOut: true } });
    })
  );

  router.get(
    '/auth/me',
    requireAuth,
    asyncHandler(async (req: AuthRequest, res) => {
      res.json({ data: req.authUser });
    })
  );

  // ==========================================
  // USER MANAGEMENT (ADMIN ONLY)
  // ==========================================
  router.get(
    '/users',
    requireAuth,
    requireRole('ADMIN'),
    asyncHandler(async (_req, res) => {
      const data = await listUsers();
      res.json({ data });
    })
  );

  router.post(
    '/users',
    requireAuth,
    requireRole('ADMIN'),
    asyncHandler(async (req: AuthRequest, res) => {
      const body = parseBody(
        z.object({
          fullName: z.string().min(2).max(120),
          username: z
            .string()
            .min(3)
            .max(48)
            .regex(/^[a-zA-Z0-9._-]+$/),
          email: z.string().email(),
          role: z.enum(['ADMIN', 'SPOTTING', 'IRONING', 'PACKING']),
          password: z.string().min(8).max(128).optional(),
        }),
        req.body
      );
      const created = await createStaffUser({
        actorUserId: req.authUser!.id,
        ...body,
        ipAddress: getClientIp(req),
      });
      res.status(201).json({ data: created });
    })
  );

  router.get(
    '/users/:id',
    requireAuth,
    requireRole('ADMIN'),
    asyncHandler(async (req, res) => {
      const userId = assertUuid(req.params.id, 'user_id');
      const user = await getUserById(userId);
      res.json({ data: user });
    })
  );

  router.patch(
    '/users/:id',
    requireAuth,
    requireRole('ADMIN'),
    asyncHandler(async (req: AuthRequest, res) => {
      const targetUserId = assertUuid(req.params.id, 'user_id');
      const body = parseBody(
        z.object({
          fullName: z.string().min(2).max(120).optional(),
          role: z.enum(['ADMIN', 'SPOTTING', 'IRONING', 'PACKING']).optional(),
          isActive: z.boolean().optional(),
          password: z.string().min(8).max(128).optional(),
        }),
        req.body
      );
      const updated = await updateStaffUser({
        actorUserId: req.authUser!.id,
        targetUserId,
        ...body,
        ipAddress: getClientIp(req),
      });
      res.json({ data: updated });
    })
  );

  // ==========================================
  // WORKFLOW TEMPLATES & SETTINGS
  // ==========================================
  router.get(
    '/workflow-templates',
    requireAuth,
    asyncHandler(async (_req, res) => {
      const templates = await listWorkflowTemplates();
      res.json({ data: templates });
    })
  );

  router.get(
    '/settings',
    requireAuth,
    requireRole('ADMIN'),
    asyncHandler(async (_req, res) => {
      const data = await getSystemSettings();
      res.json({ data });
    })
  );

  router.patch(
    '/settings/:key',
    requireAuth,
    requireRole('ADMIN'),
    asyncHandler(async (req: AuthRequest, res) => {
      const key = String(req.params.key || '');
      if (!['sla_hours', 'photo_policy', 'checklist_templates'].includes(key)) {
        throw new AppError(400, 'INVALID_SETTING_KEY', 'Kunci pengaturan tidak dikenali.');
      }
      const body = parseBody(z.object({ value: z.unknown() }), req.body);
      const data = await updateSystemSetting({
        actorUserId: req.authUser!.id,
        key,
        value: body.value,
        ipAddress: getClientIp(req),
      });
      res.json({ data });
    })
  );

  // ==========================================
  // ORDERS (ADMIN MANAGEMENT, AUTH READ FOR GARMENT CONTEXT)
  // ==========================================
  router.post(
    '/orders',
    requireAuth,
    requireRole('ADMIN'),
    asyncHandler(async (req: AuthRequest, res) => {
      const body = parseBody(
        z.object({
          customerName: z.string().min(2).max(160),
          customerPhone: z.string().min(6).max(40),
          orderCategory: z.enum([
            'INDIVIDUAL',
            'VILLA',
            'HOTEL',
            'WEDDING_ORGANIZER',
            'SALON',
            'OTHER_VENDOR',
          ]),
          expectedCompletionAt: z.string().nullable().optional(),
          notes: z.string().max(1000).nullable().optional(),
        }),
        req.body
      );
      const created = await createOrder({
        actorUserId: req.authUser!.id,
        ...body,
        ipAddress: getClientIp(req),
      });
      res.status(201).json({ data: created });
    })
  );

  router.get(
    '/orders',
    requireAuth,
    requireRole('ADMIN'),
    asyncHandler(async (req, res) => {
      const query = parseBody(
        z.object({
          page: z.coerce.number().int().min(1).default(1),
          perPage: z.coerce.number().int().min(1).max(100).default(20),
          search: z.string().optional(),
          status: z.enum(['ACTIVE', 'READY_FOR_PICKUP', 'ARCHIVED', 'CANCELLED', 'ALL_ACTIVE']).optional(),
          category: z
            .enum(['INDIVIDUAL', 'VILLA', 'HOTEL', 'WEDDING_ORGANIZER', 'SALON', 'OTHER_VENDOR'])
            .optional(),
        }),
        req.query
      );
      const result = await listOrders(query);
      res.json({ data: result.items, meta: result.meta });
    })
  );

  router.get(
    '/orders/:id',
    requireAuth,
    requireRole('ADMIN'),
    asyncHandler(async (req, res) => {
      const orderId = assertUuid(req.params.id, 'order_id');
      const order = await getOrderById(orderId);
      res.json({ data: order });
    })
  );

  router.patch(
    '/orders/:id',
    requireAuth,
    requireRole('ADMIN'),
    asyncHandler(async (req: AuthRequest, res) => {
      const orderId = assertUuid(req.params.id, 'order_id');
      const body = parseBody(
        z.object({
          version: z.number().int().min(1),
          customerName: z.string().min(2).max(160).optional(),
          customerPhone: z.string().min(6).max(40).optional(),
          orderCategory: z
            .enum(['INDIVIDUAL', 'VILLA', 'HOTEL', 'WEDDING_ORGANIZER', 'SALON', 'OTHER_VENDOR'])
            .optional(),
          expectedCompletionAt: z.string().nullable().optional(),
          notes: z.string().max(1000).nullable().optional(),
        }),
        req.body
      );
      const updated = await updateOrder({
        actorUserId: req.authUser!.id,
        orderId,
        ...body,
        ipAddress: getClientIp(req),
      });
      res.json({ data: updated });
    })
  );

  router.post(
    '/orders/:id/cancel',
    requireAuth,
    requireRole('ADMIN'),
    asyncHandler(async (req: AuthRequest, res) => {
      const orderId = assertUuid(req.params.id, 'order_id');
      const body = parseBody(
        z.object({ reason: z.string().min(3, 'Alasan pembatalan wajib diisi').max(500) }),
        req.body
      );
      const updated = await cancelOrder({
        actorUserId: req.authUser!.id,
        orderId,
        reason: body.reason,
        ipAddress: getClientIp(req),
      });
      res.json({ data: updated });
    })
  );

  router.post(
    '/orders/:id/pickup',
    requireAuth,
    requireRole('ADMIN'),
    asyncHandler(async (req: AuthRequest, res) => {
      const orderId = assertUuid(req.params.id, 'order_id');
      const body = parseBody(
        z.object({
          recipientName: z.string().min(2, 'Nama penerima wajib diisi').max(160),
          recipientPhone: z.string().max(40).nullable().optional(),
          verificationNotes: z.string().max(500).nullable().optional(),
          expectedGarmentCount: z.number().int().min(1),
          idempotencyKey: z.string().max(120).optional(),
        }),
        req.body
      );
      const pickup = await confirmOrderPickup({
        actorUserId: req.authUser!.id,
        orderId,
        ...body,
        ipAddress: getClientIp(req),
      });
      res.status(201).json({ data: pickup });
    })
  );

  // ==========================================
  // GARMENTS
  // ==========================================
  router.post(
    '/garments',
    requireAuth,
    requireRole('ADMIN'),
    asyncHandler(async (req: AuthRequest, res) => {
      const body = parseBody(
        z.object({
          orderId: z.string().regex(UUID_REGEX, 'ID pesanan tidak valid'),
          templateCode: z.string().min(2).max(64).default('FULL_DETAILING'),
          garmentName: z.string().min(2).max(160),
          category: z.string().min(2).max(80),
          garmentType: z.string().min(2).max(80),
          brand: z.string().max(80).nullable().optional(),
          color: z.string().min(2).max(64),
          size: z.string().max(32).nullable().optional(),
          physicalTagNumber: z.string().min(1, 'Nomor tag fisik wajib diisi').max(64),
          distinctiveFeatures: z.string().max(500).nullable().optional(),
          initialCondition: z.string().min(2).max(500),
          stainDescription: z.string().max(500).nullable().optional(),
          specialInstructions: z.string().max(500).nullable().optional(),
        }),
        req.body
      );
      const created = await registerGarment({
        actorUserId: req.authUser!.id,
        ...body,
        ipAddress: getClientIp(req),
      });
      res.status(201).json({ data: created });
    })
  );

  router.get(
    '/garments',
    requireAuth,
    asyncHandler(async (req: AuthRequest, res) => {
      const query = parseBody(
        z.object({
          page: z.coerce.number().int().min(1).default(1),
          perPage: z.coerce.number().int().min(1).max(100).default(20),
          search: z.string().optional(),
          status: z
            .enum([
              'REGISTERED',
              'WAITING_SPOTTING',
              'SPOTTING_IN_PROGRESS',
              'WAITING_IRONING',
              'IRONING_IN_PROGRESS',
              'WAITING_PACKING',
              'PACKING_IN_PROGRESS',
              'READY_FOR_PICKUP',
              'ON_HOLD',
              'PICKED_UP',
            ])
            .optional(),
          department: z.string().optional(),
          orderId: z.string().optional(),
          includeArchived: z.coerce.boolean().optional(),
        }),
        req.query
      );
      const result = await listGarments({
        ...query,
        actorRole: req.authUser!.role,
      });
      res.json({ data: result.items, meta: result.meta });
    })
  );

  router.get(
    '/garments/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      const garmentId = assertUuid(req.params.id, 'garment_id');
      const garment = await getGarmentById(garmentId);
      res.json({ data: garment });
    })
  );

  router.patch(
    '/garments/:id',
    requireAuth,
    requireRole('ADMIN'),
    asyncHandler(async (req: AuthRequest, res) => {
      const garmentId = assertUuid(req.params.id, 'garment_id');
      // Explicitly block attempts to mutate status/department via generic PATCH
      if (
        req.body &&
        ('currentStatus' in req.body ||
          'current_status' in req.body ||
          'currentDepartment' in req.body ||
          'current_department' in req.body)
      ) {
        throw new AppError(
          400,
          'DIRECT_STATUS_UPDATE_FORBIDDEN',
          'Perubahan status barang tidak diperbolehkan melalui PATCH. Gunakan endpoint workflow resmi.'
        );
      }
      const body = parseBody(
        z.object({
          version: z.number().int().min(1),
          garmentName: z.string().min(2).max(160).optional(),
          category: z.string().min(2).max(80).optional(),
          garmentType: z.string().min(2).max(80).optional(),
          brand: z.string().max(80).nullable().optional(),
          color: z.string().min(2).max(64).optional(),
          size: z.string().max(32).nullable().optional(),
          physicalTagNumber: z.string().min(1).max(64).optional(),
          tagStatus: z.enum(['ATTACHED', 'MISSING', 'REPLACED']).optional(),
          distinctiveFeatures: z.string().max(500).nullable().optional(),
          initialCondition: z.string().min(2).max(500).optional(),
          stainDescription: z.string().max(500).nullable().optional(),
          specialInstructions: z.string().max(500).nullable().optional(),
        }),
        req.body
      );
      const updated = await updateGarmentDetails({
        actorUserId: req.authUser!.id,
        garmentId,
        ...body,
        ipAddress: getClientIp(req),
      });
      res.json({ data: updated });
    })
  );

  router.get(
    '/garments/:id/history',
    requireAuth,
    asyncHandler(async (req, res) => {
      const garmentId = assertUuid(req.params.id, 'garment_id');
      const data = await getGarmentHistory(garmentId);
      res.json({ data });
    })
  );

  // ==========================================
  // PHOTOS & PRIVATE GALLERY
  // ==========================================
  router.post(
    '/garments/:id/photos',
    requireAuth,
    upload.fields([
      { name: 'file', maxCount: 1 },
      { name: 'thumbnail', maxCount: 1 },
    ]),
    asyncHandler(async (req: AuthRequest, res) => {
      const garmentId = assertUuid(req.params.id, 'garment_id');
      const files = req.files as Record<string, Express.Multer.File[]> | undefined;
      const mainFile = files?.file?.[0];
      if (!mainFile) {
        throw new AppError(400, 'FILE_REQUIRED', 'File foto wajib dipilih.');
      }

      const body = parseBody(
        z.object({
          photoType: z.enum(['FRONT', 'BACK', 'LABEL', 'TAG', 'DETAIL', 'OTHER']).default('FRONT'),
          caption: z.string().max(240).nullable().optional(),
        }),
        req.body
      );

      const thumbFile = files?.thumbnail?.[0];
      const photo = await addGarmentPhoto({
        actorUserId: req.authUser!.id,
        garmentId,
        photoType: body.photoType,
        caption: body.caption,
        originalBuffer: mainFile.buffer,
        thumbnailBuffer: thumbFile?.buffer,
        ipAddress: getClientIp(req),
      });
      res.status(201).json({ data: photo });
    })
  );

  router.get(
    '/garments/:id/photos',
    requireAuth,
    asyncHandler(async (req, res) => {
      const garmentId = assertUuid(req.params.id, 'garment_id');
      const result = await listPhotosGallery({ page: 1, perPage: 50, garmentId });
      res.json({ data: result.items, meta: result.meta });
    })
  );

  router.get(
    '/photos',
    requireAuth,
    asyncHandler(async (req, res) => {
      const query = parseBody(
        z.object({
          page: z.coerce.number().int().min(1).default(1),
          perPage: z.coerce.number().int().min(1).max(60).default(24),
          photoType: z.enum(['FRONT', 'BACK', 'LABEL', 'TAG', 'DETAIL', 'OTHER']).optional(),
          search: z.string().optional(),
        }),
        req.query
      );
      const result = await listPhotosGallery(query);
      res.json({ data: result.items, meta: result.meta });
    })
  );

  router.get(
    '/photos/:id/file',
    requireAuth,
    asyncHandler(async (req, res) => {
      const photoId = assertUuid(req.params.id, 'photo_id');
      const variant = req.query.variant === 'thumb' ? 'thumb' : 'original';
      const meta = await getPhotoMetadata(photoId);
      const objectPath = variant === 'thumb' ? meta.thumbnailPath : meta.storagePath;
      const { buffer, contentType } = await readPhotoObject({
        storageProvider: meta.storageProvider,
        objectPath,
      });

      res.setHeader('Content-Type', contentType || meta.mimeType || 'image/jpeg');
      res.setHeader('Cache-Control', 'private, max-age=300');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.send(buffer);
    })
  );

  router.delete(
    '/photos/:id',
    requireAuth,
    requireRole('ADMIN'),
    asyncHandler(async (req: AuthRequest, res) => {
      const photoId = assertUuid(req.params.id, 'photo_id');
      await softDeletePhoto({
        actorUserId: req.authUser!.id,
        photoId,
        ipAddress: getClientIp(req),
      });
      res.json({ data: { deleted: true } });
    })
  );

  // ==========================================
  // STAFF QUEUE & WORKFLOW ENGINE
  // ==========================================
  router.get(
    '/staff/queue',
    requireAuth,
    requireRole('SPOTTING', 'IRONING', 'PACKING'),
    asyncHandler(async (req: AuthRequest, res) => {
      const statusFilter =
        req.query.status === 'WAITING' ||
        req.query.status === 'IN_PROGRESS' ||
        req.query.status === 'ON_HOLD'
          ? req.query.status
          : 'ALL';
      const dept = req.authUser!.role as 'SPOTTING' | 'IRONING' | 'PACKING';
      const items = await getStaffDepartmentQueue({
        department: dept,
        statusFilter,
      });
      res.json({ data: items });
    })
  );

  router.get(
    '/staff/dashboard',
    requireAuth,
    requireRole('SPOTTING', 'IRONING', 'PACKING'),
    asyncHandler(async (req: AuthRequest, res) => {
      const dept = req.authUser!.role as 'SPOTTING' | 'IRONING' | 'PACKING';
      const data = await getStaffDashboardSummary({
        department: dept,
        userId: req.authUser!.id,
      });
      res.json({ data });
    })
  );

  router.get(
    '/staff/history',
    requireAuth,
    asyncHandler(async (req: AuthRequest, res) => {
      const data = await getStaffWorkHistory(req.authUser!.id);
      res.json({ data });
    })
  );

  router.post(
    '/garments/:id/start',
    requireAuth,
    requireRole('SPOTTING', 'IRONING', 'PACKING'),
    asyncHandler(async (req: AuthRequest, res) => {
      const garmentId = assertUuid(req.params.id, 'garment_id');
      const body = parseBody(
        z.object({
          version: z.number().int().min(1),
          verificationMethod: z
            .enum(['PHYSICAL_TAG', 'PHOTO_AND_DETAILS_BACKUP'])
            .default('PHYSICAL_TAG'),
          notes: z.string().max(500).nullable().optional(),
        }),
        req.body
      );
      const updated = await startGarmentStage({
        actorUserId: req.authUser!.id,
        actorRole: req.authUser!.role,
        garmentId,
        ...body,
        ipAddress: getClientIp(req),
      });
      res.json({ data: updated });
    })
  );

  router.get(
    '/garments/:id/checklist',
    requireAuth,
    asyncHandler(async (req: AuthRequest, res) => {
      const garmentId = assertUuid(req.params.id, 'garment_id');
      const data = await getGarmentCurrentChecklist(garmentId, req.authUser!.role);
      res.json({ data });
    })
  );

  router.post(
    '/garments/:id/checklist',
    requireAuth,
    requireRole('SPOTTING', 'IRONING', 'PACKING'),
    asyncHandler(async (req: AuthRequest, res) => {
      const garmentId = assertUuid(req.params.id, 'garment_id');
      const body = parseBody(
        z.object({
          identityVerified: z.boolean(),
          verificationMethod: z
            .enum(['PHYSICAL_TAG', 'PHOTO_AND_DETAILS_BACKUP'])
            .default('PHYSICAL_TAG'),
          items: z
            .array(
              z.object({
                itemKey: z.string().min(1),
                isChecked: z.boolean(),
                note: z.string().max(300).nullable().optional(),
              })
            )
            .min(1),
        }),
        req.body
      );
      const data = await saveGarmentChecklist({
        actorUserId: req.authUser!.id,
        actorRole: req.authUser!.role,
        garmentId,
        ...body,
        ipAddress: getClientIp(req),
      });
      res.json({ data });
    })
  );

  router.post(
    '/garments/:id/complete',
    requireAuth,
    requireRole('SPOTTING', 'IRONING', 'PACKING'),
    asyncHandler(async (req: AuthRequest, res) => {
      const garmentId = assertUuid(req.params.id, 'garment_id');
      const body = parseBody(
        z.object({
          version: z.number().int().min(1),
          notes: z.string().max(500).nullable().optional(),
        }),
        req.body
      );
      const updated = await completeGarmentStage({
        actorUserId: req.authUser!.id,
        actorRole: req.authUser!.role,
        garmentId,
        ...body,
        ipAddress: getClientIp(req),
      });
      res.json({ data: updated });
    })
  );

  router.post(
    '/garments/:id/handover',
    requireAuth,
    requireRole('SPOTTING', 'IRONING', 'PACKING'),
    asyncHandler(async (req: AuthRequest, res) => {
      const garmentId = assertUuid(req.params.id, 'garment_id');
      const body = parseBody(
        z.object({
          version: z.number().int().min(1),
          physicalTagVerified: z.boolean(),
          conditionNotes: z.string().max(500).nullable().optional(),
          idempotencyKey: z.string().max(120).optional(),
        }),
        req.body
      );
      const updated = await handoverGarmentStage({
        actorUserId: req.authUser!.id,
        actorRole: req.authUser!.role,
        garmentId,
        ...body,
        ipAddress: getClientIp(req),
      });
      res.json({ data: updated });
    })
  );

  router.post(
    '/garments/:id/hold',
    requireAuth,
    asyncHandler(async (req: AuthRequest, res) => {
      const garmentId = assertUuid(req.params.id, 'garment_id');
      const body = parseBody(
        z.object({
          version: z.number().int().min(1),
          reason: z.string().min(3, 'Alasan penahanan barang wajib diisi').max(500),
        }),
        req.body
      );
      const updated = await holdGarment({
        actorUserId: req.authUser!.id,
        actorRole: req.authUser!.role,
        garmentId,
        ...body,
        ipAddress: getClientIp(req),
      });
      res.json({ data: updated });
    })
  );

  router.post(
    '/garments/:id/resume',
    requireAuth,
    requireRole('ADMIN'),
    asyncHandler(async (req: AuthRequest, res) => {
      const garmentId = assertUuid(req.params.id, 'garment_id');
      const body = parseBody(
        z.object({
          version: z.number().int().min(1),
          notes: z.string().max(500).nullable().optional(),
        }),
        req.body
      );
      const updated = await resumeGarment({
        actorUserId: req.authUser!.id,
        garmentId,
        ...body,
        ipAddress: getClientIp(req),
      });
      res.json({ data: updated });
    })
  );

  // ==========================================
  // ISSUE REPORTS
  // ==========================================
  router.post(
    '/garments/:id/issues',
    requireAuth,
    asyncHandler(async (req: AuthRequest, res) => {
      const garmentId = assertUuid(req.params.id, 'garment_id');
      const body = parseBody(
        z.object({
          issueType: z.enum([
            'STAIN_PERSISTS',
            'FABRIC_DAMAGE',
            'MISSING_TAG',
            'MISSING_BUTTON_TRIM',
            'COLOR_BLEED_RISK',
            'OTHER',
          ]),
          severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
          description: z.string().min(5, 'Deskripsi kendala minimal 5 karakter').max(1000),
          putsGarmentOnHold: z.boolean().default(false),
          version: z.number().int().min(1),
        }),
        req.body
      );
      const issue = await reportGarmentIssue({
        actorUserId: req.authUser!.id,
        actorRole: req.authUser!.role,
        garmentId,
        ...body,
        ipAddress: getClientIp(req),
      });
      res.status(201).json({ data: issue });
    })
  );

  router.get(
    '/issues',
    requireAuth,
    asyncHandler(async (req: AuthRequest, res) => {
      const status =
        req.query.status === 'OPEN' ||
        req.query.status === 'IN_REVIEW' ||
        req.query.status === 'RESOLVED'
          ? req.query.status
          : undefined;
      const items = await listIssues({
        actorRole: req.authUser!.role,
        status,
      });
      res.json({ data: items });
    })
  );

  router.patch(
    '/issues/:id/resolve',
    requireAuth,
    requireRole('ADMIN'),
    asyncHandler(async (req: AuthRequest, res) => {
      const issueId = assertUuid(req.params.id, 'issue_id');
      const body = parseBody(
        z.object({ resolutionNotes: z.string().min(3).max(500) }),
        req.body
      );
      const updated = await resolveIssue({
        actorUserId: req.authUser!.id,
        issueId,
        resolutionNotes: body.resolutionNotes,
        ipAddress: getClientIp(req),
      });
      res.json({ data: updated });
    })
  );

  // ==========================================
  // ARCHIVE, REPORTS & GLOBAL SEARCH
  // ==========================================
  router.get(
    '/archive',
    requireAuth,
    requireRole('ADMIN'),
    asyncHandler(async (req, res) => {
      const query = parseBody(
        z.object({
          page: z.coerce.number().int().min(1).default(1),
          perPage: z.coerce.number().int().min(1).max(100).default(20),
          search: z.string().optional(),
          category: z
            .enum(['INDIVIDUAL', 'VILLA', 'HOTEL', 'WEDDING_ORGANIZER', 'SALON', 'OTHER_VENDOR'])
            .optional(),
        }),
        req.query
      );
      const result = await listArchiveOrders(query);
      res.json({ data: result.items, meta: result.meta });
    })
  );

  router.get(
    '/archive/:orderId',
    requireAuth,
    requireRole('ADMIN'),
    asyncHandler(async (req, res) => {
      const orderId = assertUuid(req.params.orderId, 'order_id');
      const data = await getOrderById(orderId);
      res.json({ data });
    })
  );

  router.get(
    '/reports/overview',
    requireAuth,
    requireRole('ADMIN'),
    asyncHandler(async (_req, res) => {
      const data = await getAdminOverview();
      res.json({ data });
    })
  );

  router.get(
    '/reports/departments',
    requireAuth,
    requireRole('ADMIN'),
    asyncHandler(async (_req, res) => {
      const data = await getDepartmentsReport();
      res.json({ data });
    })
  );

  router.get(
    '/reports/completed',
    requireAuth,
    requireRole('ADMIN'),
    asyncHandler(async (_req, res) => {
      const data = await getCompletedReport();
      res.json({ data });
    })
  );

  router.get(
    '/search',
    requireAuth,
    asyncHandler(async (req, res) => {
      const q = typeof req.query.q === 'string' ? req.query.q : '';
      const data = await globalSearch(q);
      res.json({ data });
    })
  );

  return router;
}
