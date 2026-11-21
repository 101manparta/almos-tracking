import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createBackendApp } from '../src/server/app.ts';

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

  it('rejects unauthenticated requests to protected Admin and Staff endpoints with 401', async () => {
    const protectedEndpoints = [
      '/api/v1/orders',
      '/api/v1/garments',
      '/api/v1/staff/queue',
      '/api/v1/reports/overview',
      '/api/v1/archive',
    ];
    for (const endpoint of protectedEndpoints) {
      const res = await fetch(`${baseUrl}${endpoint}`);
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
});
