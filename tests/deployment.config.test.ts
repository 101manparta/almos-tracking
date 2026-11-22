import fs from 'node:fs/promises';
import http from 'node:http';
import type { Server } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildPoolConfig, handlePoolError } from '../src/db/index.ts';
import { attachProductionSpa, createBackendApp } from '../src/server/app.ts';
import { AppError } from '../src/server/errors/app-error.ts';
import vercelHandler from '../src/server/vercel.ts';

describe('Cloud SQL Connection Config & Production Server Startup', () => {
  it('builds Unix socket config for Google Cloud Run (/cloudsql/...) without TCP port or SSL', () => {
    const cfg = buildPoolConfig({
      SQL_HOST: '/cloudsql/analog-platform-3bcxw:asia-southeast1:ai-studio-bd7c4503',
      SQL_PORT: '5432',
      SQL_SSL: 'true',
      SQL_USER: 'ai_studio_admin',
      SQL_PASSWORD: 'secret-placeholder',
      SQL_DB_NAME: 'cloud_sql_development_database',
      SQL_POOL_MAX: '5',
    } as NodeJS.ProcessEnv);

    expect(cfg.host).toBe('/cloudsql/analog-platform-3bcxw:asia-southeast1:ai-studio-bd7c4503');
    expect(cfg.port).toBeUndefined();
    expect(cfg.ssl).toBeUndefined();
    expect(cfg.user).toBe('ai_studio_admin');
    expect(cfg.database).toBe('cloud_sql_development_database');
    expect(cfg.max).toBe(5);
    expect(cfg.connectionTimeoutMillis).toBe(15000);
    expect(cfg.idleTimeoutMillis).toBe(30000);
    expect(cfg.keepAlive).toBe(true);
    expect(cfg.keepAliveInitialDelayMillis).toBe(10000);
    expect(cfg.allowExitOnIdle).toBe(true);
  });

  it('handles transient idle SQL pool terminations gracefully without console.error stack noise', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      handlePoolError(new Error('Connection terminated unexpectedly'));
      expect(errorSpy).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledTimes(1);
    } finally {
      errorSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });

  it('builds Unix socket config for AI Studio Preview (/app/cloudsql/...)', () => {
    const cfg = buildPoolConfig({
      SQL_HOST: '/app/cloudsql/analog-platform-3bcxw:asia-southeast1:ai-studio-bd7c4503',
      SQL_USER: 'ai_studio_admin',
      SQL_PASSWORD: 'secret-placeholder',
      SQL_DB_NAME: 'cloud_sql_development_database',
    } as NodeJS.ProcessEnv);

    expect(cfg.host).toBe('/app/cloudsql/analog-platform-3bcxw:asia-southeast1:ai-studio-bd7c4503');
    expect(cfg.port).toBeUndefined();
    expect(cfg.ssl).toBeUndefined();
    expect(cfg.max).toBe(10);
  });

  it('builds TCP config with SQL_PORT and optional SQL_SSL=true for local/TCP connections', () => {
    const cfg = buildPoolConfig({
      SQL_HOST: '127.0.0.1',
      SQL_PORT: '5432',
      SQL_SSL: 'true',
      SQL_USER: 'postgres',
      SQL_PASSWORD: 'secret-placeholder',
      SQL_DB_NAME: 'almos_local',
      SQL_POOL_MAX: '8',
    } as NodeJS.ProcessEnv);

    expect(cfg.host).toBe('127.0.0.1');
    expect(cfg.port).toBe(5432);
    expect(cfg.ssl).toEqual({ rejectUnauthorized: true });
    expect(cfg.max).toBe(8);
  });

  it('builds Supabase PostgreSQL config from DATABASE_URL with SSL enabled for remote hosts', () => {
    const cfg = buildPoolConfig({
      DATABASE_URL:
        'DIRECT_URL="postgresql://postgres.demo:secret@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require"',
      SQL_POOL_MAX: '5',
    } as NodeJS.ProcessEnv);

    expect(cfg.connectionString).toBe(
      'postgresql://postgres.demo:secret@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require'
    );
    expect(cfg.ssl).toEqual({ rejectUnauthorized: false });
    expect(cfg.max).toBe(5);
    expect(cfg.keepAlive).toBe(true);
  });

  it('uses conservative pool limits on Vercel serverless when SQL_POOL_MAX is unset', () => {
    const cfg = buildPoolConfig({
      VERCEL: '1',
      DATABASE_URL:
        'postgresql://postgres.demo:secret@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres',
    } as NodeJS.ProcessEnv);

    expect(cfg.max).toBe(3);
    expect(cfg.idleTimeoutMillis).toBe(10000);
    expect(cfg.allowExitOnIdle).toBe(true);
    expect(cfg.ssl).toEqual({ rejectUnauthorized: false });
  });

  describe('Production SPA static + API routing without Vite dev middleware', () => {
    let server: Server;
    let baseUrl = '';
    let tempDistDir = '';

    beforeAll(async () => {
      tempDistDir = await fs.mkdtemp(path.join(os.tmpdir(), 'almos-prod-dist-'));
      await fs.writeFile(
        path.join(tempDistDir, 'index.html'),
        '<!doctype html><html><body><div id="root">ALMOS Prod</div></body></html>',
        'utf-8'
      );

      const app = createBackendApp();
      attachProductionSpa(app, tempDistDir);

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
      if (tempDistDir) {
        await fs.rm(tempDistDir, { recursive: true, force: true });
      }
    });

    it('serves SPA index.html for frontend routes and keeps /api/v1/* returning JSON', async () => {
      const rootRes = await fetch(`${baseUrl}/`);
      expect(rootRes.status).toBe(200);
      expect(rootRes.headers.get('content-type')).toContain('text/html');
      const html = await rootRes.text();
      expect(html).toContain('ALMOS Prod');

      const spaRes = await fetch(`${baseUrl}/admin/dashboard`);
      expect(spaRes.status).toBe(200);
      expect(spaRes.headers.get('content-type')).toContain('text/html');

      const healthRes = await fetch(`${baseUrl}/api/v1/health`);
      expect(healthRes.status).toBe(200);
      const healthBody = (await healthRes.json()) as { data: { status: string } };
      expect(healthBody.data.status).toBe('ok');

      const missingApiRes = await fetch(`${baseUrl}/api/v1/unknown-endpoint`);
      expect(missingApiRes.status).toBe(404);
      expect(missingApiRes.headers.get('content-type')).toContain('application/json');
      const missingBody = (await missingApiRes.json()) as { error: { code: string } };
      expect(missingBody.error.code).toBe('ENDPOINT_NOT_FOUND');

      // Ensure AppError stays intact
      const err = new AppError(404, 'TEST', 'test');
      expect(err.statusCode).toBe(404);
    });
  });

  describe('Vercel Serverless API handler', () => {
    let server: Server;
    let baseUrl = '';

    beforeAll(async () => {
      server = http.createServer((req, res) => {
        vercelHandler(req as never, res as never);
      });
      await new Promise<void>((resolve) => {
        server.listen(0, '127.0.0.1', () => {
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

    it('handles /api/v1/health, /api/v1/openapi.json, and unknown API 404 via default export', async () => {
      const healthRes = await fetch(`${baseUrl}/api/v1/health`);
      expect(healthRes.status).toBe(200);
      const healthJson = (await healthRes.json()) as { data: { status: string } };
      expect(healthJson.data.status).toBe('ok');

      const openapiRes = await fetch(`${baseUrl}/api/v1/openapi.json`);
      expect(openapiRes.status).toBe(200);
      const openapiJson = (await openapiRes.json()) as { openapi: string };
      expect(openapiJson.openapi).toBe('3.0.3');

      const notFoundRes = await fetch(`${baseUrl}/api/v1/nonexistent`);
      expect(notFoundRes.status).toBe(404);
      const notFoundJson = (await notFoundRes.json()) as { error: { code: string } };
      expect(notFoundJson.error.code).toBe('ENDPOINT_NOT_FOUND');
    });
  });
});
