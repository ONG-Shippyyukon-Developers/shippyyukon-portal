import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PoolClient } from "pg";
import { RolPlataforma } from "@shippiyyukon/shared";
import type { AuthenticatedUser } from "../../middleware/auth-model";
import type { HttpRequest } from "../../http/types";

const mocks = vi.hoisted(() => ({
  requiere: vi.fn(),
  withTenantContext: vi.fn(),
  siguienteCorrelativo: vi.fn(),
  query: vi.fn(),
}));

vi.mock("../../middleware/rbac", () => ({
  requiere: mocks.requiere,
}));

vi.mock("../../db/client", () => ({
  withTenantContext: mocks.withTenantContext,
  siguienteCorrelativo: mocks.siguienteCorrelativo,
}));

import { handleApprove } from "./approve-handler";

const usuario: AuthenticatedUser = {
  sub: "11111111-1111-4111-8111-111111111111",
  rolPlataforma: RolPlataforma.CTO_DEV,
  alcanceTerritorial: {
    kind: "MUNICIPAL",
    territoryId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    estado: "Estado 1",
    municipio: "Municipio A",
  },
};

const consejeroPendiente = {
  id: "consejero-001",
  nombres: "Ana",
  apellidos: "Pérez",
  estado: "Estado 1",
  municipio: "Municipio A",
  territorio_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  genero: "F",
  estado_registro: "PENDIENTE",
};

function request(decision: string, id = consejeroPendiente.id): HttpRequest {
  return {
    headers: {},
    params: { id },
    body: JSON.stringify({ decision }),
  };
}

function parseBody(body: string) {
  return JSON.parse(body);
}

describe("approve HTTP handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requiere.mockReturnValue(undefined);
    mocks.siguienteCorrelativo.mockResolvedValue(14);
    mocks.withTenantContext.mockImplementation(
      async (_context: unknown, callback: (client: PoolClient) => Promise<unknown>) =>
        callback({ query: mocks.query } as unknown as PoolClient)
    );
  });

  it("applies RBAC and passes the assigned municipality into the database context", async () => {
    const updated = {
      id: consejeroPendiente.id,
      estado_registro: "RECHAZADO",
    };
    mocks.query
      .mockResolvedValueOnce({ rows: [consejeroPendiente] })
      .mockResolvedValueOnce({ rows: [updated] });

    const response = await handleApprove(request("RECHAZADO"), usuario);

    expect(response.statusCode).toBe(200);
    expect(parseBody(response.body).data).toEqual(updated);
    expect(mocks.requiere).toHaveBeenCalledWith(usuario, "consejero:aprobar");
    expect(mocks.withTenantContext).toHaveBeenCalledWith(
      {
        authenticatedUserId: usuario.sub,
        alcanceTerritorial: usuario.alcanceTerritorial,
      },
      expect.any(Function)
    );
    expect(mocks.query.mock.calls[0][0]).toMatch(/territorio_id = \$2/i);
    expect(mocks.query.mock.calls[0][1]).toEqual([
      consejeroPendiente.id,
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    ]);
    expect(mocks.query.mock.calls[1][0]).toMatch(/territorio_id = \$3/i);
    expect(mocks.query.mock.calls[1][1]).toEqual([
      consejeroPendiente.id,
      usuario.sub,
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    ]);
  });

  it("returns 404 when the requested record is not visible or does not exist", async () => {
    mocks.query.mockResolvedValueOnce({ rows: [] });

    const response = await handleApprove(request("APROBADO"), usuario);

    expect(response.statusCode).toBe(404);
    expect(parseBody(response.body).error.code).toBe("NOT_FOUND");
    expect(mocks.siguienteCorrelativo).not.toHaveBeenCalled();
  });

  it("does not update a record outside a MUNICIPAL assignment, even for MASTER", async () => {
    const masterMunicipal: AuthenticatedUser = {
      sub: "33333333-3333-4333-8333-333333333333",
      rolPlataforma: RolPlataforma.MASTER,
      alcanceTerritorial: {
        kind: "MUNICIPAL",
        territoryId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        estado: "Estado 1",
        municipio: "Municipio A",
      },
    };
    mocks.query.mockResolvedValueOnce({
      rows: [{
        ...consejeroPendiente,
        municipio: "Municipio A",
        territorio_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      }],
    });

    const response = await handleApprove(
      request("APROBADO"),
      masterMunicipal
    );

    expect(response.statusCode).toBe(404);
    expect(parseBody(response.body).error.code).toBe("NOT_FOUND");
    expect(mocks.query).toHaveBeenCalledTimes(1);
    expect(mocks.query.mock.calls[0][0]).toMatch(/territorio_id = \$2/i);
    expect(mocks.query.mock.calls[0][1]).toEqual([
      consejeroPendiente.id,
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    ]);
    expect(mocks.siguienteCorrelativo).not.toHaveBeenCalled();
  });

  it("allows GLOBAL assignment to approve a record in another municipality", async () => {
    const globallyAssignedUser: AuthenticatedUser = {
      sub: "44444444-4444-4444-8444-444444444444",
      rolPlataforma: RolPlataforma.MASTER,
      alcanceTerritorial: { kind: "GLOBAL" },
    };
    const otherMunicipalityRecord = {
      ...consejeroPendiente,
      municipio: "Municipio B",
    };
    const updated = {
      id: otherMunicipalityRecord.id,
      estado_registro: "RECHAZADO",
    };
    mocks.query
      .mockResolvedValueOnce({ rows: [otherMunicipalityRecord] })
      .mockResolvedValueOnce({ rows: [updated] });

    const response = await handleApprove(
      request("RECHAZADO"),
      globallyAssignedUser
    );

    expect(response.statusCode).toBe(200);
    expect(mocks.withTenantContext).toHaveBeenCalledWith(
      {
        authenticatedUserId: globallyAssignedUser.sub,
        alcanceTerritorial: { kind: "GLOBAL" },
      },
      expect.any(Function)
    );
    expect(mocks.query.mock.calls[0][0]).not.toMatch(/municipio =/i);
  });

  it("returns 422 for an invalid decision before opening a database context", async () => {
    const response = await handleApprove(request("OTRA_DECISION"), usuario);

    expect(response.statusCode).toBe(422);
    expect(mocks.withTenantContext).not.toHaveBeenCalled();
  });

  it("approves a pending record and generates its code atomically", async () => {
    const updated = {
      id: consejeroPendiente.id,
      estado_registro: "APROBADO",
      codigo_unico: "AP-EST-MUN-F-014",
      fecha_aprobacion: "2026-11-05T12:00:00.000Z",
    };
    mocks.query
      .mockResolvedValueOnce({ rows: [consejeroPendiente] })
      .mockResolvedValueOnce({ rows: [updated] });

    const response = await handleApprove(request("APROBADO"), usuario);

    expect(response.statusCode).toBe(200);
    expect(parseBody(response.body).data).toEqual(updated);
    expect(mocks.siguienteCorrelativo).toHaveBeenCalledWith(
      expect.anything(),
      consejeroPendiente.territorio_id
    );
    expect(mocks.query.mock.calls[0][0]).toMatch(/FOR UPDATE/i);
    expect(mocks.query.mock.calls[1][0]).toMatch(/territorio_id = \$4/i);
    expect(mocks.query.mock.calls[1][1]).toEqual([
      consejeroPendiente.id,
      updated.codigo_unico,
      usuario.sub,
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    ]);
  });

  it("does not expose database error details", async () => {
    const databaseError = new Error("private database detail");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.query.mockRejectedValueOnce(databaseError);

    const response = await handleApprove(request("APROBADO"), usuario);

    expect(response.statusCode).toBe(500);
    expect(parseBody(response.body).error).toEqual({
      code: "INTERNAL_ERROR",
      message: "Error interno al procesar la decisión de aprobación",
    });
    expect(parseBody(response.body).error.message).not.toContain(databaseError.message);
    consoleError.mockRestore();
  });
});
