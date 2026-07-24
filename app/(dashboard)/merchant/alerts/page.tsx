"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, BellRing } from "lucide-react";
import { MerchantDashboardLayout } from "@/components/merchant/merchant-dashboard-layout";
import { apiFetch } from "@/lib/http";

function apiError(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const value = payload as { detail?: unknown; message?: unknown };
  if (typeof value.detail === "string" && value.detail.trim()) return value.detail;
  if (typeof value.message === "string" && value.message.trim()) return value.message;
  return fallback;
}

type Notification = {
  id: number;
  title: string;
  body: string;
  deep_link: string | null;
  created_at: string;
  is_read: boolean;
};

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function MerchantAlertsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch("/notifications/me?limit=50", { auth: true });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(apiError(payload, `Unable to load notifications (${response.status}).`));
      const items = Array.isArray(payload) ? payload : payload?.data;
      if (!Array.isArray(items)) {
        throw new Error("Notifications response did not contain a notification list.");
      }
      setNotifications(items);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load notifications.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  async function markRead(notification: Notification) {
    if (notification.is_read) return;
    const response = await apiFetch(`/notifications/me/${notification.id}/read`, {
      method: "PATCH",
      auth: true,
    });
    if (response.ok) {
      setNotifications((current) => current.map((item) => (
        item.id === notification.id ? { ...item, is_read: true } : item
      )));
    }
  }

  async function markAllRead() {
    const response = await apiFetch("/notifications/me/read-all", {
      method: "PATCH",
      auth: true,
    });
    if (response.ok) {
      setNotifications((current) => current.map((item) => ({ ...item, is_read: true })));
    }
  }

  return (
    <MerchantDashboardLayout>
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#e53e4f]">Dashboard</p>
            <h1 className="mt-2 text-3xl font-bold text-[#212529]">Notifications</h1>
            <p className="mt-2 text-sm text-[#6b7280]">Order, message, and workspace updates for your restaurant.</p>
          </div>
          {notifications.some((notification) => !notification.is_read) && (
            <button type="button" onClick={() => void markAllRead()} className="text-sm font-semibold text-[#e53e4f] hover:underline">
              Mark all read
            </button>
          )}
        </div>

        {loading ? <div className="rounded-xl border border-[#e9ecef] bg-white p-8 text-center text-sm text-[#868e96]">Loading notifications…</div> : null}
        {!loading && error ? <div className="rounded-xl border border-[#f5c2c7] bg-[#fff5f5] p-8 text-center text-sm text-[#b02a37]">{error}<button type="button" onClick={() => void loadNotifications()} className="ml-2 font-semibold underline">Retry</button></div> : null}
        {!loading && !error && notifications.length === 0 ? <div className="rounded-xl border border-[#e9ecef] bg-white p-12 text-center text-sm text-[#868e96]">No notifications yet.</div> : null}

        {!loading && !error && notifications.length > 0 ? (
          <div className="space-y-3">
            {notifications.map((notification) => (
              <button
                type="button"
                key={notification.id}
                onClick={() => {
                  void markRead(notification);
                  if (notification.deep_link) window.location.href = notification.deep_link;
                }}
                className={`flex w-full items-start gap-4 rounded-xl border bg-white p-5 text-left shadow-sm transition hover:border-[#e53e4f]/50 ${notification.is_read ? "border-[#e9ecef]" : "border-[#ffb08a]"}`}
              >
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${notification.is_read ? "bg-[#f4f6fa] text-[#7d8597]" : "bg-[#fff0e8] text-[#e9572d]"}`}>
                  {notification.is_read ? <Bell className="h-5 w-5" /> : <BellRing className="h-5 w-5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-3">
                    <span className="font-semibold text-[#1f2430]">{notification.title}</span>
                    <span className="shrink-0 text-xs text-[#8b93a7]">{formatTime(notification.created_at)}</span>
                  </span>
                  <span className="mt-1 block text-sm leading-6 text-[#5c657a]">{notification.body}</span>
                  {notification.deep_link ? <span className="mt-2 block text-xs font-semibold text-[#e9572d]">Open details</span> : null}
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </MerchantDashboardLayout>
  );
}
