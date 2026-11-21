import type {
  Department,
  GarmentStatus,
  OperationalDepartment,
  RoleCode,
} from '../../shared/types.ts';
import { AppError } from '../errors/app-error.ts';

export const WAITING_STATUS_BY_DEPT: Record<OperationalDepartment, GarmentStatus> = {
  SPOTTING: 'WAITING_SPOTTING',
  IRONING: 'WAITING_IRONING',
  PACKING: 'WAITING_PACKING',
};

export const IN_PROGRESS_STATUS_BY_DEPT: Record<OperationalDepartment, GarmentStatus> = {
  SPOTTING: 'SPOTTING_IN_PROGRESS',
  IRONING: 'IRONING_IN_PROGRESS',
  PACKING: 'PACKING_IN_PROGRESS',
};

export function assertDepartmentRole(role: RoleCode, department: OperationalDepartment) {
  if (role !== department) {
    throw new AppError(
      403,
      'DEPARTMENT_ROLE_MISMATCH',
      `Tindakan untuk divisi ${department} hanya dapat dilakukan oleh staf divisi ${department}.`
    );
  }
}

export function canStartStage(params: {
  currentStatus: GarmentStatus;
  currentDepartment: Department;
  stageDepartment: OperationalDepartment;
  actorRole: RoleCode;
}) {
  assertDepartmentRole(params.actorRole, params.stageDepartment);
  const expectedWaiting = WAITING_STATUS_BY_DEPT[params.stageDepartment];
  if (params.currentDepartment !== params.stageDepartment || params.currentStatus !== expectedWaiting) {
    throw new AppError(
      409,
      'INVALID_STATE_TRANSITION',
      `Barang tidak berada pada status ${expectedWaiting} (status saat ini: ${params.currentStatus}).`
    );
  }
  return IN_PROGRESS_STATUS_BY_DEPT[params.stageDepartment];
}

export function canCompleteStage(params: {
  currentStatus: GarmentStatus;
  currentDepartment: Department;
  stageDepartment: OperationalDepartment;
  actorRole: RoleCode;
  identityVerified: boolean;
  allChecklistItemsChecked: boolean;
}) {
  assertDepartmentRole(params.actorRole, params.stageDepartment);
  const expectedInProgress = IN_PROGRESS_STATUS_BY_DEPT[params.stageDepartment];
  if (
    params.currentDepartment !== params.stageDepartment ||
    params.currentStatus !== expectedInProgress
  ) {
    throw new AppError(
      409,
      'INVALID_STATE_TRANSITION',
      `Pekerjaan divisi ${params.stageDepartment} belum dimulai atau sudah selesai (status saat ini: ${params.currentStatus}).`
    );
  }
  if (!params.identityVerified) {
    throw new AppError(
      422,
      'IDENTITY_VERIFICATION_REQUIRED',
      'Verifikasi identitas barang (tag fisik / foto referensi + detail) wajib dicentang sebelum menyelesaikan tugas.'
    );
  }
  if (!params.allChecklistItemsChecked) {
    throw new AppError(
      422,
      'CHECKLIST_INCOMPLETE',
      'Semua item checklist divisi wajib diselesaikan sebelum menyelesaikan pekerjaan.'
    );
  }
}

export function resolveNextWorkflowTarget(
  orderedDepartments: OperationalDepartment[],
  completedDepartment: OperationalDepartment
): { nextDepartment: Department; nextStatus: GarmentStatus } {
  const idx = orderedDepartments.indexOf(completedDepartment);
  if (idx === -1) {
    throw new AppError(
      409,
      'INVALID_STAGE_TEMPLATE',
      `Divisi ${completedDepartment} tidak terdaftar pada template alur barang ini.`
    );
  }
  const nextDept = orderedDepartments[idx + 1];
  if (!nextDept) {
    return {
      nextDepartment: 'PICKUP',
      nextStatus: 'READY_FOR_PICKUP',
    };
  }
  return {
    nextDepartment: nextDept,
    nextStatus: WAITING_STATUS_BY_DEPT[nextDept],
  };
}

export function canPlaceOnHold(currentStatus: GarmentStatus) {
  if (
    currentStatus === 'REGISTERED' ||
    currentStatus === 'READY_FOR_PICKUP' ||
    currentStatus === 'PICKED_UP' ||
    currentStatus === 'ON_HOLD'
  ) {
    throw new AppError(
      409,
      'INVALID_STATE_TRANSITION',
      `Barang dengan status ${currentStatus} tidak dapat dipindahkan ke status ON_HOLD.`
    );
  }
}

export function canResumeFromHold(
  currentStatus: GarmentStatus,
  previousStatus: GarmentStatus | null,
  previousDepartment: Department | null
): { restoreStatus: GarmentStatus; restoreDepartment: Department } {
  if (currentStatus !== 'ON_HOLD' || !previousStatus || !previousDepartment) {
    throw new AppError(
      409,
      'INVALID_STATE_TRANSITION',
      'Barang tidak berada dalam status ON_HOLD yang dapat dilanjutkan.'
    );
  }
  return {
    restoreStatus: previousStatus,
    restoreDepartment: previousDepartment,
  };
}
