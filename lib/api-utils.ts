"use client";

export type ApiEnvelope<T> = {
  message?: string;
  data: T;
};

export async function readJsonSafely<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export function unwrapApiData<T>(payload: ApiEnvelope<T> | T | null | undefined): T | null {
  if (!payload) {
    return null;
  }

  if (typeof payload === "object" && payload !== null && "data" in payload) {
    return (payload as ApiEnvelope<T>).data;
  }

  return payload as T;
}

export function extractApiErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const candidate = payload as {
    detail?: unknown;
    message?: unknown;
    errors?: unknown;
  };

  if (typeof candidate.detail === "string" && candidate.detail.trim()) {
    return candidate.detail;
  }

  if (Array.isArray(candidate.detail) && candidate.detail.length > 0) {
    const first = candidate.detail[0];
    if (typeof first === "string" && first.trim()) {
      return first;
    }
    if (first && typeof first === "object" && "msg" in first) {
      const message = (first as { msg?: unknown }).msg;
      if (typeof message === "string" && message.trim()) {
        return message;
      }
    }
  }

  if (typeof candidate.message === "string" && candidate.message.trim()) {
    return candidate.message;
  }

  if (Array.isArray(candidate.errors) && candidate.errors.length > 0) {
    const first = candidate.errors[0];
    if (typeof first === "string" && first.trim()) {
      return first;
    }
  }

  return fallback;
}
