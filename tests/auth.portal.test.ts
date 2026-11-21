import { describe, expect, it } from 'vitest';
import {
  getDivisionDashboardRoute,
  normalizePublicRoute,
  normalizeRouteForRole,
} from '../src/lib/routing.ts';
import { AppError } from '../src/server/errors/app-error.ts';
import { validateLoginPortalAccess } from '../src/server/services/auth.service.ts';

describe('Portal Login Access & Route Protection Rules', () => {
  it('allows ADMIN only via ADMIN portal', () => {
    expect(() =>
      validateLoginPortalAccess({ actualRole: 'ADMIN', portal: 'ADMIN' })
    ).not.toThrow();

    for (const empRole of ['SPOTTING', 'IRONING', 'PACKING'] as const) {
      try {
        validateLoginPortalAccess({ actualRole: empRole, portal: 'ADMIN' });
        expect.unreachable('Employee should be rejected on ADMIN portal');
      } catch (err) {
        expect(err).toBeInstanceOf(AppError);
        expect((err as AppError).statusCode).toBe(403);
        expect((err as AppError).code).toBe('ROLE_PORTAL_MISMATCH');
      }
    }
  });

  it('allows matching employee division and rejects ADMIN or wrong division on EMPLOYEE portal', () => {
    for (const div of ['SPOTTING', 'IRONING', 'PACKING'] as const) {
      expect(() =>
        validateLoginPortalAccess({
          actualRole: div,
          portal: 'EMPLOYEE',
          selectedDivision: div,
        })
      ).not.toThrow();
    }

    try {
      validateLoginPortalAccess({
        actualRole: 'ADMIN',
        portal: 'EMPLOYEE',
        selectedDivision: 'SPOTTING',
      });
      expect.unreachable('Admin should be rejected on EMPLOYEE portal');
    } catch (err) {
      expect((err as AppError).statusCode).toBe(403);
      expect((err as AppError).code).toBe('ROLE_PORTAL_MISMATCH');
    }

    try {
      validateLoginPortalAccess({
        actualRole: 'SPOTTING',
        portal: 'EMPLOYEE',
        selectedDivision: 'IRONING',
      });
      expect.unreachable('Mismatched division should be rejected');
    } catch (err) {
      expect((err as AppError).statusCode).toBe(403);
      expect((err as AppError).code).toBe('DIVISION_MISMATCH');
      expect((err as AppError).message).toBe(
        'Divisi yang dipilih tidak sesuai dengan akun Anda. Silakan pilih divisi yang benar.'
      );
    }

    try {
      validateLoginPortalAccess({
        actualRole: 'PACKING',
        portal: 'EMPLOYEE',
      });
      expect.unreachable('Missing selectedDivision should be rejected');
    } catch (err) {
      expect((err as AppError).statusCode).toBe(400);
      expect((err as AppError).code).toBe('DIVISION_REQUIRED');
    }
  });

  it('redirects unauthenticated routes strictly to /admin or /login', () => {
    expect(normalizePublicRoute('/admin')).toBe('/admin');
    expect(normalizePublicRoute('/admin/dashboard')).toBe('/admin');
    expect(normalizePublicRoute('/login')).toBe('/login');
    expect(normalizePublicRoute('/spotting/dashboard')).toBe('/login');
    expect(normalizePublicRoute('/ironing/dashboard')).toBe('/login');
    expect(normalizePublicRoute('/packing/dashboard')).toBe('/login');
    expect(normalizePublicRoute('/')).toBe('/login');
  });

  it('isolates authenticated dashboard routes strictly by verified role', () => {
    expect(getDivisionDashboardRoute('ADMIN')).toBe('/admin/dashboard');
    expect(getDivisionDashboardRoute('SPOTTING')).toBe('/spotting/dashboard');
    expect(getDivisionDashboardRoute('IRONING')).toBe('/ironing/dashboard');
    expect(getDivisionDashboardRoute('PACKING')).toBe('/packing/dashboard');

    expect(normalizeRouteForRole('/spotting/dashboard', 'ADMIN')).toBe('/admin/dashboard');
    expect(normalizeRouteForRole('/pesanan', 'ADMIN')).toBe('/pesanan');
    expect(normalizeRouteForRole('/admin/dashboard', 'SPOTTING')).toBe('/spotting/dashboard');
    expect(normalizeRouteForRole('/ironing/dashboard', 'SPOTTING')).toBe('/spotting/dashboard');
    expect(normalizeRouteForRole('/packing/dashboard', 'IRONING')).toBe('/ironing/dashboard');
    expect(normalizeRouteForRole('/staff/antrean', 'PACKING')).toBe('/staff/antrean');
  });
});
