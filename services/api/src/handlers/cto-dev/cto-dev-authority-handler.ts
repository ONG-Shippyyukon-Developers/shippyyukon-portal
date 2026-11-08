import { AuthError, type AuthenticatedUser } from "../../middleware/auth-model";
import { requiereCtoDevPrincipal } from "../../middleware/rbac";
import {
  assignSecondaryCtoDev,
  revokeSecondaryCtoDev,
} from "../../db/client";
import { fail, ok } from "../../utils/response";
import type { HttpRequest, HttpResponse } from "../../http/types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface AuthorityBody {
  targetUserId: string;
  reason: string;
}

function parseBody(body: string | undefined): AuthorityBody | undefined {
  try {
    const parsed: unknown = JSON.parse(body ?? "{}");
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("targetUserId" in parsed) ||
      !("reason" in parsed) ||
      typeof parsed.targetUserId !== "string" ||
      typeof parsed.reason !== "string"
    ) {
      return undefined;
    }
    return {
      targetUserId: parsed.targetUserId,
      reason: parsed.reason,
    };
  } catch {
    return undefined;
  }
}

function validateBody(
  body: AuthorityBody | undefined
): AuthorityBody | HttpResponse {
  if (!body) return fail("El cuerpo de la solicitud no es válido", 400);
  if (!UUID_PATTERN.test(body.targetUserId)) {
    return fail("targetUserId debe ser un UUID válido", 422);
  }
  const reason = body.reason.trim();
  if (reason.length === 0 || reason.length > 500) {
    return fail("reason es obligatorio y no debe exceder 500 caracteres", 422);
  }
  return { targetUserId: body.targetUserId, reason };
}

function databaseErrorCode(error: unknown): string | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
  }
  return undefined;
}

function handleDatabaseError(error: unknown, message: string): HttpResponse {
  if (error instanceof AuthError) {
    return fail(error.message, error.statusCode, "AUTH_ERROR");
  }
  const code = databaseErrorCode(error);
  if (code === "42501") {
    return fail(
      "Solo el CTO/DEV principal puede administrar al segundo CTO/DEV",
      403,
      "AUTH_ERROR"
    );
  }
  if (code === "23505") {
    return fail(
      "La asignación CTO/DEV entra en conflicto con el estado actual",
      409,
      "CONFLICT"
    );
  }
  if (code === "22023") {
    return fail(
      "Se requiere un motivo válido para el cambio",
      422,
      "VALIDATION_ERROR"
    );
  }
  console.error(message, error);
  return fail(message, 500, "INTERNAL_ERROR");
}

export async function handleAssignSecondaryCtoDev(
  request: HttpRequest,
  user: AuthenticatedUser
): Promise<HttpResponse> {
  try {
    requiereCtoDevPrincipal(user);
    const body = validateBody(parseBody(request.body));
    if ("statusCode" in body) return body;

    const assignmentId = await assignSecondaryCtoDev(
      user.sub,
      body.targetUserId,
      body.reason
    );
    return ok({ assignmentId, position: "SECONDARY" }, 201);
  } catch (error) {
    return handleDatabaseError(
      error,
      "Error interno al asignar el segundo CTO/DEV"
    );
  }
}

export async function handleRevokeSecondaryCtoDev(
  request: HttpRequest,
  user: AuthenticatedUser
): Promise<HttpResponse> {
  try {
    requiereCtoDevPrincipal(user);
    const body = validateBody(parseBody(request.body));
    if ("statusCode" in body) return body;

    await revokeSecondaryCtoDev(user.sub, body.targetUserId, body.reason);
    return ok({ revoked: true, position: "SECONDARY" });
  } catch (error) {
    return handleDatabaseError(
      error,
      "Error interno al revocar el segundo CTO/DEV"
    );
  }
}
