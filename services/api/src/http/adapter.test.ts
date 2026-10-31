import { describe, expect, it, vi } from "vitest";
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";
import { createHttpHandler } from "./adapter";

function result(statusCode: number, body: unknown): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

describe("Vercel HTTP adapter", () => {
  it("adapts a GET request and preserves the query string for the existing handler", async () => {
    const listConsejeros = vi.fn(async (event: APIGatewayProxyEventV2) =>
      result(200, { ok: true, data: { query: event.queryStringParameters } })
    );
    const handler = createHttpHandler({
      health: async () => result(200, { status: "ok" }),
      listConsejeros,
    });

    const response = await handler(
      new Request("https://redpanel.shippiyyukon.org/api/consejeros?municipio=Centro")
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: { query: { municipio: "Centro" } },
    });
    expect(listConsejeros).toHaveBeenCalledOnce();
  });

  it("returns 404 for paths that are not part of the API", async () => {
    const handler = createHttpHandler({
      health: async () => result(200, { status: "ok" }),
      listConsejeros: async () => result(200, []),
    });

    const response = await handler(new Request("https://redpanel.shippiyyukon.org/api/admin"));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
  });

  it("does not expose stack traces or internal error details in adapter failures", async () => {
    const handler = createHttpHandler({
      health: async () => {
        throw new Error("database password must never be exposed");
      },
      listConsejeros: async () => result(200, []),
    });

    const response = await handler(new Request("https://redpanel.shippiyyukon.org/api/health"));

    expect(response.status).toBe(500);
    const payload = await response.json();
    expect(JSON.stringify(payload)).not.toContain("database password");
    expect(payload).toMatchObject({
      ok: false,
      error: { code: "INTERNAL_ERROR" },
    });
  });

  it("rejects unsupported methods without invoking a route handler", async () => {
    const listConsejeros = vi.fn(async () => result(200, []));
    const handler = createHttpHandler({
      health: async () => result(200, { status: "ok" }),
      listConsejeros,
    });

    const response = await handler(
      new Request("https://redpanel.shippiyyukon.org/api/consejeros", { method: "DELETE" })
    );

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toContain("GET");
    expect(listConsejeros).not.toHaveBeenCalled();
  });
});
