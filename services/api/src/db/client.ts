import { Pool, PoolClient } from "pg";

/**
 * Conexión a Aurora PostgreSQL (DAT §4/§9). En producción, el host/credenciales
 * se inyectan vía Secrets Manager + variables de entorno de la Lambda
 * (ver infrastructure/lib/constructs/data-construct.ts), nunca hardcodeados.
 */
const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 5432),
  database: process.env.DB_NAME ?? "shippiyyukon",
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === "false" ? undefined : { rejectUnauthorized: true },
  max: 5, // conservador para Lambda: evita agotar conexiones de Aurora Serverless v2
});

export interface TenantContext {
  /** Rol de plataforma del usuario autenticado (RawData §11 RBAC) */
  rolPlataforma: string;
  /** Municipio del usuario autenticado; requerido para roles con alcance municipal */
  municipio?: string;
}

/**
 * Ejecuta `fn` dentro de una transacción con el contexto de tenant aplicado
 * vía `SET LOCAL`, que las políticas de Row-Level Security de schema.sql leen
 * con `current_setting(...)`. Este es el punto único por el que CUALQUIER
 * consulta a `consejeros` pasa — así HU-A7 y HU-00.5 (RBAC) se cumplen a nivel
 * de base de datos, no solo en la lógica de la aplicación.
 */
export async function withTenantContext<T>(
  ctx: TenantContext,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
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

export { pool };
