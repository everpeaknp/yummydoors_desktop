"use client";

import { useEffect, useMemo, useRef } from "react";

import { useAuth } from "@/hooks/use-auth";
import { apiFetch } from "@/lib/http";
import { config } from "@/lib/config";
import {
  markWebPushPrompted,
  ORDER_EVENT_NAME,
  WEB_PUSH_ENABLE_EVENT,
  WEB_PUSH_STATUS_EVENT,
  shouldPromptForWebPushPermission,
  type OrderNotificationPayload,
  type WebPushStatusPayload,
  resetWebPushPrompted,
  urlBase64ToUint8Array,
} from "@/lib/web-push";

export function OrderNotificationManager() {
  const { hydrated, accessToken, user } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);
  const latestEventIdRef = useRef<string | null>(null);
  const setupWebPushRef = useRef<(() => Promise<void>) | null>(null);

  const wsUrl = useMemo(() => {
    if (!accessToken || !user) {
      return null;
    }

    const wsBase = config.apiBaseUrl.replace("https://", "wss://").replace("http://", "ws://");
    const workspaceType = user.activeWorkspace?.workspaceType;
    const endpoint =
      workspaceType === "merchant" ? "/orders/ws/merchant" : "/orders/ws/customer";
    return `${wsBase}${config.apiPrefix}${endpoint}?token=${accessToken}`;
  }, [accessToken, user]);

  useEffect(() => {
    if (!hydrated || !accessToken || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      return;
    }

    let cancelled = false;

    async function setupWebPush() {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js");

        if (typeof Notification === "undefined") {
          return;
        }

        if (Notification.permission !== "granted") {
          if (shouldPromptForWebPushPermission()) {
            markWebPushPrompted();
            await Notification.requestPermission();
          }

          if (Notification.permission !== "granted") {
            return;
          }
        }

        const publicKeyResponse = await apiFetch("/notifications/webpush/public-key", { auth: true });
        const publicKeyPayload = await publicKeyResponse.json().catch(() => null);
        const publicKey =
          publicKeyPayload?.data?.public_key ??
          publicKeyPayload?.data?.publicKey ??
          publicKeyPayload?.public_key ??
          publicKeyPayload?.publicKey;

        if (!publicKeyResponse.ok || typeof publicKey !== "string" || !publicKey.trim()) {
          return;
        }

        let subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey),
          });
        }

        if (cancelled) {
          return;
        }

        await apiFetch("/notifications/webpush/subscribe", {
          method: "POST",
          auth: true,
          body: JSON.stringify(subscription),
        });

        window.dispatchEvent(
          new CustomEvent<WebPushStatusPayload>(WEB_PUSH_STATUS_EVENT, {
            detail: { subscribed: true, source: "sync" },
          }),
        );
      } catch {
        window.dispatchEvent(
          new CustomEvent<WebPushStatusPayload>(WEB_PUSH_STATUS_EVENT, {
            detail: { subscribed: false, source: "sync" },
          }),
        );
        // Keep notifications best-effort.
      }
    }

    setupWebPushRef.current = setupWebPush;
    void setupWebPush();

    return () => {
      cancelled = true;
      setupWebPushRef.current = null;
    };
  }, [accessToken, hydrated]);

  useEffect(() => {
    function handleManualEnable() {
      resetWebPushPrompted();
      void setupWebPushRef.current?.();
    }

    window.addEventListener(WEB_PUSH_ENABLE_EVENT, handleManualEnable);
    return () => window.removeEventListener(WEB_PUSH_ENABLE_EVENT, handleManualEnable);
  }, []);

  useEffect(() => {
    if (!wsUrl) {
      return;
    }

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as OrderNotificationPayload;
        if (payload.event_id && latestEventIdRef.current === payload.event_id) {
          return;
        }
        latestEventIdRef.current = payload.event_id ?? null;

        window.dispatchEvent(new CustomEvent<OrderNotificationPayload>(ORDER_EVENT_NAME, { detail: payload }));

        if (
          typeof Notification !== "undefined" &&
          Notification.permission === "granted" &&
          document.hidden &&
          payload.title &&
          payload.body
        ) {
          const notification = new Notification(payload.title, {
            body: payload.body,
            tag: payload.tag,
            icon: "/Yummy_Doors-Png.png",
          });
          notification.onclick = () => {
            window.focus();
            window.location.href = payload.deep_link ?? "/orders";
            notification.close();
          };
        }
      } catch {
        // Ignore malformed payloads.
      }
    };

    return () => {
      ws.close();
    };
  }, [wsUrl]);

  return null;
}
