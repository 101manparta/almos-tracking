import crypto from 'node:crypto';

const SCRYPT_KEYLEN = 64;
const SCRYPT_COST = 16384;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLEL = 1;

export function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(
      password,
      salt,
      SCRYPT_KEYLEN,
      { N: SCRYPT_COST, r: SCRYPT_BLOCK_SIZE, p: SCRYPT_PARALLEL },
      (err, derivedKey) => {
        if (err) return reject(err);
        resolve(
          `$scrypt$N=${SCRYPT_COST},r=${SCRYPT_BLOCK_SIZE},p=${SCRYPT_PARALLEL}$${salt}$${derivedKey.toString('hex')}`
        );
      }
    );
  });
}

export function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const parts = storedHash.split('$');
    if (parts.length !== 5 || parts[1] !== 'scrypt') {
      return resolve(false);
    }
    const paramsStr = parts[2];
    const salt = parts[3];
    const expectedHex = parts[4];
    const params = Object.fromEntries(
      paramsStr.split(',').map((kv) => {
        const [k, v] = kv.split('=');
        return [k, Number(v)];
      })
    );
    const N = params.N || SCRYPT_COST;
    const r = params.r || SCRYPT_BLOCK_SIZE;
    const p = params.p || SCRYPT_PARALLEL;
    const expectedBuf = Buffer.from(expectedHex, 'hex');

    crypto.scrypt(password, salt, expectedBuf.length, { N, r, p }, (err, derivedKey) => {
      if (err) return reject(err);
      if (derivedKey.length !== expectedBuf.length) return resolve(false);
      resolve(crypto.timingSafeEqual(derivedKey, expectedBuf));
    });
  });
}

export function generateOpaqueToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function detectImageMimeFromBuffer(buffer: Buffer): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  // WebP: RIFF....WEBP
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }

  return null;
}
