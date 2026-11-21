import { describe, expect, it } from 'vitest';
import { AppError } from '../src/server/errors/app-error.ts';
import {
  assertDepartmentRole,
  canCompleteStage,
  canPlaceOnHold,
  canResumeFromHold,
  canStartStage,
  resolveNextWorkflowTarget,
} from '../src/server/services/workflow.rules.ts';

describe('Workflow State Machine Rules', () => {
  it('allows matching department staff to start a waiting stage', () => {
    const nextStatus = canStartStage({
      currentStatus: 'WAITING_SPOTTING',
      currentDepartment: 'SPOTTING',
      stageDepartment: 'SPOTTING',
      actorRole: 'SPOTTING',
    });
    expect(nextStatus).toBe('SPOTTING_IN_PROGRESS');
  });

  it('rejects cross-department start attempts with 403', () => {
    expect(() =>
      canStartStage({
        currentStatus: 'WAITING_SPOTTING',
        currentDepartment: 'SPOTTING',
        stageDepartment: 'SPOTTING',
        actorRole: 'IRONING',
      })
    ).toThrowError(AppError);

    try {
      assertDepartmentRole('PACKING', 'IRONING');
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(403);
      expect((err as AppError).code).toBe('DEPARTMENT_ROLE_MISMATCH');
    }
  });

  it('rejects starting an already started or mismatched stage with 409', () => {
    try {
      canStartStage({
        currentStatus: 'SPOTTING_IN_PROGRESS',
        currentDepartment: 'SPOTTING',
        stageDepartment: 'SPOTTING',
        actorRole: 'SPOTTING',
      });
      expect.unreachable('Should have thrown');
    } catch (err) {
      expect((err as AppError).statusCode).toBe(409);
    }
  });

  it('blocks stage completion if identity is not verified or checklist is incomplete', () => {
    try {
      canCompleteStage({
        currentStatus: 'IRONING_IN_PROGRESS',
        currentDepartment: 'IRONING',
        stageDepartment: 'IRONING',
        actorRole: 'IRONING',
        identityVerified: false,
        allChecklistItemsChecked: true,
      });
      expect.unreachable('Should have thrown');
    } catch (err) {
      expect((err as AppError).statusCode).toBe(422);
      expect((err as AppError).code).toBe('IDENTITY_VERIFICATION_REQUIRED');
    }

    try {
      canCompleteStage({
        currentStatus: 'IRONING_IN_PROGRESS',
        currentDepartment: 'IRONING',
        stageDepartment: 'IRONING',
        actorRole: 'IRONING',
        identityVerified: true,
        allChecklistItemsChecked: false,
      });
      expect.unreachable('Should have thrown');
    } catch (err) {
      expect((err as AppError).statusCode).toBe(422);
      expect((err as AppError).code).toBe('CHECKLIST_INCOMPLETE');
    }

    expect(() =>
      canCompleteStage({
        currentStatus: 'IRONING_IN_PROGRESS',
        currentDepartment: 'IRONING',
        stageDepartment: 'IRONING',
        actorRole: 'IRONING',
        identityVerified: true,
        allChecklistItemsChecked: true,
      })
    ).not.toThrow();
  });

  it('resolves next department or READY_FOR_PICKUP across workflow templates', () => {
    expect(resolveNextWorkflowTarget(['SPOTTING', 'IRONING', 'PACKING'], 'SPOTTING')).toEqual({
      nextDepartment: 'IRONING',
      nextStatus: 'WAITING_IRONING',
    });
    expect(resolveNextWorkflowTarget(['SPOTTING', 'IRONING', 'PACKING'], 'IRONING')).toEqual({
      nextDepartment: 'PACKING',
      nextStatus: 'WAITING_PACKING',
    });
    expect(resolveNextWorkflowTarget(['SPOTTING', 'IRONING', 'PACKING'], 'PACKING')).toEqual({
      nextDepartment: 'PICKUP',
      nextStatus: 'READY_FOR_PICKUP',
    });
    expect(resolveNextWorkflowTarget(['PACKING'], 'PACKING')).toEqual({
      nextDepartment: 'PICKUP',
      nextStatus: 'READY_FOR_PICKUP',
    });
  });

  it('validates hold and resume transitions strictly', () => {
    expect(() => canPlaceOnHold('WAITING_SPOTTING')).not.toThrow();
    expect(() => canPlaceOnHold('IRONING_IN_PROGRESS')).not.toThrow();
    expect(() => canPlaceOnHold('PICKED_UP')).toThrowError(AppError);
    expect(() => canPlaceOnHold('ON_HOLD')).toThrowError(AppError);

    expect(canResumeFromHold('ON_HOLD', 'SPOTTING_IN_PROGRESS', 'SPOTTING')).toEqual({
      restoreStatus: 'SPOTTING_IN_PROGRESS',
      restoreDepartment: 'SPOTTING',
    });
    expect(() => canResumeFromHold('WAITING_IRONING', null, null)).toThrowError(AppError);
  });
});
