"use client";

export const ORDER_EVENT_NAME = "yummydoors:order-event";
export const WEB_PUSH_ENABLE_EVENT = "yummydoors:webpush:enable";
export const WEB_PUSH_STATUS_EVENT = "yummydoors:webpush:status";
const WEB_PUSH_PROMPT_KEY = "yummydoors.webpush.prompted.v1";

export type OrderNotificationPayload = {
  event?: string;
  event_id?: string;
  audience?: string;
  order_id?: number;
  order_number?: string;
  restaurant_id?: number | null;
  restaurant_name?: string;
  status?: string;
  title?: string;
  body?: string;
  deep_link?: string;
  tag?: string;
};

export type WebPushStatusPayload = {
  subscribed: boolean;
  source: "refresh" | "sync" | "manual";
};

export function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from(rawData, (char) => char.charCodeAt(0));
}

export function shouldPromptForWebPushPermission() {
  if (typeof window === "undefined" || typeof Notification === "undefined") {
    return false;
  }
  return (
    Notification.permission === "default" &&
    window.localStorage.getItem(WEB_PUSH_PROMPT_KEY) !== "1"
  );
}

export function markWebPushPrompted() {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(WEB_PUSH_PROMPT_KEY, "1");
}

export function resetWebPushPrompted() {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(WEB_PUSH_PROMPT_KEY);
}
