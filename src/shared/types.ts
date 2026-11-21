export type RoleCode = 'ADMIN' | 'SPOTTING' | 'IRONING' | 'PACKING';

export type Department = 'ADMIN' | 'SPOTTING' | 'IRONING' | 'PACKING' | 'PICKUP';

export type OperationalDepartment = 'SPOTTING' | 'IRONING' | 'PACKING';

export type OrderCategory =
  | 'INDIVIDUAL'
  | 'VILLA'
  | 'HOTEL'
  | 'WEDDING_ORGANIZER'
  | 'SALON'
  | 'OTHER_VENDOR';

export type OrderStatus = 'ACTIVE' | 'READY_FOR_PICKUP' | 'ARCHIVED' | 'CANCELLED';

export type GarmentStatus =
  | 'REGISTERED'
  | 'WAITING_SPOTTING'
  | 'SPOTTING_IN_PROGRESS'
  | 'WAITING_IRONING'
  | 'IRONING_IN_PROGRESS'
  | 'WAITING_PACKING'
  | 'PACKING_IN_PROGRESS'
  | 'READY_FOR_PICKUP'
  | 'ON_HOLD'
  | 'PICKED_UP';

export type TagStatus = 'ATTACHED' | 'MISSING' | 'REPLACED';

export type PhotoType = 'FRONT' | 'BACK' | 'LABEL' | 'TAG' | 'DETAIL' | 'OTHER';

export type IssueType =
  | 'STAIN_PERSISTS'
  | 'FABRIC_DAMAGE'
  | 'MISSING_TAG'
  | 'MISSING_BUTTON_TRIM'
  | 'COLOR_BLEED_RISK'
  | 'OTHER';

export type IssueSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type ResolutionStatus = 'OPEN' | 'IN_REVIEW' | 'RESOLVED';

export interface AuthUser {
  id: string;
  uid: string | null;
  fullName: string;
  username: string;
  email: string;
  role: RoleCode;
  roleName: string;
  isActive: boolean;
}

export interface PaginationMeta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  data: T;
  meta?: PaginationMeta;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}
