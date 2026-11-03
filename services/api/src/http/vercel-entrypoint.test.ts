import { afterEach, describe, expect, it, vi } from "vitest";
import api from "../../api/index";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Vercel API service entrypoint", () => {
  it("serves a public health check without database or identity-provider configuration", async () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("COGNITO_USER_POOL_ID", "");
    vi.stubEnv("COGNITO_CLIENT_ID", "");

    const response = await api.fetch(
      new Request("https://redpanel.shippiyyukon.org/api/health")
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: { status: "ok", service: "shippiyyukon-api" },
    });
  });

  it("denies protected operations when the identity provider is not configured", async () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("COGNITO_USER_POOL_ID", "");
    vi.stubEnv("COGNITO_CLIENT_ID", "");

    const response = await api.fetch(
      new Request("https://redpanel.shippiyyukon.org/api/consejeros")
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "AUTH_ERROR" },
    });
  });
});
