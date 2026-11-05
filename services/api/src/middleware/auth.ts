import { CognitoJwtVerifier } from "aws-jwt-verify";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { RolPlataforma } from "@shippiyyukon/shared";

/**
 * Cognito remains a future identity-provider integration for this MVP.
 * Create the verifier lazily so public health checks can start without AWS
 * configuration. Protected routes fail closed until valid provider settings
 * are supplied; this does not implement WebAuthn or user provisioning.
 */
type JwtVerifier = ReturnType<typeof CognitoJwtVerifier.create>;
let verifier: JwtVerifier | undefined;

export interface AuthenticatedUser {
  sub: string;
  rolPlataforma: RolPlataforma;
  municipio?: string;
}

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly statusCode: 401 | 403 | 503 = 401
  ) {
    super(message);
    this.name = "AuthError";
  }
}

function getVerifier(): JwtVerifier {
  const userPoolId = process.env.COGNITO_USER_POOL_ID?.trim();
  const clientId = process.env.COGNITO_CLIENT_ID?.trim();

  if (!userPoolId || !clientId) {
    throw new AuthError("El proveedor de autenticación no está configurado", 503);
  }

  if (!verifier) {
    try {
      verifier = CognitoJwtVerifier.create({
        userPoolId,
        tokenUse: "access",
        clientId,
      });
    } catch {
      throw new AuthError("La configuración de autenticación no es válida", 503);
    }
  }

  return verifier;
}

export async function authenticate(
  event: APIGatewayProxyEventV2
): Promise<AuthenticatedUser> {
  const header = event.headers?.authorization ?? event.headers?.Authorization;
  if (!header?.startsWith("Bearer ")) {
    throw new AuthError("Falta el header Authorization: Bearer <token>");
  }
  const token = header.slice("Bearer ".length);
  const jwtVerifier = getVerifier();

  let payload;
  try {
    payload = await jwtVerifier.verify(token);
  } catch {
    throw new AuthError("Token inválido o expirado");
  }

  const rolPlataforma = payload["custom:rol_plataforma"] as RolPlataforma | undefined;
  if (!rolPlataforma || !Object.values(RolPlataforma).includes(rolPlataforma)) {
    throw new AuthError("El token no tiene un rol de plataforma válido", 403);
  }

  return {
    sub: payload.sub,
    rolPlataforma,
    municipio: payload["custom:municipio"] as string | undefined,
  };
}
