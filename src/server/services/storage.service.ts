import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { AppError } from '../errors/app-error.ts';

const PRIVATE_STORAGE_ROOT = path.resolve(process.cwd(), 'storage', 'photos');

export interface StoredPhotoResult {
  storageProvider: 'SUPABASE' | 'LOCAL_PRIVATE';
  storagePath: string;
  thumbnailPath: string;
}

function getExtension(mimeType: string): string {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpg';
}

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const bucket = process.env.SUPABASE_STORAGE_BUCKET?.trim() || 'almos-garment-photos';
  if (url && serviceKey) {
    return { url: url.replace(/\/+$/, ''), serviceKey, bucket };
  }
  return null;
}

function resolveConfinedPath(relativePath: string): string {
  const cleanRel = relativePath.replace(/^\/+/, '');
  const resolved = path.resolve(PRIVATE_STORAGE_ROOT, cleanRel);
  if (!resolved.startsWith(PRIVATE_STORAGE_ROOT + path.sep)) {
    throw new AppError(400, 'INVALID_STORAGE_PATH', 'Jalur file foto tidak valid.');
  }
  return resolved;
}

export async function uploadGarmentPhotoBuffers(params: {
  garmentId: string;
  originalBuffer: Buffer;
  originalMime: string;
  thumbnailBuffer: Buffer;
  thumbnailMime: string;
}): Promise<StoredPhotoResult> {
  const fileUuid = crypto.randomUUID();
  const origExt = getExtension(params.originalMime);
  const thumbExt = getExtension(params.thumbnailMime);

  const storagePath = `${params.garmentId}/${fileUuid}_original.${origExt}`;
  const thumbnailPath = `${params.garmentId}/${fileUuid}_thumb.${thumbExt}`;

  const supa = getSupabaseConfig();
  if (supa) {
    const uploadToSupabase = async (objectPath: string, body: Buffer, contentType: string) => {
      const endpoint = `${supa.url}/storage/v1/object/${encodeURIComponent(supa.bucket)}/${objectPath}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${supa.serviceKey}`,
          apikey: supa.serviceKey,
          'Content-Type': contentType,
          'x-upsert': 'false',
        },
        body: new Uint8Array(body),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new AppError(
          502,
          'STORAGE_UPLOAD_FAILED',
          `Gagal mengunggah foto ke Supabase Storage (${res.status}): ${text.slice(0, 120)}`
        );
      }
    };

    await uploadToSupabase(storagePath, params.originalBuffer, params.originalMime);
    try {
      await uploadToSupabase(thumbnailPath, params.thumbnailBuffer, params.thumbnailMime);
    } catch (err) {
      // Compensating delete so no orphaned original file remains
      await deleteFromSupabase(supa, storagePath).catch(() => {});
      throw err;
    }

    return {
      storageProvider: 'SUPABASE',
      storagePath,
      thumbnailPath,
    };
  }

  // Private local disk storage (only served via authenticated API route)
  const absOriginal = resolveConfinedPath(storagePath);
  const absThumb = resolveConfinedPath(thumbnailPath);
  await fs.mkdir(path.dirname(absOriginal), { recursive: true });
  await fs.writeFile(absOriginal, params.originalBuffer);
  try {
    await fs.writeFile(absThumb, params.thumbnailBuffer);
  } catch (err) {
    await fs.unlink(absOriginal).catch(() => {});
    throw err;
  }

  return {
    storageProvider: 'LOCAL_PRIVATE',
    storagePath,
    thumbnailPath,
  };
}

async function deleteFromSupabase(
  supa: { url: string; serviceKey: string; bucket: string },
  objectPath: string
) {
  const endpoint = `${supa.url}/storage/v1/object/${encodeURIComponent(supa.bucket)}/${objectPath}`;
  await fetch(endpoint, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${supa.serviceKey}`,
      apikey: supa.serviceKey,
    },
  });
}

export async function readPhotoObject(params: {
  storageProvider: string;
  objectPath: string;
}): Promise<{ buffer: Buffer; contentType?: string }> {
  if (params.storageProvider === 'SUPABASE') {
    const supa = getSupabaseConfig();
    if (!supa) {
      throw new AppError(500, 'STORAGE_CONFIG_MISSING', 'Konfigurasi Supabase Storage tidak tersedia.');
    }
    const endpoint = `${supa.url}/storage/v1/object/authenticated/${encodeURIComponent(supa.bucket)}/${params.objectPath}`;
    const res = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${supa.serviceKey}`,
        apikey: supa.serviceKey,
      },
    });
    if (!res.ok) {
      throw new AppError(404, 'PHOTO_NOT_FOUND', 'File foto tidak ditemukan di storage.');
    }
    const arr = await res.arrayBuffer();
    return {
      buffer: Buffer.from(arr),
      contentType: res.headers.get('content-type') || undefined,
    };
  }

  const absPath = resolveConfinedPath(params.objectPath);
  try {
    const buffer = await fs.readFile(absPath);
    return { buffer };
  } catch {
    throw new AppError(404, 'PHOTO_NOT_FOUND', 'File foto tidak ditemukan.');
  }
}

export async function deletePhotoObjects(params: {
  storageProvider: string;
  storagePath: string;
  thumbnailPath: string;
}): Promise<void> {
  if (params.storageProvider === 'SUPABASE') {
    const supa = getSupabaseConfig();
    if (supa) {
      await deleteFromSupabase(supa, params.storagePath).catch(() => {});
      await deleteFromSupabase(supa, params.thumbnailPath).catch(() => {});
    }
    return;
  }

  const absOrig = resolveConfinedPath(params.storagePath);
  const absThumb = resolveConfinedPath(params.thumbnailPath);
  await fs.unlink(absOrig).catch(() => {});
  await fs.unlink(absThumb).catch(() => {});
}
