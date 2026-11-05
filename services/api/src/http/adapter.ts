import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";

type LegacyHandler = (
  event: APIGatewayProxyEventV2
) => Promise<APIGatewayProxyStructuredResultV2>;

export interface HttpApiHandlers {
  health: LegacyHandler | (() => Promise<APIGatewayProxyStructuredResultV2>);
  listConsejeros: LegacyHandler;
  createConsejero?: LegacyHandler;
  approveConsejero?: LegacyHandler;
}

function jsonError(status: number, code: string, message: string, headers?: HeadersInit): Response {
  return Response.json(
    { ok: false, error: { code, message } },
    { status, headers }
  );
}

function toApiGatewayEvent(
  request: Request,
  url: URL,
  pathParameters?: Record<string, string>
): APIGatewayProxyEventV2 {
  const query: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    // API Gateway v2 exposes the last value for repeated query keys in this field.
    query[key] = value;
  });

  return {
    version: "2.0",
    routeKey: `${request.method} ${url.pathname}`,
    rawPath: url.pathname,
    rawQueryString: url.searchParams.toString(),
    headers: Object.fromEntries(request.headers.entries()),
    queryStringParameters: Object.keys(query).length ? query : undefined,
    pathParameters,
    body: undefined,
    isBase64Encoded: false,
  } as APIGatewayProxyEventV2;
}

function toResponse(result: APIGatewayProxyStructuredResultV2): Response {
  const headers = new Headers();
  for (const [name, value] of Object.entries(result.headers ?? {})) {
    if (value !== undefined && value !== null) headers.set(name, String(value));
  }

  return new Response(result.body ?? null, {
    status: result.statusCode ?? 200,
    headers,
  });
}

/**
 * Provider-neutral Fetch adapter for Vercel Node.js functions.
 * Existing domain handlers remain unchanged while the transport boundary
 * converts standard HTTP requests into the legacy handler contract.
 */
export function createHttpHandler(handlers: HttpApiHandlers) {
  return async function handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();
    const approvalMatch = url.pathname.match(/^\/api\/consejeros\/([^/]+)\/approve$/);

    let selected: LegacyHandler | (() => Promise<APIGatewayProxyStructuredResultV2>) | undefined;
    let pathParameters: Record<string, string> | undefined;

    if (url.pathname === "/api/health" && method === "GET") {
      selected = handlers.health;
    } else if (url.pathname === "/api/health") {
      return jsonError(405, "METHOD_NOT_ALLOWED", "Método no permitido", { allow: "GET" });
    } else if (url.pathname === "/api/consejeros" && method === "GET") {
      selected = handlers.listConsejeros;
    } else if (
      url.pathname === "/api/consejeros" &&
      method === "POST" &&
      handlers.createConsejero
    ) {
      selected = handlers.createConsejero;
    } else if (url.pathname === "/api/consejeros") {
      const allow = handlers.createConsejero ? "GET, POST" : "GET";
      return jsonError(405, "METHOD_NOT_ALLOWED", "Método no permitido", { allow });
    } else if (approvalMatch && method === "POST" && handlers.approveConsejero) {
      selected = handlers.approveConsejero;
      pathParameters = { id: approvalMatch[1] };
    } else if (approvalMatch) {
      if (method !== "POST") {
        return jsonError(405, "METHOD_NOT_ALLOWED", "Método no permitido", { allow: "POST" });
      }
      return jsonError(404, "NOT_FOUND", "Ruta no encontrada");
    } else {
      return jsonError(404, "NOT_FOUND", "Ruta no encontrada");
    }

    try {
      let body: string | undefined;
      if (method !== "GET") {
        body = await request.text();
      }

      const event = {
        ...toApiGatewayEvent(request, url, pathParameters),
        body,
      } as APIGatewayProxyEventV2;
      const result = await selected(event);
      return toResponse(result);
    } catch {
      // Do not leak stack traces, SQL errors, or environment details to clients.
      return jsonError(500, "INTERNAL_ERROR", "Error interno del servidor");
    }
  };
}
