import { describe, expect, it, vi } from "vitest";
import { RolPlataforma } from "@shippiyyukon/shared";
import type { HttpResponse } from "../src/http/types";
import type { AuthenticatedUser } from "../src/middleware/auth-model";
import { createApiRouter, type ApiRouterDependencies } from "./router";

const globalUser: AuthenticatedUser = {
  sub: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  rolPlataforma: RolPlataforma.CTO_DEV,
  alcanceTerritorial: { kind: "GLOBAL" },
  ctoDevPosition: "PRIMARY",
};

function response(data: unknown, statusCode = 200): HttpResponse {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ok: true, data }),
  };
}

function makeDependencies(
  overrides: Partial<ApiRouterDependencies> = {}
): ApiRouterDependencies {
  return {
    authenticate: vi.fn().mockResolvedValue(globalUser),
    listConsejeros: vi.fn().mockResolvedValue(response([])),
    createConsejero: vi.fn().mockResolvedValue(response({ id: "created" }, 201)),
    approveConsejero: vi.fn().mockResolvedValue(response({ id: "approved" })),
    ...overrides,
  };
}

describe("Vercel API router", () => {
  it("serves health without requiring authentication", async () => {
    const dependencies = makeDependencies();
    const router = createApiRouter(dependencies);

    const result = await router(new Request("https://example.test/api/health"));

    expect(result.status).toBe(200);
    expect(dependencies.authenticate).not.toHaveBeenCalled();
    expect(result.headers.get("cache-control")).toBe("no-store");
    await expect(result.json()).resolves.toMatchObject({
      ok: true,
      data: { status: "ok", service: "shippiyyukon-api" },
    });
  });

  it("returns only the authenticated server-resolved authorization context", async () => {
    const dependencies = makeDependencies();
    const router = createApiRouter(dependencies);

    const result = await router(
      new Request("https://example.test/api/auth/context", {
        headers: { authorization: "Bearer token" },
      })
    );

    expect(result.status).toBe(200);
    const body = await result.json();
    expect(body).toMatchObject({
      ok: true,
      data: {
        sub: globalUser.sub,
        rolPlataforma: RolPlataforma.CTO_DEV,
        alcanceTerritorial: { kind: "GLOBAL" },
        ctoDevPosition: "PRIMARY",
        permisos: ["consejero:crear", "consejero:aprobar", "consejero:listar"],
      },
    });
    expect(body.data.permisos).not.toContain("cto-dev:administrar-secundario");
  });

  it("routes list query parameters to the authorized list handler", async () => {
    const dependencies = makeDependencies();
    const router = createApiRouter(dependencies);

    const result = await router(
      new Request("https://example.test/api/consejeros?estado=Estado%201")
    );

    expect(result.status).toBe(200);
    expect(dependencies.listConsejeros).toHaveBeenCalledWith(
      expect.objectContaining({ query: { estado: "Estado 1" } }),
      globalUser
    );
  });

  it("routes a valid approval path id and JSON body", async () => {
    const dependencies = makeDependencies();
    const router = createApiRouter(dependencies);
    const id = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

    const result = await router(
      new Request(`https://example.test/api/consejeros/${id}/approve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision: "APROBADO" }),
      })
    );

    expect(result.status).toBe(200);
    expect(dependencies.approveConsejero).toHaveBeenCalledWith(
      expect.objectContaining({
        params: { id },
        body: JSON.stringify({ decision: "APROBADO" }),
      }),
      globalUser
    );
  });

  it("rejects unknown routes and unsupported methods", async () => {
    const router = createApiRouter(makeDependencies());

    const unknown = await router(
      new Request("https://example.test/api/users")
    );
    const unsupported = await router(
      new Request("https://example.test/api/consejeros", { method: "DELETE" })
    );

    expect(unknown.status).toBe(404);
    expect(unsupported.status).toBe(405);
  });

  it("rejects invalid approval ids before authentication", async () => {
    const dependencies = makeDependencies();
    const router = createApiRouter(dependencies);

    const result = await router(
      new Request("https://example.test/api/consejeros/not-a-uuid/approve", {
        method: "POST",
        body: "{}",
      })
    );

    expect(result.status).toBe(422);
    expect(dependencies.authenticate).not.toHaveBeenCalled();
  });

  it("rejects oversized request bodies before authentication", async () => {
    const dependencies = makeDependencies();
    const router = createApiRouter(dependencies);
    const body = "x".repeat(1_048_577);

    const result = await router(
      new Request("https://example.test/api/consejeros", {
        method: "POST",
        body,
      })
    );

    expect(result.status).toBe(413);
    expect(dependencies.authenticate).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON without returning an internal error", async () => {
    const dependencies = makeDependencies();
    const router = createApiRouter(dependencies);

    const result = await router(
      new Request("https://example.test/api/consejeros", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{invalid",
      })
    );

    expect(result.status).toBe(400);
    expect(dependencies.authenticate).not.toHaveBeenCalled();
  });
});
