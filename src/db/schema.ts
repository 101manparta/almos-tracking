import { relations } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const roles = pgTable('roles', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: text('code').notNull().unique(), // ADMIN | SPOTTING | IRONING | PACKING
  name: text('name').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    uid: text('uid').unique(), // Firebase Auth UID when linked
    roleId: uuid('role_id')
      .references(() => roles.id)
      .notNull(),
    fullName: text('full_name').notNull(),
    username: text('username').notNull().unique(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash'),
    isActive: boolean('is_active').default(true).notNull(),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_users_role_id').on(table.roleId),
    index('idx_users_email').on(table.email),
  ]
);

export const userSessions = pgTable(
  'user_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    userAgent: text('user_agent'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_user_sessions_user_id').on(table.userId)]
);

export const workflowTemplates = pgTable('workflow_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: text('code').notNull().unique(), // FULL_DETAILING | SPOTTING_IRONING | IRONING_PACKING | PACKING_ONLY
  name: text('name').notNull(),
  description: text('description'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const workflowTemplateStages = pgTable(
  'workflow_template_stages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    templateId: uuid('template_id')
      .references(() => workflowTemplates.id, { onDelete: 'cascade' })
      .notNull(),
    department: text('department').notNull(), // SPOTTING | IRONING | PACKING
    stageOrder: integer('stage_order').notNull(),
    slaHours: integer('sla_hours').default(12).notNull(),
  },
  (table) => [
    uniqueIndex('uq_template_stage_order').on(table.templateId, table.stageOrder),
    uniqueIndex('uq_template_department').on(table.templateId, table.department),
  ]
);

export const orders = pgTable(
  'orders',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orderCode: text('order_code').notNull().unique(),
    customerName: text('customer_name').notNull(),
    customerPhone: text('customer_phone').notNull(),
    orderCategory: text('order_category').notNull(), // INDIVIDUAL | VILLA | HOTEL | WEDDING_ORGANIZER | SALON | OTHER_VENDOR
    expectedCompletionAt: timestamp('expected_completion_at', { withTimezone: true }),
    notes: text('notes'),
    status: text('status').default('ACTIVE').notNull(), // ACTIVE | READY_FOR_PICKUP | ARCHIVED | CANCELLED
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancelReason: text('cancel_reason'),
    createdBy: uuid('created_by')
      .references(() => users.id)
      .notNull(),
    version: integer('version').default(1).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_orders_status_created').on(table.status, table.createdAt),
    index('idx_orders_customer_name').on(table.customerName),
  ]
);

export const garments = pgTable(
  'garments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    garmentCode: text('garment_code').notNull().unique(),
    orderId: uuid('order_id')
      .references(() => orders.id)
      .notNull(),
    templateId: uuid('template_id')
      .references(() => workflowTemplates.id)
      .notNull(),
    garmentName: text('garment_name').notNull(),
    category: text('category').notNull(),
    garmentType: text('garment_type').notNull(),
    brand: text('brand'),
    color: text('color').notNull(),
    size: text('size'),
    physicalTagNumber: text('physical_tag_number').notNull(),
    tagStatus: text('tag_status').default('ATTACHED').notNull(), // ATTACHED | MISSING | REPLACED
    distinctiveFeatures: text('distinctive_features'),
    initialCondition: text('initial_condition').notNull(),
    stainDescription: text('stain_description'),
    specialInstructions: text('special_instructions'),
    currentDepartment: text('current_department').default('ADMIN').notNull(), // ADMIN | SPOTTING | IRONING | PACKING | PICKUP
    currentStatus: text('current_status').default('REGISTERED').notNull(),
    previousStatusBeforeHold: text('previous_status_before_hold'),
    previousDepartmentBeforeHold: text('previous_department_before_hold'),
    assignedStaffId: uuid('assigned_staff_id').references(() => users.id),
    dueAt: timestamp('due_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    registeredBy: uuid('registered_by')
      .references(() => users.id)
      .notNull(),
    version: integer('version').default(1).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_garments_order_id').on(table.orderId),
    index('idx_garments_status_dept').on(table.currentStatus, table.currentDepartment),
    index('idx_garments_physical_tag').on(table.physicalTagNumber),
  ]
);

export const garmentWorkflowStages = pgTable(
  'garment_workflow_stages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    garmentId: uuid('garment_id')
      .references(() => garments.id)
      .notNull(),
    department: text('department').notNull(), // SPOTTING | IRONING | PACKING
    stageOrder: integer('stage_order').notNull(),
    status: text('status').default('PENDING').notNull(), // PENDING | IN_PROGRESS | COMPLETED | ON_HOLD | SKIPPED
    assignedTo: uuid('assigned_to').references(() => users.id),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    dueAt: timestamp('due_at', { withTimezone: true }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('uq_garment_stage_order').on(table.garmentId, table.stageOrder),
    index('idx_garment_stages_dept_status').on(table.department, table.status),
  ]
);

export const garmentPhotos = pgTable(
  'garment_photos',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    garmentId: uuid('garment_id')
      .references(() => garments.id)
      .notNull(),
    photoType: text('photo_type').notNull(), // FRONT | BACK | LABEL | TAG | DETAIL | OTHER
    storageProvider: text('storage_provider').default('LOCAL_PRIVATE').notNull(),
    storagePath: text('storage_path').notNull(),
    thumbnailPath: text('thumbnail_path').notNull(),
    mimeType: text('mime_type').notNull(),
    fileSizeBytes: integer('file_size_bytes').notNull(),
    caption: text('caption'),
    uploadedBy: uuid('uploaded_by')
      .references(() => users.id)
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: uuid('deleted_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_garment_photos_garment').on(table.garmentId, table.photoType)]
);

export const workflowHistory = pgTable(
  'workflow_history',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    garmentId: uuid('garment_id')
      .references(() => garments.id)
      .notNull(),
    previousStatus: text('previous_status').notNull(),
    newStatus: text('new_status').notNull(),
    fromDepartment: text('from_department'),
    toDepartment: text('to_department'),
    performedBy: uuid('performed_by')
      .references(() => users.id)
      .notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_workflow_history_garment').on(table.garmentId, table.createdAt)]
);

export const checklists = pgTable(
  'checklists',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    garmentId: uuid('garment_id')
      .references(() => garments.id)
      .notNull(),
    stageId: uuid('stage_id')
      .references(() => garmentWorkflowStages.id)
      .notNull()
      .unique(),
    department: text('department').notNull(),
    identityVerified: boolean('identity_verified').default(false).notNull(),
    verificationMethod: text('verification_method').default('PHYSICAL_TAG').notNull(), // PHYSICAL_TAG | PHOTO_AND_DETAILS_BACKUP
    isComplete: boolean('is_complete').default(false).notNull(),
    completedBy: uuid('completed_by').references(() => users.id),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_checklists_garment').on(table.garmentId)]
);

export const checklistItems = pgTable(
  'checklist_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    checklistId: uuid('checklist_id')
      .references(() => checklists.id, { onDelete: 'cascade' })
      .notNull(),
    itemKey: text('item_key').notNull(),
    label: text('label').notNull(),
    sortOrder: integer('sort_order').notNull(),
    isChecked: boolean('is_checked').default(false).notNull(),
    note: text('note'),
    checkedBy: uuid('checked_by').references(() => users.id),
    checkedAt: timestamp('checked_at', { withTimezone: true }),
  },
  (table) => [uniqueIndex('uq_checklist_item_key').on(table.checklistId, table.itemKey)]
);

export const handoverRecords = pgTable(
  'handover_records',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    garmentId: uuid('garment_id')
      .references(() => garments.id)
      .notNull(),
    fromDepartment: text('from_department').notNull(),
    toDepartment: text('to_department').notNull(),
    handedOverBy: uuid('handed_over_by')
      .references(() => users.id)
      .notNull(),
    receivedBy: uuid('received_by').references(() => users.id),
    physicalTagVerified: boolean('physical_tag_verified').notNull(),
    conditionNotes: text('condition_notes'),
    idempotencyKey: text('idempotency_key').unique(),
    handedOverAt: timestamp('handed_over_at', { withTimezone: true }).defaultNow().notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true }),
  },
  (table) => [index('idx_handover_garment').on(table.garmentId)]
);

export const issueReports = pgTable(
  'issue_reports',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    garmentId: uuid('garment_id')
      .references(() => garments.id)
      .notNull(),
    department: text('department').notNull(),
    reportedBy: uuid('reported_by')
      .references(() => users.id)
      .notNull(),
    issueType: text('issue_type').notNull(), // STAIN_PERSISTS | FABRIC_DAMAGE | MISSING_TAG | MISSING_BUTTON_TRIM | COLOR_BLEED_RISK | OTHER
    severity: text('severity').notNull(), // LOW | MEDIUM | HIGH | CRITICAL
    description: text('description').notNull(),
    putsGarmentOnHold: boolean('puts_garment_on_hold').default(false).notNull(),
    resolutionStatus: text('resolution_status').default('OPEN').notNull(), // OPEN | IN_REVIEW | RESOLVED
    resolvedBy: uuid('resolved_by').references(() => users.id),
    resolutionNotes: text('resolution_notes'),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_issue_reports_garment_status').on(table.garmentId, table.resolutionStatus)]
);

export const pickupRecords = pgTable('pickup_records', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderId: uuid('order_id')
    .references(() => orders.id)
    .notNull()
    .unique(),
  confirmedBy: uuid('confirmed_by')
    .references(() => users.id)
    .notNull(),
  recipientName: text('recipient_name').notNull(),
  recipientPhone: text('recipient_phone'),
  verificationNotes: text('verification_notes'),
  garmentCount: integer('garment_count').notNull(),
  idempotencyKey: text('idempotency_key').unique(),
  pickedUpAt: timestamp('picked_up_at', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    actorUserId: uuid('actor_user_id').references(() => users.id),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id'),
    metadata: jsonb('metadata').default({}).notNull(),
    ipAddress: text('ip_address'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_audit_logs_entity').on(table.entityType, table.entityId, table.createdAt)]
);

export const systemSettings = pgTable('system_settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedBy: uuid('updated_by').references(() => users.id),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Drizzle Relations
export const rolesRelations = relations(roles, ({ many }) => ({
  users: many(users),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  role: one(roles, { fields: [users.roleId], references: [roles.id] }),
  sessions: many(userSessions),
  createdOrders: many(orders),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  creator: one(users, { fields: [orders.createdBy], references: [users.id] }),
  garments: many(garments),
  pickupRecord: one(pickupRecords, { fields: [orders.id], references: [pickupRecords.orderId] }),
}));

export const workflowTemplatesRelations = relations(workflowTemplates, ({ many }) => ({
  stages: many(workflowTemplateStages),
  garments: many(garments),
}));

export const workflowTemplateStagesRelations = relations(workflowTemplateStages, ({ one }) => ({
  template: one(workflowTemplates, {
    fields: [workflowTemplateStages.templateId],
    references: [workflowTemplates.id],
  }),
}));

export const garmentsRelations = relations(garments, ({ one, many }) => ({
  order: one(orders, { fields: [garments.orderId], references: [orders.id] }),
  template: one(workflowTemplates, { fields: [garments.templateId], references: [workflowTemplates.id] }),
  registrant: one(users, { fields: [garments.registeredBy], references: [users.id] }),
  stages: many(garmentWorkflowStages),
  photos: many(garmentPhotos),
  history: many(workflowHistory),
  checklists: many(checklists),
  handovers: many(handoverRecords),
  issues: many(issueReports),
}));

export const garmentWorkflowStagesRelations = relations(garmentWorkflowStages, ({ one }) => ({
  garment: one(garments, { fields: [garmentWorkflowStages.garmentId], references: [garments.id] }),
  checklist: one(checklists, {
    fields: [garmentWorkflowStages.id],
    references: [checklists.stageId],
  }),
}));

export const checklistsRelations = relations(checklists, ({ one, many }) => ({
  garment: one(garments, { fields: [checklists.garmentId], references: [garments.id] }),
  stage: one(garmentWorkflowStages, { fields: [checklists.stageId], references: [garmentWorkflowStages.id] }),
  items: many(checklistItems),
}));

export const checklistItemsRelations = relations(checklistItems, ({ one }) => ({
  checklist: one(checklists, { fields: [checklistItems.checklistId], references: [checklists.id] }),
}));
