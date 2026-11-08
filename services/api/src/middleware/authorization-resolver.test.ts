import { describe, expect, it, vi } from "vitest";
import { RolPlataforma } from "@shippiyyukon/shared";
import { AuthError } from "./auth-model";
import type { AuthenticatedIdentity } from "./auth-boundary";
import {
  RepositoryAuthorizationResolver,
  type AuthorizationAssignmentRepository,
} from "./authorization-resolver";

describe("RepositoryAuthorizationResolver", () => {
  it("resolves role and territorial scope from an authorized assignment", async () => {
    const identity: AuthenticatedIdentity = {
      provider: "BETTER_AUTH",
      subject: "identity-001",
    };
    const repository: AuthorizationAssignmentRepository = {
      findActiveAssignment: vi.fn().mockResolvedValue({
        identity,
        rolPlataforma: RolPlataforma.COORDINADOR_MUNICIPAL,
        alcanceTerritorial: {
          kind: "MUNICIPAL",
          territoryId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          estado: "Estado 1",
          municipio: "Municipio A",
        },
      }),
    };
    const resolver = new RepositoryAuthorizationResolver(repository);

    await expect(resolver.resolve(identity)).resolves.toEqual({
      sub: "identity-001",
      rolPlataforma: RolPlataforma.COORDINADOR_MUNICIPAL,
      alcanceTerritorial: {
        kind: "MUNICIPAL",
        territoryId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        estado: "Estado 1",
        municipio: "Municipio A",
      },
    });
    expect(repository.findActiveAssignment).toHaveBeenCalledWith(identity);
  });

  it("uses the assigned role and explicit global scope, not provider claims", async () => {
    const identity: AuthenticatedIdentity = {
      provider: "BETTER_AUTH",
      subject: "identity-002",
    };
    const repository: AuthorizationAssignmentRepository = {
      findActiveAssignment: vi.fn().mockResolvedValue({
        identity,
        rolPlataforma: RolPlataforma.MASTER,
        alcanceTerritorial: { kind: "GLOBAL" },
      }),
    };
    const resolver = new RepositoryAuthorizationResolver(repository);

    await expect(resolver.resolve(identity)).resolves.toEqual({
      sub: "identity-002",
      rolPlataforma: RolPlataforma.MASTER,
      alcanceTerritorial: { kind: "GLOBAL" },
    });
  });

  it("rejects CTO/DEV assignments without explicit GLOBAL scope", async () => {
    const identity: AuthenticatedIdentity = {
      provider: "BETTER_AUTH",
      subject: "identity-cto-municipal",
    };
    const repository: AuthorizationAssignmentRepository = {
      findActiveAssignment: vi.fn().mockResolvedValue({
        identity,
        rolPlataforma: RolPlataforma.CTO_DEV,
        ctoDevPosition: "PRIMARY",
        alcanceTerritorial: {
          kind: "MUNICIPAL",
          territoryId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          estado: "Estado 1",
          municipio: "Municipio A",
        },
      }),
    };
    const resolver = new RepositoryAuthorizationResolver(repository);

    await expect(resolver.resolve(identity)).rejects.toMatchObject({
      statusCode: 403,
      message: "La asignación CTO/DEV requiere posición y alcance GLOBAL explícitos",
    });
  });

  it("preserves the assigned CTO/DEV position", async () => {
    const identity: AuthenticatedIdentity = {
      provider: "BETTER_AUTH",
      subject: "identity-cto-primary",
    };
    const repository: AuthorizationAssignmentRepository = {
      findActiveAssignment: vi.fn().mockResolvedValue({
        identity,
        rolPlataforma: RolPlataforma.CTO_DEV,
        ctoDevPosition: "PRIMARY",
        alcanceTerritorial: { kind: "GLOBAL" },
      }),
    };
    const resolver = new RepositoryAuthorizationResolver(repository);

    await expect(resolver.resolve(identity)).resolves.toMatchObject({
      rolPlataforma: RolPlataforma.CTO_DEV,
      ctoDevPosition: "PRIMARY",
      alcanceTerritorial: { kind: "GLOBAL" },
    });
  });

  it("rejects an assignment returned for a different subject", async () => {
    const repository: AuthorizationAssignmentRepository = {
      findActiveAssignment: vi.fn().mockResolvedValue({
        identity: { provider: "BETTER_AUTH", subject: "different-subject" },
        rolPlataforma: RolPlataforma.COORDINADOR_MUNICIPAL,
        alcanceTerritorial: {
          kind: "MUNICIPAL",
          territoryId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          estado: "Estado 1",
          municipio: "Municipio A",
        },
      }),
    };
    const resolver = new RepositoryAuthorizationResolver(repository);

    const resolution = resolver.resolve({
      provider: "BETTER_AUTH",
      subject: "shared-subject",
    });
    await expect(resolution).rejects.toBeInstanceOf(AuthError);
    await expect(resolution).rejects.toMatchObject({ statusCode: 403 });
  });

  it("denies identities without an authorized assignment", async () => {
    const repository: AuthorizationAssignmentRepository = {
      findActiveAssignment: vi.fn().mockResolvedValue(null),
    };
    const resolver = new RepositoryAuthorizationResolver(repository);

    const resolution = resolver.resolve({
      provider: "BETTER_AUTH",
      subject: "unassigned-identity",
    });
    await expect(resolution).rejects.toBeInstanceOf(AuthError);
    await expect(resolution).rejects.toMatchObject({ statusCode: 403 });
  });

  it("propagates repository failures instead of returning a success-shaped fallback", async () => {
    const repositoryError = new Error("authorization repository unavailable");
    const repository: AuthorizationAssignmentRepository = {
      findActiveAssignment: vi.fn().mockRejectedValue(repositoryError),
    };
    const resolver = new RepositoryAuthorizationResolver(repository);

    await expect(
      resolver.resolve({ provider: "BETTER_AUTH", subject: "identity-001" })
    ).rejects.toBe(repositoryError);
  });
});
