import { beforeEach, describe, expect, it, vi } from "vitest";
import { RolPlataforma } from "@shippiyyukon/shared";

const mocks = vi.hoisted(() => ({
  withAuthorizationUserContext: vi.fn(),
  query: vi.fn(),
}));

vi.mock("../db/client", () => ({
  withAuthorizationUserContext: mocks.withAuthorizationUserContext,
}));

import { NeonAuthorizationAssignmentRepository } from "./authorization-resolver";

const identity = {
  provider: "BETTER_AUTH" as const,
  subject: "11111111-1111-4111-8111-111111111111",
};

describe("NeonAuthorizationAssignmentRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.withAuthorizationUserContext.mockImplementation(
      async (_userId: string, callback: (client: unknown) => Promise<unknown>) =>
        callback({ query: mocks.query })
    );
    mocks.query.mockResolvedValue({
      rows: [{
        user_id: identity.subject,
        role: "COORDINADOR_MUNICIPAL",
        cto_dev_position: null,
        scope_kind: "MUNICIPAL",
        territory_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        estado: "Estado 1",
        municipio: "Municipio A",
      }],
    });
  });

  it("loads the current assignment and resolves the canonical territory", async () => {
    const repository = new NeonAuthorizationAssignmentRepository();

    await expect(repository.findActiveAssignment(identity)).resolves.toEqual({
      identity,
      rolPlataforma: RolPlataforma.COORDINADOR_MUNICIPAL,
      alcanceTerritorial: {
        kind: "MUNICIPAL",
        territoryId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        estado: "Estado 1",
        municipio: "Municipio A",
      },
    });
    expect(mocks.withAuthorizationUserContext).toHaveBeenCalledWith(
      identity.subject,
      expect.any(Function)
    );
    const [sql, params] = mocks.query.mock.calls[0];
    expect(sql).toContain("assignment.is_active = TRUE");
    expect(sql).toContain("assignment.revoked_at IS NULL");
    expect(sql).toContain("assignment.valid_from <= now()");
    expect(sql).toContain("assignment.valid_until > now()");
    expect(params).toEqual([identity.subject]);
  });

  it("does not query Neon when identity subject is not a UUID", async () => {
    const repository = new NeonAuthorizationAssignmentRepository();

    await expect(
      repository.findActiveAssignment({
        provider: "BETTER_AUTH",
        subject: "not-a-uuid",
      })
    ).rejects.toMatchObject({ statusCode: 401 });
    expect(mocks.withAuthorizationUserContext).not.toHaveBeenCalled();
  });

  it("returns no assignment when the database has no active match", async () => {
    mocks.query.mockResolvedValueOnce({ rows: [] });
    const repository = new NeonAuthorizationAssignmentRepository();

    await expect(repository.findActiveAssignment(identity)).resolves.toBeNull();
  });

  it("supports only consistent global assignments", async () => {
    mocks.query.mockResolvedValueOnce({
      rows: [{
        user_id: identity.subject,
        role: "MASTER",
        cto_dev_position: null,
        scope_kind: "GLOBAL",
        territory_id: null,
        estado: null,
        municipio: null,
      }],
    });
    const repository = new NeonAuthorizationAssignmentRepository();

    await expect(repository.findActiveAssignment(identity)).resolves.toMatchObject({
      rolPlataforma: RolPlataforma.MASTER,
      alcanceTerritorial: { kind: "GLOBAL" },
    });

    mocks.query.mockResolvedValueOnce({
      rows: [{
        user_id: identity.subject,
        role: "MASTER",
        cto_dev_position: null,
        scope_kind: "GLOBAL",
        territory_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        estado: "Estado 1",
        municipio: "Municipio A",
      }],
    });
    await expect(repository.findActiveAssignment(identity)).rejects.toThrow(
      "inconsistent territorial scope"
    );
  });

  it("bootstraps the allowlisted identity once and reloads its CTO assignment", async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ bootstrapped: true }] })
      .mockResolvedValueOnce({
        rows: [{
          user_id: identity.subject,
          role: "CTO_DEV",
          cto_dev_position: "PRIMARY",
          scope_kind: "GLOBAL",
          territory_id: null,
          estado: null,
          municipio: null,
        }],
      });
    const repository = new NeonAuthorizationAssignmentRepository();

    await expect(repository.findActiveAssignment(identity)).resolves.toMatchObject({
      rolPlataforma: RolPlataforma.CTO_DEV,
      ctoDevPosition: "PRIMARY",
      alcanceTerritorial: { kind: "GLOBAL" },
    });
    expect(mocks.query).toHaveBeenNthCalledWith(
      2,
      "SELECT public.bootstrap_initial_cto_dev() AS bootstrapped"
    );
  });

  it("fails closed for a CTO/DEV assignment without a primary or secondary position", async () => {
    mocks.query.mockResolvedValueOnce({
      rows: [{
        user_id: identity.subject,
        role: "CTO_DEV",
        cto_dev_position: null,
        scope_kind: "GLOBAL",
        territory_id: null,
        estado: null,
        municipio: null,
      }],
    });
    const repository = new NeonAuthorizationAssignmentRepository();

    await expect(repository.findActiveAssignment(identity)).rejects.toThrow(
      "without a position"
    );
  });
});
