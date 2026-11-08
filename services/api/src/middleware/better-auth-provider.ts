import type { JWTPayload } from "jose";
import type { AuthenticationProvider } from "./auth-boundary";
import { AuthError } from "./auth-model";
import type { HttpRequest } from "../http/types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface BetterAuthConfig {
  authUrl: string;
  jwksUrl: string;
}

type TokenVerifier = (
  token: string,
  config: BetterAuthConfig
) => Promise<JWTPayload>;

function parseUrl(value: string | undefined, variable: string): string {
  if (!value) {
    throw new AuthError(`${variable} is required for API authentication`, 503);
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new AuthError(`${variable} must be a valid URL`, 503);
  }
  const isLoopback =
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" ||
    url.hostname === "[::1]";
  if (
    (url.protocol !== "https:" && !(isLoopback && url.protocol === "http:")) ||
    url.username ||
    url.password ||
    url.hash
  ) {
    throw new AuthError(`${variable} must be a secure URL`, 503);
  }
  return url.toString().replace(/\/$/, "");
}

function getConfig(): BetterAuthConfig {
  return {
    authUrl: parseUrl(
      process.env.NEON_AUTH_BASE_URL ??
        process.env.SBOX_NEON_AUTH_BASE_URL ??
        process.env.SBOX_AUTH_URL ??
        process.env.AUTH_URL,
      "NEON_AUTH_BASE_URL"
    ),
    jwksUrl: parseUrl(
      process.env.NEON_AUTH_JWKS_URL ??
        process.env.SBOX_NEON_AUTH_JWKS_URL ??
        process.env.SBOX_AUTH_JWKS_URL ??
        process.env.AUTH_JWKS_URL,
      "NEON_AUTH_JWKS_URL"
    ),
  };
}

function getIssuer(config: BetterAuthConfig): string {
  return new URL(config.authUrl).origin;
}

function isProviderAvailabilityError(error: unknown): boolean {
  return (
    error instanceof TypeError ||
    (error instanceof Error &&
      (error.name === "JWKSTimeout" ||
        error.name === "JWKSInvalid" ||
        error.name === "JOSEError"))
  );
}

export class BetterAuthAuthenticationProvider
  implements AuthenticationProvider
{
  private readonly config?: BetterAuthConfig;
  private readonly injectedVerifier?: TokenVerifier;
  private remoteJwks?: ReturnType<typeof import("jose").createRemoteJWKSet>;

  constructor(options?: {
    config?: BetterAuthConfig;
    verifyToken?: TokenVerifier;
  }) {
    this.config = options?.config;
    this.injectedVerifier = options?.verifyToken;
  }

  async authenticate(request: HttpRequest) {
    const header =
      request.headers.authorization ?? request.headers.Authorization;
    const match = header?.match(/^Bearer\s+(\S+)$/i);
    if (!match) {
      throw new AuthError("Falta un token Bearer válido");
    }

    const config = this.config ?? getConfig();
    let payload: JWTPayload;
    try {
      if (this.injectedVerifier) {
        payload = await this.injectedVerifier(match[1], config);
      } else {
        const { createRemoteJWKSet, jwtVerify } = await import("jose");
        const jwks =
          this.remoteJwks ?? createRemoteJWKSet(new URL(config.jwksUrl));
        this.remoteJwks = jwks;
        ({ payload } = await jwtVerify(match[1], jwks, {
          issuer: getIssuer(config),
          algorithms: ["EdDSA", "ES256", "RS256"],
        }));
      }
    } catch (error) {
      if (isProviderAvailabilityError(error)) {
        throw new AuthError("El proveedor de autenticación no está disponible", 503);
      }
      throw new AuthError("Token Better Auth inválido o expirado", 401);
    }

    if (typeof payload.sub !== "string" || !UUID_PATTERN.test(payload.sub)) {
      throw new AuthError("El token no contiene un identificador de usuario válido", 401);
    }

    return {
      provider: "BETTER_AUTH" as const,
      subject: payload.sub,
    };
  }
}
