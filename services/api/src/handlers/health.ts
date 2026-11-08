import type { HttpRequest, HttpResponse } from "../http/types";
import { ok } from "../utils/response";

/** Health endpoint independent of the runtime-specific request adapter. */
export async function handleHealth(_request: HttpRequest): Promise<HttpResponse> {
  return ok({
    status: "ok",
    service: "shippiyyukon-api",
    ts: new Date().toISOString(),
  });
}

/** Compatibility entry point for the existing API Gateway Lambda integration. */
export async function handler(): Promise<HttpResponse> {
  return handleHealth({ headers: {} });
}
