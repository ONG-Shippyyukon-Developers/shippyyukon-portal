import { beforeEach, describe, expect, it, vi } from "vitest";
import { RolPlataforma } from "@shippiyyukon/shared";
import { AuthError } from "../../middleware/auth-model";
import type { AuthenticatedUser } from "../../middleware/auth-model";
import type { HttpRequest } from "../../http/types";

const mocks = vi.hoisted(() => ({
  requiereCtoDevPrincipal: vi.fn(),
  assignSecondaryCtoDev: vi.fn(),
  revokeSecondaryCtoDev: vi.fn(),
}));

vi.mock("../../middleware/rbac", () => ({
  requiereCtoDevPrincipal: mocks.requiereCtoDevPrincipal,
}));

vi.mock("../../db/client", () => ({
  assignSecondaryCtoDev: mocks.assignSecondaryCtoDev,
  revokeSecondaryCtoDev: mocks.revokeSecondaryCtoDev,
}));

import {
  handleAssignSecondaryCtoDev,
  handleRevokeSecondaryCtoDev,
} from "./cto-dev-authority-handler";

const primary: AuthenticatedUser = {
  sub: "11111111-1111-4111-8111-111111111111",
  rolPlataforma: RolPlataforma.CTO_DEV,
  ctoDevPosition: "PRIMARY",
  alcanceTerritorial: { kind: "GLOBAL" },
};

const secondaryId = "22222222-2222-4222-8222-222222222222";

function request(targetUserId = secondaryId, reason = "Cobertura técnica"): HttpRequest {
  return {
    headers: {},
    body: JSON.stringify({ targetUserId, reason }),
  };
}

function parseBody(body: string) {
  return JSON.parse(body);
}

describe("CTO/DEV authority handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requiereCtoDevPrincipal.mockReturnValue(undefined);
    mocks.assignSecondaryCtoDev.mockResolvedValue(
      "33333333-3333-4333-8333-333333333333"
    );
    mocks.revokeSecondaryCtoDev.mockResolvedValue(undefined);
  });

  it("assigns the secondary only after primary authorization", async () => {
    const response = await handleAssignSecondaryCtoDev(request(), primary);

    expect(response.statusCode).toBe(201);
    expect(parseBody(response.body).data).toEqual({
      assignmentId: "33333333-3333-4333-8333-333333333333",
      position: "SECONDARY",
    });
    expect(mocks.requiereCtoDevPrincipal).toHaveBeenCalledWith(primary);
    expect(mocks.assignSecondaryCtoDev).toHaveBeenCalledWith(
      primary.sub,
      secondaryId,
      "Cobertura técnica"
    );
  });

  it("revokes only the secondary after primary authorization", async () => {
    const response = await handleRevokeSecondaryCtoDev(request(), primary);

    expect(response.statusCode).toBe(200);
    expect(parseBody(response.body).data).toEqual({
      revoked: true,
      position: "SECONDARY",
    });
    expect(mocks.revokeSecondaryCtoDev).toHaveBeenCalledWith(
      primary.sub,
      secondaryId,
      "Cobertura técnica"
    );
  });

  it("does not call assignment storage when the actor is not primary", async () => {
    mocks.requiereCtoDevPrincipal.mockImplementationOnce(() => {
      throw new AuthError(
        "Solo el CTO/DEV principal puede administrar al segundo CTO/DEV",
        403
      );
    });

    const response = await handleAssignSecondaryCtoDev(request(), primary);

    expect(response.statusCode).toBe(403);
    expect(mocks.assignSecondaryCtoDev).not.toHaveBeenCalled();
  });

  it("validates the target and reason before calling the database", async () => {
    const badTarget = await handleAssignSecondaryCtoDev(
      request("not-a-uuid"),
      primary
    );
    const emptyReason = await handleRevokeSecondaryCtoDev(
      request(secondaryId, "  "),
      primary
    );

    expect(badTarget.statusCode).toBe(422);
    expect(emptyReason.statusCode).toBe(422);
    expect(mocks.assignSecondaryCtoDev).not.toHaveBeenCalled();
    expect(mocks.revokeSecondaryCtoDev).not.toHaveBeenCalled();
  });

  it("maps database authorization and uniqueness rejections explicitly", async () => {
    mocks.assignSecondaryCtoDev.mockRejectedValueOnce({ code: "42501" });
    const denied = await handleAssignSecondaryCtoDev(request(), primary);

    mocks.revokeSecondaryCtoDev.mockRejectedValueOnce({ code: "23505" });
    const conflict = await handleRevokeSecondaryCtoDev(request(), primary);

    expect(denied.statusCode).toBe(403);
    expect(conflict.statusCode).toBe(409);
  });
});
