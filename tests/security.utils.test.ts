import { describe, expect, it } from 'vitest';
import { AppError } from '../src/server/errors/app-error.ts';
import { readPhotoObject } from '../src/server/services/storage.service.ts';
import {
  detectImageMimeFromBuffer,
  generateOpaqueToken,
  hashPassword,
  hashToken,
  verifyPassword,
} from '../src/server/utils/crypto.ts';

describe('Security, Crypto & Storage Guardrails', () => {
  it('hashes and verifies passwords with scrypt safely', async () => {
    const hash = await hashPassword('AlmosStrongPass#2026');
    expect(hash.startsWith('$scrypt$')).toBe(true);
    expect(await verifyPassword('AlmosStrongPass#2026', hash)).toBe(true);
    expect(await verifyPassword('WrongPassword', hash)).toBe(false);
  });

  it('generates distinct opaque tokens and deterministic SHA-256 hashes', () => {
    const t1 = generateOpaqueToken();
    const t2 = generateOpaqueToken();
    expect(t1).not.toBe(t2);
    expect(t1.length).toBeGreaterThanOrEqual(40);
    expect(hashToken(t1)).toBe(hashToken(t1));
    expect(hashToken(t1)).not.toBe(t1);
  });

  it('validates image magic bytes and rejects non-image payloads', () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
    const webp = Buffer.from('RIFF\x00\x00\x00\x00WEBP', 'binary');
    const fakeSvg = Buffer.from('<svg><script>alert(1)</script></svg>');

    expect(detectImageMimeFromBuffer(jpeg)).toBe('image/jpeg');
    expect(detectImageMimeFromBuffer(png)).toBe('image/png');
    expect(detectImageMimeFromBuffer(webp)).toBe('image/webp');
    expect(detectImageMimeFromBuffer(fakeSvg)).toBeNull();
  });

  it('blocks path traversal attempts in local storage reads', async () => {
    try {
      await readPhotoObject({
        storageProvider: 'LOCAL',
        objectPath: '../../etc/passwd',
      });
      expect.unreachable('Should have rejected path traversal');
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(400);
      expect((err as AppError).code).toBe('INVALID_STORAGE_PATH');
    }
  });
});
