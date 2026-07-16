"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import {
  Bell,
  CalendarDays,
  CreditCard,
  Edit,
  Heart,
  Layers3,
  Link2,
  Link as LinkIcon,
  LogOut,
  Mail,
  Menu,
  PanelTop,
  Search,
  Settings,
  ShoppingBag,
  Star,
  Store,
  Table2,
  User,
  ArrowRightLeft,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  Bike,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { apiFetch } from "@/lib/http";
import { mapStoredUser } from "@/lib/auth-mappers";
import { useAuthStore } from "@/stores/auth-store";
import { OrderNotificationManager } from "@/components/notifications/order-notification-manager";
import {
  WEB_PUSH_ENABLE_EVENT,
  WEB_PUSH_STATUS_EVENT,
  resetWebPushPrompted,
  type WebPushStatusPayload,
} from "@/lib/web-push";

type MerchantRestaurant = {
  id: number;
  name: string;
  slug: string;
  city: string | null;
  area: string | null;
  logo_url: string | null;
};

export function MerchantDashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { hydrated, accessToken } = useAuth();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  
  const [restaurants, setRestaurants] = useState<MerchantRestaurant[]>([]);
  const [activeRestaurantId, setActiveRestaurantId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const [showMessages, setShowMessages] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);
  const [webPushStatus, setWebPushStatus] = useState<"checking" | "subscribed" | "unsubscribed" | "error">("checking");

  useEffect(() => {
    if (!hydrated || !accessToken) return;

    async function loadData() {
      try {
        const merchantWorkspace = user?.workspaces?.find(
          (workspace) => workspace.workspaceType === "merchant",
        );
        const activeWorkspaceType = user?.activeWorkspace?.workspaceType ?? null;

        if (merchantWorkspace && activeWorkspaceType !== "merchant") {
          const switchResponse = await apiFetch("/workspaces/switch", {
            method: "POST",
            auth: true,
            body: JSON.stringify({ workspace_id: merchantWorkspace.id }),
          });
          if (switchResponse.ok) {
            const meResponse = await apiFetch("/auth/me", { auth: true });
            if (meResponse.ok) {
              const mePayload = await meResponse.json().catch(() => null);
              if (mePayload?.data) {
                setUser(mapStoredUser(mePayload.data));
              }
            }
          }
        }

        const res = await apiFetch("/merchant/restaurants/me", { auth: true });
        if (res.ok) {
          const payload = await res.json();
          setRestaurants(payload.data?.items || []);
          setActiveRestaurantId(payload.data?.active_restaurant_id || null);
        }
      } catch (err) {
        console.error("Failed to load merchant restaurants", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [hydrated, accessToken, setUser, user]);

  useEffect(() => {
    if (!hydrated || !accessToken) {
      return;
    }

    let cancelled = false;

    async function refreshWebPushStatus() {
      try {
        const response = await apiFetch("/notifications/webpush/status", { auth: true });
        if (!response.ok) {
          if (!cancelled) {
            setWebPushStatus("error");
          }
          return;
        }

        const payload = await response.json().catch(() => null);
        const subscribed = Boolean(payload?.data?.has_subscription);
        if (!cancelled) {
          setWebPushStatus(subscribed ? "subscribed" : "unsubscribed");
        }
      } catch {
        if (!cancelled) {
          setWebPushStatus("error");
        }
      }
    }

    void refreshWebPushStatus();

    const handleStatusEvent = (event: Event) => {
      const detail = (event as CustomEvent<WebPushStatusPayload>).detail;
      if (!detail) {
        return;
      }
      setWebPushStatus(detail.subscribed ? "subscribed" : "unsubscribed");
    };

    window.addEventListener(WEB_PUSH_STATUS_EVENT, handleStatusEvent);
    return () => {
      cancelled = true;
      window.removeEventListener(WEB_PUSH_STATUS_EVENT, handleStatusEvent);
    };
  }, [hydrated, accessToken]);

  const handleSwitchRestaurant = async (id: number) => {
    try {
      await apiFetch("/merchant/restaurants/switch", {
        method: "POST",
        auth: true,
        body: JSON.stringify({ active_restaurant_id: id }),
      });
      setActiveRestaurantId(id);
      window.location.reload();
    } catch (err) {
      console.error(err);
    }
  };

  const handleExit = async () => {
    try {
      await apiFetch("/workspaces/switch", {
        method: "POST",
        auth: true,
        body: JSON.stringify({ active_workspace_id: null }),
      });
      window.location.href = "/";
    } catch (err) {
      console.error(err);
      window.location.href = "/";
    }
  };

  const handleLogout = () => {
    clearAuth();
    router.push("/login");
  };

  const handleEnableOrderAlerts = async () => {
    setWebPushStatus("checking");
    resetWebPushPrompted();
    if (typeof Notification !== "undefined" && Notification.permission !== "granted") {
      await Notification.requestPermission();
    }
    window.dispatchEvent(new Event(WEB_PUSH_ENABLE_EVENT));
    window.setTimeout(() => {
      void (async () => {
        try {
          const response = await apiFetch("/notifications/webpush/status", { auth: true });
          if (response.ok) {
            const payload = await response.json().catch(() => null);
            setWebPushStatus(payload?.data?.has_subscription ? "subscribed" : "unsubscribed");
          } else {
            setWebPushStatus("error");
          }
        } catch {
          setWebPushStatus("error");
        }
      })();
    }, 1500);
  };

  if (!hydrated || loading) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
  }

  return (
    <>
      <OrderNotificationManager />
      <div className="flex h-screen w-full bg-[#f8f9fa] text-[#555] antialiased overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="flex h-full w-[260px] flex-col bg-[#212529] text-[#868e96] shrink-0 overflow-y-auto">
        <div className="flex h-[70px] items-center px-6">
          <Link href="/merchant" className="flex items-center gap-2 text-white">
            <div className="flex items-center justify-center">
              <Image
                src="/Yummy_Doors-Png.png"
                alt="YummyDoors logo"
                width={32}
                height={32}
                className="h-8 w-8 object-contain"
                priority
              />
            </div>
            <span className="text-[22px] font-bold tracking-tight">YummyDoors</span>
          </Link>
        </div>

        <nav className="flex-1 py-4 space-y-0.5">
          <SidebarLink href="/merchant" icon={Store} label="Dashboard" active={pathname === "/merchant"} />
          <SidebarLink href="/merchant/messages" icon={Mail} label="Messages" active={pathname === "/merchant/messages"} />
          <SidebarLink href="/merchant/orders" icon={ShoppingBag} label="Orders Page" active={pathname === "/merchant/orders"} />
          <SidebarLink href="/merchant/orders/1" icon={Edit} label="Edit Order" active={pathname?.includes("/merchant/orders/") ?? false} />
          
          <div className="px-7 py-3 mt-4 text-[11px] font-bold uppercase tracking-wider text-white/30">Management</div>
          <SidebarLink href="/merchant/presence" icon={Store} label="Restaurant presence" active={pathname === "/merchant/presence"} />
          <SidebarLink href="/categories" icon={Layers3} label="Category structure" active={pathname === "/categories"} />
          <SidebarLink href="/merchant/menu" icon={PanelTop} label="Menu catalog" active={pathname === "/merchant/menu"} />
          <SidebarLink href="/merchant/reservations" icon={CalendarDays} label="Reservation queue" active={pathname === "/merchant/reservations"} />
          <SidebarLink href="/merchant/tables" icon={Table2} label="Reservation tables" active={pathname === "/merchant/tables"} />
          <SidebarLink href="/merchant/rider-team" icon={Bike} label="Rider team" active={pathname === "/merchant/rider-team"} />
          <SidebarLink href="/promos" icon={LinkIcon} label="Promos and merchandising" active={pathname === "/promos"} />
        </nav>

        {/* Operating Context & Exit */}
        <div className="mt-auto border-t border-white/5 p-5 space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-white/40">Operating Context</label>
            <select
              value={activeRestaurantId || ""}
              onChange={(e) => handleSwitchRestaurant(Number(e.target.value))}
              className="w-full rounded bg-[#2a3035] px-3 py-2.5 text-[13px] text-white/90 outline-none focus:ring-1 focus:ring-white/20"
            >
              <option value="" disabled className="text-gray-900">Select a restaurant</option>
              {restaurants.map((r) => (
                <option key={r.id} value={r.id} className="text-gray-900">
                  {r.name} {r.city ? `• ${r.city}` : ""}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleExit}
            className="flex w-full items-center justify-center gap-2 rounded bg-[#2a3035] px-4 py-2.5 text-[13px] font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            <ArrowRightLeft className="h-4 w-4" />
            Exit to Customer App
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex flex-1 flex-col overflow-hidden bg-[#f8f9fa]">
        {/* Top Navbar */}
        <header className="flex h-[70px] items-center justify-between bg-white px-8 shadow-sm z-10 shrink-0">
          <div className="flex items-center">
            <button className="text-gray-500 hover:text-gray-700 lg:hidden mr-4">
              <Menu className="h-5 w-5" />
            </button>
          </div>
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-4 mr-3 relative">
              {/* Messages Dropdown Toggle */}
              <div 
                className="relative flex items-center gap-1 cursor-pointer"
                onClick={() => { setShowMessages(!showMessages); setShowAlerts(false); }}
              >
                <div className="relative">
                  <Mail className="h-[18px] w-[18px] text-[#868e96] hover:text-gray-700" />
                  <span className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#0d84ff] text-[9px] font-bold text-white border-2 border-white">3</span>
                </div>
                <ChevronDown className="h-3 w-3 text-[#868e96]" />
              </div>
              
              {/* Messages Dropdown Panel */}
              {showMessages && (
                <div className="absolute top-10 right-8 w-[320px] bg-white shadow-[0_5px_15px_rgba(0,0,0,0.1)] rounded overflow-hidden border border-[#e9ecef] z-50">
                  <div className="px-4 py-3 border-b border-[#e9ecef] font-semibold text-[#495057] text-[14px]">
                    New Messages:
                  </div>
                  <div className="divide-y divide-[#e9ecef]">
                    {[
                      { name: "David Miller", time: "11:21 AM", snippet: "Hey there! This new version of SB Admin is pre..." },
                      { name: "Jane Smith", time: "11:21 AM", snippet: "I was wondering if you could meet for an app..." },
                      { name: "John Doe", time: "11:21 AM", snippet: "I've sent the final files over to you for review. ..." }
                    ].map((msg, i) => (
                      <Link href="/merchant/messages" key={i} className="block px-4 py-3 hover:bg-[#f8f9fa] transition" onClick={() => setShowMessages(false)}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-semibold text-[15px] text-[#212529]">{msg.name}</span>
                          <span className="text-[12px] text-[#868e96]">{msg.time}</span>
                        </div>
                        <p className="text-[13px] text-[#495057] truncate">{msg.snippet}</p>
                      </Link>
                    ))}
                  </div>
                  <Link href="/merchant/messages" className="block px-4 py-3 border-t border-[#e9ecef] text-[14px] text-[#495057] hover:bg-[#f8f9fa] transition" onClick={() => setShowMessages(false)}>
                    View all messages
                  </Link>
                </div>
              )}

              {/* Alerts Dropdown Toggle */}
              <div 
                className="relative flex items-center gap-1 cursor-pointer"
                onClick={() => { setShowAlerts(!showAlerts); setShowMessages(false); }}
              >
                <div className="relative">
                  <Bell className="h-[18px] w-[18px] text-[#868e96] hover:text-gray-700" />
                  <span className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#f5b800] text-[9px] font-bold text-white border-2 border-white">2</span>
                </div>
                <ChevronDown className="h-3 w-3 text-[#868e96]" />
              </div>

              {/* Alerts Dropdown Panel */}
              {showAlerts && (
                <div className="absolute top-10 right-0 w-[320px] bg-white shadow-[0_5px_15px_rgba(0,0,0,0.1)] rounded overflow-hidden border border-[#e9ecef] z-50">
                  <div className="px-4 py-3 border-b border-[#e9ecef] font-semibold text-[#495057] text-[14px]">
                    New Alerts:
                  </div>
                  <div className="divide-y divide-[#e9ecef]">
                    {[
                      { type: "up", time: "11:21 AM", snippet: "This is an automated server response messa..." },
                      { type: "down", time: "11:21 AM", snippet: "This is an automated server response messa..." },
                      { type: "up", time: "11:21 AM", snippet: "This is an automated server response messa..." }
                    ].map((alert, i) => (
                      <Link href="/merchant/alerts" key={i} className="block px-4 py-3 hover:bg-[#f8f9fa] transition" onClick={() => setShowAlerts(false)}>
                        <div className="flex justify-between items-center mb-1">
                          <span className={`font-semibold text-[15px] flex items-center gap-1 ${alert.type === 'up' ? 'text-[#28a745]' : 'text-[#dc3545]'}`}>
                            {alert.type === 'up' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                            Status Update
                          </span>
                          <span className="text-[12px] text-[#868e96]">{alert.time}</span>
                        </div>
                        <p className="text-[13px] text-[#495057] truncate">{alert.snippet}</p>
                      </Link>
                    ))}
                  </div>
                  <Link href="/merchant/alerts" className="block px-4 py-3 border-t border-[#e9ecef] text-[14px] text-[#495057] hover:bg-[#f8f9fa] transition" onClick={() => setShowAlerts(false)}>
                    View all alerts
                  </Link>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleEnableOrderAlerts}
              className="flex items-center gap-2 rounded-full border border-[#ced4da] bg-white px-4 py-2 text-[13px] font-medium text-[#495057] shadow-sm transition hover:border-[#86b7fe] hover:text-[#212529]"
              title="Enable browser notifications for new orders"
            >
              <Bell className="h-4 w-4 text-[#868e96]" />
              {webPushStatus === "subscribed"
                ? "Order alerts enabled"
                : webPushStatus === "checking"
                  ? "Checking alerts..."
                  : webPushStatus === "error"
                    ? "Alerts unavailable"
                    : "Enable order alerts"}
            </button>
            
            <div className="flex h-[38px] w-[260px] items-center rounded bg-white border border-[#ced4da] overflow-hidden focus-within:border-[#86b7fe] focus-within:ring-2 focus-within:ring-[#86b7fe]/25">
              <input type="text" placeholder="Search for..." className="h-full w-full bg-transparent px-3 text-[14px] text-[#495057] outline-none placeholder:text-[#6c757d]" />
              <button className="flex h-full w-[42px] shrink-0 items-center justify-center bg-[#dc3545] text-white hover:bg-[#c82333] transition">
                <Search className="h-4 w-4" />
              </button>
            </div>

            <button onClick={handleLogout} className="flex items-center gap-1.5 text-[14px] text-[#868e96] hover:text-[#343a40] ml-3 transition">
              <LogOut className="h-[18px] w-[18px]" />
              Logout
            </button>
          </div>
        </header>

        {/* Scrollable Page Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 lg:p-8">
            {children}
          </div>
          <footer className="mt-8 py-6 text-center text-[13px] text-[#868e96]">
            Copyright © YummyDoors {new Date().getFullYear()}
          </footer>
        </div>
      </main>
      </div>
    </>
  );
}

function SidebarLink({ href, icon: Icon, label, active }: { href: string, icon: any, label: string, active: boolean }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-4 px-6 py-3 text-[15px] transition-colors ${
        active 
          ? "text-white bg-[#262c31] font-semibold" 
          : "text-[#8ea2b9] hover:text-white hover:bg-[#262c31] font-medium"
      }`}
    >
      <Icon className={`h-[18px] w-[18px] ${active ? "text-white" : "text-[#8ea2b9]"}`} strokeWidth={active ? 2 : 1.5} />
      {label}
    </Link>
  );
}
