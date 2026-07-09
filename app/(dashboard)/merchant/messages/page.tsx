"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { MerchantDashboardLayout } from "@/components/merchant/merchant-dashboard-layout";
import { apiFetch } from "@/lib/http";
import { config } from "@/lib/config";
import { loadStoredAuth } from "@/lib/auth-storage";

type Conversation = {
  customer_id: number;
  customer_name: string;
  customer_avatar: string | null;
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
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function MerchantMessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const loadConversations = useCallback(async () => {
    setLoadingConvs(true);
    try {
      const res = await apiFetch("/messages/merchant/conversations", { auth: true });
      if (!res.ok) throw new Error("Failed to load conversations");
      const data: Conversation[] = await res.json();
      setConversations(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error loading conversations");
    } finally {
      setLoadingConvs(false);
    }
  }, []);

  const loadMessages = useCallback(async (customerId: number) => {
    setLoadingMsgs(true);
    try {
      const res = await apiFetch(`/messages/merchant/${customerId}`, { auth: true });
      if (!res.ok) throw new Error("Failed to load messages");
      const data: Message[] = await res.json();
      setMessages(data);
      // Mark as read locally
      setConversations((prev) =>
        prev.map((c) => (c.customer_id === customerId ? { ...c, unread_count: 0 } : c))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error loading messages");
    } finally {
      setLoadingMsgs(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (selectedId !== null) {
      loadMessages(selectedId);
    }
  }, [selectedId, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // WebSocket for real-time new messages
  useEffect(() => {
    const stored = loadStoredAuth();
    if (!stored?.accessToken) return;

    const wsBase = config.apiBaseUrl
      .replace("https://", "wss://")
      .replace("http://", "ws://");
    const ws = new WebSocket(
      `${wsBase}${config.apiPrefix}/messages/ws/merchant?token=${stored.accessToken}`
    );
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.event === "new_message") {
          const cid = msg.customer_id as number;
          const m = msg.message as Message;
          if (selectedId === cid) {
            setMessages((prev) => [...prev, m]);
          }
          // Update conversation list
          setConversations((prev) => {
            const existing = prev.find((c) => c.customer_id === cid);
            if (existing) {
              return prev.map((c) =>
                c.customer_id === cid
                  ? {
                      ...c,
                      last_message: m.content,
                      last_message_at: m.created_at,
                      unread_count: selectedId === cid ? 0 : c.unread_count + 1,
                    }
                  : c
              );
            }
            return prev;
          });
        }
      } catch {}
    };

    return () => ws.close();
  }, [selectedId]);

  const sendMessage = async () => {
    if (!newMessage.trim() || selectedId === null) return;
    setSending(true);
    try {
      const res = await apiFetch(`/messages/merchant/${selectedId}`, {
        method: "POST",
        auth: true,
        body: JSON.stringify({ content: newMessage.trim() }),
      });
      if (!res.ok) throw new Error("Failed to send");
      const sent: Message = await res.json();
      setMessages((prev) => [...prev, sent]);
      setNewMessage("");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Send failed");
    } finally {
      setSending(false);
    }
  };

  const selectedConv = conversations.find((c) => c.customer_id === selectedId);

  return (
    <MerchantDashboardLayout>
      <div className="mb-6 flex items-center text-[13px] text-[#868e96] font-medium">
        <span className="text-[#e53e4f]">Dashboard</span>
        <span className="mx-2">/</span>
        <span>Messages</span>
      </div>

      <div className="bg-white rounded shadow-sm border border-[#e9ecef] overflow-hidden flex h-[calc(100vh-200px)]">
        {/* Sidebar */}
        <div className="w-[320px] border-r border-[#e9ecef] flex flex-col">
          <div className="px-4 py-3 border-b border-[#e9ecef]">
            <h2 className="text-[18px] font-semibold text-[#495057]">Inbox</h2>
          </div>
          <div className="overflow-y-auto flex-1">
            {loadingConvs ? (
              <div className="p-6 text-center text-[#868e96] text-[13px]">Loading…</div>
            ) : error ? (
              <div className="p-6 text-center text-[#e53e4f] text-[13px]">{error}</div>
            ) : conversations.length === 0 ? (
              <div className="p-6 text-center text-[#868e96] text-[13px]">No conversations yet.</div>
            ) : (
              conversations.map((conv) => (
                <button
                  key={conv.customer_id}
                  onClick={() => setSelectedId(conv.customer_id)}
                  className={`w-full text-left p-4 flex gap-3 border-b border-[#f1f3f5] hover:bg-[#f8f9fa] transition ${
                    selectedId === conv.customer_id ? "bg-[#fff5f6]" : ""
                  }`}
                >
                  <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full border border-gray-200 bg-gray-100">
                    {conv.customer_avatar ? (
                      <Image src={conv.customer_avatar} alt={conv.customer_name} fill className="object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[16px] font-bold text-gray-400">
                        {conv.customer_name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-[14px] font-semibold text-[#212529] truncate">
                        {conv.customer_name}
                      </span>
                      <span className="text-[11px] text-[#868e96] ml-1 shrink-0">
                        {timeAgo(conv.last_message_at)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-[12px] text-[#868e96] truncate pr-2">{conv.last_message}</p>
                      {conv.unread_count > 0 && (
                        <span className="shrink-0 h-5 w-5 rounded-full bg-[#e53e4f] text-white text-[10px] font-bold flex items-center justify-center">
                          {conv.unread_count > 9 ? "9+" : conv.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat panel */}
        <div className="flex-1 flex flex-col">
          {selectedId === null ? (
            <div className="flex-1 flex items-center justify-center text-[#868e96] text-[14px]">
              Select a conversation to start chatting
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="px-5 py-3 border-b border-[#e9ecef] flex items-center gap-3">
                <div className="relative h-9 w-9 rounded-full overflow-hidden bg-gray-100 border border-gray-200">
                  {selectedConv?.customer_avatar ? (
                    <Image src={selectedConv.customer_avatar} alt="" fill className="object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[14px] font-bold text-gray-400">
                      {selectedConv?.customer_name.charAt(0)}
                    </div>
                  )}
                </div>
                <span className="font-semibold text-[15px] text-[#212529]">
                  {selectedConv?.customer_name}
                </span>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3">
                {loadingMsgs ? (
                  <div className="text-center text-[#868e96] text-[13px]">Loading messages…</div>
                ) : messages.length === 0 ? (
                  <div className="text-center text-[#868e96] text-[13px]">No messages yet. Say hi!</div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-[13px] leading-relaxed ${
                        msg.is_from_merchant
                          ? "self-end bg-[#e53e4f] text-white rounded-br-sm"
                          : "self-start bg-[#f1f3f5] text-[#212529] rounded-bl-sm"
                      }`}
                    >
                      {msg.content}
                      <div className={`text-[10px] mt-1 opacity-70 text-right`}>
                        {timeAgo(msg.created_at)}
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="border-t border-[#e9ecef] p-4 flex gap-3">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                  placeholder="Type a message…"
                  className="flex-1 border border-[#ced4da] rounded-lg px-4 py-2 text-[14px] outline-none focus:border-[#e53e4f]"
                />
                <button
                  onClick={sendMessage}
                  disabled={sending || !newMessage.trim()}
                  className="px-5 py-2 bg-[#e53e4f] text-white rounded-lg font-semibold text-[13px] disabled:opacity-50 hover:bg-[#c62a3a] transition"
                >
                  {sending ? "…" : "Send"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </MerchantDashboardLayout>
  );
}
