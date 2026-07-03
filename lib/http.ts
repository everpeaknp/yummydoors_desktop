import { mapStoredUser } from "@/lib/auth-mappers";
import { config } from "@/lib/config";
import { loadStoredAuth, saveStoredAuth, type StoredAuth } from "@/lib/auth-storage";

type RequestOptions = RequestInit & {
  auth?: boolean;
  timeoutMs?: number;
};

const DEFAULT_REQUEST_TIMEOUT_MS = 15000;

async function refreshAccessToken(stored: StoredAuth): Promise<StoredAuth | null> {
  const response = await fetch(`${config.apiBaseUrl}${config.apiPrefix}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: stored.refreshToken }),
  });

  if (!response.ok) {
    saveStoredAuth(null);
    return null;
  }

  const payload = await response.json();
  const data = payload.data;
  const nextStored: StoredAuth = {
    accessToken: data.tokens.access_token,
    refreshToken: data.tokens.refresh_token,
    user: mapStoredUser(data.user),
  };
  saveStoredAuth(nextStored);
  return nextStored;
}

export async function apiFetch(path: string, options: RequestOptions = {}) {
  const { auth, timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS, signal: externalSignal, ...requestOptions } = options;
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");

  let stored = auth ? loadStoredAuth() : null;
  if (stored?.accessToken) {
    headers.set("Authorization", `Bearer ${stored.accessToken}`);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const abortHandler = () => controller.abort();
  externalSignal?.addEventListener("abort", abortHandler);

  try {
    let response = await fetch(`${config.apiBaseUrl}${config.apiPrefix}${path}`, {
      ...requestOptions,
      headers,
      signal: controller.signal,
    });

    if (response.status === 401 && auth && stored?.refreshToken) {
      stored = await refreshAccessToken(stored);
      if (stored?.accessToken) {
        headers.set("Authorization", `Bearer ${stored.accessToken}`);
        response = await fetch(`${config.apiBaseUrl}${config.apiPrefix}${path}`, {
          ...requestOptions,
          headers,
          signal: controller.signal,
        });
      }
    }

    return response;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Request timed out. Check that the YummyDoors backend is running.");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener("abort", abortHandler);
  }
}
