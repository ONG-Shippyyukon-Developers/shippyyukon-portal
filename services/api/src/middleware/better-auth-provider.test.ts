import { describe, expect, it, vi } from "vitest";
import { createServer } from "node:http";
import {
  exportJWK,
  generateKeyPair,
  SignJWT,
  type JWK,
} from "jose";
import { AuthError } from "./auth-model";
import { BetterAuthAuthenticationProvider } from "./better-auth-provider";

const config = {
  authUrl: "https://auth.example.test/neondb/auth",
  jwksUrl: "https://auth.example.test/neondb/auth/.well-known/jwks.json",
};
const authOrigin = new URL(config.authUrl).origin;
const validSubject = "11111111-1111-4111-8111-111111111111";

describe("BetterAuthAuthenticationProvider", () => {
  it("returns only the verified Better Auth identity", async () => {
    const verifyToken = vi.fn().mockResolvedValue({
      sub: validSubject,
      role: "MASTER",
      scope: "GLOBAL",
    });
    const provider = new BetterAuthAuthenticationProvider({
      config,
      verifyToken,
    });

    await (async () => {
      const { publicKey, privateKey } = await generateKeyPair("EdDSA");
      const kid = "test-key";
      const exportedKey = await exportJWK(publicKey);
      const jwk: JWK = { ...exportedKey, kid, alg: "EdDSA", use: "sig" };
      const server = createServer((_request, response) => {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ keys: [jwk] }));
      });
      await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
      const address = server.address();
      if (!address || typeof address === "string") {
        throw new Error("Unable to start local JWKS server");
      }

      try {
        const jwksUrl = `http://127.0.0.1:${address.port}/jwks`;
        const provider = new BetterAuthAuthenticationProvider({
          config: { ...config, jwksUrl },
        });
        const token = await new SignJWT({})
          .setProtectedHeader({ alg: "EdDSA", kid })
          .setIssuer(authOrigin)
          .setAudience(authOrigin)
          .setSubject(validSubject)
          .setExpirationTime("2m")
          .sign(privateKey);

        await expect(
          provider.authenticate({
            headers: { authorization: `Bearer ${token}` },
          })
        ).resolves.toEqual({
          provider: "BETTER_AUTH",
          subject: validSubject,
        });

        const wrongIssuer = await new SignJWT({})
          .setProtectedHeader({ alg: "EdDSA", kid })
          .setIssuer("https://unexpected.example.test")
          .setAudience(authOrigin)
          .setSubject(validSubject)
          .setExpirationTime("2m")
          .sign(privateKey);
        await expect(
          provider.authenticate({
            headers: { authorization: `Bearer ${wrongIssuer}` },
          })
        ).rejects.toMatchObject({ statusCode: 401 });

        const baseUrlIssuer = await new SignJWT({})
          .setProtectedHeader({ alg: "EdDSA", kid })
          .setIssuer(config.authUrl)
          .setAudience(authOrigin)
          .setSubject(validSubject)
          .setExpirationTime("2m")
          .sign(privateKey);
        await expect(
          provider.authenticate({
            headers: { authorization: `Bearer ${baseUrlIssuer}` },
          })
        ).rejects.toMatchObject({ statusCode: 401 });
      } finally {
        await new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve()))
        );
      }
    })();

    await expect(
      provider.authenticate({
        headers: { authorization: "Bearer signed-token" },
      })
    ).resolves.toEqual({
      provider: "BETTER_AUTH",
      subject: validSubject,
    });
    expect(verifyToken).toHaveBeenCalledWith("signed-token", config);
  });

  it("does not verify a request without a Bearer token", async () => {
    const verifyToken = vi.fn();
    const provider = new BetterAuthAuthenticationProvider({
      config,
      verifyToken,
    });

    await expect(provider.authenticate({ headers: {} })).rejects.toMatchObject({
      statusCode: 401,
    });
    expect(verifyToken).not.toHaveBeenCalled();
  });

  it("rejects a verified token whose subject is not a Better Auth UUID", async () => {
    const provider = new BetterAuthAuthenticationProvider({
      config,
      verifyToken: vi.fn().mockResolvedValue({ sub: "not-a-uuid" }),
    });

    await expect(
      provider.authenticate({
        headers: { authorization: "Bearer signed-token" },
      })
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it("rejects invalid tokens and reports JWKS transport failures as unavailable", async () => {
    const invalidTokenProvider = new BetterAuthAuthenticationProvider({
      config,
      verifyToken: vi.fn().mockRejectedValue(new Error("signature invalid")),
    });
    await expect(
      invalidTokenProvider.authenticate({
        headers: { authorization: "Bearer signed-token" },
      })
    ).rejects.toMatchObject({ statusCode: 401 });

    const unavailableProvider = new BetterAuthAuthenticationProvider({
      config,
      verifyToken: vi.fn().mockRejectedValue(new TypeError("fetch failed")),
    });
    await expect(
      unavailableProvider.authenticate({
        headers: { authorization: "Bearer signed-token" },
      })
    ).rejects.toMatchObject({ statusCode: 503 });
  });

  it("fails closed when Better Auth URLs are not configured", async () => {
    const previousAuthUrl = process.env.AUTH_URL;
    const previousJwksUrl = process.env.AUTH_JWKS_URL;
    delete process.env.AUTH_URL;
    delete process.env.AUTH_JWKS_URL;
    const provider = new BetterAuthAuthenticationProvider();

    try {
      await expect(
        provider.authenticate({
          headers: { authorization: "Bearer signed-token" },
        })
      ).rejects.toBeInstanceOf(AuthError);
      await expect(
        provider.authenticate({
          headers: { authorization: "Bearer signed-token" },
        })
      ).rejects.toMatchObject({ statusCode: 503 });
    } finally {
      if (previousAuthUrl === undefined) delete process.env.AUTH_URL;
      else process.env.AUTH_URL = previousAuthUrl;
      if (previousJwksUrl === undefined) delete process.env.AUTH_JWKS_URL;
      else process.env.AUTH_JWKS_URL = previousJwksUrl;
    }
  });
});
