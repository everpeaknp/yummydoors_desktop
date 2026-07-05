"use client";

import { useEffect, useRef } from "react";

import { mapStoredUser } from "@/lib/auth-mappers";
import { apiFetch } from "@/lib/http";
import { useAuthStore } from "@/stores/auth-store";

export function useAuth() {
  const store = useAuthStore();
  const refreshedRef = useRef(false);

  useEffect(() => {
    if (!store.hydrated) {
      store.hydrate();
    }
  }, [store]);

  useEffect(() => {
    if (!store.hydrated || !store.accessToken || refreshedRef.current) {
      return;
    }

    refreshedRef.current = true;
    let cancelled = false;

    async function refreshSessionUser() {
      try {
        const response = await apiFetch("/auth/me", { auth: true });
        if (response.status === 401) {
          if (!cancelled) {
            store.clearAuth();
          }
          return;
        }

        if (!response.ok) {
          return;
        }

        const payload = await response.json();
        if (!cancelled && payload?.data) {
          store.setUser(mapStoredUser(payload.data));
        }
      } catch {
        // Keep stored auth if the backend is temporarily unavailable.
      }
    }

    void refreshSessionUser();

    return () => {
      cancelled = true;
    };
  }, [store]);

  return store;
}
