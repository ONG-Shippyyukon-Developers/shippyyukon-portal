import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { AddressInfo } from "node:net";
import server from "../server";

let baseUrl: string;

beforeAll(async () => {
  vi.stubEnv("DATABASE_URL", "");
  vi.stubEnv("COGNITO_USER_POOL_ID", "");
  vi.stubEnv("COGNITO_CLIENT_ID", "");

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  vi.unstubAllEnvs();
});

describe("Vercel Node.js API service", () => {
  it("serves the public health check over a real HTTP server", async () => {
    const response = await fetch(`${baseUrl}/api/health`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: { status: "ok", service: "shippiyyukon-api" },
    });
  });

  it("rejects protected consejero routes without an application bearer token", async () => {
    const response = await fetch(`${baseUrl}/api/consejeros`);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "AUTH_ERROR" },
    });
  });
});
