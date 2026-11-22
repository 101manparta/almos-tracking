import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool, type PoolConfig } from 'pg';
import * as schema from './schema.ts';

declare global {
  var _postgresPool: Pool | undefined;
}

export function normalizeDatabaseUrl(raw?: string): string | undefined {
  if (!raw) return undefined;
  let cleaned = raw.trim();
  const eqIdx = cleaned.indexOf('=');
  const schemeIdx = cleaned.search(/postgres(ql)?:\/\//i);
  if (eqIdx !== -1 && (schemeIdx === -1 || eqIdx < schemeIdx)) {
    cleaned = cleaned.slice(eqIdx + 1).trim();
  }
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  if (!cleaned) return undefined;
  if (!/^postgres(ql)?:\/\/.+/i.test(cleaned)) {
    throw new Error('Invalid DATABASE_URL format: must start with postgresql:// or postgres://.');
  }
  return cleaned;
}

export function buildPoolConfig(env: NodeJS.ProcessEnv = process.env): PoolConfig {
  const databaseUrl = normalizeDatabaseUrl(env.DATABASE_URL);
  const parsedPoolMax = env.SQL_POOL_MAX ? Number(env.SQL_POOL_MAX) : 10;
  const max = Number.isFinite(parsedPoolMax) && parsedPoolMax > 0 ? parsedPoolMax : 10;

  if (databaseUrl) {
    const isLocalUrl =
      databaseUrl.includes('localhost') ||
      databaseUrl.includes('127.0.0.1') ||
      databaseUrl.includes('::1');
    const ssl =
      env.SQL_SSL === 'false' || isLocalUrl
        ? undefined
        : { rejectUnauthorized: env.SQL_SSL_STRICT === 'true' };

    return {
      connectionString: databaseUrl,
      ...(ssl ? { ssl } : {}),
      max,
      connectionTimeoutMillis: 15000,
      idleTimeoutMillis: 30000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
      allowExitOnIdle: true,
    };
  }

  const sqlHost = env.SQL_HOST?.trim();
  const isUnixSocket = Boolean(sqlHost && sqlHost.startsWith('/'));
  const parsedPort = !isUnixSocket && env.SQL_PORT ? Number(env.SQL_PORT) : undefined;

  return {
    host: sqlHost,
    ...(parsedPort && Number.isFinite(parsedPort) && parsedPort > 0 ? { port: parsedPort } : {}),
    ...(!isUnixSocket && env.SQL_SSL === 'true' ? { ssl: { rejectUnauthorized: true } } : {}),
    user: env.SQL_USER,
    password: env.SQL_PASSWORD,
    database: env.SQL_DB_NAME,
    max,
    connectionTimeoutMillis: 15000,
    idleTimeoutMillis: 30000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
    allowExitOnIdle: true,
  };
}

export function handlePoolError(err: unknown) {
  const pgErr = err as { code?: string; message?: string } | undefined;
  const message = pgErr?.message || 'Unknown SQL pool error';
  const code = pgErr?.code || '';
  const isTransientDisconnect =
    message.includes('Connection terminated unexpectedly') ||
    message.includes('Client has encountered a connection error') ||
    code === 'ECONNRESET' ||
    code === 'EPIPE' ||
    code === 'ETIMEDOUT' ||
    code === '57P01' ||
    code === '57P02' ||
    code === '57P03' ||
    code === '08003' ||
    code === '08006';

  if (isTransientDisconnect) {
    console.warn(
      `[DB Pool] Idle connection recycled (${code || 'CLOSED'}): ${message}. Next query will reconnect automatically.`
    );
    return;
  }

  console.error(`[DB Pool] Error (${code || 'UNKNOWN'}): ${message}`);
}

export const createPool = () => {
  if (!global._postgresPool) {
    global._postgresPool = new Pool(buildPoolConfig(process.env));

    global._postgresPool.on('error', handlePoolError);
  }
  return global._postgresPool;
};

const pool = createPool();

export async function closePool() {
  if (global._postgresPool) {
    const p = global._postgresPool;
    global._postgresPool = undefined;
    await p.end();
  }
}

export const db = drizzle(pool, { schema });
export { pool };
