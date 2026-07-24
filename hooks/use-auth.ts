"use client";

import { useEffect, useRef, useState } from "react";

import { mapStoredUser } from "@/lib/auth-mappers";
import { apiFetch } from "@/lib/http";
import { useAuthStore } from "@/stores/auth-store";

export function useAuth() {
  const hydrated = useAuthStore((state) => state.hydrated);
  const accessToken = useAuthStore((state) => state.accessToken);
  const hydrate = useAuthStore((state) => state.hydrate);
  const setUser = useAuthStore((state) => state.setUser);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const refreshedRef = useRef(false);
  const [visibilityVersion, setVisibilityVersion] = useState(0);

  useEffect(() => {
    if (!hydrated) {
      hydrate();
    }
  }, [hydrate, hydrated]);

  useEffect(() => {
    if (!hydrated || !accessToken || refreshedRef.current) {
      return;
    }

    refreshedRef.current = true;
    let cancelled = false;

    async function refreshSessionUser() {
      try {
        const response = await apiFetch("/auth/me", { auth: true });
        if (response.status === 401) {
          if (!cancelled) {
            clearAuth();
          }
          return;
        }

        if (!response.ok) {
          return;
        }

        const payload = await response.json();
        if (!cancelled && payload?.data) {
          setUser(mapStoredUser(payload.data));
        }
      } catch {
        // Keep stored auth if the backend is temporarily unavailable.
      }
    }

    void refreshSessionUser();

    return () => {
      cancelled = true;
    };
  }, [accessToken, clearAuth, hydrated, setUser, visibilityVersion]);

  useEffect(() => {
    if (!hydrated || !accessToken) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshedRef.current = false;
        setVisibilityVersion((version) => version + 1);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [accessToken, hydrated]);

  return {
    hydrated,
    accessToken,
    user: useAuthStore((state) => state.user),
    setUser,
  };
}
