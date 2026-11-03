import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import type { PoolClient } from "pg";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  requiere: vi.fn(),
  withTenantContext: vi.fn(),
  siguienteCorrelativo: vi.fn(),
  query: vi.fn(),
}));

vi.mock("../../middleware/auth", () => ({
  authenticate: mocks.authenticate,
  AuthError: class AuthError extends Error {
    constructor(
      message: string,
      public readonly statusCode: 401 | 403 = 401
    ) {
      super(message);
    }
  },
}));

vi.mock("../../middleware/rbac", () => ({
  requiere: mocks.requiere,
}));

vi.mock("../../db/client", () => ({
  withTenantContext: mocks.withTenantContext,
  siguienteCorrelativo: mocks.siguienteCorrelativo,
}));

import { handler } from "./approve";

const usuario = {
  sub: "usuario-prueba-001",
  rolPlataforma: "MASTER" as never,
};

const consejeroPendiente = {
  id: "consejero-prueba-001",
  nombres: "Ana",
  apellidos: "Pérez",
  estado: "Anzoátegui",
  municipio: "Cantaura",
  genero: "F",
  estado_registro: "PENDIENTE",
};

function evento(
  decision: string,
  id = "consejero-prueba-001"
): APIGatewayProxyEventV2 {
  return {
    pathParameters: { id },
    headers: {},
    body: JSON.stringify({ decision }),
  } as unknown as APIGatewayProxyEventV2;
}

function respuesta(result: Awaited<ReturnType<typeof handler>>) {
  return {
    statusCode: result.statusCode,
    body: JSON.parse(result.body ?? "{}"),
  };
}

describe("POST /consejeros/{id}/approve", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.authenticate.mockResolvedValue(usuario);
    mocks.requiere.mockReturnValue(undefined);
    mocks.siguienteCorrelativo.mockResolvedValue(14);

    mocks.withTenantContext.mockImplementation(
      async (_context: unknown, callback: (client: PoolClient) => Promise<unknown>) =>
        callback({ query: mocks.query } as unknown as PoolClient)
    );
  });

  it("responde 404 cuando el consejero no existe", async () => {
    mocks.query.mockResolvedValueOnce({ rows: [] });

    const result = respuesta(await handler(evento("APROBADO")));

    expect(result.statusCode).toBe(404);
    expect(result.body.error.code).toBe("NOT_FOUND");
    expect(mocks.siguienteCorrelativo).not.toHaveBeenCalled();
  });

  it.each(["APROBADO", "RECHAZADO"])(
    "responde 409 cuando el registro ya está en estado %s",
    async (estado) => {
      mocks.query.mockResolvedValueOnce({
        rows: [{ ...consejeroPendiente, estado_registro: estado }],
      });

      const result = respuesta(await handler(evento("APROBADO")));

      expect(result.statusCode).toBe(409);
      expect(result.body.error.code).toBe("CONFLICT");
      expect(mocks.siguienteCorrelativo).not.toHaveBeenCalled();
    }
  );

  it("aprueba un registro pendiente y genera su código único", async () => {
    const actualizado = {
      id: consejeroPendiente.id,
      estado_registro: "APROBADO",
      codigo_unico: "AP-ANZ-CAN-F-014",
      fecha_aprobacion: "2026-11-03T12:00:00.000Z",
    };

    mocks.query
      .mockResolvedValueOnce({ rows: [consejeroPendiente] })
      .mockResolvedValueOnce({ rows: [actualizado] });

    const result = respuesta(await handler(evento("APROBADO")));

    expect(result.statusCode).toBe(200);
    expect(result.body.data).toEqual(actualizado);
    expect(mocks.siguienteCorrelativo).toHaveBeenCalledWith(
      expect.anything(),
      "Cantaura"
    );

    const selectSQL = mocks.query.mock.calls[0][0] as string;
    const updateSQL = mocks.query.mock.calls[1][0] as string;

    expect(selectSQL).toMatch(/FOR UPDATE/i);
    expect(updateSQL).toMatch(
      /WHERE id = \$1\s+AND estado_registro = 'PENDIENTE'/i
    );
  });

  it("rechaza un registro pendiente sin reservar correlativo", async () => {
    const actualizado = {
      id: consejeroPendiente.id,
      estado_registro: "RECHAZADO",
    };

    mocks.query
      .mockResolvedValueOnce({ rows: [consejeroPendiente] })
      .mockResolvedValueOnce({ rows: [actualizado] });

    const result = respuesta(await handler(evento("RECHAZADO")));

    expect(result.statusCode).toBe(200);
    expect(result.body.data).toEqual(actualizado);
    expect(mocks.siguienteCorrelativo).not.toHaveBeenCalled();

    const updateSQL = mocks.query.mock.calls[1][0] as string;

    expect(updateSQL).toMatch(
      /WHERE id = \$1\s+AND estado_registro = 'PENDIENTE'/i
    );
  });

  it("responde 409 si el UPDATE de aprobación no afecta una fila", async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [consejeroPendiente] })
      .mockResolvedValueOnce({ rows: [] });

    const result = respuesta(await handler(evento("APROBADO")));

    expect(result.statusCode).toBe(409);
    expect(result.body.error.code).toBe("CONFLICT");
    expect(mocks.siguienteCorrelativo).toHaveBeenCalledOnce();
  });

  it("responde 409 si el UPDATE de rechazo no afecta una fila", async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [consejeroPendiente] })
      .mockResolvedValueOnce({ rows: [] });

    const result = respuesta(await handler(evento("RECHAZADO")));

    expect(result.statusCode).toBe(409);
    expect(result.body.error.code).toBe("CONFLICT");
    expect(mocks.siguienteCorrelativo).not.toHaveBeenCalled();
  });

  it("responde 422 cuando la decisión no es válida", async () => {
    const result = respuesta(await handler(evento("OTRA_DECISION")));

    expect(result.statusCode).toBe(422);
    expect(mocks.withTenantContext).not.toHaveBeenCalled();
  });

  it("no expone detalles de errores de base de datos en la respuesta", async () => {
    const databaseError = new Error("relation consejeros_private does not exist");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.query.mockRejectedValueOnce(databaseError);

    const result = respuesta(await handler(evento("APROBADO")));

    expect(result.statusCode).toBe(500);
    expect(result.body.error.code).toBe("INTERNAL_ERROR");
    expect(result.body.error.message).toBe(
      "Error interno al procesar la decisión de aprobación"
    );
    expect(result.body.error.message).not.toContain(databaseError.message);
    expect(consoleError).toHaveBeenCalledWith(
      "Error interno al procesar aprobación:",
      databaseError
    );

    consoleError.mockRestore();
  });
});
