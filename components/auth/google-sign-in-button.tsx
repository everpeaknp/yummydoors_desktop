"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { mapStoredAuth } from "@/lib/auth-mappers";
import { apiFetch } from "@/lib/http";
import { config } from "@/lib/config";
import { useAuthStore } from "@/stores/auth-store";

function GoogleMark() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24">
      <path
        d="M21.805 12.23c0-.79-.064-1.364-.202-1.96H12.24v3.71h5.494c-.11.922-.706 2.31-2.03 3.243l-.018.124 2.966 2.252.205.02c1.89-1.706 2.948-4.216 2.948-7.389Z"
        fill="#4285F4"
      />
      <path
        d="M12.24 21.75c2.692 0 4.95-.87 6.6-2.372l-3.153-2.396c-.843.575-1.974.977-3.447.977-2.635 0-4.875-1.706-5.67-4.063l-.12.01-3.084 2.339-.042.112c1.64 3.186 5.017 5.393 8.916 5.393Z"
        fill="#34A853"
      />
      <path
        d="M6.57 13.896a5.62 5.62 0 0 1-.332-1.897c0-.66.12-1.3.322-1.896l-.006-.127-3.124-2.376-.102.047A9.55 9.55 0 0 0 2.29 12c0 1.54.378 2.996 1.037 4.353l3.242-2.457Z"
        fill="#FBBC05"
      />
      <path
        d="M12.24 6.04c1.854 0 3.105.784 3.815 1.444l2.787-2.661C17.18 3.283 14.932 2.25 12.24 2.25c-3.9 0-7.277 2.206-8.917 5.392l3.232 2.456c.806-2.356 3.046-4.058 5.685-4.058Z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function GoogleSignInButton() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  const hiddenButtonRef = useRef<HTMLDivElement | null>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!scriptReady || !hiddenButtonRef.current || !window.google || !config.googleClientId) {
      return;
    }

    hiddenButtonRef.current.innerHTML = "";
    window.google.accounts.id.initialize({
      client_id: config.googleClientId,
      callback: async (response) => {
        setError(null);
        setIsLoading(true);
        try {
          const apiResponse = await apiFetch("/auth/google", {
            method: "POST",
            body: JSON.stringify({ credential: response.credential }),
          });
          const payload = await apiResponse.json();
          if (!apiResponse.ok) {
            throw new Error(payload.detail ?? payload.message ?? "Google sign-in failed.");
          }
          setAuth(mapStoredAuth(payload.data));
          router.replace("/");
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : "Google sign-in failed.");
        } finally {
          setIsLoading(false);
        }
      },
    });

    window.google.accounts.id.renderButton(hiddenButtonRef.current, {
      theme: "outline",
      size: "large",
      shape: "rectangular",
      text: "continue_with",
      width: 380,
      logo_alignment: "left",
    });
    setIsReady(true);
  }, [router, scriptReady, setAuth]);

  function triggerGoogleSignIn() {
    if (!config.googleClientId || !isReady || isLoading) {
      return;
    }
    const iframe = hiddenButtonRef.current?.querySelector<HTMLElement>('[role="button"]');
    iframe?.click();
  }

  const isConfigured = Boolean(config.googleClientId);

  return (
    <>
      {isConfigured ? (
        <Script
          src="https://accounts.google.com/gsi/client"
          strategy="afterInteractive"
          onLoad={() => setScriptReady(true)}
        />
      ) : null}

      <div className="space-y-3">
        <button
          type="button"
          onClick={triggerGoogleSignIn}
          disabled={!isConfigured || !isReady || isLoading}
          className="flex h-12 w-full items-center justify-center gap-3 rounded-2xl border border-[#d9dde5] bg-white px-4 text-sm font-medium text-[#111827] shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:bg-[#fafafa] disabled:text-[#6b7280]"
        >
          <GoogleMark />
          <span>
            {isLoading
              ? "Signing in with Google..."
              : "Continue with Google"}
          </span>
        </button>

        <div ref={hiddenButtonRef} className="hidden" />

        {error ? (
          <div className="rounded-2xl border border-[#ffd8cc] bg-[#fff4ef] px-4 py-3 text-sm text-[#9a3412]">
            {error}
          </div>
        ) : null}
      </div>
    </>
  );
}
