import { createAuthClient } from "@neon/neon-js/auth";

const authUrl = (
  import.meta.env.VITE_NEON_AUTH_URL ??
  import.meta.env.SBOX_VITE_NEON_AUTH_URL
)?.trim();

export const authClient = authUrl ? createAuthClient(authUrl) : null;

export function requireAuthClient() {
  if (!authClient) {
    throw new Error("VITE_NEON_AUTH_URL no está configurada para este entorno");
  }
  return authClient;
}
