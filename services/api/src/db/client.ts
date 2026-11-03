import { Pool } from "pg";
import type { PoolClient } from "pg";
import { databasePoolConfig } from "./config";

/**
 * Lazy server-side PostgreSQL pool. This keeps non-database endpoints (such as
 * /api/health) available while DATABASE_URL is not configured. Database
 * operations fail closed when configuration is missing.
 */
let pool: Pool | undefined;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool(databasePoolConfig());
  }
  return pool;
}

export interface TenantContext {
  /** Rol de plataforma del usuario autenticado (RawData §11 RBAC) */
  rolPlataforma: string;
  /** Municipio del usuario autenticado; requerido para roles con alcance municipal */
  municipio?: string;
}

/**
 * Ejecuta `fn` dentro de una transacción con el contexto de tenant aplicado
 * vía `SET LOCAL`, que las políticas de Row-Level Security de schema.sql leen
 * con `current_setting(...)`. El contexto proviene de claims ya verificados.
 */
export async function withTenantContext<T>(
  ctx: TenantContext,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.rol_plataforma', $1, true)", [
      ctx.rolPlataforma,
    ]);
    await client.query("SELECT set_config('app.current_municipio', $1, true)", [
      ctx.municipio ?? "",
    ]);
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/** HU-A5 — asigna el siguiente correlativo del municipio de forma atómica. */
export async function siguienteCorrelativo(
  client: PoolClient,
  municipio: string
): Promise<number> {
  const { rows } = await client.query<{ siguiente: number }>(
    `INSERT INTO municipio_correlativos (municipio, siguiente)
     VALUES ($1, 1)
     ON CONFLICT (municipio)
     DO UPDATE SET siguiente = municipio_correlativos.siguiente + 1
     RETURNING siguiente`,
    [municipio]
  );
  return rows[0].siguiente;
}
