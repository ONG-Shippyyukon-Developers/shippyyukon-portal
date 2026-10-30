import { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { ApiResult } from "@shippiyyukon/shared";

export function ok<T>(data: T, statusCode = 200): APIGatewayProxyStructuredResultV2 {
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
): APIGatewayProxyStructuredResultV2 {
  const body: ApiResult<never> = { ok: false, error: { code, message } };
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}
