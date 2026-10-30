import { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { ok } from "../utils/response";

/** HU-00.4 — endpoint simple para confirmar que la Lambda y el ambiente responden. */
export async function handler(): Promise<APIGatewayProxyStructuredResultV2> {
  return ok({ status: "ok", service: "shippiyyukon-api", ts: new Date().toISOString() });
}
