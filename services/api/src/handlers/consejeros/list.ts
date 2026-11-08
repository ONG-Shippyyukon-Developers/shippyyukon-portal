import { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { authenticate, AuthError } from "../../middleware/auth";
import { fail } from "../../utils/response";
import { handleList } from "./list-handler";
import type { HttpRequest } from "../../http/types";

/** API Gateway adapter retained while the execution runtime is migrated. */
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
    return await handleList(request, user);
  } catch (err) {
    if (err instanceof AuthError) return fail(err.message, err.statusCode, "AUTH_ERROR");
    console.error(err);
    return fail("Error interno al listar consejeros", 500);
  }
}
