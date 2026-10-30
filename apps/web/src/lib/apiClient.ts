import { ApiResult } from "@shippiyyukon/shared";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

/**
 * El token real lo entrega el SDK de Amplify/Cognito tras el login con
 * passkey (ver auth/AuthContext.tsx — stub pendiente de integrar el SDK).
 */
function getAccessToken(): string | null {
  return sessionStorage.getItem("shippiyyukon_access_token");
}

export async function apiRequest<T>(
  path: string,
  options: { method?: "GET" | "POST"; body?: unknown } = {}
): Promise<T> {
  const token = getAccessToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const payload = (await res.json()) as ApiResult<T>;
  if (!payload.ok) {
    throw new Error(payload.error?.message ?? `Error ${res.status}`);
  }
  return payload.data as T;
}
