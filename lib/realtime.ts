"use client";

import { config } from "@/lib/config";

export function canUseDirectBackendWebSocket() {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const apiUrl = new URL(config.apiBaseUrl);
    if (window.location.protocol === "https:" && apiUrl.protocol !== "https:") {
      return false;
    }
    return apiUrl.protocol === "https:" || apiUrl.protocol === "http:";
  } catch {
    return false;
  }
}
