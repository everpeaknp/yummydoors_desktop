import { mapStoredUser } from "@/lib/auth-mappers";
import { config } from "@/lib/config";
import { loadStoredAuth, saveStoredAuth, type StoredAuth } from "@/lib/auth-storage";

type RequestOptions = RequestInit & {
  auth?: boolean;
  timeoutMs?: number;
};

const DEFAULT_REQUEST_TIMEOUT_MS = 15000;
const PROXY_BASE = "/api/proxy";

function isLocalhost() {
  return (
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
  );
}

function buildRequestUrl(path: string) {
  if (isLocalhost()) {
    return `${PROXY_BASE}${path}`;
  }
  return `${config.apiBaseUrl}${config.apiPrefix}${path}`;
}

async function refreshAccessToken(stored: StoredAuth): Promise<StoredAuth | null> {
  const response = await fetch(buildRequestUrl("/auth/refresh"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: stored.refreshToken }),
    cache: "no-store",
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
  const isFormData = requestOptions.body instanceof FormData;
  if (!isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let stored = auth ? loadStoredAuth() : null;
  if (stored?.accessToken) {
    headers.set("Authorization", `Bearer ${stored.accessToken}`);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const abortHandler = () => controller.abort();
  externalSignal?.addEventListener("abort", abortHandler);

  try {
    let response = await fetch(buildRequestUrl(path), {
      cache: "no-store",
      ...requestOptions,
      headers,
      signal: controller.signal,
    });

    if (response.status === 401 && auth && stored?.refreshToken) {
      stored = await refreshAccessToken(stored);
      if (stored?.accessToken) {
        headers.set("Authorization", `Bearer ${stored.accessToken}`);
        response = await fetch(buildRequestUrl(path), {
          cache: "no-store",
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
