import type { PoolConfig } from "pg";

/**
 * Server-only PostgreSQL configuration shared by Neon and Aurora PostgreSQL.
 * TLS certificate verification is mandatory; callers cannot disable it.
 */
export function databasePoolConfig(
  env: NodeJS.ProcessEnv = process.env
): PoolConfig {
  const connectionString = env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for the API runtime");
  }
  if (!/^postgres(?:ql)?:\/\//i.test(connectionString)) {
    throw new Error("DATABASE_URL must use the PostgreSQL protocol");
  }

  const rawMax = env.DB_POOL_MAX ?? "3";
  const max = Number(rawMax);
  if (!Number.isInteger(max) || max < 1 || max > 5) {
    throw new Error("DB_POOL_MAX must be an integer between 1 and 5");
  }

  return {
    connectionString,
    ssl: { rejectUnauthorized: true },
    max,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 10_000,
    allowExitOnIdle: true,
  };
}
