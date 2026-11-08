import type { ApiResult } from "@shippiyyukon/shared";
import { authClient } from "../auth/neonAuth";

const API_ORIGIN = import.meta.env.VITE_API_BASE_URL ?? "";

async function getAccessToken(): Promise<string | null> {
  if (!authClient) return null;
  const result = await authClient.getSession();
  return result.data?.session?.token ?? null;
}

export async function apiRequest<T>(
  path: string,
  options: { method?: "GET" | "POST"; body?: unknown } = {}
): Promise<T> {
  const token = await getAccessToken();
  const apiPath = path.startsWith("/") ? path : `/${path}`;
  const apiBase = `${API_ORIGIN.replace(/\/$/, "")}/api`;
  const res = await fetch(`${apiBase}${apiPath}`, {
    method: options.method ?? "GET",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });

  const payload = (await res.json()) as ApiResult<T>;
  if (!payload.ok) throw new Error(payload.error?.message ?? `Error ${res.status}`);
  return payload.data as T;
}
