"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { Send, Store, MessageSquareText } from "lucide-react";
import { SiteNavbar } from "@/components/layout/site-navbar";
import { config } from "@/lib/config";
import { apiFetch } from "@/lib/http";
import { loadStoredAuth } from "@/lib/auth-storage";
import { canUseDirectBackendWebSocket } from "@/lib/realtime";
import { useAuthStore } from "@/stores/auth-store";

type Conversation = {
  customer_id: number; // For customer, this is actually the restaurant_id
  customer_name: string; // Restaurant name
  customer_avatar: string | null; // Restaurant logo
  last_message: string;
  last_message_at: string;
  unread_count: number;
};

type Message = {
  id: number;
  content: string;
  is_from_merchant: boolean;
  sender_name: string;
  created_at: string;
  read_at: string | null;
};

type MessageEventPayload = {
  event?: string;
  restaurant_id?: number;
  customer_id?: number;
  message_id?: number;
  restaurant_name?: string;
  sender_name?: string;
  is_from_merchant?: boolean;
  body?: string;
  deep_link?: string;
  tag?: string;
  message?: Message;
};

type MessagePageResponse = {
  items: Message[];
  has_more: boolean;
};

const MESSAGE_PAGE_SIZE = 30;

function normalizeMessage(value: unknown): Message | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as Record<string, unknown>;
  const nested = raw.message && typeof raw.message === "object" ? (raw.message as Record<string, unknown>) : null;
  const source = nested ?? raw;

  const id = typeof source.id === "number" ? source.id : null;
  const content = typeof source.content === "string" ? source.content : "";
  const isFromMerchant = typeof source.is_from_merchant === "boolean" ? source.is_from_merchant : null;
  const senderName = typeof source.sender_name === "string" ? source.sender_name : "";
  const createdAt = typeof source.created_at === "string" ? source.created_at : "";

  if (id === null || !content || isFromMerchant === null || !senderName || !createdAt) {
    return null;
  }

  return {
    id,
    content,
    is_from_merchant: isFromMerchant,
    sender_name: senderName,
    created_at: createdAt,
    read_at: typeof source.read_at === "string" || source.read_at === null ? (source.read_at as string | null) : null,
  };
}

function normalizeMessagePageResponse(value: unknown): MessagePageResponse {
  if (Array.isArray(value)) {
    const items = value.map(normalizeMessage).filter((message): message is Message => message !== null);
    return { items, has_more: items.length >= MESSAGE_PAGE_SIZE };
  }

  if (!value || typeof value !== "object") {
    return { items: [], has_more: false };
  }

  const raw = value as Record<string, unknown>;
  const nestedData = raw.data && typeof raw.data === "object" ? (raw.data as Record<string, unknown>) : null;
  const source = nestedData ?? raw;
  const rawItems = Array.isArray(source.items) ? source.items : [];
  const items = rawItems.map(normalizeMessage).filter((message): message is Message => message !== null);
  const hasMore = typeof source.has_more === "boolean" ? source.has_more : items.length >= MESSAGE_PAGE_SIZE;
  return { items, has_more: hasMore };
}

function mergeMessages(existing: Message[], incoming: Message[]) {
  const merged = new Map<number, Message>();
  for (const message of existing) merged.set(message.id, message);
  for (const message of incoming) merged.set(message.id, message);

  return Array.from(merged.values()).sort((left, right) => {
    const leftTime = new Date(left.created_at).getTime();
    const rightTime = new Date(right.created_at).getTime();
    if (leftTime !== rightTime) return leftTime - rightTime;
    return left.id - right.id;
  });
}

function isNearBottom(element: HTMLDivElement, threshold = 96) {
  return element.scrollHeight - element.scrollTop - element.clientHeight <= threshold;
}

export default function CustomerMessagesPage() {
  const searchParams = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingConvs, setLoadingConvs] = useState(true);
  
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [usePollingFallback, setUsePollingFallback] = useState<boolean>(() => !canUseDirectBackendWebSocket());
  
  const token = useAuthStore((s) => s.accessToken);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const selectedIdRef = useRef<number | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const pendingScrollRestoreRef = useRef<{ scrollHeight: number; scrollTop: number } | null>(null);
  const shouldPinToBottomRef = useRef(false);
  const restaurantIdFromUrl = searchParams?.get("restaurant_id");
  const restaurantNameFromUrl = searchParams?.get("restaurant_name");
  const parsedRestaurantId = restaurantIdFromUrl ? Number(restaurantIdFromUrl) : null;

  const loadConversations = useCallback(async (background = false) => {
    if (!background) {
      setLoadingConvs(true);
    }
    try {
      const res = await apiFetch("/messages/customer/conversations", { auth: true });
      if (!res.ok) throw new Error("Failed to load conversations");
      const data: Conversation[] = await res.json();
      setConversations(data);
    } catch (e) {
      console.error(e);
    } finally {
      if (!background) {
        setLoadingConvs(false);
      }
    }
  }, []);

  const fetchMessagePage = useCallback(async (restaurantId: number, beforeMessageId?: number) => {
    const params = new URLSearchParams({ limit: String(MESSAGE_PAGE_SIZE) });
    if (beforeMessageId) {
      params.set("before_message_id", String(beforeMessageId));
    }

    const res = await apiFetch(`/messages/customer/${restaurantId}?${params.toString()}`, { auth: true });
    if (!res.ok) throw new Error("Failed to load messages");
    return normalizeMessagePageResponse(await res.json());
  }, []);

  const loadLatestMessages = useCallback(async (restaurantId: number, background = false) => {
    if (!background) {
      setLoadingMsgs(true);
    }
    try {
      const page = await fetchMessagePage(restaurantId);
      if (selectedIdRef.current !== restaurantId) {
        return;
      }
      const container = messagesScrollRef.current;
      if (!background || !container || isNearBottom(container)) {
        shouldPinToBottomRef.current = true;
      }

      setMessages((prev) => (background ? mergeMessages(prev, page.items) : page.items));
      if (!background) {
        setHasOlderMessages(page.has_more);
      }
      // clear unread count locally
      setConversations((prev) => 
        prev.map(c => c.customer_id === restaurantId ? { ...c, unread_count: 0 } : c)
      );
    } catch (e) {
      console.error(e);
    } finally {
      if (!background) {
        setLoadingMsgs(false);
      }
    }
  }, [fetchMessagePage]);

  const loadOlderMessages = useCallback(async (restaurantId: number) => {
    if (loadingOlderMessages || !hasOlderMessages) {
      return;
    }

    const oldestMessageId = messages[0]?.id;
    if (!oldestMessageId) {
      return;
    }

    const container = messagesScrollRef.current;
    if (container) {
      pendingScrollRestoreRef.current = {
        scrollHeight: container.scrollHeight,
        scrollTop: container.scrollTop,
      };
    }

    setLoadingOlderMessages(true);
    try {
      const page = await fetchMessagePage(restaurantId, oldestMessageId);
      if (selectedIdRef.current !== restaurantId) {
        return;
      }
      setMessages((prev) => mergeMessages(page.items, prev));
      setHasOlderMessages(page.has_more);
    } catch (e) {
      console.error(e);
      pendingScrollRestoreRef.current = null;
    } finally {
      setLoadingOlderMessages(false);
    }
  }, [fetchMessagePage, hasOlderMessages, loadingOlderMessages, messages]);

  useEffect(() => {
    if (token) loadConversations();
  }, [loadConversations, token]);

  useEffect(() => {
    if (!Number.isFinite(parsedRestaurantId)) {
      return;
    }

    setSelectedId(parsedRestaurantId);
  }, [parsedRestaurantId]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) {
      return;
    }

    setMessages([]);
    setHasOlderMessages(false);
    setLoadingOlderMessages(false);
    pendingScrollRestoreRef.current = null;
    shouldPinToBottomRef.current = true;
    void loadLatestMessages(selectedId);
  }, [selectedId, loadLatestMessages]);

  useEffect(() => {
    if (!token || usePollingFallback) {
      return;
    }

    let cancelled = false;
    let ws: WebSocket | null = null;
    let opened = false;

    const applyMessageEvent = (payload: MessageEventPayload) => {
      const message = normalizeMessage(payload?.message);
      const messageId = payload?.message_id ?? message?.id;
      const restaurantId = payload?.restaurant_id;
      if (payload?.event !== "new_message" || !restaurantId || !messageId) {
        return;
      }

      const nextContent = payload?.body ?? message?.content ?? "";
      const nextName = payload?.restaurant_name ?? restaurantNameFromUrl ?? "this restaurant";
      const nextTimestamp = message?.created_at ?? new Date().toISOString();
      const activeId = selectedIdRef.current;

      setConversations((prev) => {
        const existing = prev.find((conv) => conv.customer_id === restaurantId);
        const nextConversation: Conversation = {
          customer_id: restaurantId,
          customer_name: existing?.customer_name ?? nextName,
          customer_avatar: existing?.customer_avatar ?? null,
          last_message: nextContent || existing?.last_message || "",
          last_message_at: nextTimestamp,
          unread_count: activeId === restaurantId ? 0 : (existing?.unread_count ?? 0) + 1,
        };

        if (!existing) {
          return [nextConversation, ...prev];
        }

        return prev.map((conv) => (conv.customer_id === restaurantId ? nextConversation : conv));
      });

      if (activeId && restaurantId === activeId) {
        const container = messagesScrollRef.current;
        if (!container || isNearBottom(container)) {
          shouldPinToBottomRef.current = true;
        }
        setMessages((prev) => {
          const nextMessage = message ?? {
            id: messageId,
            content: payload?.body ?? "",
            is_from_merchant: payload?.is_from_merchant ?? false,
            sender_name: payload?.sender_name ?? payload?.restaurant_name ?? "Restaurant",
            created_at: new Date().toISOString(),
            read_at: null,
          };

          if (prev.some((entry) => entry.id === nextMessage.id)) {
            return prev.map((entry) => (entry.id === nextMessage.id ? nextMessage : entry));
          }

          return [...prev, nextMessage];
        });
      }
    };

    const connect = () => {
      if (cancelled) {
        return;
      }

      const storedToken = loadStoredAuth()?.accessToken ?? token;
      if (!storedToken) {
        return;
      }
      const wsBase = config.apiBaseUrl.replace("https://", "wss://").replace("http://", "ws://");
      const wsUrl = `${wsBase}${config.apiPrefix}/messages/ws/customer?token=${storedToken}`;
      ws = new WebSocket(wsUrl);
      ws.onopen = () => {
        opened = true;
      };

      ws.onmessage = (event) => {
        try {
          applyMessageEvent(JSON.parse(event.data) as MessageEventPayload);
        } catch {
          // Ignore malformed websocket payloads.
        }
      };

      ws.onerror = () => {
        if (!opened) {
          setUsePollingFallback(true);
        }
      };

      ws.onclose = () => {
        if (!opened && !cancelled) {
          setUsePollingFallback(true);
        }
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (ws?.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [restaurantNameFromUrl, token, usePollingFallback]);

  useEffect(() => {
    if (!token || !usePollingFallback) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void loadConversations(true);
      const activeId = selectedIdRef.current;
      if (activeId) {
        void loadLatestMessages(activeId, true);
      }
    }, 2000);

    return () => window.clearInterval(intervalId);
  }, [loadConversations, loadLatestMessages, token, usePollingFallback]);

  useLayoutEffect(() => {
    const container = messagesScrollRef.current;
    if (!container) {
      return;
    }

    const pendingRestore = pendingScrollRestoreRef.current;
    if (pendingRestore) {
      pendingScrollRestoreRef.current = null;
      container.scrollTop = container.scrollHeight - pendingRestore.scrollHeight + pendingRestore.scrollTop;
      return;
    }

    if (shouldPinToBottomRef.current) {
      shouldPinToBottomRef.current = false;
      container.scrollTop = container.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    const root = messagesScrollRef.current;
    const target = topSentinelRef.current;
    const activeId = selectedIdRef.current;
    if (!root || !target || activeId === null || !hasOlderMessages) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry.isIntersecting) {
          return;
        }

        const latestActiveId = selectedIdRef.current;
        if (latestActiveId === null || loadingOlderMessages || !hasOlderMessages) {
          return;
        }

        void loadOlderMessages(latestActiveId);
      },
      {
        root,
        rootMargin: "96px 0px 0px 0px",
        threshold: 0.01,
      },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasOlderMessages, loadOlderMessages, loadingOlderMessages, selectedId]);

  const sendMessage = async () => {
    if (!newMessage.trim() || selectedId === null) return;
    setSending(true);
    try {
      const res = await apiFetch(`/messages/customer/${selectedId}`, {
        method: "POST",
        auth: true,
        body: JSON.stringify({ content: newMessage.trim() }),
      });
      if (!res.ok) throw new Error("Failed to send message");
      const savedMsg = normalizeMessage(await res.json());
      if (savedMsg) {
        shouldPinToBottomRef.current = true;
        setMessages((prev) => mergeMessages(prev, [savedMsg]));
      }
      setConversations((prev) =>
        prev.map((conv) =>
          conv.customer_id === selectedId
            ? {
                ...conv,
                last_message: savedMsg?.content ?? conv.last_message,
                last_message_at: savedMsg?.created_at ?? new Date().toISOString(),
                unread_count: 0,
              }
            : conv,
        ),
      );
      setNewMessage("");
    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
    }
  };

  const selectedConv = conversations.find((c) => c.customer_id === selectedId);
  const selectedConversationName = selectedConv?.customer_name ?? restaurantNameFromUrl ?? "this restaurant";

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-[linear-gradient(180deg,#f7f8fb_0%,#fdfbf4_100%)]">
      <SiteNavbar />
      
      <main className="mx-auto grid h-full w-full max-w-[1480px] flex-1 min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-6 overflow-hidden px-4 pb-6 pt-24 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[#212529]">Messages</h1>
            <p className="mt-2 text-[15px] text-[#6c757d]">
              Chat with restaurants and keep the latest order conversations in one place.
            </p>
          </div>
        </div>

        <div className="grid h-full min-h-0 overflow-hidden rounded-[28px] border border-[#e7ebf0] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)] lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)]">
          {/* Left panel: Conversations */}
          <div className="flex min-h-0 flex-col border-r border-[#e9ecef] bg-[#fbfbfd]">
            <div className="border-b border-[#e9ecef] bg-white px-5 py-4">
              <div className="font-semibold text-[#364152]">Conversations</div>
              <div className="mt-1 text-[13px] text-[#98a2b3]">
                {conversations.length} {conversations.length === 1 ? "restaurant" : "restaurants"}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {loadingConvs ? (
                <div className="p-8 text-center text-[#868e96] text-[14px]">Loading...</div>
              ) : conversations.length === 0 ? (
                <div className="p-8 text-center text-[#868e96] text-[14px]">No messages yet.</div>
              ) : (
                conversations.map((conv) => (
                  <button
                    key={conv.customer_id}
                    onClick={() => setSelectedId(conv.customer_id)}
                    className={`flex w-full items-center gap-3 border-b border-[#eef2f6] px-5 py-4 text-left transition ${
                      selectedId === conv.customer_id ? "bg-[#fff4f5]" : "bg-[#fbfbfd] hover:bg-white"
                    }`}
                  >
                    {conv.customer_avatar ? (
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full ring-1 ring-[#f1d8dc]">
                        <Image fill src={conv.customer_avatar} alt="Logo" className="object-cover" sizes="48px" />
                      </div>
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#f1d8dc] bg-white text-[#adb5bd]">
                        <Store className="w-6 h-6" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="mb-1 flex items-baseline justify-between gap-3">
                        <span className="truncate text-[15px] font-semibold text-[#212529]">
                          {conv.customer_name}
                        </span>
                        <span className="shrink-0 text-[11px] text-[#adb5bd]">
                          {new Date(conv.last_message_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="truncate text-[13px] text-[#868e96]">
                        {conv.last_message}
                      </div>
                    </div>
                    {conv.unread_count > 0 && (
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#e53e4f] text-[11px] font-bold text-white">
                        {conv.unread_count}
                      </div>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Right panel: Chat */}
          <div className="grid h-full min-h-0 overflow-hidden grid-rows-[auto_minmax(0,1fr)_auto] bg-white">
            {selectedId ? (
              <>
                <div className="flex items-center gap-3 border-b border-[#e9ecef] bg-white px-6 py-5">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#fff4f5] text-[#e53e4f] ring-1 ring-[#f1d8dc]">
                    <Store className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-semibold text-[18px] text-[#212529]">
                      {selectedConversationName}
                    </div>
                    <div className="text-[13px] text-[#98a2b3]">
                      Live conversation
                    </div>
                  </div>
                </div>
                
                <div
                  ref={messagesScrollRef}
                  className="relative min-h-0 overflow-y-auto bg-[linear-gradient(180deg,#fbfcfe_0%,#f8f9fb_100%)] p-6"
                >
                  {loadingOlderMessages ? (
                    <div className="pointer-events-none absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded-full border border-[#e9ecef] bg-white/95 px-3 py-1 text-[12px] text-[#98a2b3] shadow-sm backdrop-blur">
                      Loading older messages...
                    </div>
                  ) : null}
                  <div ref={topSentinelRef} className="h-px w-full" aria-hidden="true" />
                  <div className="flex min-h-full w-full flex-col justify-end gap-4">
                    {loadingMsgs && messages.length === 0 ? (
                      <div className="py-8 text-center text-[13px] text-[#868e96]">Loading messages...</div>
                    ) : messages.length === 0 ? (
                      <div className="py-8 text-center text-[13px] text-[#868e96]">
                        Say hello to {selectedConversationName}!
                      </div>
                    ) : (
                      messages.map((msg) => {
                        const isMe = !msg.is_from_merchant;
                        return (
                          <div
                            key={msg.id}
                            className={`flex max-w-[78%] flex-col ${
                              isMe ? "self-end items-end" : "self-start items-start"
                            }`}
                          >
                            <div
                              className={`rounded-2xl px-4 py-3 text-[14px] leading-relaxed shadow-sm ${
                                isMe
                                  ? "rounded-br-md bg-[#e53e4f] text-white shadow-[0_10px_24px_rgba(229,62,79,0.18)]"
                                  : "rounded-bl-md border border-[#e9ecef] bg-white text-[#212529]"
                              }`}
                            >
                              {msg.content}
                            </div>
                            <span className="mt-1 px-1 text-[11px] text-[#adb5bd]">
                              {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="border-t border-[#e9ecef] bg-white p-4">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      sendMessage();
                    }}
                    className="flex items-center gap-3 rounded-full border border-[#e3e8ef] bg-[#fbfbfd] p-2 pl-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)]"
                  >
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type a message..."
                      className="flex-1 bg-transparent px-1 py-2.5 text-[15px] text-[#212529] outline-none placeholder:text-[#adb5bd]"
                    />
                    <button
                      type="submit"
                      disabled={sending || !newMessage.trim()}
                      className="flex h-12 w-12 items-center justify-center rounded-full bg-[#e53e4f] text-white transition hover:bg-[#c62a3a] disabled:opacity-50"
                    >
                      <Send className="w-5 h-5 ml-0.5" />
                    </button>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-[#868e96]">
                <MessageSquareText className="w-16 h-16 text-[#e9ecef] mb-4" />
                <p className="text-[15px]">Select a conversation to start chatting</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
