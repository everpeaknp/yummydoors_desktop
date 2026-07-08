"use client";

import Image from "next/image";
import { MerchantDashboardLayout } from "@/components/merchant/merchant-dashboard-layout";

const INBOX_MESSAGES = [
  {
    id: 1,
    name: "Enzo Ferrari",
    avatar: "https://i.pravatar.cc/150?u=1",
    status: "Unread",
    time: "2 hours ago",
    content: "In vim mucius menandri convenire, an brute zril vis. Ancillae delectus necessitatibus no eam, at porro solet veniam mel, ad everti nostrud vim. Eam no menandri pertinacia deterruisset.",
  },
  {
    id: 2,
    name: "Andrea Lomarco",
    avatar: "https://i.pravatar.cc/150?u=2",
    status: "Unread",
    time: "2 hours ago",
    content: "Ex omnis error aliquam quo, eu eos atqui accusam, ex nec sensibus erroribus principes. No pro albucius eloquentiam accommodare. Mei id illud posse persius. Nec eu dico lucilius delicata, qui propriae voluptaria eu.",
  },
  {
    id: 3,
    name: "Marc Twain",
    avatar: "https://i.pravatar.cc/150?u=3",
    status: "Read",
    time: "2 hours ago",
    content: "Ex omnis error aliquam quo, eu eos atqui accusam, ex nec sensibus erroribus principes. No pro albucius eloquentiam accommodare. Mei id illud posse persius. Nec eu dico lucilius delicata, qui propriae voluptaria eu.",
  },
  {
    id: 4,
    name: "Lucas Swing",
    avatar: "https://i.pravatar.cc/150?u=4",
    status: "Read",
    time: "2 hours ago",
    content: "Cum id mundi admodum menandri, eum errem aperiri at. Ut quas facilis qui, euismod admodum persequeris cum at. Summo aliquid eos ut, eum facilisi salutatus ne. Mazim option abhorreant ne his.",
  },
  {
    id: 5,
    name: "Steve Wornder",
    avatar: "https://i.pravatar.cc/150?u=5",
    status: "Read",
    time: "2 hours ago",
    content: "In vim mucius menandri convenire, an brute zril vis. Ancillae delectus necessitatibus no eam, at porro solet veniam mel, ad everti nostrud vim. Eam no menandri pertinacia deterruisset.",
  },
  {
    id: 6,
    name: "Mark Shoemaker",
    avatar: "https://i.pravatar.cc/150?u=6",
    status: "Unread",
    time: "2 hours ago",
    content: "In vim mucius menandri convenire, an brute zril vis. Ancillae delectus necessitatibus no eam, at porro solet veniam mel, ad everti nostrud vim.",
  }
];

export default function MerchantMessagesPage() {
  return (
    <MerchantDashboardLayout>
      <div className="mb-6 flex items-center text-[13px] text-[#868e96] font-medium">
        <span className="text-[#e53e4f]">Dashboard</span>
        <span className="mx-2">/</span>
        <span>Messages</span>
      </div>

      <div className="bg-white rounded shadow-sm border border-[#e9ecef] overflow-hidden">
        <div className="border-b border-[#e9ecef] px-6 py-4">
          <h2 className="text-[22px] font-medium text-[#495057]">Inbox</h2>
        </div>
        
        <div className="divide-y divide-[#e9ecef]">
          {INBOX_MESSAGES.map((msg) => (
            <div key={msg.id} className="p-6 hover:bg-[#f8f9fa] transition flex gap-5">
              <div className="relative h-[60px] w-[60px] shrink-0 overflow-hidden rounded-full border border-gray-200">
                <Image src={msg.avatar} alt={msg.name} fill className="object-cover" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[16px] font-semibold text-[#212529]">{msg.name}</h3>
                    <span 
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-sm text-white ${
                        msg.status === "Unread" ? "bg-[#e53e4f]" : "bg-[#28a745]"
                      }`}
                    >
                      {msg.status}
                    </span>
                  </div>
                  <span className="text-[13px] text-[#868e96] italic">{msg.time}</span>
                </div>
                <p className="text-[14px] text-[#868e96] leading-relaxed pr-10">
                  {msg.content}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </MerchantDashboardLayout>
  );
}
