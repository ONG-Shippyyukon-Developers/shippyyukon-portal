import type { HttpRequest } from "../http/types";
import type { AuthenticatedUser } from "./auth-model";

export interface AuthenticatedIdentity {
  provider: "BETTER_AUTH";
  subject: string;
}

export interface AuthenticationProvider {
  authenticate(request: HttpRequest): Promise<AuthenticatedIdentity>;
}

export interface AuthorizationResolver {
  resolve(identity: AuthenticatedIdentity): Promise<AuthenticatedUser>;
}

export async function authenticateAndAuthorize(
  request: HttpRequest,
  authenticationProvider: AuthenticationProvider,
  authorizationResolver: AuthorizationResolver
): Promise<AuthenticatedUser> {
  const identity = await authenticationProvider.authenticate(request);
  return authorizationResolver.resolve(identity);
}
