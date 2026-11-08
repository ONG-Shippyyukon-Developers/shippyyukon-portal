import type {
  AlcanceTerritorial,
  RolPlataforma,
} from "@shippiyyukon/shared";

export type AuthenticatedTerritorialScope = AlcanceTerritorial;

export interface AuthenticatedUser {
  sub: string;
  rolPlataforma: RolPlataforma;
  alcanceTerritorial: AuthenticatedTerritorialScope;
  ctoDevPosition?: "PRIMARY" | "SECONDARY";
}

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly statusCode: 401 | 403 | 503 = 401
  ) {
    super(message);
    this.name = "AuthError";
  }
}
