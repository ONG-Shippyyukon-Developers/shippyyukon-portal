import { describe, expect, it, vi } from "vitest";
import { RolPlataforma } from "@shippiyyukon/shared";
import type { HttpRequest } from "../http/types";
import {
  authenticateAndAuthorize,
  type AuthenticationProvider,
  type AuthorizationResolver,
} from "./auth-boundary";

describe("authentication boundary", () => {
  it("authenticates identity before resolving authorization data", async () => {
    const request: HttpRequest = {
      headers: { authorization: "Bearer token" },
      query: {},
      params: {},
    };
    const identity = { provider: "BETTER_AUTH" as const, subject: "identity-001" };
    const user = {
      sub: "identity-001",
      rolPlataforma: RolPlataforma.CTO_DEV,
      municipio: "Municipio A",
    };
    const authenticate = vi.fn().mockResolvedValue(identity);
    const resolve = vi.fn().mockResolvedValue(user);
    const provider: AuthenticationProvider = { authenticate };
    const resolver: AuthorizationResolver = { resolve };

    await expect(
      authenticateAndAuthorize(request, provider, resolver)
    ).resolves.toEqual(user);

    expect(authenticate).toHaveBeenCalledWith(request);
    expect(resolve).toHaveBeenCalledWith(identity);
  });

  it("does not resolve authorization when authentication fails", async () => {
    const request: HttpRequest = { headers: {} };
    const authenticationError = new Error("Unauthenticated");
    const provider: AuthenticationProvider = {
      authenticate: vi.fn().mockRejectedValue(authenticationError),
    };
    const resolver: AuthorizationResolver = {
      resolve: vi.fn(),
    };

    await expect(
      authenticateAndAuthorize(request, provider, resolver)
    ).rejects.toBe(authenticationError);
    expect(resolver.resolve).not.toHaveBeenCalled();
  });
});
