"use client";

import { create } from "zustand";

import {
  loadStoredAuth,
  saveStoredAuth,
  type StoredAuth,
  type StoredUser,
} from "@/lib/auth-storage";

type AuthState = {
  hydrated: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  user: StoredAuth["user"] | null;
  hydrate: () => void;
  setAuth: (auth: StoredAuth) => void;
  setUser: (user: StoredUser) => void;
  clearAuth: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  hydrated: false,
  accessToken: null,
  refreshToken: null,
  user: null,
  hydrate: () => {
    const stored = loadStoredAuth();
    set({
      hydrated: true,
      accessToken: stored?.accessToken ?? null,
      refreshToken: stored?.refreshToken ?? null,
      user: stored?.user ?? null,
    });
  },
  setAuth: (auth) => {
    saveStoredAuth(auth);
    set({
      hydrated: true,
      accessToken: auth.accessToken,
      refreshToken: auth.refreshToken,
      user: auth.user,
    });
  },
  setUser: (user) => {
    const stored = loadStoredAuth();
    if (stored) {
      saveStoredAuth({ ...stored, user });
    }
    set({
      hydrated: true,
      user,
    });
  },
  clearAuth: () => {
    saveStoredAuth(null);
    set({
      hydrated: true,
      accessToken: null,
      refreshToken: null,
      user: null,
    });
  },
}));
