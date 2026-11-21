import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool, type PoolConfig } from 'pg';
import * as schema from './schema.ts';

declare global {
  var _postgresPool: Pool | undefined;
}

export function buildPoolConfig(env: NodeJS.ProcessEnv = process.env): PoolConfig {
  const sqlHost = env.SQL_HOST?.trim();
  const isUnixSocket = Boolean(sqlHost && sqlHost.startsWith('/'));
  const parsedPort = !isUnixSocket && env.SQL_PORT ? Number(env.SQL_PORT) : undefined;
  const parsedPoolMax = env.SQL_POOL_MAX ? Number(env.SQL_POOL_MAX) : 10;

  return {
    host: sqlHost,
    ...(parsedPort && Number.isFinite(parsedPort) && parsedPort > 0 ? { port: parsedPort } : {}),
    ...(!isUnixSocket && env.SQL_SSL === 'true' ? { ssl: { rejectUnauthorized: true } } : {}),
    user: env.SQL_USER,
    password: env.SQL_PASSWORD,
    database: env.SQL_DB_NAME,
    max: Number.isFinite(parsedPoolMax) && parsedPoolMax > 0 ? parsedPoolMax : 10,
    connectionTimeoutMillis: 15000,
    idleTimeoutMillis: 30000,
  };
}

export const createPool = () => {
  if (!global._postgresPool) {
    global._postgresPool = new Pool(buildPoolConfig(process.env));

    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
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
