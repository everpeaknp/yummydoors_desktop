"use client";

import Link from "next/link";
import Image from "next/image";
import { Mail, MapPin, Phone, UserCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { SiteNavbar } from "@/components/layout/site-navbar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { mapStoredAddress, mergeStoredUserWithProfile } from "@/lib/auth-mappers";
import { apiFetch } from "@/lib/http";
import type { StoredCustomerAddress } from "@/lib/auth-storage";
import { useAuth } from "@/hooks/use-auth";
import { useAuthStore } from "@/stores/auth-store";

function extractApiErrorMessage(payload: unknown, fallback: string) {
  if (typeof payload === "object" && payload !== null) {
    const maybeDetail = (payload as { detail?: unknown }).detail;
    if (typeof maybeDetail === "string" && maybeDetail.trim()) {
      return maybeDetail;
    }
    const maybeMessage = (payload as { message?: unknown }).message;
    if (typeof maybeMessage === "string" && maybeMessage.trim()) {
      return maybeMessage;
    }
  }
  return fallback;
}

async function readJsonSafely(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export default function ProfilePage() {
  const router = useRouter();
  const { hydrated, accessToken } = useAuth();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const [profileLoading, setProfileLoading] = useState(true);
  const [addressesLoading, setAddressesLoading] = useState(true);
  const [addresses, setAddresses] = useState<StoredCustomerAddress[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [addressesError, setAddressesError] = useState<string | null>(null);

  // Address Action State
  const [actionInProgress, setActionInProgress] = useState<number | null>(null);
  
  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<StoredCustomerAddress | null>(null);
  const [editFormState, setEditFormState] = useState({
    recipient_name: "",
    phone_number: "",
    address_line_1: "",
  });

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    if (!accessToken) {
      router.replace("/login");
      return;
    }

    let cancelled = false;

    async function loadProfile() {
      setProfileLoading(true);
      setAddressesLoading(true);
      setError(null);
      setAddressesError(null);
      try {
        const profileResponse = await apiFetch("/me/profile", { auth: true });
        const profilePayload = await readJsonSafely(profileResponse);

        if (!profileResponse.ok) {
          throw new Error(extractApiErrorMessage(profilePayload, "Failed to load your profile."));
        }

        if (!cancelled) {
          const storedUser = useAuthStore.getState().user;
          if (storedUser) {
            setUser(mergeStoredUserWithProfile(storedUser, profilePayload));
          }
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Failed to load your profile.");
        }
      } finally {
        if (!cancelled) {
          setProfileLoading(false);
        }
      }
    }

    async function loadAddresses() {
      setAddressesLoading(true);
      setAddressesError(null);

      try {
        const addressesResponse = await apiFetch("/me/addresses", { auth: true });
        const addressesPayload = await readJsonSafely(addressesResponse);

        if (!addressesResponse.ok) {
          throw new Error(
            extractApiErrorMessage(addressesPayload, "Failed to load saved addresses."),
          );
        }

        const rawAddresses = Array.isArray(addressesPayload)
          ? addressesPayload
          : Array.isArray((addressesPayload as { data?: unknown } | null)?.data)
            ? ((addressesPayload as { data: unknown[] }).data ?? [])
            : [];

        if (!cancelled) {
          setAddresses(rawAddresses.map(mapStoredAddress));
        }
      } catch (caught) {
        if (!cancelled) {
          setAddresses([]);
          setAddressesError(
            caught instanceof Error ? caught.message : "Failed to load saved addresses.",
          );
        }
      } finally {
        if (!cancelled) {
          setAddressesLoading(false);
        }
      }
    }

    void Promise.allSettled([loadProfile(), loadAddresses()]);

    return () => {
      cancelled = true;
    };
  }, [hydrated, accessToken, router, setUser]);

  async function reloadAddressesAndProfile() {
    try {
      const [profileRes, addrRes] = await Promise.all([
        apiFetch("/me/profile", { auth: true }),
        apiFetch("/me/addresses", { auth: true })
      ]);
      const profileData = await readJsonSafely(profileRes);
      const addrData = await readJsonSafely(addrRes);
      
      const storedUser = useAuthStore.getState().user;
      if (storedUser && profileRes.ok) {
        setUser(mergeStoredUserWithProfile(storedUser, profileData));
      }
      
      if (addrRes.ok) {
        const rawAddresses = Array.isArray(addrData)
          ? addrData
          : Array.isArray((addrData as { data?: unknown } | null)?.data)
            ? ((addrData as { data: unknown[] }).data ?? [])
            : [];
        setAddresses(rawAddresses.map(mapStoredAddress));
      }
    } catch {
      // Ignore background refresh errors
    }
  }

  async function handleSetDefault(id: number) {
    if (actionInProgress) return;
    setActionInProgress(id);
    try {
      await apiFetch(`/me/addresses/${id}/default`, { method: "POST", auth: true });
      await reloadAddressesAndProfile();
    } catch (e) {
      alert("Failed to set default address.");
    } finally {
      setActionInProgress(null);
    }
  }

  async function handleDeleteAddress(id: number) {
    if (actionInProgress || !confirm("Are you sure you want to delete this address?")) return;
    setActionInProgress(id);
    try {
      await apiFetch(`/me/addresses/${id}`, { method: "DELETE", auth: true });
      await reloadAddressesAndProfile();
    } catch (e) {
      alert("Failed to delete address.");
    } finally {
      setActionInProgress(null);
    }
  }

  function openEditModal(address: StoredCustomerAddress) {
    setEditingAddress(address);
    setEditFormState({
      recipient_name: address.recipientName || "",
      phone_number: address.phoneNumber || "",
      address_line_1: address.addressSummary || address.locationTitle || "",
    });
    setIsEditModalOpen(true);
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingAddress) return;
    
    setActionInProgress(editingAddress.id);
    try {
      await apiFetch(`/me/addresses/${editingAddress.id}`, {
        method: "PATCH",
        auth: true,
        body: JSON.stringify({
          recipient_name: editFormState.recipient_name,
          phone_number: editFormState.phone_number,
          address_line_1: editFormState.address_line_1,
        }),
      });
      setIsEditModalOpen(false);
      await reloadAddressesAndProfile();
    } catch (e) {
      alert("Failed to update address.");
    } finally {
      setActionInProgress(null);
    }
  }

  if (!hydrated) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Preparing profile...</div>;
  }

  if (!accessToken) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#fcfcfd]">
      <SiteNavbar className="sticky top-0 z-40" />
      <main className="mx-auto w-full max-w-7xl space-y-6 px-6 py-10 lg:px-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Profile</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Review your YummyDoors account details and delivery identity.
            </p>
          </div>
          <Link href="/profile/edit">
            <Button>Edit profile</Button>
          </Link>
        </div>

        {error ? (
          <div className="rounded-2xl border border-[#ffd8cc] bg-[#fff4ef] px-4 py-3 text-sm text-[#9a3412]">
            {error}
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <Card>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#eff6ff] text-[#024abe] shadow-sm">
                  {user?.avatarUrl ? (
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full">
                      <Image
                        fill
                        src={user.avatarUrl}
                        alt={user.fullName}
                        className="object-cover"
                        sizes="80px"
                      />
                    </div>
                  ) : (
                    <UserCircle2 className="h-10 w-10" />
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-foreground">
                    {user?.fullName ?? "Unknown user"}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {user?.email ?? user?.phone ?? "No primary identifier"}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full border border-[#eceef3] bg-[#f8fafc] px-3 py-1 text-xs font-medium text-foreground">
                      Status: {user?.status ?? "unknown"}
                    </span>
                    <span className="rounded-full border border-[#ffd8cc] bg-secondary px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                      {user?.isVerified ? "Verified" : "Unverified"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-border bg-[#fcfcfd] px-4 py-4">
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-primary" />
                    <p className="text-sm font-medium text-foreground">Email</p>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">{user?.email ?? "Not set"}</p>
                </div>
                <div className="rounded-2xl border border-border bg-[#fcfcfd] px-4 py-4">
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-primary" />
                    <p className="text-sm font-medium text-foreground">Phone</p>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">{user?.phone ?? "Not set"}</p>
                </div>
                <div className="rounded-2xl border border-border bg-[#fcfcfd] px-4 py-4">
                  <div className="flex items-center gap-3">
                    <MapPin className="h-4 w-4 text-primary" />
                    <p className="text-sm font-medium text-foreground">Saved addresses</p>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {addressesLoading ? "Loading..." : String(addresses.length)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                  Default address
                </p>
                <h3 className="mt-2 text-xl font-semibold text-foreground">
                  {user?.defaultAddress?.label ?? user?.defaultAddress?.locationTitle ?? "No default address"}
                </h3>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">
                  {user?.defaultAddress?.addressSummary ??
                    "Choose a delivery address so the home feed can personalize location and restaurant context."}
                </p>
              </div>

              {user?.defaultAddress ? (
                <div className="rounded-2xl border border-border bg-[#fcfcfd] px-4 py-4 text-sm text-muted-foreground">
                  <p>
                    Recipient: <span className="font-medium text-foreground">{user.defaultAddress.recipientName}</span>
                  </p>
                  <p className="mt-2">
                    Phone:{" "}
                    <span className="font-medium text-foreground">
                      {user.defaultAddress.phoneCountryCode ?? ""} {user.defaultAddress.phoneNumber}
                    </span>
                  </p>
                  <p className="mt-2">
                    Location:{" "}
                    <span className="font-medium text-foreground">
                      {user.defaultAddress.locationTitle} • {user.defaultAddress.locationSubtitle}
                    </span>
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent>
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                  Delivery addresses
                </p>
                <h3 className="mt-2 text-xl font-semibold text-foreground">Saved addresses</h3>
              </div>
            </div>

            {addressesLoading ? (
              <p className="text-sm text-muted-foreground">Loading addresses...</p>
            ) : addressesError ? (
              <div className="rounded-2xl border border-[#ffd8cc] bg-[#fff4ef] px-4 py-3 text-sm text-[#9a3412]">
                {addressesError}
              </div>
            ) : addresses.length === 0 ? (
              <p className="text-sm text-muted-foreground">No saved addresses yet.</p>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {addresses.map((address) => (
                  <div
                    key={address.id}
                    className="rounded-2xl border border-border bg-[#fcfcfd] px-5 py-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-foreground">
                          {address.label ?? address.locationTitle}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">{address.addressSummary}</p>
                      </div>
                      {address.isDefault ? (
                        <span className="rounded-full border border-[#ffd8cc] bg-secondary px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
                          Default
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-4 grid gap-2 text-sm text-muted-foreground">
                      <p>Recipient: {address.recipientName}</p>
                      <p>
                        Phone: {address.phoneCountryCode ?? ""} {address.phoneNumber}
                      </p>
                      <p>Email: {address.email ?? "Not set"}</p>
                    </div>
                    <div className="mt-5 flex flex-wrap items-center gap-3 pt-4 border-t border-gray-100">
                      {!address.isDefault && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          disabled={actionInProgress === address.id}
                          onClick={() => handleSetDefault(address.id)}
                        >
                          {actionInProgress === address.id ? "Working..." : "Set Default"}
                        </Button>
                      )}
                      <Button 
                        variant="ghost" 
                        size="sm"
                        disabled={actionInProgress === address.id}
                        onClick={() => openEditModal(address)}
                      >
                        Edit
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        disabled={actionInProgress === address.id}
                        onClick={() => handleDeleteAddress(address.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
      
      {/* Edit Address Modal Overlay */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden p-6 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-[#111827] mb-2">Edit Address</h3>
            <p className="text-sm text-gray-500 mb-6">Update the details for this saved location.</p>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Recipient Name</label>
                <input 
                  type="text" 
                  required
                  value={editFormState.recipient_name}
                  onChange={(e) => setEditFormState(prev => ({ ...prev, recipient_name: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-4 py-2 focus:ring-primary focus:border-primary outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <input 
                  type="text" 
                  required
                  value={editFormState.phone_number}
                  onChange={(e) => setEditFormState(prev => ({ ...prev, phone_number: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-4 py-2 focus:ring-primary focus:border-primary outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Street Address / Landmark</label>
                <input 
                  type="text" 
                  required
                  value={editFormState.address_line_1}
                  onChange={(e) => setEditFormState(prev => ({ ...prev, address_line_1: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-4 py-2 focus:ring-primary focus:border-primary outline-none"
                />
              </div>
              <div className="pt-4 flex items-center justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-5 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition"
                  disabled={actionInProgress !== null}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={actionInProgress !== null}
                  className="px-6 py-2 bg-primary text-white text-sm font-medium rounded-md hover:bg-primary/90 transition disabled:opacity-50"
                >
                  {actionInProgress !== null ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
