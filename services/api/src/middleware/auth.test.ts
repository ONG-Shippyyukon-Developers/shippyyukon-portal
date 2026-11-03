import { afterEach, describe, expect, it, vi } from "vitest";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { authenticate, AuthError } from "./auth";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("authenticate", () => {
  it("rejects requests without a bearer token", async () => {
    await expect(authenticate({ headers: {} } as unknown as APIGatewayProxyEventV2))
      .rejects.toMatchObject({ statusCode: 401 });
  });

  it("fails closed with 503 when the identity provider is not configured", async () => {
    vi.stubEnv("COGNITO_USER_POOL_ID", "");
    vi.stubEnv("COGNITO_CLIENT_ID", "");

    await expect(
      authenticate({
        headers: { authorization: "Bearer untrusted-token" },
      } as APIGatewayProxyEventV2)
    ).rejects.toMatchObject({
      name: "AuthError",
      statusCode: 503,
    } satisfies Partial<AuthError>);
  });
});
