import type { Request, Response } from 'express';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createBackendApp } from '../src/server/app.ts';
import { errorMiddleware } from '../src/server/errors/app-error.ts';

describe('API v1 HTTP Contract & Auth Boundaries', () => {
  let server: Server;
  let baseUrl = '';

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
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it('GET /api/v1/health returns ok status', async () => {
    const res = await fetch(`${baseUrl}/api/v1/health`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { status: string; version: string } };
    expect(body.data.status).toBe('ok');
    expect(body.data.version).toBe('v1');
  });

  it('GET /api/v1/openapi.json exposes OpenAPI 3.0 specification', async () => {
    const res = await fetch(`${baseUrl}/api/v1/openapi.json`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      openapi: string;
      paths: Record<string, unknown>;
    };
    expect(body.openapi).toBe('3.0.3');
    expect(body.paths['/api/v1/orders']).toBeDefined();
    expect(body.paths['/api/v1/garments/{id}/handover']).toBeDefined();
    expect(body.paths['/api/v1/orders/{id}/pickup']).toBeDefined();
  });

  it('returns structured 404 JSON for unknown /api/v1/* endpoints', async () => {
    const res = await fetch(`${baseUrl}/api/v1/nonexistent`);
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toContain('application/json');
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('ENDPOINT_NOT_FOUND');
    expect(JSON.stringify(body)).not.toContain('stack');
  });

  it('rejects unauthenticated requests to protected Admin, Staff, and Photo endpoints with 401', async () => {
    const dummyId = '00000000-0000-4000-8000-000000000001';
    const protectedEndpoints: Array<{ path: string; method?: string }> = [
      { path: '/api/v1/orders' },
      { path: '/api/v1/garments' },
      { path: '/api/v1/staff/queue' },
      { path: '/api/v1/reports/overview' },
      { path: '/api/v1/archive' },
      { path: '/api/v1/photos' },
      { path: `/api/v1/garments/${dummyId}/photos` },
      { path: `/api/v1/photos/${dummyId}/file` },
      { path: `/api/v1/garments/${dummyId}/photos`, method: 'POST' },
      { path: `/api/v1/photos/${dummyId}`, method: 'DELETE' },
    ];
    for (const endpoint of protectedEndpoints) {
      const res = await fetch(`${baseUrl}${endpoint.path}`, {
        method: endpoint.method || 'GET',
      });
      expect(res.status).toBe(401);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe('UNAUTHORIZED');
    }
  });

  it('validates login input payload with 400 VALIDATION_ERROR', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({ identifier: 'a', password: '' }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('never exposes stack traces on malformed JSON or internal server errors', async () => {
    const badJsonRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: '{"identifier": ',
    });
    expect(badJsonRes.status).toBe(400);
    const badJsonBody = (await badJsonRes.json()) as { error: { code: string } };
    expect(badJsonBody.error.code).toBe('INVALID_JSON');
    expect(JSON.stringify(badJsonBody)).not.toContain('SyntaxError');
    expect(JSON.stringify(badJsonBody)).not.toContain('stack');

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      let statusCode = 0;
      let payload: unknown = null;
      const mockRes = {
        status(code: number) {
          statusCode = code;
          return this;
        },
        json(data: unknown) {
          payload = data;
          return this;
        },
      } as unknown as Response;

      errorMiddleware(
        new Error('secret internal connection failure at /src/db/index.ts'),
        {} as Request,
        mockRes,
        vi.fn()
      );

      expect(statusCode).toBe(500);
      const serialized = JSON.stringify(payload);
      expect(serialized).toContain('INTERNAL_SERVER_ERROR');
      expect(serialized).not.toContain('secret internal');
      expect(serialized).not.toContain('stack');
      expect(serialized).not.toContain('.ts');
    } finally {
      consoleSpy.mockRestore();
    }
  });
});
