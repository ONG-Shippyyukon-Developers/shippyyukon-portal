import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { authenticateAndAuthorize } from "./auth-boundary";
import { BetterAuthAuthenticationProvider } from "./better-auth-provider";
import {
  NeonAuthorizationAssignmentRepository,
  RepositoryAuthorizationResolver,
} from "./authorization-resolver";
import type { AuthenticatedUser } from "./auth-model";
import type { HttpRequest } from "../http/types";

export { AuthError } from "./auth-model";
export type { AuthenticatedUser } from "./auth-model";

const authenticationProvider = new BetterAuthAuthenticationProvider();
const authorizationResolver = new RepositoryAuthorizationResolver(
  new NeonAuthorizationAssignmentRepository()
);

export async function authenticate(
  event: APIGatewayProxyEventV2
): Promise<AuthenticatedUser> {
  const request: HttpRequest = {
    headers: event.headers ?? {},
    body: event.body ?? undefined,
    query: event.queryStringParameters ?? {},
    params: event.pathParameters ?? {},
  };
  return authenticateRequest(request);
}

export async function authenticateRequest(
  request: HttpRequest
): Promise<AuthenticatedUser> {
  return authenticateAndAuthorize(
    request,
    authenticationProvider,
    authorizationResolver
  );
}
