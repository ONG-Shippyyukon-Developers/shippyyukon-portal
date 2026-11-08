import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";
import { authenticate, AuthError } from "../../middleware/auth";
import type { HttpRequest } from "../../http/types";
import { fail } from "../../utils/response";
import { handleRevokeSecondaryCtoDev } from "./cto-dev-authority-handler";

export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyStructuredResultV2> {
  try {
    const user = await authenticate(event);
    const request: HttpRequest = {
      headers: event.headers ?? {},
      body: event.body ?? undefined,
      query: event.queryStringParameters ?? {},
      params: event.pathParameters ?? {},
    };
    return await handleRevokeSecondaryCtoDev(request, user);
  } catch (error) {
    if (error instanceof AuthError) {
      return fail(error.message, error.statusCode, "AUTH_ERROR");
    }
    console.error("Error interno al revocar el segundo CTO/DEV:", error);
    return fail("Error interno al revocar el segundo CTO/DEV", 500, "INTERNAL_ERROR");
  }
}
