import { describe, expect, it, vi } from "vitest";
import type { PoolClient } from "pg";
import {
  assertRuntimeDatabaseRole,
  configureTenantContext,
  type TenantContext,
} from "./client";

function createClient() {
  return { query: vi.fn().mockResolvedValue({ rows: [] }) } as unknown as PoolClient;
}

describe("Neon transaction context", () => {
  it("sets the exact authenticated-user and municipal territory GUCs", async () => {
    const client = createClient();
    const context: TenantContext = {
      authenticatedUserId: "11111111-1111-4111-8111-111111111111",
      alcanceTerritorial: {
        kind: "MUNICIPAL",
        territoryId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        estado: "Estado 1",
        municipio: "Municipio A",
      },
    };

    await configureTenantContext(client, context);

    expect(client.query).toHaveBeenNthCalledWith(
      1,
      "SELECT set_config('app.authenticated_user_id', $1, true)",
      [context.authenticatedUserId]
    );
    expect(client.query).toHaveBeenNthCalledWith(
      2,
      "SELECT set_config('app.scope_kind', $1, true)",
      ["MUNICIPAL"]
    );
    expect(client.query).toHaveBeenNthCalledWith(
      3,
      "SELECT set_config('app.territory_id', $1, true)",
      ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"]
    );
  });

  it("clears territory_id for an explicit GLOBAL scope", async () => {
    const client = createClient();

    await configureTenantContext(client, {
      authenticatedUserId: "22222222-2222-4222-8222-222222222222",
      alcanceTerritorial: { kind: "GLOBAL" },
    });

    expect(client.query).toHaveBeenNthCalledWith(
      3,
      "SELECT set_config('app.territory_id', $1, true)",
      [""]
    );
  });
});

describe("runtime database role guard", () => {
  it("accepts the non-login runtime role only when it cannot bypass RLS or administer the database", () => {
    expect(() =>
      assertRuntimeDatabaseRole({
        role_name: "shippiyyukon_runtime",
        is_superuser: false,
        can_create_db: false,
        can_create_role: false,
        bypasses_rls: false,
        owns_sensitive_tables: false,
        sensitive_rls_incomplete: false,
      })
    ).not.toThrow();

    expect(() =>
      assertRuntimeDatabaseRole({
        role_name: "shippiyyukon_runtime",
        is_superuser: false,
        can_create_db: true,
        can_create_role: false,
        bypasses_rls: true,
        owns_sensitive_tables: false,
        sensitive_rls_incomplete: false,
      })
    ).toThrow(/subject to RLS/);

    expect(() =>
      assertRuntimeDatabaseRole({
        role_name: "shippiyyukon_runtime",
        is_superuser: false,
        can_create_db: false,
        can_create_role: false,
        bypasses_rls: false,
        owns_sensitive_tables: true,
        sensitive_rls_incomplete: false,
      })
    ).toThrow(/subject to RLS/);

    expect(() =>
      assertRuntimeDatabaseRole({
        role_name: "shippiyyukon_runtime",
        is_superuser: false,
        can_create_db: false,
        can_create_role: false,
        bypasses_rls: false,
        owns_sensitive_tables: false,
        sensitive_rls_incomplete: true,
      })
    ).toThrow(/subject to RLS/);

    expect(() =>
      assertRuntimeDatabaseRole({
        role_name: "neondb_owner",
        is_superuser: false,
        can_create_db: false,
        can_create_role: false,
        bypasses_rls: false,
        owns_sensitive_tables: false,
        sensitive_rls_incomplete: false,
      })
    ).toThrow(/subject to RLS/);
  });
});
