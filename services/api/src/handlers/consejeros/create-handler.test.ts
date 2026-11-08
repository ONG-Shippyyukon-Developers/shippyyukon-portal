import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PoolClient } from "pg";
import {
  RolConsejero,
  RolPlataforma,
  ViaIngreso,
  type ConsejeroInput,
} from "@shippiyyukon/shared";
import { AuthError } from "../../middleware/auth-model";

const mocks = vi.hoisted(() => ({
  requiere: vi.fn(),
  requiereAlcanceTerritorio: vi.fn(),
  withTenantContext: vi.fn(),
  query: vi.fn(),
}));

vi.mock("../../middleware/rbac", () => ({
  requiere: mocks.requiere,
  requiereAlcanceTerritorio: mocks.requiereAlcanceTerritorio,
}));

vi.mock("../../db/client", () => ({
  withTenantContext: mocks.withTenantContext,
}));

import { handleCreate } from "./create-handler";

const usuario = {
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

const input: ConsejeroInput = {
  nombres: "Carla",
  apellidos: "Marín",
  rol: RolConsejero.CONSEJERO_PRINCIPAL,
  numeroResolucion: "RES-2026-014",
  fechaIngreso: "2022-03-01",
  viaIngreso: ViaIngreso.CONCURSO_OPOSICION,
  estado: "Estado 1",
  municipio: "Municipio A",
  genero: "F",
  cedulaUltimos2: "45",
};

describe("POST /consejeros HTTP handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requiere.mockReturnValue(undefined);
    mocks.requiereAlcanceTerritorio.mockReturnValue(undefined);
    mocks.query.mockResolvedValue({
      rows: [{ id: "consejero-001", estado_registro: "PENDIENTE" }],
    });
    mocks.withTenantContext.mockImplementation(
      async (_context: unknown, callback: (client: PoolClient) => Promise<unknown>) =>
        callback({ query: mocks.query } as unknown as PoolClient)
    );
  });

  it("autoriza, valida alcance y crea en el contexto territorial asignado", async () => {
    const response = await handleCreate(
      { headers: {}, body: JSON.stringify(input) },
      usuario
    );

    expect(response.statusCode).toBe(201);
    expect(JSON.parse(response.body)).toEqual({
      ok: true,
      data: { id: "consejero-001", estado_registro: "PENDIENTE" },
    });
    expect(mocks.requiere).toHaveBeenCalledWith(usuario, "consejero:crear");
    expect(mocks.requiereAlcanceTerritorio).toHaveBeenCalledWith(
      usuario,
      { estado: "Estado 1", municipio: "Municipio A" }
    );
    expect(mocks.withTenantContext).toHaveBeenCalledWith(
      {
        authenticatedUserId: usuario.sub,
        alcanceTerritorial: usuario.alcanceTerritorial,
      },
      expect.any(Function)
    );
    expect(mocks.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO consejeros"),
      expect.arrayContaining(["Carla", "Marín", "Municipio A", usuario.sub])
    );
  });

  it("rechaza datos territoriales inválidos sin acceder a PostgreSQL", async () => {
    const response = await handleCreate(
      {
        headers: {},
        body: JSON.stringify({ ...input, municipio: "Municipio inexistente" }),
      },
      usuario
    );

    expect(response.statusCode).toBe(422);
    expect(JSON.parse(response.body).error.code).toBe("VALIDATION_ERROR");
    expect(mocks.requiereAlcanceTerritorio).not.toHaveBeenCalled();
    expect(mocks.withTenantContext).not.toHaveBeenCalled();
  });

  it("deniega un municipio fuera del alcance antes de acceder a PostgreSQL", async () => {
    mocks.requiereAlcanceTerritorio.mockImplementation(() => {
      throw new AuthError("Fuera de alcance", 403);
    });

    const response = await handleCreate(
      { headers: {}, body: JSON.stringify({ ...input, municipio: "Municipio B" }) },
      usuario
    );

    expect(response.statusCode).toBe(403);
    expect(JSON.parse(response.body).error.code).toBe("AUTH_ERROR");
    expect(mocks.withTenantContext).not.toHaveBeenCalled();
  });
});
