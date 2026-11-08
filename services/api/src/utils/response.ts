import type { ApiResult } from "@shippiyyukon/shared";
import type { HttpResponse } from "../http/types";

export function ok<T>(data: T, statusCode = 200): HttpResponse {
  const body: ApiResult<T> = { ok: true, data };
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

export function fail(
  message: string,
  statusCode = 400,
  code = "BAD_REQUEST"
): HttpResponse {
  const body: ApiResult<never> = { ok: false, error: { code, message } };
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}
