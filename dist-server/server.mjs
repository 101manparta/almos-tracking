var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server.ts
import "dotenv/config";
import fs2 from "node:fs";
import path3 from "node:path";

// src/db/index.ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// src/db/schema.ts
var schema_exports = {};
__export(schema_exports, {
  auditLogs: () => auditLogs,
  checklistItems: () => checklistItems,
  checklistItemsRelations: () => checklistItemsRelations,
  checklists: () => checklists,
  checklistsRelations: () => checklistsRelations,
  garmentPhotos: () => garmentPhotos,
  garmentWorkflowStages: () => garmentWorkflowStages,
  garmentWorkflowStagesRelations: () => garmentWorkflowStagesRelations,
  garments: () => garments,
  garmentsRelations: () => garmentsRelations,
  handoverRecords: () => handoverRecords,
  issueReports: () => issueReports,
  orders: () => orders,
  ordersRelations: () => ordersRelations,
  pickupRecords: () => pickupRecords,
  roles: () => roles,
  rolesRelations: () => rolesRelations,
  systemSettings: () => systemSettings,
  userSessions: () => userSessions,
  users: () => users,
  usersRelations: () => usersRelations,
  workflowHistory: () => workflowHistory,
  workflowTemplateStages: () => workflowTemplateStages,
  workflowTemplateStagesRelations: () => workflowTemplateStagesRelations,
  workflowTemplates: () => workflowTemplates,
  workflowTemplatesRelations: () => workflowTemplatesRelations
});
import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";
var roles = pgTable("roles", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull().unique(),
  // ADMIN | SPOTTING | IRONING | PACKING
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});
var users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    uid: text("uid").unique(),
    // Firebase Auth UID when linked
    roleId: uuid("role_id").references(() => roles.id).notNull(),
    fullName: text("full_name").notNull(),
    username: text("username").notNull().unique(),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash"),
    isActive: boolean("is_active").default(true).notNull(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    index("idx_users_role_id").on(table.roleId),
    index("idx_users_email").on(table.email)
  ]
);
var userSessions = pgTable(
  "user_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    userAgent: text("user_agent"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [index("idx_user_sessions_user_id").on(table.userId)]
);
var workflowTemplates = pgTable("workflow_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull().unique(),
  // FULL_DETAILING | SPOTTING_IRONING | IRONING_PACKING | PACKING_ONLY
  name: text("name").notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});
var workflowTemplateStages = pgTable(
  "workflow_template_stages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    templateId: uuid("template_id").references(() => workflowTemplates.id, { onDelete: "cascade" }).notNull(),
    department: text("department").notNull(),
    // SPOTTING | IRONING | PACKING
    stageOrder: integer("stage_order").notNull(),
    slaHours: integer("sla_hours").default(12).notNull()
  },
  (table) => [
    uniqueIndex("uq_template_stage_order").on(table.templateId, table.stageOrder),
    uniqueIndex("uq_template_department").on(table.templateId, table.department)
  ]
);
var orders = pgTable(
  "orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderCode: text("order_code").notNull().unique(),
    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone").notNull(),
    orderCategory: text("order_category").notNull(),
    // INDIVIDUAL | VILLA | HOTEL | WEDDING_ORGANIZER | SALON | OTHER_VENDOR
    expectedCompletionAt: timestamp("expected_completion_at", { withTimezone: true }),
    notes: text("notes"),
    status: text("status").default("ACTIVE").notNull(),
    // ACTIVE | READY_FOR_PICKUP | ARCHIVED | CANCELLED
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelReason: text("cancel_reason"),
    createdBy: uuid("created_by").references(() => users.id).notNull(),
    version: integer("version").default(1).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    index("idx_orders_status_created").on(table.status, table.createdAt),
    index("idx_orders_customer_name").on(table.customerName)
  ]
);
var garments = pgTable(
  "garments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    garmentCode: text("garment_code").notNull().unique(),
    orderId: uuid("order_id").references(() => orders.id).notNull(),
    templateId: uuid("template_id").references(() => workflowTemplates.id).notNull(),
    garmentName: text("garment_name").notNull(),
    category: text("category").notNull(),
    garmentType: text("garment_type").notNull(),
    brand: text("brand"),
    color: text("color").notNull(),
    size: text("size"),
    physicalTagNumber: text("physical_tag_number").notNull(),
    tagStatus: text("tag_status").default("ATTACHED").notNull(),
    // ATTACHED | MISSING | REPLACED
    distinctiveFeatures: text("distinctive_features"),
    initialCondition: text("initial_condition").notNull(),
    stainDescription: text("stain_description"),
    specialInstructions: text("special_instructions"),
    currentDepartment: text("current_department").default("ADMIN").notNull(),
    // ADMIN | SPOTTING | IRONING | PACKING | PICKUP
    currentStatus: text("current_status").default("REGISTERED").notNull(),
    previousStatusBeforeHold: text("previous_status_before_hold"),
    previousDepartmentBeforeHold: text("previous_department_before_hold"),
    assignedStaffId: uuid("assigned_staff_id").references(() => users.id),
    dueAt: timestamp("due_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    registeredBy: uuid("registered_by").references(() => users.id).notNull(),
    version: integer("version").default(1).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    index("idx_garments_order_id").on(table.orderId),
    index("idx_garments_status_dept").on(table.currentStatus, table.currentDepartment),
    index("idx_garments_physical_tag").on(table.physicalTagNumber)
  ]
);
var garmentWorkflowStages = pgTable(
  "garment_workflow_stages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    garmentId: uuid("garment_id").references(() => garments.id).notNull(),
    department: text("department").notNull(),
    // SPOTTING | IRONING | PACKING
    stageOrder: integer("stage_order").notNull(),
    status: text("status").default("PENDING").notNull(),
    // PENDING | IN_PROGRESS | COMPLETED | ON_HOLD | SKIPPED
    assignedTo: uuid("assigned_to").references(() => users.id),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    dueAt: timestamp("due_at", { withTimezone: true }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    uniqueIndex("uq_garment_stage_order").on(table.garmentId, table.stageOrder),
    index("idx_garment_stages_dept_status").on(table.department, table.status)
  ]
);
var garmentPhotos = pgTable(
  "garment_photos",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    garmentId: uuid("garment_id").references(() => garments.id).notNull(),
    photoType: text("photo_type").notNull(),
    // FRONT | BACK | LABEL | TAG | DETAIL | OTHER
    storageProvider: text("storage_provider").default("LOCAL_PRIVATE").notNull(),
    storagePath: text("storage_path").notNull(),
    thumbnailPath: text("thumbnail_path").notNull(),
    mimeType: text("mime_type").notNull(),
    fileSizeBytes: integer("file_size_bytes").notNull(),
    caption: text("caption"),
    uploadedBy: uuid("uploaded_by").references(() => users.id).notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: uuid("deleted_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [index("idx_garment_photos_garment").on(table.garmentId, table.photoType)]
);
var workflowHistory = pgTable(
  "workflow_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    garmentId: uuid("garment_id").references(() => garments.id).notNull(),
    previousStatus: text("previous_status").notNull(),
    newStatus: text("new_status").notNull(),
    fromDepartment: text("from_department"),
    toDepartment: text("to_department"),
    performedBy: uuid("performed_by").references(() => users.id).notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [index("idx_workflow_history_garment").on(table.garmentId, table.createdAt)]
);
var checklists = pgTable(
  "checklists",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    garmentId: uuid("garment_id").references(() => garments.id).notNull(),
    stageId: uuid("stage_id").references(() => garmentWorkflowStages.id).notNull().unique(),
    department: text("department").notNull(),
    identityVerified: boolean("identity_verified").default(false).notNull(),
    verificationMethod: text("verification_method").default("PHYSICAL_TAG").notNull(),
    // PHYSICAL_TAG | PHOTO_AND_DETAILS_BACKUP
    isComplete: boolean("is_complete").default(false).notNull(),
    completedBy: uuid("completed_by").references(() => users.id),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [index("idx_checklists_garment").on(table.garmentId)]
);
var checklistItems = pgTable(
  "checklist_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    checklistId: uuid("checklist_id").references(() => checklists.id, { onDelete: "cascade" }).notNull(),
    itemKey: text("item_key").notNull(),
    label: text("label").notNull(),
    sortOrder: integer("sort_order").notNull(),
    isChecked: boolean("is_checked").default(false).notNull(),
    note: text("note"),
    checkedBy: uuid("checked_by").references(() => users.id),
    checkedAt: timestamp("checked_at", { withTimezone: true })
  },
  (table) => [uniqueIndex("uq_checklist_item_key").on(table.checklistId, table.itemKey)]
);
var handoverRecords = pgTable(
  "handover_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    garmentId: uuid("garment_id").references(() => garments.id).notNull(),
    fromDepartment: text("from_department").notNull(),
    toDepartment: text("to_department").notNull(),
    handedOverBy: uuid("handed_over_by").references(() => users.id).notNull(),
    receivedBy: uuid("received_by").references(() => users.id),
    physicalTagVerified: boolean("physical_tag_verified").notNull(),
    conditionNotes: text("condition_notes"),
    idempotencyKey: text("idempotency_key").unique(),
    handedOverAt: timestamp("handed_over_at", { withTimezone: true }).defaultNow().notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true })
  },
  (table) => [index("idx_handover_garment").on(table.garmentId)]
);
var issueReports = pgTable(
  "issue_reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    garmentId: uuid("garment_id").references(() => garments.id).notNull(),
    department: text("department").notNull(),
    reportedBy: uuid("reported_by").references(() => users.id).notNull(),
    issueType: text("issue_type").notNull(),
    // STAIN_PERSISTS | FABRIC_DAMAGE | MISSING_TAG | MISSING_BUTTON_TRIM | COLOR_BLEED_RISK | OTHER
    severity: text("severity").notNull(),
    // LOW | MEDIUM | HIGH | CRITICAL
    description: text("description").notNull(),
    putsGarmentOnHold: boolean("puts_garment_on_hold").default(false).notNull(),
    resolutionStatus: text("resolution_status").default("OPEN").notNull(),
    // OPEN | IN_REVIEW | RESOLVED
    resolvedBy: uuid("resolved_by").references(() => users.id),
    resolutionNotes: text("resolution_notes"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [index("idx_issue_reports_garment_status").on(table.garmentId, table.resolutionStatus)]
);
var pickupRecords = pgTable("pickup_records", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id").references(() => orders.id).notNull().unique(),
  confirmedBy: uuid("confirmed_by").references(() => users.id).notNull(),
  recipientName: text("recipient_name").notNull(),
  recipientPhone: text("recipient_phone"),
  verificationNotes: text("verification_notes"),
  garmentCount: integer("garment_count").notNull(),
  idempotencyKey: text("idempotency_key").unique(),
  pickedUpAt: timestamp("picked_up_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});
var auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorUserId: uuid("actor_user_id").references(() => users.id),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    metadata: jsonb("metadata").default({}).notNull(),
    ipAddress: text("ip_address"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [index("idx_audit_logs_entity").on(table.entityType, table.entityId, table.createdAt)]
);
var systemSettings = pgTable("system_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedBy: uuid("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});
var rolesRelations = relations(roles, ({ many }) => ({
  users: many(users)
}));
var usersRelations = relations(users, ({ one, many }) => ({
  role: one(roles, { fields: [users.roleId], references: [roles.id] }),
  sessions: many(userSessions),
  createdOrders: many(orders)
}));
var ordersRelations = relations(orders, ({ one, many }) => ({
  creator: one(users, { fields: [orders.createdBy], references: [users.id] }),
  garments: many(garments),
  pickupRecord: one(pickupRecords, { fields: [orders.id], references: [pickupRecords.orderId] })
}));
var workflowTemplatesRelations = relations(workflowTemplates, ({ many }) => ({
  stages: many(workflowTemplateStages),
  garments: many(garments)
}));
var workflowTemplateStagesRelations = relations(workflowTemplateStages, ({ one }) => ({
  template: one(workflowTemplates, {
    fields: [workflowTemplateStages.templateId],
    references: [workflowTemplates.id]
  })
}));
var garmentsRelations = relations(garments, ({ one, many }) => ({
  order: one(orders, { fields: [garments.orderId], references: [orders.id] }),
  template: one(workflowTemplates, { fields: [garments.templateId], references: [workflowTemplates.id] }),
  registrant: one(users, { fields: [garments.registeredBy], references: [users.id] }),
  stages: many(garmentWorkflowStages),
  photos: many(garmentPhotos),
  history: many(workflowHistory),
  checklists: many(checklists),
  handovers: many(handoverRecords),
  issues: many(issueReports)
}));
var garmentWorkflowStagesRelations = relations(garmentWorkflowStages, ({ one }) => ({
  garment: one(garments, { fields: [garmentWorkflowStages.garmentId], references: [garments.id] }),
  checklist: one(checklists, {
    fields: [garmentWorkflowStages.id],
    references: [checklists.stageId]
  })
}));
var checklistsRelations = relations(checklists, ({ one, many }) => ({
  garment: one(garments, { fields: [checklists.garmentId], references: [garments.id] }),
  stage: one(garmentWorkflowStages, { fields: [checklists.stageId], references: [garmentWorkflowStages.id] }),
  items: many(checklistItems)
}));
var checklistItemsRelations = relations(checklistItems, ({ one }) => ({
  checklist: one(checklists, { fields: [checklistItems.checklistId], references: [checklists.id] })
}));

// src/db/index.ts
function buildPoolConfig(env = process.env) {
  const sqlHost = env.SQL_HOST?.trim();
  const isUnixSocket = Boolean(sqlHost && sqlHost.startsWith("/"));
  const parsedPort = !isUnixSocket && env.SQL_PORT ? Number(env.SQL_PORT) : void 0;
  const parsedPoolMax = env.SQL_POOL_MAX ? Number(env.SQL_POOL_MAX) : 10;
  return {
    host: sqlHost,
    ...parsedPort && Number.isFinite(parsedPort) && parsedPort > 0 ? { port: parsedPort } : {},
    ...!isUnixSocket && env.SQL_SSL === "true" ? { ssl: { rejectUnauthorized: true } } : {},
    user: env.SQL_USER,
    password: env.SQL_PASSWORD,
    database: env.SQL_DB_NAME,
    max: Number.isFinite(parsedPoolMax) && parsedPoolMax > 0 ? parsedPoolMax : 10,
    connectionTimeoutMillis: 15e3,
    idleTimeoutMillis: 3e4
  };
}
var createPool = () => {
  if (!global._postgresPool) {
    global._postgresPool = new Pool(buildPoolConfig(process.env));
    global._postgresPool.on("error", (err) => {
      console.error("Unexpected error on idle SQL pool client:", err);
    });
  }
  return global._postgresPool;
};
var pool = createPool();
async function closePool() {
  if (global._postgresPool) {
    const p = global._postgresPool;
    global._postgresPool = void 0;
    await p.end();
  }
}
var db = drizzle(pool, { schema: schema_exports });

// src/server/app.ts
import cookieParser from "cookie-parser";
import express from "express";
import path2 from "node:path";

// src/server/errors/app-error.ts
var AppError = class extends Error {
  constructor(statusCode, code, message, details) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
};
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
function errorMiddleware(err, _req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...err.details ? { details: err.details } : {}
      }
    });
  }
  if (typeof err === "object" && err !== null && "code" in err && err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      error: {
        code: "FILE_TOO_LARGE",
        message: "Ukuran file foto melebihi batas maksimal 10 MB."
      }
    });
  }
  if (err instanceof SyntaxError && typeof err === "object" && err !== null && "type" in err && err.type === "entity.parse.failed") {
    return res.status(400).json({
      error: {
        code: "INVALID_JSON",
        message: "Format JSON pada permintaan tidak valid."
      }
    });
  }
  console.error("Unhandled server error:", err);
  return res.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Terjadi kesalahan internal pada server."
    }
  });
}

// src/server/routes/api.ts
import { Router } from "express";
import multer from "multer";
import { z } from "zod";

// src/server/middleware/auth.ts
import { and, eq, gt, isNull } from "drizzle-orm";

// src/server/lib/firebase-admin.ts
import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

// firebase-applet-config.json
var firebase_applet_config_default = {
  projectId: "analog-platform-3bcxw",
  appId: "1:812053538069:web:32936874422521f944751c",
  apiKey: "AIzaSyAV0gkyYEp9-ugjneQPbnsdPRg7DsYwzp0",
  authDomain: "analog-platform-3bcxw.firebaseapp.com",
  storageBucket: "analog-platform-3bcxw.firebasestorage.app",
  messagingSenderId: "812053538069",
  measurementId: "",
  oAuthClientId: "812053538069-agts69uj86508lor77esef3j2el8ak68.apps.googleusercontent.com",
  recaptchaSiteKey: ""
};

// src/server/lib/firebase-admin.ts
if (!getApps().length) {
  initializeApp({
    projectId: firebase_applet_config_default.projectId
  });
}
var adminAuth = getAuth();

// src/server/utils/crypto.ts
import crypto from "node:crypto";
var SCRYPT_KEYLEN = 64;
var SCRYPT_COST = 16384;
var SCRYPT_BLOCK_SIZE = 8;
var SCRYPT_PARALLEL = 1;
function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString("hex");
    crypto.scrypt(
      password,
      salt,
      SCRYPT_KEYLEN,
      { N: SCRYPT_COST, r: SCRYPT_BLOCK_SIZE, p: SCRYPT_PARALLEL },
      (err, derivedKey) => {
        if (err) return reject(err);
        resolve(
          `$scrypt$N=${SCRYPT_COST},r=${SCRYPT_BLOCK_SIZE},p=${SCRYPT_PARALLEL}$${salt}$${derivedKey.toString("hex")}`
        );
      }
    );
  });
}
function verifyPassword(password, storedHash) {
  return new Promise((resolve, reject) => {
    const parts = storedHash.split("$");
    if (parts.length !== 5 || parts[1] !== "scrypt") {
      return resolve(false);
    }
    const paramsStr = parts[2];
    const salt = parts[3];
    const expectedHex = parts[4];
    const params = Object.fromEntries(
      paramsStr.split(",").map((kv) => {
        const [k, v] = kv.split("=");
        return [k, Number(v)];
      })
    );
    const N = params.N || SCRYPT_COST;
    const r = params.r || SCRYPT_BLOCK_SIZE;
    const p = params.p || SCRYPT_PARALLEL;
    const expectedBuf = Buffer.from(expectedHex, "hex");
    crypto.scrypt(password, salt, expectedBuf.length, { N, r, p }, (err, derivedKey) => {
      if (err) return reject(err);
      if (derivedKey.length !== expectedBuf.length) return resolve(false);
      resolve(crypto.timingSafeEqual(derivedKey, expectedBuf));
    });
  });
}
function generateOpaqueToken() {
  return crypto.randomBytes(32).toString("base64url");
}
function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
function detectImageMimeFromBuffer(buffer) {
  if (buffer.length < 12) return null;
  if (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) {
    return "image/jpeg";
  }
  if (buffer[0] === 137 && buffer[1] === 80 && buffer[2] === 78 && buffer[3] === 71 && buffer[4] === 13 && buffer[5] === 10 && buffer[6] === 26 && buffer[7] === 10) {
    return "image/png";
  }
  if (buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") {
    return "image/webp";
  }
  return null;
}

// src/server/middleware/auth.ts
var SESSION_COOKIE_NAME = "almos_session";
var loginAttempts = /* @__PURE__ */ new Map();
function loginRateLimiter(req, _res, next) {
  const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip || "unknown";
  const now = Date.now();
  const windowMs = 5 * 60 * 1e3;
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
        "RATE_LIMIT_EXCEEDED",
        "Terlalu banyak percobaan masuk. Silakan coba lagi dalam beberapa menit."
      )
    );
  }
  entry.count += 1;
  return next();
}
function setSessionCookie(res, rawToken, maxAgeSeconds = 60 * 60 * 12) {
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(rawToken)}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=None",
    "Partitioned",
    `Max-Age=${maxAgeSeconds}`
  ];
  res.setHeader("Set-Cookie", parts.join("; "));
}
function clearSessionCookie(res) {
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=None",
    "Partitioned",
    "Max-Age=0"
  ];
  res.setHeader("Set-Cookie", parts.join("; "));
}
async function fetchUserById(userId) {
  const rows = await db.select({
    id: users.id,
    uid: users.uid,
    fullName: users.fullName,
    username: users.username,
    email: users.email,
    isActive: users.isActive,
    roleCode: roles.code,
    roleName: roles.name
  }).from(users).innerJoin(roles, eq(users.roleId, roles.id)).where(eq(users.id, userId)).limit(1);
  if (!rows.length) return null;
  const row = rows[0];
  return {
    id: row.id,
    uid: row.uid,
    fullName: row.fullName,
    username: row.username,
    email: row.email,
    role: row.roleCode,
    roleName: row.roleName,
    isActive: row.isActive
  };
}
function assertCookieCsrfSafe(req) {
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return;
  const hasCustomHeader = req.headers["x-requested-with"] === "XMLHttpRequest";
  const origin = req.headers.origin;
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  if (origin && host) {
    try {
      const originHost = new URL(origin).host;
      if (originHost === host) return;
    } catch {
    }
  }
  if (hasCustomHeader && !origin) return;
  if (hasCustomHeader && origin && host) {
    try {
      if (new URL(origin).host === host) return;
    } catch {
    }
  }
  if (!origin && req.headers["user-agent"]?.includes("node")) return;
  throw new AppError(403, "CSRF_CHECK_FAILED", "Permintaan tidak valid (verifikasi origin gagal).");
}
async function requireAuth(req, _res, next) {
  try {
    const authHeader = req.headers.authorization;
    const cookieToken = req.cookies?.[SESSION_COOKIE_NAME];
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice("Bearer ".length).trim();
      if (!token) {
        throw new AppError(401, "UNAUTHORIZED", "Token autentikasi kosong.");
      }
      const tokenDigest = hashToken(token);
      const sessionRows = await db.select({
        userId: userSessions.userId,
        tokenHash: userSessions.tokenHash
      }).from(userSessions).where(
        and(
          eq(userSessions.tokenHash, tokenDigest),
          isNull(userSessions.revokedAt),
          gt(userSessions.expiresAt, /* @__PURE__ */ new Date())
        )
      ).limit(1);
      if (sessionRows.length) {
        const user = await fetchUserById(sessionRows[0].userId);
        if (!user || !user.isActive) {
          throw new AppError(403, "ACCOUNT_DISABLED", "Akun Anda tidak aktif atau telah dinonaktifkan.");
        }
        req.authUser = user;
        req.authViaCookie = false;
        req.sessionTokenHash = sessionRows[0].tokenHash;
        return next();
      }
      try {
        const decoded = await adminAuth.verifyIdToken(token);
        const fbRows = await db.select({ id: users.id }).from(users).where(eq(users.uid, decoded.uid)).limit(1);
        if (!fbRows.length) {
          throw new AppError(
            403,
            "USER_NOT_PROVISIONED",
            "Akun Google Anda belum terdaftar dalam sistem internal ALMOS."
          );
        }
        const user = await fetchUserById(fbRows[0].id);
        if (!user || !user.isActive) {
          throw new AppError(403, "ACCOUNT_DISABLED", "Akun Anda tidak aktif.");
        }
        req.authUser = user;
        req.authViaCookie = false;
        return next();
      } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError(401, "INVALID_TOKEN", "Sesi atau token autentikasi tidak valid.");
      }
    }
    if (cookieToken) {
      assertCookieCsrfSafe(req);
      const tokenDigest = hashToken(cookieToken);
      const sessionRows = await db.select({
        userId: userSessions.userId,
        tokenHash: userSessions.tokenHash
      }).from(userSessions).where(
        and(
          eq(userSessions.tokenHash, tokenDigest),
          isNull(userSessions.revokedAt),
          gt(userSessions.expiresAt, /* @__PURE__ */ new Date())
        )
      ).limit(1);
      if (!sessionRows.length) {
        throw new AppError(401, "SESSION_EXPIRED", "Sesi telah berakhir. Silakan masuk kembali.");
      }
      const user = await fetchUserById(sessionRows[0].userId);
      if (!user || !user.isActive) {
        throw new AppError(403, "ACCOUNT_DISABLED", "Akun Anda dinonaktifkan oleh Admin.");
      }
      req.authUser = user;
      req.authViaCookie = true;
      req.sessionTokenHash = sessionRows[0].tokenHash;
      return next();
    }
    throw new AppError(401, "UNAUTHORIZED", "Silakan masuk terlebih dahulu.");
  } catch (err) {
    return next(err);
  }
}
function requireRole(...allowedRoles) {
  return (req, _res, next) => {
    if (!req.authUser) {
      return next(new AppError(401, "UNAUTHORIZED", "Autentikasi diperlukan."));
    }
    if (!allowedRoles.includes(req.authUser.role)) {
      return next(
        new AppError(
          403,
          "FORBIDDEN",
          `Akses ditolak. Halaman atau tindakan ini khusus untuk peran: ${allowedRoles.join(", ")}.`
        )
      );
    }
    return next();
  };
}

// src/server/services/auth.service.ts
import { and as and2, count, eq as eq2, or } from "drizzle-orm";

// src/server/services/audit.service.ts
async function writeAuditLog(tx, params) {
  await tx.insert(auditLogs).values({
    actorUserId: params.actorUserId ?? null,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId ?? null,
    metadata: params.metadata ?? {},
    ipAddress: params.ipAddress ?? null
  });
}

// src/server/services/auth.service.ts
function validateLoginPortalAccess(params) {
  if (params.portal === "ADMIN") {
    if (params.actualRole !== "ADMIN") {
      throw new AppError(
        403,
        "ROLE_PORTAL_MISMATCH",
        "Akses ditolak. Akun karyawan tidak dapat masuk melalui Admin Portal. Silakan gunakan halaman Login Karyawan (/login)."
      );
    }
    return;
  }
  if (params.portal === "EMPLOYEE") {
    if (params.actualRole === "ADMIN") {
      throw new AppError(
        403,
        "ROLE_PORTAL_MISMATCH",
        "Akun Administrator tidak dapat masuk melalui halaman Login Karyawan. Silakan masuk melalui Admin Portal (/admin)."
      );
    }
    if (!params.selectedDivision) {
      throw new AppError(
        400,
        "DIVISION_REQUIRED",
        "Silakan pilih divisi kerja Anda terlebih dahulu."
      );
    }
    if (params.actualRole !== params.selectedDivision) {
      throw new AppError(
        403,
        "DIVISION_MISMATCH",
        "Divisi yang dipilih tidak sesuai dengan akun Anda. Silakan pilih divisi yang benar."
      );
    }
    return;
  }
  if (params.selectedDivision && params.actualRole !== params.selectedDivision) {
    throw new AppError(
      403,
      "DIVISION_MISMATCH",
      "Divisi yang dipilih tidak sesuai dengan akun Anda. Silakan pilih divisi yang benar."
    );
  }
}
async function getRoleByCode(roleCode) {
  const rows = await db.select().from(roles).where(eq2(roles.code, roleCode)).limit(1);
  if (!rows.length) {
    throw new AppError(400, "INVALID_ROLE", `Peran '${roleCode}' tidak ditemukan.`);
  }
  return rows[0];
}
async function createSessionForUser(userId, userAgent) {
  const rawToken = generateOpaqueToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 1e3 * 60 * 60 * 12);
  await db.insert(userSessions).values({
    userId,
    tokenHash,
    userAgent: userAgent?.slice(0, 300) ?? null,
    expiresAt
  });
  await db.update(users).set({ lastLoginAt: /* @__PURE__ */ new Date(), updatedAt: /* @__PURE__ */ new Date() }).where(eq2(users.id, userId));
  return { rawToken, expiresAt };
}
async function getSystemAuthStatus() {
  const adminRole = await db.select().from(roles).where(eq2(roles.code, "ADMIN")).limit(1);
  if (!adminRole.length) {
    return { needsBootstrap: true };
  }
  const [{ total }] = await db.select({ total: count() }).from(users).where(and2(eq2(users.roleId, adminRole[0].id), eq2(users.isActive, true)));
  return {
    needsBootstrap: Number(total) === 0
  };
}
async function bootstrapFirstAdmin(params) {
  const status = await getSystemAuthStatus();
  if (!status.needsBootstrap) {
    throw new AppError(
      409,
      "ADMIN_ALREADY_EXISTS",
      "Akun Admin pertama sudah dibuat. Gunakan halaman masuk normal."
    );
  }
  const adminRole = await getRoleByCode("ADMIN");
  const passwordHash = await hashPassword(params.password);
  const normalizedUsername = params.username.trim().toLowerCase();
  const normalizedEmail = params.email.trim().toLowerCase();
  const existing = await db.select({ id: users.id }).from(users).where(or(eq2(users.username, normalizedUsername), eq2(users.email, normalizedEmail))).limit(1);
  if (existing.length) {
    throw new AppError(409, "USER_EXISTS", "Username atau email sudah digunakan.");
  }
  const created = await db.transaction(async (tx) => {
    const [inserted] = await tx.insert(users).values({
      roleId: adminRole.id,
      fullName: params.fullName.trim(),
      username: normalizedUsername,
      email: normalizedEmail,
      passwordHash,
      isActive: true
    }).returning();
    await writeAuditLog(tx, {
      actorUserId: inserted.id,
      action: "FIRST_ADMIN_BOOTSTRAPPED",
      entityType: "USER",
      entityId: inserted.id,
      metadata: { email: normalizedEmail, username: normalizedUsername },
      ipAddress: params.ipAddress
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
      role: "ADMIN",
      roleName: adminRole.name,
      isActive: created.isActive
    },
    sessionToken: rawToken
  };
}
async function loginWithPassword(params) {
  const cleanIdentifier = params.identifier.trim().toLowerCase();
  const rows = await db.select({
    user: users,
    roleCode: roles.code,
    roleName: roles.name
  }).from(users).innerJoin(roles, eq2(users.roleId, roles.id)).where(or(eq2(users.username, cleanIdentifier), eq2(users.email, cleanIdentifier))).limit(1);
  if (!rows.length || !rows[0].user.passwordHash) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Username/email atau kata sandi salah.");
  }
  const { user, roleCode, roleName } = rows[0];
  if (!user.isActive) {
    throw new AppError(403, "ACCOUNT_DISABLED", "Akun Anda telah dinonaktifkan oleh Admin.");
  }
  if (!user.passwordHash) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Username/email atau kata sandi salah.");
  }
  const valid = await verifyPassword(params.password, user.passwordHash);
  if (!valid) {
    await writeAuditLog(db, {
      actorUserId: user.id,
      action: "LOGIN_FAILED",
      entityType: "USER",
      entityId: user.id,
      metadata: { reason: "WRONG_PASSWORD", portal: params.portal ?? null },
      ipAddress: params.ipAddress
    });
    throw new AppError(401, "INVALID_CREDENTIALS", "Username/email atau kata sandi salah.");
  }
  try {
    validateLoginPortalAccess({
      actualRole: roleCode,
      portal: params.portal,
      selectedDivision: params.selectedDivision
    });
  } catch (err) {
    await writeAuditLog(db, {
      actorUserId: user.id,
      action: "LOGIN_PORTAL_DENIED",
      entityType: "USER",
      entityId: user.id,
      metadata: {
        actualRole: roleCode,
        portal: params.portal ?? null,
        selectedDivision: params.selectedDivision ?? null
      },
      ipAddress: params.ipAddress
    });
    throw err;
  }
  const { rawToken } = await createSessionForUser(user.id, params.userAgent);
  await writeAuditLog(db, {
    actorUserId: user.id,
    action: "USER_LOGIN",
    entityType: "USER",
    entityId: user.id,
    metadata: {
      method: "PASSWORD",
      portal: params.portal ?? null,
      selectedDivision: params.selectedDivision ?? null
    },
    ipAddress: params.ipAddress
  });
  return {
    user: {
      id: user.id,
      uid: user.uid,
      fullName: user.fullName,
      username: user.username,
      email: user.email,
      role: roleCode,
      roleName,
      isActive: user.isActive
    },
    sessionToken: rawToken
  };
}
async function loginWithFirebaseToken(params) {
  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(params.idToken);
  } catch {
    throw new AppError(401, "INVALID_FIREBASE_TOKEN", "Token Google Sign-In tidak valid.");
  }
  const email = decoded.email?.trim().toLowerCase();
  if (!email) {
    throw new AppError(400, "EMAIL_REQUIRED", "Akun Google tidak memiliki alamat email.");
  }
  const existingRows = await db.select({
    user: users,
    roleCode: roles.code,
    roleName: roles.name
  }).from(users).innerJoin(roles, eq2(users.roleId, roles.id)).where(or(eq2(users.uid, decoded.uid), eq2(users.email, email))).limit(1);
  if (existingRows.length) {
    const { user, roleCode, roleName } = existingRows[0];
    if (!user.isActive) {
      throw new AppError(403, "ACCOUNT_DISABLED", "Akun Anda dinonaktifkan oleh Administrator.");
    }
    try {
      validateLoginPortalAccess({
        actualRole: roleCode,
        portal: params.portal,
        selectedDivision: params.selectedDivision
      });
    } catch (err) {
      await writeAuditLog(db, {
        actorUserId: user.id,
        action: "LOGIN_PORTAL_DENIED",
        entityType: "USER",
        entityId: user.id,
        metadata: {
          actualRole: roleCode,
          portal: params.portal ?? null,
          selectedDivision: params.selectedDivision ?? null
        },
        ipAddress: params.ipAddress
      });
      throw err;
    }
    if (!user.uid || user.uid !== decoded.uid) {
      await db.update(users).set({ uid: decoded.uid, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(users.id, user.id));
    }
    const { rawToken: rawToken2 } = await createSessionForUser(user.id, params.userAgent);
    await writeAuditLog(db, {
      actorUserId: user.id,
      action: "USER_LOGIN",
      entityType: "USER",
      entityId: user.id,
      metadata: {
        method: "GOOGLE_FIREBASE",
        portal: params.portal ?? null,
        selectedDivision: params.selectedDivision ?? null
      },
      ipAddress: params.ipAddress
    });
    return {
      user: {
        id: user.id,
        uid: decoded.uid,
        fullName: user.fullName,
        username: user.username,
        email: user.email,
        role: roleCode,
        roleName,
        isActive: user.isActive
      },
      sessionToken: rawToken2
    };
  }
  if (params.portal === "EMPLOYEE") {
    throw new AppError(
      403,
      "USER_NOT_INVITED",
      "Akun Google Anda belum terdaftar sebagai karyawan. Hubungi Admin ALMOS untuk pendaftaran akun."
    );
  }
  const status = await getSystemAuthStatus();
  if (!status.needsBootstrap) {
    throw new AppError(
      403,
      "USER_NOT_INVITED",
      "Akun Google Anda belum terdaftar. Hubungi Admin ALMOS untuk menambahkan email Anda di Manajemen Pengguna."
    );
  }
  const adminRole = await getRoleByCode("ADMIN");
  const baseUsername = email.split("@")[0].replace(/[^a-z0-9._-]/g, "") || "admin";
  const created = await db.transaction(async (tx) => {
    const [inserted] = await tx.insert(users).values({
      uid: decoded.uid,
      roleId: adminRole.id,
      fullName: decoded.name?.trim() || baseUsername,
      username: baseUsername,
      email,
      isActive: true
    }).onConflictDoUpdate({
      target: users.uid,
      set: { email, updatedAt: /* @__PURE__ */ new Date() }
    }).returning();
    await writeAuditLog(tx, {
      actorUserId: inserted.id,
      action: "FIRST_ADMIN_BOOTSTRAPPED_GOOGLE",
      entityType: "USER",
      entityId: inserted.id,
      metadata: { email },
      ipAddress: params.ipAddress
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
      role: "ADMIN",
      roleName: adminRole.name,
      isActive: created.isActive
    },
    sessionToken: rawToken
  };
}
async function revokeSession(tokenHash, actorUserId, ipAddress) {
  if (tokenHash) {
    await db.update(userSessions).set({ revokedAt: /* @__PURE__ */ new Date() }).where(eq2(userSessions.tokenHash, tokenHash));
  }
  if (actorUserId) {
    await writeAuditLog(db, {
      actorUserId,
      action: "USER_LOGOUT",
      entityType: "USER",
      entityId: actorUserId,
      ipAddress
    });
  }
}
async function listUsers() {
  const rows = await db.select({
    id: users.id,
    uid: users.uid,
    fullName: users.fullName,
    username: users.username,
    email: users.email,
    isActive: users.isActive,
    lastLoginAt: users.lastLoginAt,
    createdAt: users.createdAt,
    roleCode: roles.code,
    roleName: roles.name
  }).from(users).innerJoin(roles, eq2(users.roleId, roles.id)).orderBy(users.createdAt);
  return rows.map((r) => ({
    id: r.id,
    uid: r.uid,
    fullName: r.fullName,
    username: r.username,
    email: r.email,
    isActive: r.isActive,
    lastLoginAt: r.lastLoginAt,
    createdAt: r.createdAt,
    role: r.roleCode,
    roleName: r.roleName
  }));
}
async function getUserById(userId) {
  const rows = await db.select({
    id: users.id,
    uid: users.uid,
    fullName: users.fullName,
    username: users.username,
    email: users.email,
    isActive: users.isActive,
    lastLoginAt: users.lastLoginAt,
    createdAt: users.createdAt,
    roleCode: roles.code,
    roleName: roles.name
  }).from(users).innerJoin(roles, eq2(users.roleId, roles.id)).where(eq2(users.id, userId)).limit(1);
  if (!rows.length) {
    throw new AppError(404, "USER_NOT_FOUND", "Pengguna tidak ditemukan.");
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
    role: r.roleCode,
    roleName: r.roleName
  };
}
async function createStaffUser(params) {
  const roleRow = await getRoleByCode(params.role);
  const cleanUsername = params.username.trim().toLowerCase();
  const cleanEmail = params.email.trim().toLowerCase();
  const dup = await db.select({ id: users.id }).from(users).where(or(eq2(users.username, cleanUsername), eq2(users.email, cleanEmail))).limit(1);
  if (dup.length) {
    throw new AppError(409, "USER_EXISTS", "Username atau email sudah terdaftar.");
  }
  const passwordHash = params.password ? await hashPassword(params.password) : null;
  const created = await db.transaction(async (tx) => {
    const [inserted] = await tx.insert(users).values({
      roleId: roleRow.id,
      fullName: params.fullName.trim(),
      username: cleanUsername,
      email: cleanEmail,
      passwordHash,
      isActive: true
    }).returning();
    await writeAuditLog(tx, {
      actorUserId: params.actorUserId,
      action: "USER_CREATED",
      entityType: "USER",
      entityId: inserted.id,
      metadata: { role: params.role, username: cleanUsername, email: cleanEmail },
      ipAddress: params.ipAddress
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
    createdAt: created.createdAt
  };
}
async function updateStaffUser(params) {
  const existing = await db.select().from(users).where(eq2(users.id, params.targetUserId)).limit(1);
  if (!existing.length) {
    throw new AppError(404, "USER_NOT_FOUND", "Pengguna tidak ditemukan.");
  }
  if (params.targetUserId === params.actorUserId && params.isActive === false) {
    throw new AppError(400, "CANNOT_DISABLE_SELF", "Anda tidak dapat menonaktifkan akun Anda sendiri.");
  }
  const updates = {
    updatedAt: /* @__PURE__ */ new Date()
  };
  if (params.fullName !== void 0) updates.fullName = params.fullName.trim();
  if (params.isActive !== void 0) updates.isActive = params.isActive;
  if (params.role !== void 0) {
    const roleRow = await getRoleByCode(params.role);
    updates.roleId = roleRow.id;
  }
  if (params.password && params.password.length >= 8) {
    updates.passwordHash = await hashPassword(params.password);
  }
  await db.transaction(async (tx) => {
    await tx.update(users).set(updates).where(eq2(users.id, params.targetUserId));
    if (params.isActive === false || params.password || params.role !== void 0) {
      await tx.update(userSessions).set({ revokedAt: /* @__PURE__ */ new Date() }).where(eq2(userSessions.userId, params.targetUserId));
    }
    await writeAuditLog(tx, {
      actorUserId: params.actorUserId,
      action: "USER_UPDATED",
      entityType: "USER",
      entityId: params.targetUserId,
      metadata: {
        role: params.role,
        isActive: params.isActive,
        passwordChanged: Boolean(params.password)
      },
      ipAddress: params.ipAddress
    });
  });
  return getUserById(params.targetUserId);
}

// src/server/services/garment.service.ts
import { and as and3, asc, count as count2, desc, eq as eq3, ilike, inArray, isNull as isNull2, or as or2 } from "drizzle-orm";

// src/server/services/storage.service.ts
import crypto2 from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
var PRIVATE_STORAGE_ROOT = path.resolve(process.cwd(), "storage", "photos");
function getExtension(mimeType) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}
function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const bucket = process.env.SUPABASE_STORAGE_BUCKET?.trim() || "almos-garment-photos";
  if (url && serviceKey) {
    return { url: url.replace(/\/+$/, ""), serviceKey, bucket };
  }
  return null;
}
function resolveConfinedPath(relativePath) {
  const cleanRel = relativePath.replace(/^\/+/, "");
  const resolved = path.resolve(PRIVATE_STORAGE_ROOT, cleanRel);
  if (!resolved.startsWith(PRIVATE_STORAGE_ROOT + path.sep)) {
    throw new AppError(400, "INVALID_STORAGE_PATH", "Jalur file foto tidak valid.");
  }
  return resolved;
}
async function uploadGarmentPhotoBuffers(params) {
  const fileUuid = crypto2.randomUUID();
  const origExt = getExtension(params.originalMime);
  const thumbExt = getExtension(params.thumbnailMime);
  const storagePath = `${params.garmentId}/${fileUuid}_original.${origExt}`;
  const thumbnailPath = `${params.garmentId}/${fileUuid}_thumb.${thumbExt}`;
  const supa = getSupabaseConfig();
  if (!supa && process.env.NODE_ENV === "production") {
    throw new AppError(
      500,
      "STORAGE_CONFIG_MISSING",
      "Konfigurasi Supabase Storage wajib tersedia pada lingkungan produksi."
    );
  }
  if (supa) {
    const uploadToSupabase = async (objectPath, body, contentType) => {
      const endpoint = `${supa.url}/storage/v1/object/${encodeURIComponent(supa.bucket)}/${objectPath}`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${supa.serviceKey}`,
          apikey: supa.serviceKey,
          "Content-Type": contentType,
          "x-upsert": "false"
        },
        body: new Uint8Array(body)
      });
      if (!res.ok) {
        const text2 = await res.text().catch(() => "");
        throw new AppError(
          502,
          "STORAGE_UPLOAD_FAILED",
          `Gagal mengunggah foto ke Supabase Storage (${res.status}): ${text2.slice(0, 120)}`
        );
      }
    };
    await uploadToSupabase(storagePath, params.originalBuffer, params.originalMime);
    try {
      await uploadToSupabase(thumbnailPath, params.thumbnailBuffer, params.thumbnailMime);
    } catch (err) {
      await deleteFromSupabase(supa, storagePath).catch(() => {
      });
      throw err;
    }
    return {
      storageProvider: "SUPABASE",
      storagePath,
      thumbnailPath
    };
  }
  const absOriginal = resolveConfinedPath(storagePath);
  const absThumb = resolveConfinedPath(thumbnailPath);
  await fs.mkdir(path.dirname(absOriginal), { recursive: true });
  await fs.writeFile(absOriginal, params.originalBuffer);
  try {
    await fs.writeFile(absThumb, params.thumbnailBuffer);
  } catch (err) {
    await fs.unlink(absOriginal).catch(() => {
    });
    throw err;
  }
  return {
    storageProvider: "LOCAL_PRIVATE",
    storagePath,
    thumbnailPath
  };
}
async function deleteFromSupabase(supa, objectPath) {
  const endpoint = `${supa.url}/storage/v1/object/${encodeURIComponent(supa.bucket)}/${objectPath}`;
  await fetch(endpoint, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${supa.serviceKey}`,
      apikey: supa.serviceKey
    }
  });
}
async function readPhotoObject(params) {
  if (params.storageProvider === "SUPABASE") {
    const supa = getSupabaseConfig();
    if (!supa) {
      throw new AppError(500, "STORAGE_CONFIG_MISSING", "Konfigurasi Supabase Storage tidak tersedia.");
    }
    const endpoint = `${supa.url}/storage/v1/object/authenticated/${encodeURIComponent(supa.bucket)}/${params.objectPath}`;
    const res = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${supa.serviceKey}`,
        apikey: supa.serviceKey
      }
    });
    if (!res.ok) {
      throw new AppError(404, "PHOTO_NOT_FOUND", "File foto tidak ditemukan di storage.");
    }
    const arr = await res.arrayBuffer();
    return {
      buffer: Buffer.from(arr),
      contentType: res.headers.get("content-type") || void 0
    };
  }
  const absPath = resolveConfinedPath(params.objectPath);
  try {
    const buffer = await fs.readFile(absPath);
    return { buffer };
  } catch {
    throw new AppError(404, "PHOTO_NOT_FOUND", "File foto tidak ditemukan.");
  }
}
async function deletePhotoObjects(params) {
  if (params.storageProvider === "SUPABASE") {
    const supa = getSupabaseConfig();
    if (supa) {
      await deleteFromSupabase(supa, params.storagePath).catch(() => {
      });
      await deleteFromSupabase(supa, params.thumbnailPath).catch(() => {
      });
    }
    return;
  }
  const absOrig = resolveConfinedPath(params.storagePath);
  const absThumb = resolveConfinedPath(params.thumbnailPath);
  await fs.unlink(absOrig).catch(() => {
  });
  await fs.unlink(absThumb).catch(() => {
  });
}

// src/server/services/workflow.rules.ts
var WAITING_STATUS_BY_DEPT = {
  SPOTTING: "WAITING_SPOTTING",
  IRONING: "WAITING_IRONING",
  PACKING: "WAITING_PACKING"
};
var IN_PROGRESS_STATUS_BY_DEPT = {
  SPOTTING: "SPOTTING_IN_PROGRESS",
  IRONING: "IRONING_IN_PROGRESS",
  PACKING: "PACKING_IN_PROGRESS"
};
function assertDepartmentRole(role, department) {
  if (role !== department) {
    throw new AppError(
      403,
      "DEPARTMENT_ROLE_MISMATCH",
      `Tindakan untuk divisi ${department} hanya dapat dilakukan oleh staf divisi ${department}.`
    );
  }
}
function canStartStage(params) {
  assertDepartmentRole(params.actorRole, params.stageDepartment);
  const expectedWaiting = WAITING_STATUS_BY_DEPT[params.stageDepartment];
  if (params.currentDepartment !== params.stageDepartment || params.currentStatus !== expectedWaiting) {
    throw new AppError(
      409,
      "INVALID_STATE_TRANSITION",
      `Barang tidak berada pada status ${expectedWaiting} (status saat ini: ${params.currentStatus}).`
    );
  }
  return IN_PROGRESS_STATUS_BY_DEPT[params.stageDepartment];
}
function canCompleteStage(params) {
  assertDepartmentRole(params.actorRole, params.stageDepartment);
  const expectedInProgress = IN_PROGRESS_STATUS_BY_DEPT[params.stageDepartment];
  if (params.currentDepartment !== params.stageDepartment || params.currentStatus !== expectedInProgress) {
    throw new AppError(
      409,
      "INVALID_STATE_TRANSITION",
      `Pekerjaan divisi ${params.stageDepartment} belum dimulai atau sudah selesai (status saat ini: ${params.currentStatus}).`
    );
  }
  if (!params.identityVerified) {
    throw new AppError(
      422,
      "IDENTITY_VERIFICATION_REQUIRED",
      "Verifikasi identitas barang (tag fisik / foto referensi + detail) wajib dicentang sebelum menyelesaikan tugas."
    );
  }
  if (!params.allChecklistItemsChecked) {
    throw new AppError(
      422,
      "CHECKLIST_INCOMPLETE",
      "Semua item checklist divisi wajib diselesaikan sebelum menyelesaikan pekerjaan."
    );
  }
}
function resolveNextWorkflowTarget(orderedDepartments, completedDepartment) {
  const idx = orderedDepartments.indexOf(completedDepartment);
  if (idx === -1) {
    throw new AppError(
      409,
      "INVALID_STAGE_TEMPLATE",
      `Divisi ${completedDepartment} tidak terdaftar pada template alur barang ini.`
    );
  }
  const nextDept = orderedDepartments[idx + 1];
  if (!nextDept) {
    return {
      nextDepartment: "PICKUP",
      nextStatus: "READY_FOR_PICKUP"
    };
  }
  return {
    nextDepartment: nextDept,
    nextStatus: WAITING_STATUS_BY_DEPT[nextDept]
  };
}
function canPlaceOnHold(currentStatus) {
  if (currentStatus === "REGISTERED" || currentStatus === "READY_FOR_PICKUP" || currentStatus === "PICKED_UP" || currentStatus === "ON_HOLD") {
    throw new AppError(
      409,
      "INVALID_STATE_TRANSITION",
      `Barang dengan status ${currentStatus} tidak dapat dipindahkan ke status ON_HOLD.`
    );
  }
}
function canResumeFromHold(currentStatus, previousStatus, previousDepartment) {
  if (currentStatus !== "ON_HOLD" || !previousStatus || !previousDepartment) {
    throw new AppError(
      409,
      "INVALID_STATE_TRANSITION",
      "Barang tidak berada dalam status ON_HOLD yang dapat dilanjutkan."
    );
  }
  return {
    restoreStatus: previousStatus,
    restoreDepartment: previousDepartment
  };
}

// src/server/services/garment.service.ts
var DEFAULT_CHECKLISTS = {
  SPOTTING: [
    { key: "tag_match", label: "Nomor tag fisik & detail barang sesuai catatan" },
    { key: "stain_assessed", label: "Jenis noda & risiko kerusakan serat telah diperiksa" },
    { key: "treatment_done", label: "Proses spotting selesai tanpa merusak bahan" },
    { key: "hardware_checked", label: "Kancing, ritsleting, dan aksesoris dalam kondisi aman" }
  ],
  IRONING: [
    { key: "tag_match", label: "Identitas barang & tag fisik terverifikasi" },
    { key: "temp_matched", label: "Suhu setrika/steamer sesuai label perawatan bahan" },
    { key: "finish_checked", label: "Tidak ada lipatan berlebih atau kilap setrika" },
    { key: "visual_clean", label: "Tidak ada noda tertinggal setelah pemanasan" }
  ],
  PACKING: [
    { key: "tag_match", label: "Identitas barang, pelanggan/vendor, & tag terverifikasi" },
    { key: "final_qc", label: "Kualitas kebersihan dan kerapian akhir lolos QC" },
    { key: "scent_cover", label: "Gantungan/lipatan & pelindung debu terpasang rapi" },
    { key: "ready_label", label: "Barang siap ditempatkan di rak pengambilan" }
  ]
};
async function getChecklistTemplatesMap() {
  const row = await db.select().from(systemSettings).where(eq3(systemSettings.key, "checklist_templates")).limit(1);
  if (!row.length || typeof row[0].value !== "object" || row[0].value === null) {
    return DEFAULT_CHECKLISTS;
  }
  return {
    ...DEFAULT_CHECKLISTS,
    ...row[0].value
  };
}
async function listWorkflowTemplates() {
  const templates = await db.select().from(workflowTemplates).where(eq3(workflowTemplates.isActive, true)).orderBy(workflowTemplates.name);
  const stages = await db.select().from(workflowTemplateStages).orderBy(asc(workflowTemplateStages.stageOrder));
  return templates.map((t) => ({
    ...t,
    stages: stages.filter((s) => s.templateId === t.id)
  }));
}
async function registerGarment(params) {
  const orderRows = await db.select().from(orders).where(eq3(orders.id, params.orderId)).limit(1);
  if (!orderRows.length) {
    throw new AppError(404, "ORDER_NOT_FOUND", "Pesanan tidak ditemukan.");
  }
  const order = orderRows[0];
  if (order.status === "ARCHIVED" || order.status === "CANCELLED") {
    throw new AppError(
      409,
      "ORDER_CLOSED",
      "Tidak dapat mendaftarkan barang ke pesanan yang sudah diarsipkan atau dibatalkan."
    );
  }
  const templateRows = await db.select().from(workflowTemplates).where(eq3(workflowTemplates.code, params.templateCode)).limit(1);
  if (!templateRows.length) {
    throw new AppError(400, "INVALID_TEMPLATE", "Template alur layanan tidak valid.");
  }
  const template = templateRows[0];
  const templateStages = await db.select().from(workflowTemplateStages).where(eq3(workflowTemplateStages.templateId, template.id)).orderBy(asc(workflowTemplateStages.stageOrder));
  if (!templateStages.length) {
    throw new AppError(400, "EMPTY_TEMPLATE_STAGES", "Template layanan belum memiliki tahapan divisi.");
  }
  const activeTagConflict = await db.select({ id: garments.id, garmentCode: garments.garmentCode }).from(garments).where(
    and3(
      eq3(garments.physicalTagNumber, params.physicalTagNumber.trim()),
      isNull2(garments.deletedAt),
      inArray(garments.currentStatus, [
        "REGISTERED",
        "WAITING_SPOTTING",
        "SPOTTING_IN_PROGRESS",
        "WAITING_IRONING",
        "IRONING_IN_PROGRESS",
        "WAITING_PACKING",
        "PACKING_IN_PROGRESS",
        "READY_FOR_PICKUP",
        "ON_HOLD"
      ])
    )
  ).limit(1);
  if (activeTagConflict.length) {
    throw new AppError(
      409,
      "DUPLICATE_ACTIVE_TAG",
      `Nomor tag fisik "${params.physicalTagNumber.trim()}" sedang digunakan oleh barang aktif (${activeTagConflict[0].garmentCode}).`
    );
  }
  const existingCountRows = await db.select({ total: count2() }).from(garments).where(eq3(garments.orderId, order.id));
  const seq = Number(existingCountRows[0].total) + 1;
  const suffix = order.orderCode.replace(/^ALM-/, "");
  const garmentCode = `GRM-${suffix}-${String(seq).padStart(2, "0")}`;
  const firstStage = templateStages[0];
  const firstDept = firstStage.department;
  const firstStatus = WAITING_STATUS_BY_DEPT[firstDept];
  const checklistMap = await getChecklistTemplatesMap();
  const created = await db.transaction(async (tx) => {
    const now = /* @__PURE__ */ new Date();
    const defaultDue = order.expectedCompletionAt ?? new Date(now.getTime() + templateStages.reduce((acc, s) => acc + s.slaHours, 0) * 36e5);
    const [inserted] = await tx.insert(garments).values({
      garmentCode,
      orderId: order.id,
      templateId: template.id,
      garmentName: params.garmentName.trim(),
      category: params.category.trim(),
      garmentType: params.garmentType.trim(),
      brand: params.brand?.trim() || null,
      color: params.color.trim(),
      size: params.size?.trim() || null,
      physicalTagNumber: params.physicalTagNumber.trim(),
      tagStatus: "ATTACHED",
      distinctiveFeatures: params.distinctiveFeatures?.trim() || null,
      initialCondition: params.initialCondition.trim(),
      stainDescription: params.stainDescription?.trim() || null,
      specialInstructions: params.specialInstructions?.trim() || null,
      currentDepartment: firstDept,
      currentStatus: firstStatus,
      dueAt: defaultDue,
      registeredBy: params.actorUserId
    }).returning();
    let cumulativeHours = 0;
    for (const ts of templateStages) {
      cumulativeHours += ts.slaHours;
      const stageDept = ts.department;
      const [stageRow] = await tx.insert(garmentWorkflowStages).values({
        garmentId: inserted.id,
        department: stageDept,
        stageOrder: ts.stageOrder,
        status: "PENDING",
        dueAt: new Date(now.getTime() + cumulativeHours * 36e5)
      }).returning();
      const [checklistRow] = await tx.insert(checklists).values({
        garmentId: inserted.id,
        stageId: stageRow.id,
        department: stageDept,
        identityVerified: false,
        verificationMethod: "PHYSICAL_TAG",
        isComplete: false
      }).returning();
      const items = checklistMap[stageDept] ?? [];
      if (items.length) {
        await tx.insert(checklistItems).values(
          items.map((item, idx) => ({
            checklistId: checklistRow.id,
            itemKey: item.key,
            label: item.label,
            sortOrder: idx + 1,
            isChecked: false
          }))
        );
      }
    }
    await tx.insert(workflowHistory).values([
      {
        garmentId: inserted.id,
        previousStatus: "NEW",
        newStatus: "REGISTERED",
        fromDepartment: "ADMIN",
        toDepartment: "ADMIN",
        performedBy: params.actorUserId,
        notes: `Registrasi barang oleh Admin (Tag fisik: ${inserted.physicalTagNumber})`
      },
      {
        garmentId: inserted.id,
        previousStatus: "REGISTERED",
        newStatus: firstStatus,
        fromDepartment: "ADMIN",
        toDepartment: firstDept,
        performedBy: params.actorUserId,
        notes: `Masuk antrean divisi ${firstDept} (${template.name})`
      }
    ]);
    if (order.status === "READY_FOR_PICKUP") {
      await tx.update(orders).set({ status: "ACTIVE", updatedAt: now }).where(eq3(orders.id, order.id));
    }
    await writeAuditLog(tx, {
      actorUserId: params.actorUserId,
      action: "GARMENT_REGISTERED",
      entityType: "GARMENT",
      entityId: inserted.id,
      metadata: {
        garmentCode: inserted.garmentCode,
        orderId: order.id,
        physicalTagNumber: inserted.physicalTagNumber,
        templateCode: template.code
      },
      ipAddress: params.ipAddress
    });
    return inserted;
  });
  return created;
}
async function listGarments(params) {
  const offset = (params.page - 1) * params.perPage;
  const filters = [isNull2(garments.deletedAt)];
  if (!params.includeArchived && !params.orderId && !params.status) {
    filters.push(
      inArray(garments.currentStatus, [
        "REGISTERED",
        "WAITING_SPOTTING",
        "SPOTTING_IN_PROGRESS",
        "WAITING_IRONING",
        "IRONING_IN_PROGRESS",
        "WAITING_PACKING",
        "PACKING_IN_PROGRESS",
        "READY_FOR_PICKUP",
        "ON_HOLD"
      ])
    );
  }
  if (params.status) {
    filters.push(eq3(garments.currentStatus, params.status));
  }
  if (params.department) {
    filters.push(eq3(garments.currentDepartment, params.department));
  }
  if (params.orderId) {
    filters.push(eq3(garments.orderId, params.orderId));
  }
  if (params.search && params.search.trim()) {
    const q = `%${params.search.trim()}%`;
    filters.push(
      or2(
        ilike(garments.garmentCode, q),
        ilike(garments.physicalTagNumber, q),
        ilike(garments.garmentName, q),
        ilike(garments.garmentType, q),
        ilike(garments.brand, q),
        ilike(garments.color, q),
        ilike(garments.distinctiveFeatures, q),
        ilike(orders.customerName, q),
        ilike(orders.orderCode, q)
      )
    );
  }
  const whereClause = and3(...filters);
  const [{ total }] = await db.select({ total: count2() }).from(garments).innerJoin(orders, eq3(garments.orderId, orders.id)).where(whereClause);
  const rows = await db.select({
    garment: garments,
    orderCode: orders.orderCode,
    customerName: orders.customerName,
    orderCategory: orders.orderCategory,
    templateName: workflowTemplates.name
  }).from(garments).innerJoin(orders, eq3(garments.orderId, orders.id)).innerJoin(workflowTemplates, eq3(garments.templateId, workflowTemplates.id)).where(whereClause).orderBy(desc(garments.createdAt)).limit(params.perPage).offset(offset);
  const garmentIds = rows.map((r) => r.garment.id);
  const thumbMap = /* @__PURE__ */ new Map();
  if (garmentIds.length) {
    const photoRows = await db.select({
      id: garmentPhotos.id,
      garmentId: garmentPhotos.garmentId,
      photoType: garmentPhotos.photoType
    }).from(garmentPhotos).where(and3(inArray(garmentPhotos.garmentId, garmentIds), isNull2(garmentPhotos.deletedAt))).orderBy(garmentPhotos.createdAt);
    for (const p of photoRows) {
      if (!thumbMap.has(p.garmentId) || p.photoType === "FRONT") {
        thumbMap.set(p.garmentId, `/api/v1/photos/${p.id}/file?variant=thumb`);
      }
    }
  }
  return {
    items: rows.map((r) => ({
      ...r.garment,
      orderCode: r.orderCode,
      customerName: r.customerName,
      orderCategory: r.orderCategory,
      templateName: r.templateName,
      thumbnailUrl: thumbMap.get(r.garment.id) ?? null
    })),
    meta: {
      page: params.page,
      perPage: params.perPage,
      total: Number(total),
      totalPages: Math.max(1, Math.ceil(Number(total) / params.perPage))
    }
  };
}
async function getGarmentById(garmentId) {
  const rows = await db.select({
    garment: garments,
    order: orders,
    template: workflowTemplates,
    registrantName: users.fullName
  }).from(garments).innerJoin(orders, eq3(garments.orderId, orders.id)).innerJoin(workflowTemplates, eq3(garments.templateId, workflowTemplates.id)).innerJoin(users, eq3(garments.registeredBy, users.id)).where(and3(eq3(garments.id, garmentId), isNull2(garments.deletedAt))).limit(1);
  if (!rows.length) {
    throw new AppError(404, "GARMENT_NOT_FOUND", "Barang tidak ditemukan.");
  }
  const [stages, photos, history, issues, handovers, garmentChecklists] = await Promise.all([
    db.select().from(garmentWorkflowStages).where(eq3(garmentWorkflowStages.garmentId, garmentId)).orderBy(asc(garmentWorkflowStages.stageOrder)),
    db.select({
      photo: garmentPhotos,
      uploadedByName: users.fullName
    }).from(garmentPhotos).innerJoin(users, eq3(garmentPhotos.uploadedBy, users.id)).where(and3(eq3(garmentPhotos.garmentId, garmentId), isNull2(garmentPhotos.deletedAt))).orderBy(desc(garmentPhotos.createdAt)),
    db.select({
      history: workflowHistory,
      performedByName: users.fullName
    }).from(workflowHistory).innerJoin(users, eq3(workflowHistory.performedBy, users.id)).where(eq3(workflowHistory.garmentId, garmentId)).orderBy(asc(workflowHistory.createdAt)),
    db.select({
      issue: issueReports,
      reportedByName: users.fullName
    }).from(issueReports).innerJoin(users, eq3(issueReports.reportedBy, users.id)).where(eq3(issueReports.garmentId, garmentId)).orderBy(desc(issueReports.createdAt)),
    db.select({
      handover: handoverRecords,
      handedOverByName: users.fullName
    }).from(handoverRecords).innerJoin(users, eq3(handoverRecords.handedOverBy, users.id)).where(eq3(handoverRecords.garmentId, garmentId)).orderBy(asc(handoverRecords.handedOverAt)),
    db.select().from(checklists).where(eq3(checklists.garmentId, garmentId))
  ]);
  const checklistIds = garmentChecklists.map((c) => c.id);
  const allItems = checklistIds.length ? await db.select().from(checklistItems).where(inArray(checklistItems.checklistId, checklistIds)).orderBy(asc(checklistItems.sortOrder)) : [];
  return {
    ...rows[0].garment,
    orderCode: rows[0].order.orderCode,
    customerName: rows[0].order.customerName,
    customerPhone: rows[0].order.customerPhone,
    orderCategory: rows[0].order.orderCategory,
    orderStatus: rows[0].order.status,
    templateCode: rows[0].template.code,
    templateName: rows[0].template.name,
    registrantName: rows[0].registrantName,
    stages,
    photos: photos.map((p) => ({
      ...p.photo,
      uploadedByName: p.uploadedByName,
      thumbnailUrl: `/api/v1/photos/${p.photo.id}/file?variant=thumb`,
      originalUrl: `/api/v1/photos/${p.photo.id}/file?variant=original`
    })),
    history: history.map((h) => ({
      ...h.history,
      performedByName: h.performedByName
    })),
    issues: issues.map((i) => ({
      ...i.issue,
      reportedByName: i.reportedByName
    })),
    handovers: handovers.map((h) => ({
      ...h.handover,
      handedOverByName: h.handedOverByName
    })),
    checklists: garmentChecklists.map((c) => ({
      ...c,
      items: allItems.filter((item) => item.checklistId === c.id)
    }))
  };
}
async function updateGarmentDetails(params) {
  const existing = await db.select().from(garments).where(and3(eq3(garments.id, params.garmentId), isNull2(garments.deletedAt))).limit(1);
  if (!existing.length) {
    throw new AppError(404, "GARMENT_NOT_FOUND", "Barang tidak ditemukan.");
  }
  if (existing[0].currentStatus === "PICKED_UP") {
    throw new AppError(409, "GARMENT_ARCHIVED", "Barang yang sudah diambil tidak dapat diubah.");
  }
  const updated = await db.transaction(async (tx) => {
    const [row] = await tx.update(garments).set({
      ...params.garmentName !== void 0 ? { garmentName: params.garmentName.trim() } : {},
      ...params.category !== void 0 ? { category: params.category.trim() } : {},
      ...params.garmentType !== void 0 ? { garmentType: params.garmentType.trim() } : {},
      ...params.brand !== void 0 ? { brand: params.brand?.trim() || null } : {},
      ...params.color !== void 0 ? { color: params.color.trim() } : {},
      ...params.size !== void 0 ? { size: params.size?.trim() || null } : {},
      ...params.physicalTagNumber !== void 0 ? { physicalTagNumber: params.physicalTagNumber.trim() } : {},
      ...params.tagStatus !== void 0 ? { tagStatus: params.tagStatus } : {},
      ...params.distinctiveFeatures !== void 0 ? { distinctiveFeatures: params.distinctiveFeatures?.trim() || null } : {},
      ...params.initialCondition !== void 0 ? { initialCondition: params.initialCondition.trim() } : {},
      ...params.stainDescription !== void 0 ? { stainDescription: params.stainDescription?.trim() || null } : {},
      ...params.specialInstructions !== void 0 ? { specialInstructions: params.specialInstructions?.trim() || null } : {},
      version: existing[0].version + 1,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(and3(eq3(garments.id, params.garmentId), eq3(garments.version, params.version))).returning();
    if (!row) {
      throw new AppError(
        409,
        "CONFLICT_OPTIMISTIC_LOCK",
        "Data barang baru saja diperbarui oleh staf lain. Muat ulang halaman."
      );
    }
    await writeAuditLog(tx, {
      actorUserId: params.actorUserId,
      action: params.physicalTagNumber && params.physicalTagNumber !== existing[0].physicalTagNumber ? "PHYSICAL_TAG_UPDATED" : "GARMENT_UPDATED",
      entityType: "GARMENT",
      entityId: row.id,
      metadata: {
        previousTag: existing[0].physicalTagNumber,
        newTag: row.physicalTagNumber,
        tagStatus: row.tagStatus
      },
      ipAddress: params.ipAddress
    });
    return row;
  });
  return updated;
}
async function addGarmentPhoto(params) {
  const existing = await db.select({ id: garments.id, currentStatus: garments.currentStatus }).from(garments).where(and3(eq3(garments.id, params.garmentId), isNull2(garments.deletedAt))).limit(1);
  if (!existing.length) {
    throw new AppError(404, "GARMENT_NOT_FOUND", "Barang tidak ditemukan.");
  }
  if (existing[0].currentStatus === "PICKED_UP") {
    throw new AppError(409, "GARMENT_ARCHIVED", "Tidak dapat mengunggah foto ke barang yang sudah diambil.");
  }
  const detectedMime = detectImageMimeFromBuffer(params.originalBuffer);
  if (!detectedMime) {
    throw new AppError(
      400,
      "INVALID_IMAGE_FILE",
      "Format file foto harus berupa gambar JPEG, PNG, atau WebP yang valid."
    );
  }
  let thumbBuffer = params.originalBuffer;
  let thumbMime = detectedMime;
  if (params.thumbnailBuffer && params.thumbnailBuffer.length > 12) {
    const detectedThumbMime = detectImageMimeFromBuffer(params.thumbnailBuffer);
    if (detectedThumbMime) {
      thumbBuffer = params.thumbnailBuffer;
      thumbMime = detectedThumbMime;
    }
  }
  const stored = await uploadGarmentPhotoBuffers({
    garmentId: params.garmentId,
    originalBuffer: params.originalBuffer,
    originalMime: detectedMime,
    thumbnailBuffer: thumbBuffer,
    thumbnailMime: thumbMime
  });
  try {
    const inserted = await db.transaction(async (tx) => {
      const [row] = await tx.insert(garmentPhotos).values({
        garmentId: params.garmentId,
        photoType: params.photoType,
        storageProvider: stored.storageProvider,
        storagePath: stored.storagePath,
        thumbnailPath: stored.thumbnailPath,
        mimeType: detectedMime,
        fileSizeBytes: params.originalBuffer.length,
        caption: params.caption?.trim() || null,
        uploadedBy: params.actorUserId
      }).returning();
      await writeAuditLog(tx, {
        actorUserId: params.actorUserId,
        action: "GARMENT_PHOTO_UPLOADED",
        entityType: "GARMENT_PHOTO",
        entityId: row.id,
        metadata: { garmentId: params.garmentId, photoType: params.photoType, bytes: row.fileSizeBytes },
        ipAddress: params.ipAddress
      });
      return row;
    });
    return {
      ...inserted,
      thumbnailUrl: `/api/v1/photos/${inserted.id}/file?variant=thumb`,
      originalUrl: `/api/v1/photos/${inserted.id}/file?variant=original`
    };
  } catch (err) {
    await deletePhotoObjects(stored).catch(() => {
    });
    throw err;
  }
}
async function listPhotosGallery(params) {
  const offset = (params.page - 1) * params.perPage;
  const filters = [isNull2(garmentPhotos.deletedAt), isNull2(garments.deletedAt)];
  if (params.photoType) {
    filters.push(eq3(garmentPhotos.photoType, params.photoType));
  }
  if (params.garmentId) {
    filters.push(eq3(garmentPhotos.garmentId, params.garmentId));
  }
  if (params.search && params.search.trim()) {
    const q = `%${params.search.trim()}%`;
    filters.push(
      or2(
        ilike(garments.garmentCode, q),
        ilike(garments.physicalTagNumber, q),
        ilike(garments.garmentName, q),
        ilike(garments.brand, q),
        ilike(orders.customerName, q),
        ilike(orders.orderCode, q)
      )
    );
  }
  const whereClause = and3(...filters);
  const [{ total }] = await db.select({ total: count2() }).from(garmentPhotos).innerJoin(garments, eq3(garmentPhotos.garmentId, garments.id)).innerJoin(orders, eq3(garments.orderId, orders.id)).where(whereClause);
  const rows = await db.select({
    photo: garmentPhotos,
    garmentCode: garments.garmentCode,
    garmentName: garments.garmentName,
    physicalTagNumber: garments.physicalTagNumber,
    color: garments.color,
    brand: garments.brand,
    currentStatus: garments.currentStatus,
    orderCode: orders.orderCode,
    customerName: orders.customerName,
    uploadedByName: users.fullName
  }).from(garmentPhotos).innerJoin(garments, eq3(garmentPhotos.garmentId, garments.id)).innerJoin(orders, eq3(garments.orderId, orders.id)).innerJoin(users, eq3(garmentPhotos.uploadedBy, users.id)).where(whereClause).orderBy(desc(garmentPhotos.createdAt)).limit(params.perPage).offset(offset);
  return {
    items: rows.map((r) => ({
      ...r.photo,
      garmentCode: r.garmentCode,
      garmentName: r.garmentName,
      physicalTagNumber: r.physicalTagNumber,
      color: r.color,
      brand: r.brand,
      currentStatus: r.currentStatus,
      orderCode: r.orderCode,
      customerName: r.customerName,
      uploadedByName: r.uploadedByName,
      thumbnailUrl: `/api/v1/photos/${r.photo.id}/file?variant=thumb`,
      originalUrl: `/api/v1/photos/${r.photo.id}/file?variant=original`
    })),
    meta: {
      page: params.page,
      perPage: params.perPage,
      total: Number(total),
      totalPages: Math.max(1, Math.ceil(Number(total) / params.perPage))
    }
  };
}
async function softDeletePhoto(params) {
  const rows = await db.select().from(garmentPhotos).where(and3(eq3(garmentPhotos.id, params.photoId), isNull2(garmentPhotos.deletedAt))).limit(1);
  if (!rows.length) {
    throw new AppError(404, "PHOTO_NOT_FOUND", "Foto tidak ditemukan.");
  }
  await db.transaction(async (tx) => {
    await tx.update(garmentPhotos).set({ deletedAt: /* @__PURE__ */ new Date(), deletedBy: params.actorUserId }).where(eq3(garmentPhotos.id, params.photoId));
    await writeAuditLog(tx, {
      actorUserId: params.actorUserId,
      action: "PHOTO_DELETED",
      entityType: "GARMENT_PHOTO",
      entityId: params.photoId,
      metadata: { garmentId: rows[0].garmentId, photoType: rows[0].photoType },
      ipAddress: params.ipAddress
    });
  });
}
async function getPhotoMetadata(photoId) {
  const rows = await db.select().from(garmentPhotos).where(and3(eq3(garmentPhotos.id, photoId), isNull2(garmentPhotos.deletedAt))).limit(1);
  if (!rows.length) {
    throw new AppError(404, "PHOTO_NOT_FOUND", "Foto tidak ditemukan.");
  }
  return rows[0];
}
async function getGarmentHistory(garmentId) {
  const existing = await db.select({ id: garments.id }).from(garments).where(and3(eq3(garments.id, garmentId), isNull2(garments.deletedAt))).limit(1);
  if (!existing.length) {
    throw new AppError(404, "GARMENT_NOT_FOUND", "Barang tidak ditemukan.");
  }
  const [historyRows, handoverRows, issueRows] = await Promise.all([
    db.select({
      history: workflowHistory,
      performedByName: users.fullName
    }).from(workflowHistory).innerJoin(users, eq3(workflowHistory.performedBy, users.id)).where(eq3(workflowHistory.garmentId, garmentId)).orderBy(asc(workflowHistory.createdAt)),
    db.select({
      handover: handoverRecords,
      handedOverByName: users.fullName
    }).from(handoverRecords).innerJoin(users, eq3(handoverRecords.handedOverBy, users.id)).where(eq3(handoverRecords.garmentId, garmentId)).orderBy(asc(handoverRecords.handedOverAt)),
    db.select({
      issue: issueReports,
      reportedByName: users.fullName
    }).from(issueReports).innerJoin(users, eq3(issueReports.reportedBy, users.id)).where(eq3(issueReports.garmentId, garmentId)).orderBy(desc(issueReports.createdAt))
  ]);
  return {
    history: historyRows.map((h) => ({ ...h.history, performedByName: h.performedByName })),
    handovers: handoverRows.map((h) => ({ ...h.handover, handedOverByName: h.handedOverByName })),
    issues: issueRows.map((i) => ({ ...i.issue, reportedByName: i.reportedByName }))
  };
}

// src/server/services/order.service.ts
import { and as and4, count as count3, desc as desc2, eq as eq4, ilike as ilike2, inArray as inArray2, isNull as isNull3, ne, or as or3, sql } from "drizzle-orm";
async function generateOrderCode() {
  const now = /* @__PURE__ */ new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const prefix = `ALM-${ym}-`;
  const existing = await db.select({ orderCode: orders.orderCode }).from(orders).where(ilike2(orders.orderCode, `${prefix}%`)).orderBy(desc2(orders.orderCode)).limit(1);
  let nextNum = 1;
  if (existing.length) {
    const tail = existing[0].orderCode.split("-").pop();
    const parsed = Number(tail);
    if (!Number.isNaN(parsed)) nextNum = parsed + 1;
  }
  return `${prefix}${String(nextNum).padStart(4, "0")}`;
}
async function createOrder(params) {
  const orderCode = await generateOrderCode();
  const expectedDate = params.expectedCompletionAt ? new Date(params.expectedCompletionAt) : null;
  const created = await db.transaction(async (tx) => {
    const [inserted] = await tx.insert(orders).values({
      orderCode,
      customerName: params.customerName.trim(),
      customerPhone: params.customerPhone.trim(),
      orderCategory: params.orderCategory,
      expectedCompletionAt: expectedDate,
      notes: params.notes?.trim() || null,
      status: "ACTIVE",
      createdBy: params.actorUserId
    }).returning();
    await writeAuditLog(tx, {
      actorUserId: params.actorUserId,
      action: "ORDER_CREATED",
      entityType: "ORDER",
      entityId: inserted.id,
      metadata: { orderCode, customerName: inserted.customerName, orderCategory: params.orderCategory },
      ipAddress: params.ipAddress
    });
    return inserted;
  });
  return created;
}
async function listOrders(params) {
  const offset = (params.page - 1) * params.perPage;
  const filters = [];
  if (params.status === "ARCHIVED" || params.status === "CANCELLED" || params.status === "ACTIVE" || params.status === "READY_FOR_PICKUP") {
    filters.push(eq4(orders.status, params.status));
  } else {
    filters.push(inArray2(orders.status, ["ACTIVE", "READY_FOR_PICKUP"]));
  }
  if (params.category) {
    filters.push(eq4(orders.orderCategory, params.category));
  }
  if (params.search && params.search.trim()) {
    const q = `%${params.search.trim()}%`;
    filters.push(
      or3(
        ilike2(orders.orderCode, q),
        ilike2(orders.customerName, q),
        ilike2(orders.customerPhone, q)
      )
    );
  }
  const whereClause = filters.length ? and4(...filters) : void 0;
  const [{ total }] = await db.select({ total: count3() }).from(orders).where(whereClause);
  const rows = await db.select({
    order: orders,
    creatorName: users.fullName
  }).from(orders).innerJoin(users, eq4(orders.createdBy, users.id)).where(whereClause).orderBy(desc2(orders.createdAt)).limit(params.perPage).offset(offset);
  const orderIds = rows.map((r) => r.order.id);
  const garmentStatsMap = /* @__PURE__ */ new Map();
  if (orderIds.length) {
    const statsRows = await db.select({
      orderId: garments.orderId,
      total: count3(),
      ready: sql`count(*) filter (where ${garments.currentStatus} = 'READY_FOR_PICKUP')::int`,
      onHold: sql`count(*) filter (where ${garments.currentStatus} = 'ON_HOLD')::int`,
      pickedUp: sql`count(*) filter (where ${garments.currentStatus} = 'PICKED_UP')::int`
    }).from(garments).where(and4(inArray2(garments.orderId, orderIds), isNull3(garments.deletedAt))).groupBy(garments.orderId);
    for (const s of statsRows) {
      garmentStatsMap.set(s.orderId, {
        total: Number(s.total),
        ready: Number(s.ready),
        onHold: Number(s.onHold),
        pickedUp: Number(s.pickedUp)
      });
    }
  }
  const items = rows.map((r) => {
    const stats = garmentStatsMap.get(r.order.id) ?? {
      total: 0,
      ready: 0,
      onHold: 0,
      pickedUp: 0
    };
    return {
      ...r.order,
      creatorName: r.creatorName,
      garmentCount: stats.total,
      readyCount: stats.ready,
      onHoldCount: stats.onHold,
      pickedUpCount: stats.pickedUp,
      isPickupEligible: r.order.status !== "ARCHIVED" && r.order.status !== "CANCELLED" && stats.total > 0 && stats.ready === stats.total
    };
  });
  return {
    items,
    meta: {
      page: params.page,
      perPage: params.perPage,
      total: Number(total),
      totalPages: Math.max(1, Math.ceil(Number(total) / params.perPage))
    }
  };
}
async function getOrderById(orderId) {
  const rows = await db.select({
    order: orders,
    creatorName: users.fullName
  }).from(orders).innerJoin(users, eq4(orders.createdBy, users.id)).where(eq4(orders.id, orderId)).limit(1);
  if (!rows.length) {
    throw new AppError(404, "ORDER_NOT_FOUND", "Pesanan tidak ditemukan.");
  }
  const childGarments = await db.select().from(garments).where(and4(eq4(garments.orderId, orderId), isNull3(garments.deletedAt))).orderBy(garments.createdAt);
  const pickup = await db.select({
    record: pickupRecords,
    confirmedByName: users.fullName
  }).from(pickupRecords).innerJoin(users, eq4(pickupRecords.confirmedBy, users.id)).where(eq4(pickupRecords.orderId, orderId)).limit(1);
  const readyCount = childGarments.filter((g) => g.currentStatus === "READY_FOR_PICKUP").length;
  const onHoldCount = childGarments.filter((g) => g.currentStatus === "ON_HOLD").length;
  return {
    ...rows[0].order,
    creatorName: rows[0].creatorName,
    garments: childGarments,
    garmentCount: childGarments.length,
    readyCount,
    onHoldCount,
    isPickupEligible: rows[0].order.status !== "ARCHIVED" && rows[0].order.status !== "CANCELLED" && childGarments.length > 0 && readyCount === childGarments.length,
    pickupRecord: pickup.length ? { ...pickup[0].record, confirmedByName: pickup[0].confirmedByName } : null
  };
}
async function updateOrder(params) {
  const existing = await db.select().from(orders).where(eq4(orders.id, params.orderId)).limit(1);
  if (!existing.length) {
    throw new AppError(404, "ORDER_NOT_FOUND", "Pesanan tidak ditemukan.");
  }
  if (existing[0].status === "ARCHIVED" || existing[0].status === "CANCELLED") {
    throw new AppError(409, "ORDER_IMMUTABLE", "Pesanan yang sudah diarsipkan atau dibatalkan tidak dapat diubah.");
  }
  const updated = await db.transaction(async (tx) => {
    const [row] = await tx.update(orders).set({
      ...params.customerName !== void 0 ? { customerName: params.customerName.trim() } : {},
      ...params.customerPhone !== void 0 ? { customerPhone: params.customerPhone.trim() } : {},
      ...params.orderCategory !== void 0 ? { orderCategory: params.orderCategory } : {},
      ...params.expectedCompletionAt !== void 0 ? {
        expectedCompletionAt: params.expectedCompletionAt ? new Date(params.expectedCompletionAt) : null
      } : {},
      ...params.notes !== void 0 ? { notes: params.notes?.trim() || null } : {},
      version: existing[0].version + 1,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(and4(eq4(orders.id, params.orderId), eq4(orders.version, params.version))).returning();
    if (!row) {
      throw new AppError(
        409,
        "CONFLICT_OPTIMISTIC_LOCK",
        "Pesanan telah diperbarui oleh pengguna lain. Muat ulang data terbaru."
      );
    }
    await writeAuditLog(tx, {
      actorUserId: params.actorUserId,
      action: "ORDER_UPDATED",
      entityType: "ORDER",
      entityId: row.id,
      metadata: { orderCode: row.orderCode },
      ipAddress: params.ipAddress
    });
    return row;
  });
  return updated;
}
async function cancelOrder(params) {
  const existing = await db.select().from(orders).where(eq4(orders.id, params.orderId)).limit(1);
  if (!existing.length) {
    throw new AppError(404, "ORDER_NOT_FOUND", "Pesanan tidak ditemukan.");
  }
  if (existing[0].status === "ARCHIVED" || existing[0].status === "CANCELLED") {
    throw new AppError(409, "ORDER_IMMUTABLE", "Pesanan sudah diarsipkan atau dibatalkan.");
  }
  const startedGarments = await db.select({ id: garments.id }).from(garments).where(
    and4(
      eq4(garments.orderId, params.orderId),
      isNull3(garments.deletedAt),
      ne(garments.currentStatus, "REGISTERED"),
      ne(garments.currentStatus, "WAITING_SPOTTING"),
      ne(garments.currentStatus, "WAITING_IRONING"),
      ne(garments.currentStatus, "WAITING_PACKING")
    )
  ).limit(1);
  if (startedGarments.length) {
    throw new AppError(
      409,
      "ORDER_HAS_ACTIVE_PROCESSING",
      "Pesanan tidak dapat dibatalkan karena terdapat barang yang sudah mulai diproses."
    );
  }
  const updated = await db.transaction(async (tx) => {
    const now = /* @__PURE__ */ new Date();
    const [row] = await tx.update(orders).set({
      status: "CANCELLED",
      cancelledAt: now,
      cancelReason: params.reason.trim(),
      version: existing[0].version + 1,
      updatedAt: now
    }).where(eq4(orders.id, params.orderId)).returning();
    await tx.update(garments).set({ deletedAt: now, updatedAt: now }).where(and4(eq4(garments.orderId, params.orderId), isNull3(garments.deletedAt)));
    await writeAuditLog(tx, {
      actorUserId: params.actorUserId,
      action: "ORDER_CANCELLED",
      entityType: "ORDER",
      entityId: params.orderId,
      metadata: { reason: params.reason.trim() },
      ipAddress: params.ipAddress
    });
    return row;
  });
  return updated;
}
async function listArchiveOrders(params) {
  const offset = (params.page - 1) * params.perPage;
  const filters = [eq4(orders.status, "ARCHIVED")];
  if (params.category) {
    filters.push(eq4(orders.orderCategory, params.category));
  }
  if (params.search && params.search.trim()) {
    const q = `%${params.search.trim()}%`;
    filters.push(
      or3(
        ilike2(orders.orderCode, q),
        ilike2(orders.customerName, q),
        ilike2(orders.customerPhone, q)
      )
    );
  }
  const whereClause = and4(...filters);
  const [{ total }] = await db.select({ total: count3() }).from(orders).where(whereClause);
  const rows = await db.select({
    order: orders,
    pickupRecord: pickupRecords,
    confirmedByName: users.fullName
  }).from(orders).leftJoin(pickupRecords, eq4(orders.id, pickupRecords.orderId)).leftJoin(users, eq4(pickupRecords.confirmedBy, users.id)).where(whereClause).orderBy(desc2(orders.archivedAt)).limit(params.perPage).offset(offset);
  return {
    items: rows.map((r) => ({
      ...r.order,
      pickupRecord: r.pickupRecord ? { ...r.pickupRecord, confirmedByName: r.confirmedByName } : null
    })),
    meta: {
      page: params.page,
      perPage: params.perPage,
      total: Number(total),
      totalPages: Math.max(1, Math.ceil(Number(total) / params.perPage))
    }
  };
}

// src/server/services/pickup.service.ts
import { and as and5, eq as eq5, isNull as isNull4 } from "drizzle-orm";
async function confirmOrderPickup(params) {
  if (params.idempotencyKey) {
    const existingByKey = await db.select().from(pickupRecords).where(eq5(pickupRecords.idempotencyKey, params.idempotencyKey)).limit(1);
    if (existingByKey.length) {
      return existingByKey[0];
    }
  }
  const result = await db.transaction(async (tx) => {
    const orderRows = await tx.select().from(orders).where(eq5(orders.id, params.orderId)).limit(1);
    if (!orderRows.length) {
      throw new AppError(404, "ORDER_NOT_FOUND", "Pesanan tidak ditemukan.");
    }
    const order = orderRows[0];
    if (order.status === "ARCHIVED") {
      throw new AppError(
        409,
        "DUPLICATE_PICKUP",
        "Pengambilan pesanan ini sudah pernah dikonfirmasi dan telah diarsipkan."
      );
    }
    if (order.status === "CANCELLED") {
      throw new AppError(409, "ORDER_CANCELLED", "Pesanan yang dibatalkan tidak dapat diambil.");
    }
    const existingPickup = await tx.select().from(pickupRecords).where(eq5(pickupRecords.orderId, order.id)).limit(1);
    if (existingPickup.length) {
      throw new AppError(
        409,
        "DUPLICATE_PICKUP",
        "Catatan pengambilan untuk pesanan ini sudah ada."
      );
    }
    const orderGarments = await tx.select().from(garments).where(and5(eq5(garments.orderId, order.id), isNull4(garments.deletedAt)));
    if (!orderGarments.length) {
      throw new AppError(
        422,
        "ORDER_HAS_NO_GARMENTS",
        "Pesanan belum memiliki barang terdaftar."
      );
    }
    if (orderGarments.length !== params.expectedGarmentCount) {
      throw new AppError(
        422,
        "GARMENT_COUNT_MISMATCH",
        `Rekonsiliasi jumlah barang tidak cocok. Tercatat ${orderGarments.length} barang, konfirmasi Anda ${params.expectedGarmentCount}.`
      );
    }
    const notReady = orderGarments.filter((g) => g.currentStatus !== "READY_FOR_PICKUP");
    if (notReady.length) {
      throw new AppError(
        409,
        "GARMENTS_NOT_READY",
        `Masih ada ${notReady.length} barang yang belum berstatus Siap Diambil (contoh: ${notReady[0].garmentCode} - ${notReady[0].currentStatus}). Pengambilan parsial tidak diperbolehkan.`
      );
    }
    const now = /* @__PURE__ */ new Date();
    const [pickup] = await tx.insert(pickupRecords).values({
      orderId: order.id,
      confirmedBy: params.actorUserId,
      recipientName: params.recipientName.trim(),
      recipientPhone: params.recipientPhone?.trim() || null,
      verificationNotes: params.verificationNotes?.trim() || null,
      garmentCount: orderGarments.length,
      idempotencyKey: params.idempotencyKey ?? null,
      pickedUpAt: now
    }).returning();
    await tx.update(garments).set({
      currentStatus: "PICKED_UP",
      currentDepartment: "PICKUP",
      updatedAt: now
    }).where(and5(eq5(garments.orderId, order.id), isNull4(garments.deletedAt)));
    await tx.insert(workflowHistory).values(
      orderGarments.map((g) => ({
        garmentId: g.id,
        previousStatus: g.currentStatus,
        newStatus: "PICKED_UP",
        fromDepartment: g.currentDepartment,
        toDepartment: "PICKUP",
        performedBy: params.actorUserId,
        notes: `Pesanan diambil oleh ${params.recipientName.trim()} & dipindahkan ke arsip`
      }))
    );
    await tx.update(orders).set({
      status: "ARCHIVED",
      archivedAt: now,
      version: order.version + 1,
      updatedAt: now
    }).where(eq5(orders.id, order.id));
    await writeAuditLog(tx, {
      actorUserId: params.actorUserId,
      action: "ORDER_PICKUP_CONFIRMED_AND_ARCHIVED",
      entityType: "ORDER",
      entityId: order.id,
      metadata: {
        orderCode: order.orderCode,
        garmentCount: orderGarments.length,
        recipientName: params.recipientName.trim()
      },
      ipAddress: params.ipAddress
    });
    return pickup;
  });
  return result;
}

// src/server/services/report.service.ts
import { and as and6, count as count4, desc as desc3, eq as eq6, gte, ilike as ilike3, inArray as inArray3, isNull as isNull5, lt, or as or4, sql as sql2 } from "drizzle-orm";
var ACTIVE_GARMENT_STATUSES = [
  "REGISTERED",
  "WAITING_SPOTTING",
  "SPOTTING_IN_PROGRESS",
  "WAITING_IRONING",
  "IRONING_IN_PROGRESS",
  "WAITING_PACKING",
  "PACKING_IN_PROGRESS",
  "READY_FOR_PICKUP",
  "ON_HOLD"
];
async function getAdminOverview() {
  const now = /* @__PURE__ */ new Date();
  const [garmentStatsRows, orderStatsRows, delayedRows, onHoldRows, recentActivitiesRows, openIssuesRows] = await Promise.all([
    db.select({
      totalActive: sql2`count(*) filter (where ${garments.currentStatus} != 'PICKED_UP')::int`,
      waiting: sql2`count(*) filter (where ${garments.currentStatus} in ('REGISTERED','WAITING_SPOTTING','WAITING_IRONING','WAITING_PACKING'))::int`,
      inProgress: sql2`count(*) filter (where ${garments.currentStatus} in ('SPOTTING_IN_PROGRESS','IRONING_IN_PROGRESS','PACKING_IN_PROGRESS'))::int`,
      readyForPickup: sql2`count(*) filter (where ${garments.currentStatus} = 'READY_FOR_PICKUP')::int`,
      onHold: sql2`count(*) filter (where ${garments.currentStatus} = 'ON_HOLD')::int`,
      spottingCount: sql2`count(*) filter (where ${garments.currentDepartment} = 'SPOTTING' and ${garments.currentStatus} != 'PICKED_UP')::int`,
      ironingCount: sql2`count(*) filter (where ${garments.currentDepartment} = 'IRONING' and ${garments.currentStatus} != 'PICKED_UP')::int`,
      packingCount: sql2`count(*) filter (where ${garments.currentDepartment} = 'PACKING' and ${garments.currentStatus} != 'PICKED_UP')::int`
    }).from(garments).where(isNull5(garments.deletedAt)),
    db.select({
      ordersReady: sql2`count(*) filter (where ${orders.status} = 'READY_FOR_PICKUP')::int`,
      ordersActive: sql2`count(*) filter (where ${orders.status} = 'ACTIVE')::int`,
      ordersArchived: sql2`count(*) filter (where ${orders.status} = 'ARCHIVED')::int`
    }).from(orders),
    db.select({
      id: garments.id,
      garmentCode: garments.garmentCode,
      garmentName: garments.garmentName,
      physicalTagNumber: garments.physicalTagNumber,
      currentDepartment: garments.currentDepartment,
      currentStatus: garments.currentStatus,
      dueAt: garments.dueAt,
      orderCode: orders.orderCode,
      customerName: orders.customerName
    }).from(garments).innerJoin(orders, eq6(garments.orderId, orders.id)).where(
      and6(
        isNull5(garments.deletedAt),
        inArray3(garments.currentStatus, ACTIVE_GARMENT_STATUSES),
        lt(garments.dueAt, now)
      )
    ).orderBy(garments.dueAt).limit(10),
    db.select({
      id: garments.id,
      garmentCode: garments.garmentCode,
      garmentName: garments.garmentName,
      physicalTagNumber: garments.physicalTagNumber,
      currentDepartment: garments.currentDepartment,
      orderCode: orders.orderCode,
      customerName: orders.customerName,
      updatedAt: garments.updatedAt
    }).from(garments).innerJoin(orders, eq6(garments.orderId, orders.id)).where(and6(isNull5(garments.deletedAt), eq6(garments.currentStatus, "ON_HOLD"))).orderBy(desc3(garments.updatedAt)).limit(10),
    db.select({
      id: workflowHistory.id,
      garmentId: workflowHistory.garmentId,
      previousStatus: workflowHistory.previousStatus,
      newStatus: workflowHistory.newStatus,
      fromDepartment: workflowHistory.fromDepartment,
      toDepartment: workflowHistory.toDepartment,
      notes: workflowHistory.notes,
      createdAt: workflowHistory.createdAt,
      garmentCode: garments.garmentCode,
      garmentName: garments.garmentName,
      physicalTagNumber: garments.physicalTagNumber,
      performedByName: users.fullName
    }).from(workflowHistory).innerJoin(garments, eq6(workflowHistory.garmentId, garments.id)).innerJoin(users, eq6(workflowHistory.performedBy, users.id)).orderBy(desc3(workflowHistory.createdAt)).limit(15),
    db.select({ total: count4() }).from(issueReports).where(eq6(issueReports.resolutionStatus, "OPEN"))
  ]);
  const gStats = garmentStatsRows[0] ?? {
    totalActive: 0,
    waiting: 0,
    inProgress: 0,
    readyForPickup: 0,
    onHold: 0,
    spottingCount: 0,
    ironingCount: 0,
    packingCount: 0
  };
  const oStats = orderStatsRows[0] ?? {
    ordersReady: 0,
    ordersActive: 0,
    ordersArchived: 0
  };
  return {
    counts: {
      totalActiveGarments: Number(gStats.totalActive),
      waitingGarments: Number(gStats.waiting),
      inProgressGarments: Number(gStats.inProgress),
      readyForPickupGarments: Number(gStats.readyForPickup),
      onHoldGarments: Number(gStats.onHold),
      ordersAwaitingPickup: Number(oStats.ordersReady),
      ordersActive: Number(oStats.ordersActive),
      ordersArchived: Number(oStats.ordersArchived),
      openIssues: Number(openIssuesRows[0]?.total ?? 0)
    },
    departments: {
      SPOTTING: Number(gStats.spottingCount),
      IRONING: Number(gStats.ironingCount),
      PACKING: Number(gStats.packingCount)
    },
    delayedGarments: delayedRows,
    onHoldGarments: onHoldRows,
    recentActivities: recentActivitiesRows
  };
}
async function getStaffDashboardSummary(params) {
  const startOfDay = /* @__PURE__ */ new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const waitingStatus = `WAITING_${params.department}`;
  const inProgressStatus = `${params.department}_IN_PROGRESS`;
  const [queueStats, completedTodayRows] = await Promise.all([
    db.select({
      waiting: sql2`count(*) filter (where ${garments.currentStatus} = ${waitingStatus})::int`,
      inProgress: sql2`count(*) filter (where ${garments.currentStatus} = ${inProgressStatus})::int`,
      onHold: sql2`count(*) filter (where ${garments.currentStatus} = 'ON_HOLD')::int`
    }).from(garments).where(and6(isNull5(garments.deletedAt), eq6(garments.currentDepartment, params.department))),
    db.select({ total: count4() }).from(workflowHistory).where(
      and6(
        eq6(workflowHistory.fromDepartment, params.department),
        eq6(workflowHistory.performedBy, params.userId),
        gte(workflowHistory.createdAt, startOfDay),
        sql2`${workflowHistory.previousStatus} = ${inProgressStatus}`
      )
    )
  ]);
  return {
    waiting: Number(queueStats[0]?.waiting ?? 0),
    inProgress: Number(queueStats[0]?.inProgress ?? 0),
    onHold: Number(queueStats[0]?.onHold ?? 0),
    completedToday: Number(completedTodayRows[0]?.total ?? 0)
  };
}
async function getDepartmentsReport() {
  const now = /* @__PURE__ */ new Date();
  const rows = await db.select({
    department: garments.currentDepartment,
    waiting: sql2`count(*) filter (where ${garments.currentStatus} like 'WAITING_%')::int`,
    inProgress: sql2`count(*) filter (where ${garments.currentStatus} like '%_IN_PROGRESS')::int`,
    onHold: sql2`count(*) filter (where ${garments.currentStatus} = 'ON_HOLD')::int`,
    delayed: sql2`count(*) filter (where ${garments.dueAt} < ${now} and ${garments.currentStatus} in ('WAITING_SPOTTING','SPOTTING_IN_PROGRESS','WAITING_IRONING','IRONING_IN_PROGRESS','WAITING_PACKING','PACKING_IN_PROGRESS'))::int`
  }).from(garments).where(
    and6(
      isNull5(garments.deletedAt),
      inArray3(garments.currentDepartment, ["SPOTTING", "IRONING", "PACKING"])
    )
  ).groupBy(garments.currentDepartment);
  const map = new Map(rows.map((r) => [r.department, r]));
  return ["SPOTTING", "IRONING", "PACKING"].map((dept) => {
    const r = map.get(dept);
    return {
      department: dept,
      waiting: Number(r?.waiting ?? 0),
      inProgress: Number(r?.inProgress ?? 0),
      onHold: Number(r?.onHold ?? 0),
      delayed: Number(r?.delayed ?? 0)
    };
  });
}
async function getCompletedReport() {
  const [statusBreakdown, categoryBreakdown, issueSummary] = await Promise.all([
    db.select({
      status: garments.currentStatus,
      total: count4()
    }).from(garments).where(isNull5(garments.deletedAt)).groupBy(garments.currentStatus),
    db.select({
      category: orders.orderCategory,
      orderCount: count4()
    }).from(orders).groupBy(orders.orderCategory),
    db.select({
      issueType: issueReports.issueType,
      resolutionStatus: issueReports.resolutionStatus,
      total: count4()
    }).from(issueReports).groupBy(issueReports.issueType, issueReports.resolutionStatus)
  ]);
  return {
    statusBreakdown: statusBreakdown.map((s) => ({ status: s.status, total: Number(s.total) })),
    categoryBreakdown: categoryBreakdown.map((c) => ({
      category: c.category,
      orderCount: Number(c.orderCount)
    })),
    issueSummary: issueSummary.map((i) => ({
      issueType: i.issueType,
      resolutionStatus: i.resolutionStatus,
      total: Number(i.total)
    }))
  };
}
async function globalSearch(query) {
  const clean = query.trim();
  if (!clean) return { garments: [], orders: [] };
  const q = `%${clean}%`;
  const [garmentResults, orderResults] = await Promise.all([
    db.select({
      id: garments.id,
      garmentCode: garments.garmentCode,
      garmentName: garments.garmentName,
      garmentType: garments.garmentType,
      brand: garments.brand,
      color: garments.color,
      physicalTagNumber: garments.physicalTagNumber,
      tagStatus: garments.tagStatus,
      currentStatus: garments.currentStatus,
      currentDepartment: garments.currentDepartment,
      orderId: garments.orderId,
      orderCode: orders.orderCode,
      customerName: orders.customerName
    }).from(garments).innerJoin(orders, eq6(garments.orderId, orders.id)).where(
      and6(
        isNull5(garments.deletedAt),
        or4(
          ilike3(garments.garmentCode, q),
          ilike3(garments.physicalTagNumber, q),
          ilike3(garments.garmentName, q),
          ilike3(garments.garmentType, q),
          ilike3(garments.brand, q),
          ilike3(garments.color, q),
          ilike3(garments.distinctiveFeatures, q),
          ilike3(orders.orderCode, q),
          ilike3(orders.customerName, q)
        )
      )
    ).orderBy(desc3(garments.createdAt)).limit(20),
    db.select().from(orders).where(
      or4(
        ilike3(orders.orderCode, q),
        ilike3(orders.customerName, q),
        ilike3(orders.customerPhone, q)
      )
    ).orderBy(desc3(orders.createdAt)).limit(10)
  ]);
  const gIds = garmentResults.map((g) => g.id);
  const thumbMap = /* @__PURE__ */ new Map();
  if (gIds.length) {
    const photos = await db.select({
      id: garmentPhotos.id,
      garmentId: garmentPhotos.garmentId,
      photoType: garmentPhotos.photoType
    }).from(garmentPhotos).where(and6(inArray3(garmentPhotos.garmentId, gIds), isNull5(garmentPhotos.deletedAt)));
    for (const p of photos) {
      if (!thumbMap.has(p.garmentId) || p.photoType === "FRONT") {
        thumbMap.set(p.garmentId, `/api/v1/photos/${p.id}/file?variant=thumb`);
      }
    }
  }
  return {
    garments: garmentResults.map((g) => ({
      ...g,
      thumbnailUrl: thumbMap.get(g.id) ?? null
    })),
    orders: orderResults
  };
}
async function getSystemSettings() {
  const rows = await db.select().from(systemSettings);
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}
async function updateSystemSetting(params) {
  await db.transaction(async (tx) => {
    await tx.insert(systemSettings).values({
      key: params.key,
      value: params.value,
      updatedBy: params.actorUserId,
      updatedAt: /* @__PURE__ */ new Date()
    }).onConflictDoUpdate({
      target: systemSettings.key,
      set: {
        value: params.value,
        updatedBy: params.actorUserId,
        updatedAt: /* @__PURE__ */ new Date()
      }
    });
    await writeAuditLog(tx, {
      actorUserId: params.actorUserId,
      action: "SYSTEM_SETTING_UPDATED",
      entityType: "SYSTEM_SETTING",
      entityId: params.key,
      metadata: { key: params.key },
      ipAddress: params.ipAddress
    });
  });
  return getSystemSettings();
}

// src/server/services/workflow.service.ts
import { and as and7, asc as asc2, desc as desc4, eq as eq7, inArray as inArray4, isNull as isNull6 } from "drizzle-orm";
async function getStaffDepartmentQueue(params) {
  const waitingStatus = `WAITING_${params.department}`;
  const inProgressStatus = `${params.department}_IN_PROGRESS`;
  const statusList = params.statusFilter === "WAITING" ? [waitingStatus] : params.statusFilter === "IN_PROGRESS" ? [inProgressStatus] : params.statusFilter === "ON_HOLD" ? ["ON_HOLD"] : [waitingStatus, inProgressStatus, "ON_HOLD"];
  const rows = await db.select({
    garment: garments,
    orderCode: orders.orderCode,
    customerName: orders.customerName,
    orderCategory: orders.orderCategory
  }).from(garments).innerJoin(orders, eq7(garments.orderId, orders.id)).where(
    and7(
      isNull6(garments.deletedAt),
      eq7(garments.currentDepartment, params.department),
      inArray4(garments.currentStatus, statusList)
    )
  ).orderBy(asc2(garments.dueAt), asc2(garments.createdAt));
  const garmentIds = rows.map((r) => r.garment.id);
  const thumbMap = /* @__PURE__ */ new Map();
  if (garmentIds.length) {
    const photos = await db.select({
      id: garmentPhotos.id,
      garmentId: garmentPhotos.garmentId,
      photoType: garmentPhotos.photoType
    }).from(garmentPhotos).where(and7(inArray4(garmentPhotos.garmentId, garmentIds), isNull6(garmentPhotos.deletedAt)));
    for (const p of photos) {
      if (!thumbMap.has(p.garmentId) || p.photoType === "FRONT") {
        thumbMap.set(p.garmentId, `/api/v1/photos/${p.id}/file?variant=thumb`);
      }
    }
  }
  return rows.map((r) => ({
    ...r.garment,
    orderCode: r.orderCode,
    customerName: r.customerName,
    orderCategory: r.orderCategory,
    thumbnailUrl: thumbMap.get(r.garment.id) ?? null
  }));
}
async function startGarmentStage(params) {
  const garmentRows = await db.select().from(garments).where(and7(eq7(garments.id, params.garmentId), isNull6(garments.deletedAt))).limit(1);
  if (!garmentRows.length) {
    throw new AppError(404, "GARMENT_NOT_FOUND", "Barang tidak ditemukan.");
  }
  const garment = garmentRows[0];
  if (garment.currentDepartment !== "SPOTTING" && garment.currentDepartment !== "IRONING" && garment.currentDepartment !== "PACKING") {
    throw new AppError(
      409,
      "INVALID_DEPARTMENT_STAGE",
      `Barang saat ini berada di ${garment.currentDepartment}, bukan antrean pengerjaan staf.`
    );
  }
  const stageDept = garment.currentDepartment;
  const nextStatus = canStartStage({
    currentStatus: garment.currentStatus,
    currentDepartment: garment.currentDepartment,
    stageDepartment: stageDept,
    actorRole: params.actorRole
  });
  if (garment.tagStatus === "MISSING" && params.verificationMethod === "PHYSICAL_TAG") {
    throw new AppError(
      422,
      "BACKUP_VERIFICATION_REQUIRED",
      "Tag fisik tercatat hilang. Gunakan verifikasi foto referensi dan detail barang sebelum memulai."
    );
  }
  const updated = await db.transaction(async (tx) => {
    const now = /* @__PURE__ */ new Date();
    const [row] = await tx.update(garments).set({
      currentStatus: nextStatus,
      assignedStaffId: params.actorUserId,
      version: garment.version + 1,
      updatedAt: now
    }).where(
      and7(
        eq7(garments.id, garment.id),
        eq7(garments.version, params.version),
        eq7(garments.currentStatus, garment.currentStatus)
      )
    ).returning();
    if (!row) {
      throw new AppError(
        409,
        "CONFLICT_OPTIMISTIC_LOCK",
        "Barang sudah mulai diproses oleh staf lain atau data telah berubah. Muat ulang antrean."
      );
    }
    const [stageRow] = await tx.update(garmentWorkflowStages).set({
      status: "IN_PROGRESS",
      assignedTo: params.actorUserId,
      startedAt: now,
      updatedAt: now
    }).where(
      and7(
        eq7(garmentWorkflowStages.garmentId, garment.id),
        eq7(garmentWorkflowStages.department, stageDept)
      )
    ).returning();
    if (stageRow) {
      await tx.update(checklists).set({
        identityVerified: true,
        verificationMethod: params.verificationMethod,
        updatedAt: now
      }).where(eq7(checklists.stageId, stageRow.id));
    }
    await tx.update(handoverRecords).set({ receivedBy: params.actorUserId, receivedAt: now }).where(
      and7(
        eq7(handoverRecords.garmentId, garment.id),
        eq7(handoverRecords.toDepartment, stageDept),
        isNull6(handoverRecords.receivedAt)
      )
    );
    await tx.insert(workflowHistory).values({
      garmentId: garment.id,
      previousStatus: garment.currentStatus,
      newStatus: nextStatus,
      fromDepartment: stageDept,
      toDepartment: stageDept,
      performedBy: params.actorUserId,
      notes: params.notes?.trim() || `Pekerjaan divisi ${stageDept} dimulai (Verifikasi: ${params.verificationMethod})`
    });
    await writeAuditLog(tx, {
      actorUserId: params.actorUserId,
      action: "WORKFLOW_STAGE_STARTED",
      entityType: "GARMENT",
      entityId: garment.id,
      metadata: { department: stageDept, verificationMethod: params.verificationMethod },
      ipAddress: params.ipAddress
    });
    return row;
  });
  return updated;
}
async function getGarmentCurrentChecklist(garmentId, actorRole) {
  const garmentRows = await db.select().from(garments).where(and7(eq7(garments.id, garmentId), isNull6(garments.deletedAt))).limit(1);
  if (!garmentRows.length) {
    throw new AppError(404, "GARMENT_NOT_FOUND", "Barang tidak ditemukan.");
  }
  const garment = garmentRows[0];
  const allChecklists = await db.select().from(checklists).where(eq7(checklists.garmentId, garmentId));
  const checklistIds = allChecklists.map((c) => c.id);
  const items = checklistIds.length ? await db.select().from(checklistItems).where(inArray4(checklistItems.checklistId, checklistIds)).orderBy(asc2(checklistItems.sortOrder)) : [];
  const enriched = allChecklists.map((c) => ({
    ...c,
    items: items.filter((i) => i.checklistId === c.id)
  }));
  if (actorRole === "ADMIN") {
    return enriched;
  }
  return enriched.filter((c) => c.department === actorRole);
}
async function saveGarmentChecklist(params) {
  const garmentRows = await db.select().from(garments).where(and7(eq7(garments.id, params.garmentId), isNull6(garments.deletedAt))).limit(1);
  if (!garmentRows.length) {
    throw new AppError(404, "GARMENT_NOT_FOUND", "Barang tidak ditemukan.");
  }
  const garment = garmentRows[0];
  if (garment.currentDepartment !== "SPOTTING" && garment.currentDepartment !== "IRONING" && garment.currentDepartment !== "PACKING") {
    throw new AppError(409, "INVALID_STAGE", "Barang tidak sedang berada di divisi operasional.");
  }
  const dept = garment.currentDepartment;
  assertDepartmentRole(params.actorRole, dept);
  if (garment.currentStatus !== IN_PROGRESS_STATUS_BY_DEPT[dept]) {
    throw new AppError(
      409,
      "STAGE_NOT_STARTED",
      "Mulai pekerjaan terlebih dahulu sebelum mengisi checklist."
    );
  }
  const checklistRows = await db.select().from(checklists).where(and7(eq7(checklists.garmentId, garment.id), eq7(checklists.department, dept))).limit(1);
  if (!checklistRows.length) {
    throw new AppError(404, "CHECKLIST_NOT_FOUND", "Checklist divisi tidak ditemukan.");
  }
  const checklist = checklistRows[0];
  const existingItems = await db.select().from(checklistItems).where(eq7(checklistItems.checklistId, checklist.id));
  const updated = await db.transaction(async (tx) => {
    const now = /* @__PURE__ */ new Date();
    for (const incoming of params.items) {
      await tx.update(checklistItems).set({
        isChecked: incoming.isChecked,
        note: incoming.note?.trim() || null,
        checkedBy: incoming.isChecked ? params.actorUserId : null,
        checkedAt: incoming.isChecked ? now : null
      }).where(
        and7(
          eq7(checklistItems.checklistId, checklist.id),
          eq7(checklistItems.itemKey, incoming.itemKey)
        )
      );
    }
    const refreshedItems = await tx.select().from(checklistItems).where(eq7(checklistItems.checklistId, checklist.id)).orderBy(asc2(checklistItems.sortOrder));
    const allChecked = existingItems.length > 0 && refreshedItems.every((item) => item.isChecked);
    const isComplete = Boolean(params.identityVerified && allChecked);
    const [savedChecklist] = await tx.update(checklists).set({
      identityVerified: params.identityVerified,
      verificationMethod: params.verificationMethod,
      isComplete,
      completedBy: isComplete ? params.actorUserId : null,
      completedAt: isComplete ? now : null,
      updatedAt: now
    }).where(eq7(checklists.id, checklist.id)).returning();
    await writeAuditLog(tx, {
      actorUserId: params.actorUserId,
      action: "CHECKLIST_SAVED",
      entityType: "CHECKLIST",
      entityId: checklist.id,
      metadata: { garmentId: garment.id, department: dept, isComplete },
      ipAddress: params.ipAddress
    });
    return {
      ...savedChecklist,
      items: refreshedItems
    };
  });
  return updated;
}
async function completeGarmentStage(params) {
  const garmentRows = await db.select().from(garments).where(and7(eq7(garments.id, params.garmentId), isNull6(garments.deletedAt))).limit(1);
  if (!garmentRows.length) {
    throw new AppError(404, "GARMENT_NOT_FOUND", "Barang tidak ditemukan.");
  }
  const garment = garmentRows[0];
  if (garment.currentDepartment !== "SPOTTING" && garment.currentDepartment !== "IRONING" && garment.currentDepartment !== "PACKING") {
    throw new AppError(409, "INVALID_STAGE", "Barang tidak berada pada tahap pengerjaan staf.");
  }
  const dept = garment.currentDepartment;
  const checklistRows = await db.select().from(checklists).where(and7(eq7(checklists.garmentId, garment.id), eq7(checklists.department, dept))).limit(1);
  if (!checklistRows.length) {
    throw new AppError(404, "CHECKLIST_NOT_FOUND", "Checklist tidak ditemukan.");
  }
  const checklist = checklistRows[0];
  const items = await db.select().from(checklistItems).where(eq7(checklistItems.checklistId, checklist.id));
  const allChecked = items.length > 0 && items.every((i) => i.isChecked);
  canCompleteStage({
    currentStatus: garment.currentStatus,
    currentDepartment: garment.currentDepartment,
    stageDepartment: dept,
    actorRole: params.actorRole,
    identityVerified: checklist.identityVerified,
    allChecklistItemsChecked: allChecked
  });
  const stageRows = await db.select().from(garmentWorkflowStages).where(eq7(garmentWorkflowStages.garmentId, garment.id)).orderBy(asc2(garmentWorkflowStages.stageOrder));
  const orderedDepts = stageRows.map((s) => s.department);
  const { nextDepartment, nextStatus } = resolveNextWorkflowTarget(orderedDepts, dept);
  const updated = await db.transaction(async (tx) => {
    const now = /* @__PURE__ */ new Date();
    const [row] = await tx.update(garments).set({
      currentDepartment: nextDepartment,
      currentStatus: nextStatus,
      assignedStaffId: null,
      version: garment.version + 1,
      updatedAt: now
    }).where(
      and7(
        eq7(garments.id, garment.id),
        eq7(garments.version, params.version),
        eq7(garments.currentStatus, garment.currentStatus)
      )
    ).returning();
    if (!row) {
      throw new AppError(
        409,
        "CONFLICT_OPTIMISTIC_LOCK",
        "Status barang telah berubah sebelum penyelesaian disimpan. Muat ulang data."
      );
    }
    await tx.update(garmentWorkflowStages).set({
      status: "COMPLETED",
      completedAt: now,
      notes: params.notes?.trim() || null,
      updatedAt: now
    }).where(
      and7(
        eq7(garmentWorkflowStages.garmentId, garment.id),
        eq7(garmentWorkflowStages.department, dept)
      )
    );
    await tx.update(checklists).set({
      isComplete: true,
      completedBy: params.actorUserId,
      completedAt: now,
      updatedAt: now
    }).where(eq7(checklists.id, checklist.id));
    await tx.insert(handoverRecords).values({
      garmentId: garment.id,
      fromDepartment: dept,
      toDepartment: nextDepartment,
      handedOverBy: params.actorUserId,
      physicalTagVerified: checklist.identityVerified,
      conditionNotes: params.notes?.trim() || null,
      handedOverAt: now
    });
    await tx.insert(workflowHistory).values({
      garmentId: garment.id,
      previousStatus: garment.currentStatus,
      newStatus: nextStatus,
      fromDepartment: dept,
      toDepartment: nextDepartment,
      performedBy: params.actorUserId,
      notes: params.notes?.trim() || (nextStatus === "READY_FOR_PICKUP" ? `Pekerjaan divisi ${dept} selesai & diserahkan ke Admin (Siap Diambil)` : `Pekerjaan divisi ${dept} selesai & diserahkan ke divisi ${nextDepartment}`)
    });
    if (nextStatus === "READY_FOR_PICKUP") {
      const siblingGarments = await tx.select({ currentStatus: garments.currentStatus }).from(garments).where(and7(eq7(garments.orderId, garment.orderId), isNull6(garments.deletedAt)));
      if (siblingGarments.length > 0 && siblingGarments.every((g) => g.currentStatus === "READY_FOR_PICKUP")) {
        await tx.update(orders).set({ status: "READY_FOR_PICKUP", updatedAt: now }).where(and7(eq7(orders.id, garment.orderId), eq7(orders.status, "ACTIVE")));
      }
    }
    await writeAuditLog(tx, {
      actorUserId: params.actorUserId,
      action: "WORKFLOW_STAGE_COMPLETED_AND_HANDED_OVER",
      entityType: "GARMENT",
      entityId: garment.id,
      metadata: {
        fromDepartment: dept,
        toDepartment: nextDepartment,
        newStatus: nextStatus
      },
      ipAddress: params.ipAddress
    });
    return row;
  });
  return updated;
}
async function handoverGarmentStage(params) {
  if (!params.physicalTagVerified) {
    throw new AppError(
      422,
      "PHYSICAL_TAG_VERIFICATION_REQUIRED",
      "Konfirmasi verifikasi identitas barang wajib dicentang saat serah terima."
    );
  }
  if (params.idempotencyKey) {
    const existingHandover = await db.select().from(handoverRecords).where(eq7(handoverRecords.idempotencyKey, params.idempotencyKey)).limit(1);
    if (existingHandover.length) {
      const g = await db.select().from(garments).where(eq7(garments.id, params.garmentId)).limit(1);
      return g[0];
    }
  }
  return completeGarmentStage({
    actorUserId: params.actorUserId,
    actorRole: params.actorRole,
    garmentId: params.garmentId,
    version: params.version,
    notes: params.conditionNotes,
    ipAddress: params.ipAddress
  });
}
async function holdGarment(params) {
  const garmentRows = await db.select().from(garments).where(and7(eq7(garments.id, params.garmentId), isNull6(garments.deletedAt))).limit(1);
  if (!garmentRows.length) {
    throw new AppError(404, "GARMENT_NOT_FOUND", "Barang tidak ditemukan.");
  }
  const garment = garmentRows[0];
  if (params.actorRole !== "ADMIN" && params.actorRole !== garment.currentDepartment) {
    throw new AppError(
      403,
      "FORBIDDEN",
      "Anda hanya dapat menahan barang yang sedang berada di divisi Anda."
    );
  }
  canPlaceOnHold(garment.currentStatus);
  const updated = await db.transaction(async (tx) => {
    const now = /* @__PURE__ */ new Date();
    const [row] = await tx.update(garments).set({
      previousStatusBeforeHold: garment.currentStatus,
      previousDepartmentBeforeHold: garment.currentDepartment,
      currentStatus: "ON_HOLD",
      version: garment.version + 1,
      updatedAt: now
    }).where(and7(eq7(garments.id, garment.id), eq7(garments.version, params.version))).returning();
    if (!row) {
      throw new AppError(409, "CONFLICT_OPTIMISTIC_LOCK", "Data barang telah berubah.");
    }
    if (garment.currentDepartment === "SPOTTING" || garment.currentDepartment === "IRONING" || garment.currentDepartment === "PACKING") {
      await tx.update(garmentWorkflowStages).set({ status: "ON_HOLD", updatedAt: now }).where(
        and7(
          eq7(garmentWorkflowStages.garmentId, garment.id),
          eq7(garmentWorkflowStages.department, garment.currentDepartment)
        )
      );
    }
    await tx.insert(workflowHistory).values({
      garmentId: garment.id,
      previousStatus: garment.currentStatus,
      newStatus: "ON_HOLD",
      fromDepartment: garment.currentDepartment,
      toDepartment: garment.currentDepartment,
      performedBy: params.actorUserId,
      notes: `Barang ditahan (ON_HOLD): ${params.reason.trim()}`
    });
    await writeAuditLog(tx, {
      actorUserId: params.actorUserId,
      action: "GARMENT_PUT_ON_HOLD",
      entityType: "GARMENT",
      entityId: garment.id,
      metadata: { reason: params.reason.trim(), previousStatus: garment.currentStatus },
      ipAddress: params.ipAddress
    });
    return row;
  });
  return updated;
}
async function resumeGarment(params) {
  const garmentRows = await db.select().from(garments).where(and7(eq7(garments.id, params.garmentId), isNull6(garments.deletedAt))).limit(1);
  if (!garmentRows.length) {
    throw new AppError(404, "GARMENT_NOT_FOUND", "Barang tidak ditemukan.");
  }
  const garment = garmentRows[0];
  const { restoreStatus, restoreDepartment } = canResumeFromHold(
    garment.currentStatus,
    garment.previousStatusBeforeHold,
    garment.previousDepartmentBeforeHold
  );
  const updated = await db.transaction(async (tx) => {
    const now = /* @__PURE__ */ new Date();
    const [row] = await tx.update(garments).set({
      currentStatus: restoreStatus,
      currentDepartment: restoreDepartment,
      previousStatusBeforeHold: null,
      previousDepartmentBeforeHold: null,
      version: garment.version + 1,
      updatedAt: now
    }).where(and7(eq7(garments.id, garment.id), eq7(garments.version, params.version))).returning();
    if (!row) {
      throw new AppError(409, "CONFLICT_OPTIMISTIC_LOCK", "Data barang telah berubah.");
    }
    const stageStatus = restoreStatus.endsWith("_IN_PROGRESS") ? "IN_PROGRESS" : "PENDING";
    if (restoreDepartment === "SPOTTING" || restoreDepartment === "IRONING" || restoreDepartment === "PACKING") {
      await tx.update(garmentWorkflowStages).set({ status: stageStatus, updatedAt: now }).where(
        and7(
          eq7(garmentWorkflowStages.garmentId, garment.id),
          eq7(garmentWorkflowStages.department, restoreDepartment)
        )
      );
    }
    await tx.insert(workflowHistory).values({
      garmentId: garment.id,
      previousStatus: "ON_HOLD",
      newStatus: restoreStatus,
      fromDepartment: garment.currentDepartment,
      toDepartment: restoreDepartment,
      performedBy: params.actorUserId,
      notes: params.notes?.trim() || `Proses dilanjutkan oleh Admin ke status ${restoreStatus}`
    });
    await writeAuditLog(tx, {
      actorUserId: params.actorUserId,
      action: "GARMENT_HOLD_RESUMED",
      entityType: "GARMENT",
      entityId: garment.id,
      metadata: { restoreStatus, restoreDepartment },
      ipAddress: params.ipAddress
    });
    return row;
  });
  return updated;
}
async function reportGarmentIssue(params) {
  const garmentRows = await db.select().from(garments).where(and7(eq7(garments.id, params.garmentId), isNull6(garments.deletedAt))).limit(1);
  if (!garmentRows.length) {
    throw new AppError(404, "GARMENT_NOT_FOUND", "Barang tidak ditemukan.");
  }
  const garment = garmentRows[0];
  if (params.actorRole !== "ADMIN" && params.actorRole !== garment.currentDepartment) {
    throw new AppError(
      403,
      "FORBIDDEN",
      "Staf hanya dapat melaporkan kendala untuk barang di divisinya."
    );
  }
  if (params.putsGarmentOnHold) {
    canPlaceOnHold(garment.currentStatus);
  }
  const created = await db.transaction(async (tx) => {
    const now = /* @__PURE__ */ new Date();
    const [issue] = await tx.insert(issueReports).values({
      garmentId: garment.id,
      department: garment.currentDepartment,
      reportedBy: params.actorUserId,
      issueType: params.issueType,
      severity: params.severity,
      description: params.description.trim(),
      putsGarmentOnHold: params.putsGarmentOnHold,
      resolutionStatus: "OPEN"
    }).returning();
    if (params.issueType === "MISSING_TAG") {
      await tx.update(garments).set({ tagStatus: "MISSING", updatedAt: now }).where(eq7(garments.id, garment.id));
    }
    if (params.putsGarmentOnHold) {
      const [held] = await tx.update(garments).set({
        previousStatusBeforeHold: garment.currentStatus,
        previousDepartmentBeforeHold: garment.currentDepartment,
        currentStatus: "ON_HOLD",
        version: garment.version + 1,
        updatedAt: now
      }).where(and7(eq7(garments.id, garment.id), eq7(garments.version, params.version))).returning();
      if (!held) {
        throw new AppError(409, "CONFLICT_OPTIMISTIC_LOCK", "Data barang telah berubah.");
      }
      if (garment.currentDepartment === "SPOTTING" || garment.currentDepartment === "IRONING" || garment.currentDepartment === "PACKING") {
        await tx.update(garmentWorkflowStages).set({ status: "ON_HOLD", updatedAt: now }).where(
          and7(
            eq7(garmentWorkflowStages.garmentId, garment.id),
            eq7(garmentWorkflowStages.department, garment.currentDepartment)
          )
        );
      }
      await tx.insert(workflowHistory).values({
        garmentId: garment.id,
        previousStatus: garment.currentStatus,
        newStatus: "ON_HOLD",
        fromDepartment: garment.currentDepartment,
        toDepartment: garment.currentDepartment,
        performedBy: params.actorUserId,
        notes: `Kendala dilaporkan (${params.issueType}): ${params.description.trim()}`
      });
    }
    await writeAuditLog(tx, {
      actorUserId: params.actorUserId,
      action: "ISSUE_REPORTED",
      entityType: "ISSUE_REPORT",
      entityId: issue.id,
      metadata: {
        garmentId: garment.id,
        issueType: params.issueType,
        severity: params.severity,
        putsGarmentOnHold: params.putsGarmentOnHold
      },
      ipAddress: params.ipAddress
    });
    return issue;
  });
  return created;
}
async function listIssues(params) {
  const filters = [];
  if (params.status) {
    filters.push(eq7(issueReports.resolutionStatus, params.status));
  }
  if (params.actorRole !== "ADMIN") {
    filters.push(eq7(issueReports.department, params.actorRole));
  }
  const rows = await db.select({
    issue: issueReports,
    garmentCode: garments.garmentCode,
    garmentName: garments.garmentName,
    physicalTagNumber: garments.physicalTagNumber,
    orderCode: orders.orderCode,
    customerName: orders.customerName,
    reportedByName: users.fullName
  }).from(issueReports).innerJoin(garments, eq7(issueReports.garmentId, garments.id)).innerJoin(orders, eq7(garments.orderId, orders.id)).innerJoin(users, eq7(issueReports.reportedBy, users.id)).where(filters.length ? and7(...filters) : void 0).orderBy(desc4(issueReports.createdAt)).limit(100);
  return rows.map((r) => ({
    ...r.issue,
    garmentCode: r.garmentCode,
    garmentName: r.garmentName,
    physicalTagNumber: r.physicalTagNumber,
    orderCode: r.orderCode,
    customerName: r.customerName,
    reportedByName: r.reportedByName
  }));
}
async function resolveIssue(params) {
  const existing = await db.select().from(issueReports).where(eq7(issueReports.id, params.issueId)).limit(1);
  if (!existing.length) {
    throw new AppError(404, "ISSUE_NOT_FOUND", "Laporan kendala tidak ditemukan.");
  }
  const [updated] = await db.transaction(async (tx) => {
    const row = await tx.update(issueReports).set({
      resolutionStatus: "RESOLVED",
      resolvedBy: params.actorUserId,
      resolutionNotes: params.resolutionNotes.trim(),
      resolvedAt: /* @__PURE__ */ new Date(),
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq7(issueReports.id, params.issueId)).returning();
    await writeAuditLog(tx, {
      actorUserId: params.actorUserId,
      action: "ISSUE_RESOLVED",
      entityType: "ISSUE_REPORT",
      entityId: params.issueId,
      metadata: { garmentId: existing[0].garmentId },
      ipAddress: params.ipAddress
    });
    return row;
  });
  return updated;
}
async function getStaffWorkHistory(userId) {
  const rows = await db.select({
    history: workflowHistory,
    garmentCode: garments.garmentCode,
    garmentName: garments.garmentName,
    physicalTagNumber: garments.physicalTagNumber,
    orderCode: orders.orderCode,
    customerName: orders.customerName
  }).from(workflowHistory).innerJoin(garments, eq7(workflowHistory.garmentId, garments.id)).innerJoin(orders, eq7(garments.orderId, orders.id)).where(eq7(workflowHistory.performedBy, userId)).orderBy(desc4(workflowHistory.createdAt)).limit(50);
  return rows.map((r) => ({
    ...r.history,
    garmentCode: r.garmentCode,
    garmentName: r.garmentName,
    physicalTagNumber: r.physicalTagNumber,
    orderCode: r.orderCode,
    customerName: r.customerName
  }));
}

// src/server/routes/api.ts
var upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 2 }
});
function parseBody(schema, payload) {
  const result = schema.safeParse(payload);
  if (!result.success) {
    throw new AppError(400, "VALIDATION_ERROR", "Data masukan tidak valid.", {
      issues: result.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message
      }))
    });
  }
  return result.data;
}
function getClientIp(req) {
  return req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip || "unknown";
}
var UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function assertUuid(value, field = "id") {
  if (typeof value !== "string" || !UUID_REGEX.test(value)) {
    throw new AppError(400, "INVALID_UUID", `Format ${field} tidak valid.`);
  }
  return value;
}
function createApiV1Router() {
  const router = Router();
  router.get("/health", (_req, res) => {
    res.json({ data: { status: "ok", service: "almos-tracking-api", version: "v1" } });
  });
  router.get("/openapi.json", (_req, res) => {
    res.json({
      openapi: "3.0.3",
      info: {
        title: "ALMOS Laundry Detailing \u2014 Garment Tracking API",
        version: "1.0.0",
        description: "Internal operations, workflow state machine, and garment tracking REST API."
      },
      paths: {
        "/api/v1/auth/status": { get: { summary: "Check initial admin bootstrap state" } },
        "/api/v1/auth/bootstrap-admin": { post: { summary: "Create first admin account when DB is empty" } },
        "/api/v1/auth/login": { post: { summary: "Password login (HttpOnly cookie + Bearer token)" } },
        "/api/v1/auth/firebase-login": { post: { summary: "Google Firebase ID token login" } },
        "/api/v1/auth/logout": { post: { summary: "Revoke session & clear cookie" } },
        "/api/v1/auth/me": { get: { summary: "Get authenticated user profile and role" } },
        "/api/v1/users": { get: { summary: "List users (Admin)" }, post: { summary: "Create staff/admin user (Admin)" } },
        "/api/v1/users/{id}": { get: { summary: "Get user (Admin)" }, patch: { summary: "Update user role/status (Admin)" } },
        "/api/v1/orders": { get: { summary: "List active orders (Admin)" }, post: { summary: "Create order (Admin)" } },
        "/api/v1/orders/{id}": { get: { summary: "Order details" }, patch: { summary: "Update order (Admin)" } },
        "/api/v1/orders/{id}/cancel": { post: { summary: "Cancel order with reason (Admin)" } },
        "/api/v1/orders/{id}/pickup": { post: { summary: "Confirm order pickup and archive (Admin)" } },
        "/api/v1/garments": { get: { summary: "List garments" }, post: { summary: "Register garment (Admin)" } },
        "/api/v1/garments/{id}": { get: { summary: "Garment details" }, patch: { summary: "Update descriptive fields (Admin)" } },
        "/api/v1/garments/{id}/history": { get: { summary: "Garment workflow timeline & handovers" } },
        "/api/v1/garments/{id}/photos": { post: { summary: "Upload garment photo" } },
        "/api/v1/photos": { get: { summary: "Paginated photo gallery" } },
        "/api/v1/photos/{id}/file": { get: { summary: "Authenticated private photo stream" } },
        "/api/v1/photos/{id}": { delete: { summary: "Soft-delete photo with audit log (Admin)" } },
        "/api/v1/garments/{id}/start": { post: { summary: "Start assigned department stage" } },
        "/api/v1/garments/{id}/checklist": { get: { summary: "Get garment checklist" }, post: { summary: "Save checklist progress" } },
        "/api/v1/garments/{id}/complete": { post: { summary: "Complete stage & hand over" } },
        "/api/v1/garments/{id}/handover": { post: { summary: "Idempotent handover to next stage" } },
        "/api/v1/garments/{id}/hold": { post: { summary: "Place garment on hold" } },
        "/api/v1/garments/{id}/resume": { post: { summary: "Resume garment from hold (Admin)" } },
        "/api/v1/garments/{id}/issues": { post: { summary: "Report garment issue" } },
        "/api/v1/issues": { get: { summary: "List issue reports" } },
        "/api/v1/issues/{id}/resolve": { patch: { summary: "Resolve issue report (Admin)" } },
        "/api/v1/archive": { get: { summary: "Search archived orders (Admin)" } },
        "/api/v1/reports/overview": { get: { summary: "Admin live operational overview" } },
        "/api/v1/reports/departments": { get: { summary: "Department queue metrics" } },
        "/api/v1/reports/completed": { get: { summary: "Operational analytics breakdown" } },
        "/api/v1/search": { get: { summary: "Global search across orders, garments, tags" } }
      }
    });
  });
  router.get(
    "/auth/status",
    asyncHandler(async (_req, res) => {
      const status = await getSystemAuthStatus();
      res.json({ data: status });
    })
  );
  router.post(
    "/auth/bootstrap-admin",
    loginRateLimiter,
    asyncHandler(async (req, res) => {
      const body = parseBody(
        z.object({
          fullName: z.string().min(2, "Nama lengkap minimal 2 karakter").max(120),
          username: z.string().min(3, "Username minimal 3 karakter").max(48).regex(/^[a-zA-Z0-9._-]+$/, "Username hanya boleh huruf, angka, titik, garis bawah, atau strip"),
          email: z.string().email("Format email tidak valid"),
          password: z.string().min(8, "Kata sandi minimal 8 karakter").max(128)
        }),
        req.body
      );
      const { user, sessionToken } = await bootstrapFirstAdmin({
        ...body,
        ipAddress: getClientIp(req),
        userAgent: req.headers["user-agent"]
      });
      setSessionCookie(res, sessionToken);
      res.status(201).json({ data: { user, sessionToken } });
    })
  );
  router.post(
    "/auth/login",
    loginRateLimiter,
    asyncHandler(async (req, res) => {
      const body = parseBody(
        z.object({
          identifier: z.string().min(2, "Masukkan username atau email"),
          password: z.string().min(1, "Masukkan kata sandi"),
          portal: z.enum(["ADMIN", "EMPLOYEE"]).optional(),
          selectedDivision: z.enum(["SPOTTING", "IRONING", "PACKING"]).optional()
        }),
        req.body
      );
      const { user, sessionToken } = await loginWithPassword({
        ...body,
        ipAddress: getClientIp(req),
        userAgent: req.headers["user-agent"]
      });
      setSessionCookie(res, sessionToken);
      res.json({ data: { user, sessionToken } });
    })
  );
  router.post(
    "/auth/firebase-login",
    loginRateLimiter,
    asyncHandler(async (req, res) => {
      const body = parseBody(
        z.object({
          idToken: z.string().min(10, "Token Google tidak valid"),
          portal: z.enum(["ADMIN", "EMPLOYEE"]).optional(),
          selectedDivision: z.enum(["SPOTTING", "IRONING", "PACKING"]).optional()
        }),
        req.body
      );
      const { user, sessionToken } = await loginWithFirebaseToken({
        idToken: body.idToken,
        portal: body.portal,
        selectedDivision: body.selectedDivision,
        ipAddress: getClientIp(req),
        userAgent: req.headers["user-agent"]
      });
      setSessionCookie(res, sessionToken);
      res.json({ data: { user, sessionToken } });
    })
  );
  router.post(
    "/auth/logout",
    requireAuth,
    asyncHandler(async (req, res) => {
      await revokeSession(req.sessionTokenHash, req.authUser?.id, getClientIp(req));
      clearSessionCookie(res);
      res.json({ data: { loggedOut: true } });
    })
  );
  router.get(
    "/auth/me",
    requireAuth,
    asyncHandler(async (req, res) => {
      res.json({ data: req.authUser });
    })
  );
  router.get(
    "/users",
    requireAuth,
    requireRole("ADMIN"),
    asyncHandler(async (_req, res) => {
      const data = await listUsers();
      res.json({ data });
    })
  );
  router.post(
    "/users",
    requireAuth,
    requireRole("ADMIN"),
    asyncHandler(async (req, res) => {
      const body = parseBody(
        z.object({
          fullName: z.string().min(2).max(120),
          username: z.string().min(3).max(48).regex(/^[a-zA-Z0-9._-]+$/),
          email: z.string().email(),
          role: z.enum(["ADMIN", "SPOTTING", "IRONING", "PACKING"]),
          password: z.string().min(8).max(128).optional()
        }),
        req.body
      );
      const created = await createStaffUser({
        actorUserId: req.authUser.id,
        ...body,
        ipAddress: getClientIp(req)
      });
      res.status(201).json({ data: created });
    })
  );
  router.get(
    "/users/:id",
    requireAuth,
    requireRole("ADMIN"),
    asyncHandler(async (req, res) => {
      const userId = assertUuid(req.params.id, "user_id");
      const user = await getUserById(userId);
      res.json({ data: user });
    })
  );
  router.patch(
    "/users/:id",
    requireAuth,
    requireRole("ADMIN"),
    asyncHandler(async (req, res) => {
      const targetUserId = assertUuid(req.params.id, "user_id");
      const body = parseBody(
        z.object({
          fullName: z.string().min(2).max(120).optional(),
          role: z.enum(["ADMIN", "SPOTTING", "IRONING", "PACKING"]).optional(),
          isActive: z.boolean().optional(),
          password: z.string().min(8).max(128).optional()
        }),
        req.body
      );
      const updated = await updateStaffUser({
        actorUserId: req.authUser.id,
        targetUserId,
        ...body,
        ipAddress: getClientIp(req)
      });
      res.json({ data: updated });
    })
  );
  router.get(
    "/workflow-templates",
    requireAuth,
    asyncHandler(async (_req, res) => {
      const templates = await listWorkflowTemplates();
      res.json({ data: templates });
    })
  );
  router.get(
    "/settings",
    requireAuth,
    requireRole("ADMIN"),
    asyncHandler(async (_req, res) => {
      const data = await getSystemSettings();
      res.json({ data });
    })
  );
  router.patch(
    "/settings/:key",
    requireAuth,
    requireRole("ADMIN"),
    asyncHandler(async (req, res) => {
      const key = String(req.params.key || "");
      if (!["sla_hours", "photo_policy", "checklist_templates"].includes(key)) {
        throw new AppError(400, "INVALID_SETTING_KEY", "Kunci pengaturan tidak dikenali.");
      }
      const body = parseBody(z.object({ value: z.unknown() }), req.body);
      const data = await updateSystemSetting({
        actorUserId: req.authUser.id,
        key,
        value: body.value,
        ipAddress: getClientIp(req)
      });
      res.json({ data });
    })
  );
  router.post(
    "/orders",
    requireAuth,
    requireRole("ADMIN"),
    asyncHandler(async (req, res) => {
      const body = parseBody(
        z.object({
          customerName: z.string().min(2).max(160),
          customerPhone: z.string().min(6).max(40),
          orderCategory: z.enum([
            "INDIVIDUAL",
            "VILLA",
            "HOTEL",
            "WEDDING_ORGANIZER",
            "SALON",
            "OTHER_VENDOR"
          ]),
          expectedCompletionAt: z.string().nullable().optional(),
          notes: z.string().max(1e3).nullable().optional()
        }),
        req.body
      );
      const created = await createOrder({
        actorUserId: req.authUser.id,
        ...body,
        ipAddress: getClientIp(req)
      });
      res.status(201).json({ data: created });
    })
  );
  router.get(
    "/orders",
    requireAuth,
    requireRole("ADMIN"),
    asyncHandler(async (req, res) => {
      const query = parseBody(
        z.object({
          page: z.coerce.number().int().min(1).default(1),
          perPage: z.coerce.number().int().min(1).max(100).default(20),
          search: z.string().optional(),
          status: z.enum(["ACTIVE", "READY_FOR_PICKUP", "ARCHIVED", "CANCELLED", "ALL_ACTIVE"]).optional(),
          category: z.enum(["INDIVIDUAL", "VILLA", "HOTEL", "WEDDING_ORGANIZER", "SALON", "OTHER_VENDOR"]).optional()
        }),
        req.query
      );
      const result = await listOrders(query);
      res.json({ data: result.items, meta: result.meta });
    })
  );
  router.get(
    "/orders/:id",
    requireAuth,
    requireRole("ADMIN"),
    asyncHandler(async (req, res) => {
      const orderId = assertUuid(req.params.id, "order_id");
      const order = await getOrderById(orderId);
      res.json({ data: order });
    })
  );
  router.patch(
    "/orders/:id",
    requireAuth,
    requireRole("ADMIN"),
    asyncHandler(async (req, res) => {
      const orderId = assertUuid(req.params.id, "order_id");
      const body = parseBody(
        z.object({
          version: z.number().int().min(1),
          customerName: z.string().min(2).max(160).optional(),
          customerPhone: z.string().min(6).max(40).optional(),
          orderCategory: z.enum(["INDIVIDUAL", "VILLA", "HOTEL", "WEDDING_ORGANIZER", "SALON", "OTHER_VENDOR"]).optional(),
          expectedCompletionAt: z.string().nullable().optional(),
          notes: z.string().max(1e3).nullable().optional()
        }),
        req.body
      );
      const updated = await updateOrder({
        actorUserId: req.authUser.id,
        orderId,
        ...body,
        ipAddress: getClientIp(req)
      });
      res.json({ data: updated });
    })
  );
  router.post(
    "/orders/:id/cancel",
    requireAuth,
    requireRole("ADMIN"),
    asyncHandler(async (req, res) => {
      const orderId = assertUuid(req.params.id, "order_id");
      const body = parseBody(
        z.object({ reason: z.string().min(3, "Alasan pembatalan wajib diisi").max(500) }),
        req.body
      );
      const updated = await cancelOrder({
        actorUserId: req.authUser.id,
        orderId,
        reason: body.reason,
        ipAddress: getClientIp(req)
      });
      res.json({ data: updated });
    })
  );
  router.post(
    "/orders/:id/pickup",
    requireAuth,
    requireRole("ADMIN"),
    asyncHandler(async (req, res) => {
      const orderId = assertUuid(req.params.id, "order_id");
      const body = parseBody(
        z.object({
          recipientName: z.string().min(2, "Nama penerima wajib diisi").max(160),
          recipientPhone: z.string().max(40).nullable().optional(),
          verificationNotes: z.string().max(500).nullable().optional(),
          expectedGarmentCount: z.number().int().min(1),
          idempotencyKey: z.string().max(120).optional()
        }),
        req.body
      );
      const pickup = await confirmOrderPickup({
        actorUserId: req.authUser.id,
        orderId,
        ...body,
        ipAddress: getClientIp(req)
      });
      res.status(201).json({ data: pickup });
    })
  );
  router.post(
    "/garments",
    requireAuth,
    requireRole("ADMIN"),
    asyncHandler(async (req, res) => {
      const body = parseBody(
        z.object({
          orderId: z.string().regex(UUID_REGEX, "ID pesanan tidak valid"),
          templateCode: z.string().min(2).max(64).default("FULL_DETAILING"),
          garmentName: z.string().min(2).max(160),
          category: z.string().min(2).max(80),
          garmentType: z.string().min(2).max(80),
          brand: z.string().max(80).nullable().optional(),
          color: z.string().min(2).max(64),
          size: z.string().max(32).nullable().optional(),
          physicalTagNumber: z.string().min(1, "Nomor tag fisik wajib diisi").max(64),
          distinctiveFeatures: z.string().max(500).nullable().optional(),
          initialCondition: z.string().min(2).max(500),
          stainDescription: z.string().max(500).nullable().optional(),
          specialInstructions: z.string().max(500).nullable().optional()
        }),
        req.body
      );
      const created = await registerGarment({
        actorUserId: req.authUser.id,
        ...body,
        ipAddress: getClientIp(req)
      });
      res.status(201).json({ data: created });
    })
  );
  router.get(
    "/garments",
    requireAuth,
    asyncHandler(async (req, res) => {
      const query = parseBody(
        z.object({
          page: z.coerce.number().int().min(1).default(1),
          perPage: z.coerce.number().int().min(1).max(100).default(20),
          search: z.string().optional(),
          status: z.enum([
            "REGISTERED",
            "WAITING_SPOTTING",
            "SPOTTING_IN_PROGRESS",
            "WAITING_IRONING",
            "IRONING_IN_PROGRESS",
            "WAITING_PACKING",
            "PACKING_IN_PROGRESS",
            "READY_FOR_PICKUP",
            "ON_HOLD",
            "PICKED_UP"
          ]).optional(),
          department: z.string().optional(),
          orderId: z.string().optional(),
          includeArchived: z.coerce.boolean().optional()
        }),
        req.query
      );
      const result = await listGarments({
        ...query,
        actorRole: req.authUser.role
      });
      res.json({ data: result.items, meta: result.meta });
    })
  );
  router.get(
    "/garments/:id",
    requireAuth,
    asyncHandler(async (req, res) => {
      const garmentId = assertUuid(req.params.id, "garment_id");
      const garment = await getGarmentById(garmentId);
      res.json({ data: garment });
    })
  );
  router.patch(
    "/garments/:id",
    requireAuth,
    requireRole("ADMIN"),
    asyncHandler(async (req, res) => {
      const garmentId = assertUuid(req.params.id, "garment_id");
      if (req.body && ("currentStatus" in req.body || "current_status" in req.body || "currentDepartment" in req.body || "current_department" in req.body)) {
        throw new AppError(
          400,
          "DIRECT_STATUS_UPDATE_FORBIDDEN",
          "Perubahan status barang tidak diperbolehkan melalui PATCH. Gunakan endpoint workflow resmi."
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
          tagStatus: z.enum(["ATTACHED", "MISSING", "REPLACED"]).optional(),
          distinctiveFeatures: z.string().max(500).nullable().optional(),
          initialCondition: z.string().min(2).max(500).optional(),
          stainDescription: z.string().max(500).nullable().optional(),
          specialInstructions: z.string().max(500).nullable().optional()
        }),
        req.body
      );
      const updated = await updateGarmentDetails({
        actorUserId: req.authUser.id,
        garmentId,
        ...body,
        ipAddress: getClientIp(req)
      });
      res.json({ data: updated });
    })
  );
  router.get(
    "/garments/:id/history",
    requireAuth,
    asyncHandler(async (req, res) => {
      const garmentId = assertUuid(req.params.id, "garment_id");
      const data = await getGarmentHistory(garmentId);
      res.json({ data });
    })
  );
  router.post(
    "/garments/:id/photos",
    requireAuth,
    upload.fields([
      { name: "file", maxCount: 1 },
      { name: "thumbnail", maxCount: 1 }
    ]),
    asyncHandler(async (req, res) => {
      const garmentId = assertUuid(req.params.id, "garment_id");
      const files = req.files;
      const mainFile = files?.file?.[0];
      if (!mainFile) {
        throw new AppError(400, "FILE_REQUIRED", "File foto wajib dipilih.");
      }
      const body = parseBody(
        z.object({
          photoType: z.enum(["FRONT", "BACK", "LABEL", "TAG", "DETAIL", "OTHER"]).default("FRONT"),
          caption: z.string().max(240).nullable().optional()
        }),
        req.body
      );
      const thumbFile = files?.thumbnail?.[0];
      const photo = await addGarmentPhoto({
        actorUserId: req.authUser.id,
        garmentId,
        photoType: body.photoType,
        caption: body.caption,
        originalBuffer: mainFile.buffer,
        thumbnailBuffer: thumbFile?.buffer,
        ipAddress: getClientIp(req)
      });
      res.status(201).json({ data: photo });
    })
  );
  router.get(
    "/garments/:id/photos",
    requireAuth,
    asyncHandler(async (req, res) => {
      const garmentId = assertUuid(req.params.id, "garment_id");
      const result = await listPhotosGallery({ page: 1, perPage: 50, garmentId });
      res.json({ data: result.items, meta: result.meta });
    })
  );
  router.get(
    "/photos",
    requireAuth,
    asyncHandler(async (req, res) => {
      const query = parseBody(
        z.object({
          page: z.coerce.number().int().min(1).default(1),
          perPage: z.coerce.number().int().min(1).max(60).default(24),
          photoType: z.enum(["FRONT", "BACK", "LABEL", "TAG", "DETAIL", "OTHER"]).optional(),
          search: z.string().optional()
        }),
        req.query
      );
      const result = await listPhotosGallery(query);
      res.json({ data: result.items, meta: result.meta });
    })
  );
  router.get(
    "/photos/:id/file",
    requireAuth,
    asyncHandler(async (req, res) => {
      const photoId = assertUuid(req.params.id, "photo_id");
      const variant = req.query.variant === "thumb" ? "thumb" : "original";
      const meta = await getPhotoMetadata(photoId);
      const objectPath = variant === "thumb" ? meta.thumbnailPath : meta.storagePath;
      const { buffer, contentType } = await readPhotoObject({
        storageProvider: meta.storageProvider,
        objectPath
      });
      res.setHeader("Content-Type", contentType || meta.mimeType || "image/jpeg");
      res.setHeader("Cache-Control", "private, max-age=300");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.send(buffer);
    })
  );
  router.delete(
    "/photos/:id",
    requireAuth,
    requireRole("ADMIN"),
    asyncHandler(async (req, res) => {
      const photoId = assertUuid(req.params.id, "photo_id");
      await softDeletePhoto({
        actorUserId: req.authUser.id,
        photoId,
        ipAddress: getClientIp(req)
      });
      res.json({ data: { deleted: true } });
    })
  );
  router.get(
    "/staff/queue",
    requireAuth,
    requireRole("SPOTTING", "IRONING", "PACKING"),
    asyncHandler(async (req, res) => {
      const statusFilter = req.query.status === "WAITING" || req.query.status === "IN_PROGRESS" || req.query.status === "ON_HOLD" ? req.query.status : "ALL";
      const dept = req.authUser.role;
      const items = await getStaffDepartmentQueue({
        department: dept,
        statusFilter
      });
      res.json({ data: items });
    })
  );
  router.get(
    "/staff/dashboard",
    requireAuth,
    requireRole("SPOTTING", "IRONING", "PACKING"),
    asyncHandler(async (req, res) => {
      const dept = req.authUser.role;
      const data = await getStaffDashboardSummary({
        department: dept,
        userId: req.authUser.id
      });
      res.json({ data });
    })
  );
  router.get(
    "/staff/history",
    requireAuth,
    asyncHandler(async (req, res) => {
      const data = await getStaffWorkHistory(req.authUser.id);
      res.json({ data });
    })
  );
  router.post(
    "/garments/:id/start",
    requireAuth,
    requireRole("SPOTTING", "IRONING", "PACKING"),
    asyncHandler(async (req, res) => {
      const garmentId = assertUuid(req.params.id, "garment_id");
      const body = parseBody(
        z.object({
          version: z.number().int().min(1),
          verificationMethod: z.enum(["PHYSICAL_TAG", "PHOTO_AND_DETAILS_BACKUP"]).default("PHYSICAL_TAG"),
          notes: z.string().max(500).nullable().optional()
        }),
        req.body
      );
      const updated = await startGarmentStage({
        actorUserId: req.authUser.id,
        actorRole: req.authUser.role,
        garmentId,
        ...body,
        ipAddress: getClientIp(req)
      });
      res.json({ data: updated });
    })
  );
  router.get(
    "/garments/:id/checklist",
    requireAuth,
    asyncHandler(async (req, res) => {
      const garmentId = assertUuid(req.params.id, "garment_id");
      const data = await getGarmentCurrentChecklist(garmentId, req.authUser.role);
      res.json({ data });
    })
  );
  router.post(
    "/garments/:id/checklist",
    requireAuth,
    requireRole("SPOTTING", "IRONING", "PACKING"),
    asyncHandler(async (req, res) => {
      const garmentId = assertUuid(req.params.id, "garment_id");
      const body = parseBody(
        z.object({
          identityVerified: z.boolean(),
          verificationMethod: z.enum(["PHYSICAL_TAG", "PHOTO_AND_DETAILS_BACKUP"]).default("PHYSICAL_TAG"),
          items: z.array(
            z.object({
              itemKey: z.string().min(1),
              isChecked: z.boolean(),
              note: z.string().max(300).nullable().optional()
            })
          ).min(1)
        }),
        req.body
      );
      const data = await saveGarmentChecklist({
        actorUserId: req.authUser.id,
        actorRole: req.authUser.role,
        garmentId,
        ...body,
        ipAddress: getClientIp(req)
      });
      res.json({ data });
    })
  );
  router.post(
    "/garments/:id/complete",
    requireAuth,
    requireRole("SPOTTING", "IRONING", "PACKING"),
    asyncHandler(async (req, res) => {
      const garmentId = assertUuid(req.params.id, "garment_id");
      const body = parseBody(
        z.object({
          version: z.number().int().min(1),
          notes: z.string().max(500).nullable().optional()
        }),
        req.body
      );
      const updated = await completeGarmentStage({
        actorUserId: req.authUser.id,
        actorRole: req.authUser.role,
        garmentId,
        ...body,
        ipAddress: getClientIp(req)
      });
      res.json({ data: updated });
    })
  );
  router.post(
    "/garments/:id/handover",
    requireAuth,
    requireRole("SPOTTING", "IRONING", "PACKING"),
    asyncHandler(async (req, res) => {
      const garmentId = assertUuid(req.params.id, "garment_id");
      const body = parseBody(
        z.object({
          version: z.number().int().min(1),
          physicalTagVerified: z.boolean(),
          conditionNotes: z.string().max(500).nullable().optional(),
          idempotencyKey: z.string().max(120).optional()
        }),
        req.body
      );
      const updated = await handoverGarmentStage({
        actorUserId: req.authUser.id,
        actorRole: req.authUser.role,
        garmentId,
        ...body,
        ipAddress: getClientIp(req)
      });
      res.json({ data: updated });
    })
  );
  router.post(
    "/garments/:id/hold",
    requireAuth,
    asyncHandler(async (req, res) => {
      const garmentId = assertUuid(req.params.id, "garment_id");
      const body = parseBody(
        z.object({
          version: z.number().int().min(1),
          reason: z.string().min(3, "Alasan penahanan barang wajib diisi").max(500)
        }),
        req.body
      );
      const updated = await holdGarment({
        actorUserId: req.authUser.id,
        actorRole: req.authUser.role,
        garmentId,
        ...body,
        ipAddress: getClientIp(req)
      });
      res.json({ data: updated });
    })
  );
  router.post(
    "/garments/:id/resume",
    requireAuth,
    requireRole("ADMIN"),
    asyncHandler(async (req, res) => {
      const garmentId = assertUuid(req.params.id, "garment_id");
      const body = parseBody(
        z.object({
          version: z.number().int().min(1),
          notes: z.string().max(500).nullable().optional()
        }),
        req.body
      );
      const updated = await resumeGarment({
        actorUserId: req.authUser.id,
        garmentId,
        ...body,
        ipAddress: getClientIp(req)
      });
      res.json({ data: updated });
    })
  );
  router.post(
    "/garments/:id/issues",
    requireAuth,
    asyncHandler(async (req, res) => {
      const garmentId = assertUuid(req.params.id, "garment_id");
      const body = parseBody(
        z.object({
          issueType: z.enum([
            "STAIN_PERSISTS",
            "FABRIC_DAMAGE",
            "MISSING_TAG",
            "MISSING_BUTTON_TRIM",
            "COLOR_BLEED_RISK",
            "OTHER"
          ]),
          severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
          description: z.string().min(5, "Deskripsi kendala minimal 5 karakter").max(1e3),
          putsGarmentOnHold: z.boolean().default(false),
          version: z.number().int().min(1)
        }),
        req.body
      );
      const issue = await reportGarmentIssue({
        actorUserId: req.authUser.id,
        actorRole: req.authUser.role,
        garmentId,
        ...body,
        ipAddress: getClientIp(req)
      });
      res.status(201).json({ data: issue });
    })
  );
  router.get(
    "/issues",
    requireAuth,
    asyncHandler(async (req, res) => {
      const status = req.query.status === "OPEN" || req.query.status === "IN_REVIEW" || req.query.status === "RESOLVED" ? req.query.status : void 0;
      const items = await listIssues({
        actorRole: req.authUser.role,
        status
      });
      res.json({ data: items });
    })
  );
  router.patch(
    "/issues/:id/resolve",
    requireAuth,
    requireRole("ADMIN"),
    asyncHandler(async (req, res) => {
      const issueId = assertUuid(req.params.id, "issue_id");
      const body = parseBody(
        z.object({ resolutionNotes: z.string().min(3).max(500) }),
        req.body
      );
      const updated = await resolveIssue({
        actorUserId: req.authUser.id,
        issueId,
        resolutionNotes: body.resolutionNotes,
        ipAddress: getClientIp(req)
      });
      res.json({ data: updated });
    })
  );
  router.get(
    "/archive",
    requireAuth,
    requireRole("ADMIN"),
    asyncHandler(async (req, res) => {
      const query = parseBody(
        z.object({
          page: z.coerce.number().int().min(1).default(1),
          perPage: z.coerce.number().int().min(1).max(100).default(20),
          search: z.string().optional(),
          category: z.enum(["INDIVIDUAL", "VILLA", "HOTEL", "WEDDING_ORGANIZER", "SALON", "OTHER_VENDOR"]).optional()
        }),
        req.query
      );
      const result = await listArchiveOrders(query);
      res.json({ data: result.items, meta: result.meta });
    })
  );
  router.get(
    "/archive/:orderId",
    requireAuth,
    requireRole("ADMIN"),
    asyncHandler(async (req, res) => {
      const orderId = assertUuid(req.params.orderId, "order_id");
      const data = await getOrderById(orderId);
      res.json({ data });
    })
  );
  router.get(
    "/reports/overview",
    requireAuth,
    requireRole("ADMIN"),
    asyncHandler(async (_req, res) => {
      const data = await getAdminOverview();
      res.json({ data });
    })
  );
  router.get(
    "/reports/departments",
    requireAuth,
    requireRole("ADMIN"),
    asyncHandler(async (_req, res) => {
      const data = await getDepartmentsReport();
      res.json({ data });
    })
  );
  router.get(
    "/reports/completed",
    requireAuth,
    requireRole("ADMIN"),
    asyncHandler(async (_req, res) => {
      const data = await getCompletedReport();
      res.json({ data });
    })
  );
  router.get(
    "/search",
    requireAuth,
    asyncHandler(async (req, res) => {
      const q = typeof req.query.q === "string" ? req.query.q : "";
      const data = await globalSearch(q);
      res.json({ data });
    })
  );
  return router;
}

// src/server/app.ts
function createBackendApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true, limit: "2mb" }));
  app.use(cookieParser());
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
  });
  app.use("/api/v1", createApiV1Router());
  app.use("/api/v1", (_req, _res, next) => {
    next(new AppError(404, "ENDPOINT_NOT_FOUND", "Endpoint API tidak ditemukan."));
  });
  app.use(errorMiddleware);
  return app;
}
function attachProductionSpa(app, distDir) {
  app.use(
    express.static(distDir, {
      index: false,
      maxAge: "1h"
    })
  );
  app.get("*", (req, res, next) => {
    if (req.path === "/api" || req.path.startsWith("/api/")) {
      return next();
    }
    res.sendFile(path2.join(distDir, "index.html"));
  });
}

// server.ts
async function startServer() {
  const app = createBackendApp();
  const port = Number(process.env.PORT || 3e3);
  const distDir = path3.resolve(process.cwd(), "dist");
  if (process.env.NODE_ENV === "production") {
    if (!fs2.existsSync(distDir)) {
      throw new Error(`Production frontend build directory not found: ${distDir}`);
    }
    attachProductionSpa(app, distDir);
  } else {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  }
  const server = app.listen(port, "0.0.0.0", () => {
    console.log(`ALMOS Laundry Tracking Server listening on http://0.0.0.0:${port}`);
  });
  const shutdown = (signal) => {
    console.log(`Received ${signal}, shutting down HTTP server gracefully...`);
    server.close(async () => {
      await closePool().catch((err) => console.error("Error closing SQL pool:", err));
      process.exit(0);
    });
    setTimeout(() => {
      process.exit(1);
    }, 1e4).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}
startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
