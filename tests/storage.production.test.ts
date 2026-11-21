import fs from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readPhotoObject, uploadGarmentPhotoBuffers } from '../src/server/services/storage.service.ts';

describe('Production Photo Storage Guardrails', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalSupaUrl = process.env.SUPABASE_URL;
  const originalSupaKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const originalSupaBucket = process.env.SUPABASE_STORAGE_BUCKET;

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env.NODE_ENV = originalNodeEnv;
    if (originalSupaUrl === undefined) {
      delete process.env.SUPABASE_URL;
    } else {
      process.env.SUPABASE_URL = originalSupaUrl;
    }
    if (originalSupaKey === undefined) {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    } else {
      process.env.SUPABASE_SERVICE_ROLE_KEY = originalSupaKey;
    }
    if (originalSupaBucket === undefined) {
      delete process.env.SUPABASE_STORAGE_BUCKET;
    } else {
      process.env.SUPABASE_STORAGE_BUCKET = originalSupaBucket;
    }
  });

  it('rejects silent LOCAL_PRIVATE fallback when NODE_ENV=production and Supabase env is missing', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1]);

    await expect(
      uploadGarmentPhotoBuffers({
        garmentId: '00000000-0000-4000-8000-000000000001',
        originalBuffer: jpegHeader,
        originalMime: 'image/jpeg',
        thumbnailBuffer: jpegHeader,
        thumbnailMime: 'image/jpeg',
      })
    ).rejects.toMatchObject({
      statusCode: 500,
      code: 'STORAGE_CONFIG_MISSING',
    });
  });

  it('uploads and reads photos via Supabase Storage in NODE_ENV=production without local filesystem writes', async () => {
    process.env.NODE_ENV = 'production';
    process.env.SUPABASE_URL = 'https://example-project.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'dummy-service-role-token';
    process.env.SUPABASE_STORAGE_BUCKET = 'almos-garment-photos';

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === 'POST') {
        expect(url).toContain('/storage/v1/object/almos-garment-photos/');
        return new Response(JSON.stringify({ Key: 'ok' }), { status: 200 });
      }
      expect(url).toContain('/storage/v1/object/authenticated/almos-garment-photos/');
      return new Response(new Uint8Array([1, 2, 3, 4]), {
        status: 200,
        headers: { 'content-type': 'image/jpeg' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const garmentId = '00000000-0000-4000-8000-000000000099';
    const sampleBuf = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    const uploaded = await uploadGarmentPhotoBuffers({
      garmentId,
      originalBuffer: sampleBuf,
      originalMime: 'image/jpeg',
      thumbnailBuffer: sampleBuf,
      thumbnailMime: 'image/jpeg',
    });

    expect(uploaded.storageProvider).toBe('SUPABASE');
    expect(uploaded.storagePath).toContain(`${garmentId}/`);
    expect(uploaded.thumbnailPath).toContain(`${garmentId}/`);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const localFolder = path.resolve(process.cwd(), 'storage', 'photos', garmentId);
    await expect(fs.access(localFolder)).rejects.toThrow();

    const downloaded = await readPhotoObject({
      storageProvider: 'SUPABASE',
      objectPath: uploaded.storagePath,
    });
    expect(downloaded.buffer.equals(Buffer.from([1, 2, 3, 4]))).toBe(true);
    expect(downloaded.contentType).toBe('image/jpeg');
  });
});
