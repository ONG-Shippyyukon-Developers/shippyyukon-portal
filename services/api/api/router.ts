import type {
  ApiResult,
  ContextoAutorizacion,
} from "@shippiyyukon/shared";
import type { HttpRequest, HttpResponse } from "../src/http/types";
import { handleHealth } from "../src/handlers/health";
import {
  AuthError,
  type AuthenticatedUser,
} from "../src/middleware/auth-model";
import { permisosPara } from "../src/middleware/rbac";
import { fail, ok } from "../src/utils/response";

const MAX_REQUEST_BODY_BYTES = 1_048_576;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface ApiRouterDependencies {
  authenticate(request: HttpRequest): Promise<AuthenticatedUser>;
  listConsejeros(
    request: HttpRequest,
    user: AuthenticatedUser
  ): Promise<HttpResponse>;
  createConsejero(
    request: HttpRequest,
    user: AuthenticatedUser
  ): Promise<HttpResponse>;
  approveConsejero(
    request: HttpRequest,
    user: AuthenticatedUser
  ): Promise<HttpResponse>;
}

interface ReadBodyResult {
  body?: string;
  error?: HttpResponse;
}

async function readBody(request: Request): Promise<ReadBodyResult> {
  if (!request.body) return { body: "" };

  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    if (!/^\d+$/.test(contentLength)) {
      return { error: fail("El tamaño del cuerpo no es válido", 400) };
    }
    if (Number(contentLength) > MAX_REQUEST_BODY_BYTES) {
      return { error: fail("El cuerpo de la solicitud es demasiado grande", 413) };
    }
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_REQUEST_BODY_BYTES) {
      await reader.cancel();
      return { error: fail("El cuerpo de la solicitud es demasiado grande", 413) };
    }
    chunks.push(value);
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { body: new TextDecoder().decode(body) };
}

function toHttpRequest(
  request: Request,
  body: string | undefined,
  params: Record<string, string> = {}
): HttpRequest {
  const url = new URL(request.url);
  return {
    headers: Object.fromEntries(request.headers.entries()),
    body,
    query: Object.fromEntries(url.searchParams.entries()),
    params,
  };
}

function toResponse(response: HttpResponse): Response {
  return new Response(response.body, {
    status: response.statusCode,
    headers: {
      ...response.headers,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function currentAuthorizationContext(
  user: AuthenticatedUser
): HttpResponse {
  const context: ContextoAutorizacion = {
    sub: user.sub,
    rolPlataforma: user.rolPlataforma,
    alcanceTerritorial: user.alcanceTerritorial,
    ...(user.ctoDevPosition
      ? { ctoDevPosition: user.ctoDevPosition }
      : {}),
    permisos: permisosPara(user),
  };
  const result: ApiResult<ContextoAutorizacion> = {
    ok: true,
    data: context,
  };
  return {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(result),
  };
}

export function createApiRouter(dependencies: ApiRouterDependencies) {
  return async function handleApiRequest(request: Request): Promise<Response> {
    try {
      const { pathname } = new URL(request.url);
      const segments = pathname.split("/").filter(Boolean);
      if (segments[0] !== "api") {
        return toResponse(fail("Ruta no encontrada", 404, "NOT_FOUND"));
      }

      const route = segments.slice(1);
      const method = request.method.toUpperCase();

      if (route.length === 1 && route[0] === "health") {
        if (method !== "GET") {
          return toResponse(fail("Método no permitido", 405, "METHOD_NOT_ALLOWED"));
        }
        return toResponse(await handleHealth(toHttpRequest(request, undefined)));
      }

      const isAuthorizationContext =
        route.length === 2 &&
        route[0] === "auth" &&
        route[1] === "context";
      const isConsejeroCollection =
        route.length === 1 && route[0] === "consejeros";
      const isApproval =
        route.length === 3 &&
        route[0] === "consejeros" &&
        route[2] === "approve";

      if (!isAuthorizationContext && !isConsejeroCollection && !isApproval) {
        return toResponse(fail("Ruta no encontrada", 404, "NOT_FOUND"));
      }

      const allowedMethod = isConsejeroCollection
        ? method === "GET" || method === "POST"
        : method === (isApproval ? "POST" : "GET");
      if (!allowedMethod) {
        return toResponse(fail("Método no permitido", 405, "METHOD_NOT_ALLOWED"));
      }

      const bodyResult =
        method === "POST" ? await readBody(request) : { body: undefined };
      if (bodyResult.error) return toResponse(bodyResult.error);
      if (bodyResult.body?.trim()) {
        try {
          JSON.parse(bodyResult.body);
        } catch (error) {
          if (error instanceof SyntaxError) {
            return toResponse(fail("El cuerpo debe contener JSON válido", 400));
          }
          throw error;
        }
      }

      const id = isApproval ? route[1] : undefined;
      if (isApproval && (!id || !UUID_PATTERN.test(id))) {
        return toResponse(fail("El id del consejero no es válido", 422));
      }

      const httpRequest = toHttpRequest(
        request,
        bodyResult.body,
        id ? { id } : {}
      );
      const user = await dependencies.authenticate(httpRequest);

      if (isAuthorizationContext) {
        return toResponse(currentAuthorizationContext(user));
      }
      if (isApproval) {
        return toResponse(
          await dependencies.approveConsejero(httpRequest, user)
        );
      }
      if (method === "GET") {
        return toResponse(
          await dependencies.listConsejeros(httpRequest, user)
        );
      }
      return toResponse(
        await dependencies.createConsejero(httpRequest, user)
      );
    } catch (error) {
      if (error instanceof AuthError) {
        return toResponse(fail(error.message, error.statusCode, "AUTH_ERROR"));
      }
      console.error("API request failed:", error);
      return toResponse(fail("Error interno de la API", 500, "INTERNAL_ERROR"));
    }
  };
}
