"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

import { useAuth } from "@/hooks/use-auth";
import { apiFetch } from "@/lib/http";
import { config } from "@/lib/config";
import {
  markWebPushPrompted,
  ORDER_EVENT_NAME,
  MESSAGE_EVENT_NAME,
  WEB_PUSH_ENABLE_EVENT,
  WEB_PUSH_STATUS_EVENT,
  shouldPromptForWebPushPermission,
  areUint8ArraysEqual,
  bufferSourceToUint8Array,
  type OrderNotificationPayload,
  type MessageNotificationPayload,
  type WebPushStatusPayload,
  resetWebPushPrompted,
  urlBase64ToUint8Array,
} from "@/lib/web-push";
import { loadStoredAuth } from "@/lib/auth-storage";
import { canUseDirectBackendWebSocket } from "@/lib/realtime";

export function OrderNotificationManager() {
  const pathname = usePathname();
  const { hydrated, accessToken, user } = useAuth();
  const latestOrderEventIdRef = useRef<string | null>(null);
  const latestMessageEventIdRef = useRef<string | null>(null);
  const webPushReadyRef = useRef(false);
  const setupWebPushRef = useRef<(() => Promise<void>) | null>(null);
  const allowDirectSocket = canUseDirectBackendWebSocket();
  const onMessagePage = pathname === "/messages" || pathname === "/merchant/messages";
  const onMerchantOrderPage = pathname.startsWith("/merchant/orders");

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

        const notificationPermission = String(Notification.permission);

        if (notificationPermission !== "granted") {
          if (shouldPromptForWebPushPermission()) {
            markWebPushPrompted();
            await Notification.requestPermission();
          }

          if (String(Notification.permission) !== "granted") {
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

        const desiredApplicationServerKey = urlBase64ToUint8Array(publicKey);

        let subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          const currentKey = bufferSourceToUint8Array(subscription.options?.applicationServerKey);
          const keyMatches = areUint8ArraysEqual(currentKey, desiredApplicationServerKey);
          if (!keyMatches) {
            await subscription.unsubscribe();
            subscription = null;
          }
        }

        if (!subscription) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: desiredApplicationServerKey,
          });
        }

        if (cancelled) {
          return;
        }

        const serializedSubscription = subscription.toJSON();
        const endpoint = serializedSubscription.endpoint;
        const p256dh = serializedSubscription.keys?.p256dh;
        const auth = serializedSubscription.keys?.auth;

        if (!endpoint || !p256dh || !auth) {
          throw new Error("Web push subscription is missing endpoint or keys.");
        }

        await apiFetch("/notifications/webpush/subscribe", {
          method: "POST",
          auth: true,
          body: JSON.stringify({
            endpoint,
            keys: {
              p256dh,
              auth,
            },
          }),
        });
        webPushReadyRef.current = true;

        window.dispatchEvent(
          new CustomEvent<WebPushStatusPayload>(WEB_PUSH_STATUS_EVENT, {
            detail: { subscribed: true, source: "sync" },
          }),
        );
      } catch {
        webPushReadyRef.current = false;
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
    if (!allowDirectSocket || onMerchantOrderPage) {
      return;
    }

    let ws: WebSocket | null = null;
    const storedToken = loadStoredAuth()?.accessToken ?? accessToken;
    if (!storedToken) {
      return;
    }

    const wsBase = config.apiBaseUrl.replace("https://", "wss://").replace("http://", "ws://");
    const workspaceType = user?.activeWorkspace?.workspaceType;
    const endpoint =
      workspaceType === "merchant" ? "/orders/ws/merchant" : "/orders/ws/customer";
    const nextUrl = `${wsBase}${config.apiPrefix}${endpoint}?token=${storedToken}`;
    ws = new WebSocket(nextUrl);

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as OrderNotificationPayload;
        if (payload.event_id && latestOrderEventIdRef.current === payload.event_id) {
          return;
        }
        latestOrderEventIdRef.current = payload.event_id ?? null;

        window.dispatchEvent(new CustomEvent<OrderNotificationPayload>(ORDER_EVENT_NAME, { detail: payload }));

        if (
          !webPushReadyRef.current &&
          typeof Notification !== "undefined" &&
          String(Notification.permission) === "granted" &&
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
      if (ws?.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [accessToken, allowDirectSocket, onMerchantOrderPage, user]);

  useEffect(() => {
    if (!allowDirectSocket || onMessagePage) {
      return;
    }

    let ws: WebSocket | null = null;
    const storedToken = loadStoredAuth()?.accessToken ?? accessToken;
    if (!storedToken || !user) {
      return;
    }

    const wsBase = config.apiBaseUrl.replace("https://", "wss://").replace("http://", "ws://");
    const workspaceType = user.activeWorkspace?.workspaceType;
    const endpoint =
      workspaceType === "merchant" ? "/messages/ws/merchant" : "/messages/ws/customer";
    const nextUrl = `${wsBase}${config.apiPrefix}${endpoint}?token=${storedToken}`;
    ws = new WebSocket(nextUrl);

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as MessageNotificationPayload;
        if (payload.event_id && latestMessageEventIdRef.current === payload.event_id) {
          return;
        }
        latestMessageEventIdRef.current = payload.event_id ?? null;

        window.dispatchEvent(
          new CustomEvent<MessageNotificationPayload>(MESSAGE_EVENT_NAME, { detail: payload }),
        );

        if (
          !webPushReadyRef.current &&
          typeof Notification !== "undefined" &&
          String(Notification.permission) === "granted" &&
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
            window.location.href = payload.deep_link ?? "/messages";
            notification.close();
          };
        }
      } catch {
        // Ignore malformed payloads.
      }
    };

    return () => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [accessToken, allowDirectSocket, onMessagePage, user]);

  return null;
}
