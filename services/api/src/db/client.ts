import { Pool, type PoolClient } from "pg";
import type { AuthenticatedTerritorialScope } from "../middleware/auth-model";

let pool: Pool | undefined;

export interface TenantContext {
  authenticatedUserId: string;
  alcanceTerritorial: AuthenticatedTerritorialScope;
}

function getPool(): Pool {
  const connectionString = (
    process.env.DATABASE_URL ?? process.env.SBOX_DATABASE_URL
  )?.trim();
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for the API runtime");
  }
  if (!/^postgres(?:ql)?:\/\//i.test(connectionString)) {
    throw new Error("DATABASE_URL must use the PostgreSQL protocol");
  }
  if (!pool) {
    pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: true },
      max: 3,
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 10_000,
      allowExitOnIdle: true,
    });
  }
  return pool;
}

export function assertRuntimeDatabaseRole(role: {
  role_name: string;
  is_superuser: boolean;
  can_create_db: boolean;
  can_create_role: boolean;
  bypasses_rls: boolean;
  owns_sensitive_tables: boolean;
  sensitive_rls_incomplete: boolean;
} | undefined): void {
  if (
    !role ||
    role.role_name !== "shippiyyukon_runtime" ||
    role.is_superuser ||
    role.can_create_db ||
    role.can_create_role ||
    role.bypasses_rls ||
    role.owns_sensitive_tables ||
    role.sensitive_rls_incomplete
  ) {
    throw new Error(
      "The API must run as shippiyyukon_runtime, a least-privileged role subject to RLS"
    );
  }
}

async function assertRuntimeRole(client: PoolClient): Promise<void> {
  const { rows } = await client.query<{
    role_name: string;
    is_superuser: boolean;
    can_create_db: boolean;
    can_create_role: boolean;
    bypasses_rls: boolean;
    owns_sensitive_tables: boolean;
    sensitive_rls_incomplete: boolean;
  }>(`
    SELECT current_user AS role_name,
           rolsuper AS is_superuser,
           rolcreatedb AS can_create_db,
           rolcreaterole AS can_create_role,
           rolbypassrls AS bypasses_rls,
           EXISTS (
             SELECT 1
               FROM pg_class AS relation
               JOIN pg_namespace AS namespace
                 ON namespace.oid = relation.relnamespace
              WHERE namespace.nspname = 'public'
                AND relation.relname IN (
                  'authorization_assignments',
                  'delegations',
                  'territory_counters',
                  'consejeros',
                  'authorization_audit_log',
                  'cto_dev_bootstrap_config',
                  'cto_dev_bootstrap_audit'
                )
                AND relation.relowner = (SELECT oid FROM pg_roles WHERE rolname = current_user)
           ) AS owns_sensitive_tables,
           (
             SELECT count(*) <> 7
                 OR bool_or(NOT relation.relrowsecurity OR NOT relation.relforcerowsecurity)
               FROM pg_class AS relation
               JOIN pg_namespace AS namespace
                 ON namespace.oid = relation.relnamespace
              WHERE namespace.nspname = 'public'
                AND relation.relname IN (
                  'authorization_assignments',
                  'delegations',
                  'territory_counters',
                  'consejeros',
                  'authorization_audit_log',
                  'cto_dev_bootstrap_config',
                  'cto_dev_bootstrap_audit'
                )
                AND relation.relkind IN ('r', 'p')
           ) AS sensitive_rls_incomplete
      FROM pg_roles
     WHERE rolname = current_user
  `);
  assertRuntimeDatabaseRole(rows[0]);
}

async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL ROLE shippiyyukon_runtime");
    await assertRuntimeRole(client);
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

export async function withAuthorizationUserContext<T>(
  authenticatedUserId: string,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  return withTransaction(async (client) => {
    await configureAuthorizationUserContext(client, authenticatedUserId);
    return fn(client);
  });
}

export async function assignSecondaryCtoDev(
  authenticatedUserId: string,
  targetUserId: string,
  reason: string
): Promise<string> {
  return withAuthorizationUserContext(authenticatedUserId, async (client) => {
    const { rows } = await client.query<{ assignment_id: string }>(
      `SELECT public.assign_secondary_cto_dev($1::uuid, $2::text)
         AS assignment_id`,
      [targetUserId, reason]
    );
    if (!rows[0]?.assignment_id) {
      throw new Error("Secondary CTO/DEV assignment returned no identifier");
    }
    return rows[0].assignment_id;
  });
}

export async function revokeSecondaryCtoDev(
  authenticatedUserId: string,
  targetUserId: string,
  reason: string
): Promise<void> {
  await withAuthorizationUserContext(authenticatedUserId, async (client) => {
    const { rows } = await client.query<{ revoked: boolean }>(
      `SELECT public.revoke_secondary_cto_dev($1::uuid, $2::text) AS revoked`,
      [targetUserId, reason]
    );
    if (rows[0]?.revoked !== true) {
      throw new Error("Secondary CTO/DEV revocation was not confirmed");
    }
  });
}

export async function configureAuthorizationUserContext(
  client: PoolClient,
  authenticatedUserId: string
): Promise<void> {
  await client.query(
    "SELECT set_config('app.authenticated_user_id', $1, true)",
    [authenticatedUserId]
  );
}

export async function withTenantContext<T>(
  ctx: TenantContext,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  return withTransaction(async (client) => {
    await configureTenantContext(client, ctx);
    return fn(client);
  });
}

export async function configureTenantContext(
  client: PoolClient,
  ctx: TenantContext
): Promise<void> {
  await configureAuthorizationUserContext(client, ctx.authenticatedUserId);
  await client.query("SELECT set_config('app.scope_kind', $1, true)", [
    ctx.alcanceTerritorial.kind,
  ]);
  await client.query("SELECT set_config('app.territory_id', $1, true)", [
    ctx.alcanceTerritorial.kind === "MUNICIPAL"
      ? ctx.alcanceTerritorial.territoryId
      : "",
  ]);
}

export async function siguienteCorrelativo(
  client: PoolClient,
  territoryId: string
): Promise<number> {
  const { rows } = await client.query<{ siguiente: number }>(
    `INSERT INTO territory_counters (territory_id, siguiente)
     VALUES ($1, 1)
     ON CONFLICT (territory_id)
     DO UPDATE SET siguiente = territory_counters.siguiente + 1
     RETURNING siguiente`,
    [territoryId]
  );
  if (!rows[0]) {
    throw new Error("Failed to allocate a territory counter");
  }
  return rows[0].siguiente;
}

export type { AuthenticatedTerritorialScope };
