"use client";

import { useEffect } from "react";

import { useAuthStore } from "@/stores/auth-store";

export function useAuth() {
  const store = useAuthStore();

  useEffect(() => {
    if (!store.hydrated) {
      store.hydrate();
    }
  }, [store]);

  return store;
}

