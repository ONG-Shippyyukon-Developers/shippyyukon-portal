import { CognitoJwtVerifier } from "aws-jwt-verify";
import { APIGatewayProxyEventV2 } from "aws-lambda";
import { RolPlataforma } from "@shippiyyukon/shared";

/**
 * HU-00.2 — verificación de tokens emitidos por el Amazon Cognito User Pool
 * (configurado en infrastructure/lib/constructs/auth-construct.ts, con MFA y
 * passkeys/WebAuthn habilitados). No verifica contraseñas ni passkeys aquí:
 * eso lo resuelve Cognito antes de emitir el token; esta función solo valida
 * la firma/expiración del JWT y extrae los claims de rol y municipio.
 */
const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.COGNITO_USER_POOL_ID ?? "",
  tokenUse: "access",
  clientId: process.env.COGNITO_CLIENT_ID ?? "",
});

export interface AuthenticatedUser {
  sub: string;
  rolPlataforma: RolPlataforma;
  municipio?: string;
}

export class AuthError extends Error {
  constructor(message: string, public readonly statusCode: 401 | 403 = 401) {
    super(message);
    this.name = "AuthError";
  }
}

export async function authenticate(
  event: APIGatewayProxyEventV2
): Promise<AuthenticatedUser> {
  const header = event.headers?.authorization ?? event.headers?.Authorization;
  if (!header?.startsWith("Bearer ")) {
    throw new AuthError("Falta el header Authorization: Bearer <token>");
  }
  const token = header.slice("Bearer ".length);

  let payload;
  try {
    payload = await verifier.verify(token);
  } catch {
    throw new AuthError("Token inválido o expirado");
  }

  // Custom attributes definidos en el User Pool (auth-construct.ts):
  // custom:rol_plataforma y custom:municipio.
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
