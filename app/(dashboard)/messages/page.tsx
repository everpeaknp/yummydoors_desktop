"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Send, Store, MessageSquareText } from "lucide-react";
import { SiteNavbar } from "@/components/layout/site-navbar";
import { SiteFooter } from "@/components/layout/site-footer";
import { apiFetch } from "@/lib/http";
import { useAuthStore } from "@/stores/auth-store";
import { config } from "@/lib/config";

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

export default function CustomerMessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingConvs, setLoadingConvs] = useState(true);
  
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  
  const token = useAuthStore((s) => s.accessToken);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    setLoadingConvs(true);
    try {
      const res = await apiFetch("/messages/customer/conversations", { auth: true });
      if (!res.ok) throw new Error("Failed to load conversations");
      const data: Conversation[] = await res.json();
      setConversations(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingConvs(false);
    }
  }, []);

  const loadMessages = useCallback(async (restaurantId: number) => {
    setLoadingMsgs(true);
    try {
      const res = await apiFetch(`/messages/customer/${restaurantId}`, { auth: true });
      if (!res.ok) throw new Error("Failed to load messages");
      const data: Message[] = await res.json();
      setMessages(data);
      // clear unread count locally
      setConversations((prev) => 
        prev.map(c => c.customer_id === restaurantId ? { ...c, unread_count: 0 } : c)
      );
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingMsgs(false);
    }
  }, []);

  useEffect(() => {
    if (token) loadConversations();
  }, [loadConversations, token]);

  useEffect(() => {
    if (selectedId) loadMessages(selectedId);
  }, [selectedId, loadMessages]);

  useEffect(() => {
    if (!token) return;
    const wsBase = config.apiBaseUrl.replace(/^http/, "ws");
    const ws = new WebSocket(
      `${wsBase}${config.apiPrefix}/messages/ws/customer?token=${token}`
    );

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.event === "new_message") {
          loadConversations();
          if (selectedId && msg.restaurant_id === selectedId) {
            setMessages((prev) => [...prev, msg.message]);
          }
        }
      } catch {}
    };

    return () => {
      ws.close();
    };
  }, [token, selectedId, loadConversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
      const savedMsg = await res.json();
      setMessages((prev) => [...prev, savedMsg]);
      setNewMessage("");
      loadConversations();
    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
    }
  };

  const selectedConv = conversations.find(c => c.customer_id === selectedId);

  return (
    <div className="flex min-h-screen flex-col bg-[#f8f9fa]">
      <SiteNavbar />
      
      <main className="flex-1 max-w-[1200px] w-full mx-auto px-4 py-8 mt-16">
        <h1 className="text-2xl font-bold text-[#212529] mb-6">Messages</h1>

        <div className="flex h-[600px] bg-white rounded-lg shadow-sm border border-[#e9ecef] overflow-hidden">
          {/* Left panel: Conversations */}
          <div className="w-1/3 border-r border-[#e9ecef] flex flex-col bg-[#f8f9fa]">
            <div className="p-4 border-b border-[#e9ecef] bg-white font-semibold text-[#495057]">
              Conversations
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
                    className={`w-full p-4 flex items-center gap-3 border-b border-[#e9ecef] transition text-left ${
                      selectedId === conv.customer_id ? "bg-[#e53e4f]/10" : "hover:bg-white bg-[#f8f9fa]"
                    }`}
                  >
                    {conv.customer_avatar ? (
                      <div className="relative w-12 h-12 shrink-0 rounded-full overflow-hidden">
                        <Image fill src={conv.customer_avatar} alt="Logo" className="object-cover" sizes="48px" />
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-white border border-[#ced4da] flex items-center justify-center text-[#adb5bd]">
                        <Store className="w-6 h-6" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline mb-1">
                        <span className="font-semibold text-[15px] text-[#212529] truncate">
                          {conv.customer_name}
                        </span>
                        <span className="text-[11px] text-[#adb5bd] flex-shrink-0">
                          {new Date(conv.last_message_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="text-[13px] text-[#868e96] truncate">
                        {conv.last_message}
                      </div>
                    </div>
                    {conv.unread_count > 0 && (
                      <div className="w-5 h-5 rounded-full bg-[#e53e4f] text-white flex items-center justify-center text-[11px] font-bold">
                        {conv.unread_count}
                      </div>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Right panel: Chat */}
          <div className="flex-1 flex flex-col bg-white">
            {selectedId ? (
              <>
                <div className="p-4 border-b border-[#e9ecef] flex items-center gap-3">
                  <div className="font-semibold text-[16px] text-[#212529]">
                    {selectedConv?.customer_name}
                  </div>
                </div>
                
                <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-4 bg-[#f8f9fa]">
                  {loadingMsgs ? (
                    <div className="text-center text-[#868e96] text-[13px] mt-4">Loading messages...</div>
                  ) : messages.length === 0 ? (
                    <div className="text-center text-[#868e96] text-[13px] mt-4">Say hello to {selectedConv?.customer_name}!</div>
                  ) : (
                    messages.map((msg) => {
                      const isMe = !msg.is_from_merchant;
                      return (
                        <div key={msg.id} className={`flex flex-col max-w-[75%] ${isMe ? "self-end items-end" : "self-start items-start"}`}>
                          <div
                            className={`px-4 py-2 rounded-2xl text-[14px] leading-relaxed ${
                              isMe
                                ? "bg-[#e53e4f] text-white rounded-br-none"
                                : "bg-white text-[#212529] border border-[#e9ecef] rounded-bl-none shadow-sm"
                            }`}
                          >
                            {msg.content}
                          </div>
                          <span className="text-[11px] text-[#adb5bd] mt-1 px-1">
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <div className="p-4 border-t border-[#e9ecef] bg-white">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      sendMessage();
                    }}
                    className="flex items-center gap-2"
                  >
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type a message..."
                      className="flex-1 border border-[#ced4da] rounded-full px-4 py-2.5 text-[14px] outline-none focus:border-[#e53e4f] focus:ring-1 focus:ring-[#e53e4f]"
                    />
                    <button
                      type="submit"
                      disabled={sending || !newMessage.trim()}
                      className="w-10 h-10 rounded-full bg-[#e53e4f] text-white flex items-center justify-center disabled:opacity-50 hover:bg-[#c62a3a] transition"
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

      <SiteFooter />
    </div>
  );
}
