import fs from 'node:fs/promises';
import type { Server } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildPoolConfig } from '../src/db/index.ts';
import { attachProductionSpa, createBackendApp } from '../src/server/app.ts';
import { AppError } from '../src/server/errors/app-error.ts';

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
});
