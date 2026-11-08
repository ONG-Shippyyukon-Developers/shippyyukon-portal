import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PoolClient } from "pg";
import { RolPlataforma } from "@shippiyyukon/shared";
import { AuthError } from "../../middleware/auth-model";

const mocks = vi.hoisted(() => ({
  requiere: vi.fn(),
  withTenantContext: vi.fn(),
  query: vi.fn(),
}));

vi.mock("../../middleware/rbac", () => ({
  requiere: mocks.requiere,
}));

vi.mock("../../db/client", () => ({
  withTenantContext: mocks.withTenantContext,
}));

import { handleList } from "./list-handler";

describe("GET /consejeros HTTP handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requiere.mockReturnValue(undefined);
    mocks.query.mockResolvedValue({ rows: [{ id: "consejero-001" }] });
    mocks.withTenantContext.mockImplementation(
      async (_context: unknown, callback: (client: PoolClient) => Promise<unknown>) =>
        callback({ query: mocks.query } as unknown as PoolClient)
    );
  });

  it("uses the runtime-independent request and preserves the user's territorial context", async () => {
    const user = {
      sub: "11111111-1111-4111-8111-111111111111",
      rolPlataforma: RolPlataforma.COORDINADOR_MUNICIPAL,
      municipio: "Municipio A",
      alcanceTerritorial: {
        kind: "MUNICIPAL" as const,
        territoryId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        estado: "Estado 1",
        municipio: "Municipio A",
      },
    };

    const response = await handleList(
      {
        headers: {},
        query: { municipio: "Municipio A", q: "Ana" },
      },
      user
    );

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      ok: true,
      data: [{ id: "consejero-001" }],
    });
    expect(mocks.requiere).toHaveBeenCalledWith(user, "consejero:listar");
    expect(mocks.withTenantContext).toHaveBeenCalledWith(
      {
        authenticatedUserId: user.sub,
        alcanceTerritorial: user.alcanceTerritorial,
      },
      expect.any(Function)
    );
    expect(mocks.query).toHaveBeenCalledWith(
      expect.stringContaining("territorio_id = $1"),
      ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "Municipio A", "%Ana%"]
    );
  });

  it("denies a municipal filter outside the assigned municipality", async () => {
    const user = {
      sub: "11111111-1111-4111-8111-111111111111",
      rolPlataforma: RolPlataforma.COORDINADOR_MUNICIPAL,
      municipio: "Municipio A",
      alcanceTerritorial: {
        kind: "MUNICIPAL" as const,
        territoryId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        estado: "Estado 1",
        municipio: "Municipio A",
      },
    };

    const response = await handleList(
      { headers: {}, query: { municipio: "Municipio B" } },
      user
    );

    expect(response.statusCode).toBe(403);
    expect(JSON.parse(response.body).error.code).toBe("AUTH_ERROR");
    expect(mocks.withTenantContext).not.toHaveBeenCalled();
  });

  it("denies a repeated municipality name in another state", async () => {
    const user = {
      sub: "11111111-1111-4111-8111-111111111111",
      rolPlataforma: RolPlataforma.COORDINADOR_MUNICIPAL,
      alcanceTerritorial: {
        kind: "MUNICIPAL" as const,
        territoryId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        estado: "Estado 1",
        municipio: "Municipio A",
      },
    };

    const response = await handleList(
      { headers: {}, query: { municipio: "Municipio A", estado: "Estado 2" } },
      user
    );

    expect(response.statusCode).toBe(403);
    expect(mocks.withTenantContext).not.toHaveBeenCalled();
  });

  it("allows an explicitly GLOBAL assignment to request another municipality", async () => {
    const user = {
      sub: "33333333-3333-4333-8333-333333333333",
      rolPlataforma: RolPlataforma.COORDINADOR_MUNICIPAL,
      alcanceTerritorial: { kind: "GLOBAL" as const },
    };

    const response = await handleList(
      { headers: {}, query: { municipio: "Municipio B" } },
      user
    );

    expect(response.statusCode).toBe(200);
    expect(mocks.withTenantContext).toHaveBeenCalledWith(
      {
        authenticatedUserId: user.sub,
        alcanceTerritorial: { kind: "GLOBAL" },
      },
      expect.any(Function)
    );
    expect(mocks.query).toHaveBeenCalledWith(
      expect.stringContaining("municipio = $1"),
      ["Municipio B"]
    );
  });

  it("does not grant global scope to an elevated role with a MUNICIPAL assignment", async () => {
    const user = {
      sub: "44444444-4444-4444-8444-444444444444",
      rolPlataforma: RolPlataforma.MASTER,
      municipio: "Municipio A",
      alcanceTerritorial: {
        kind: "MUNICIPAL" as const,
        territoryId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        estado: "Estado 1",
        municipio: "Municipio A",
      },
    };

    const response = await handleList(
      { headers: {}, query: { municipio: "Municipio B" } },
      user
    );

    expect(response.statusCode).toBe(403);
    expect(mocks.withTenantContext).not.toHaveBeenCalled();
  });

  it("always constrains a MUNICIPAL assignment to its municipality, even without a filter", async () => {
    const user = {
      sub: "44444444-4444-4444-8444-444444444444",
      rolPlataforma: RolPlataforma.MASTER,
      municipio: "Municipio A",
      alcanceTerritorial: {
        kind: "MUNICIPAL" as const,
        territoryId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        estado: "Estado 1",
        municipio: "Municipio A",
      },
    };

    await handleList({ headers: {}, query: {} }, user);

    expect(mocks.query).toHaveBeenCalledWith(
      expect.stringMatching(/WHERE territorio_id = \$1/i),
      ["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"]
    );
    expect(mocks.withTenantContext).toHaveBeenCalledWith(
      expect.objectContaining({
        authenticatedUserId: user.sub,
        alcanceTerritorial: {
          kind: "MUNICIPAL",
          territoryId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          estado: "Estado 1",
          municipio: "Municipio A",
        },
      }),
      expect.any(Function)
    );
  });
});
