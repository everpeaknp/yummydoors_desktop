"use client";

import Link from "next/link";
import Image from "next/image";
import { Check, Mail, MapPin, Phone, UserCircle2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { SiteNavbar } from "@/components/layout/site-navbar";
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
    <div className="min-h-screen bg-[#fafafb]">
      <SiteNavbar variant="light" />
      <main className="mx-auto w-full max-w-5xl space-y-5 px-6 pb-16 pt-[92px] lg:px-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#e8505b]">Account</p>
            <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-[#111827] sm:text-3xl">Profile</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Review your YummyDoors account details and delivery identity.
            </p>
          </div>
          <Link
            href="/profile/edit"
            className="inline-flex h-10 items-center justify-center rounded-[6px] bg-[#e8505b] px-4 text-[13px] font-bold text-white transition hover:bg-[#d6414c]"
          >
            Edit profile
          </Link>
        </div>

        {error ? (
          <div className="rounded-[10px] border border-[#fecdd3] bg-[#fff1f2] px-5 py-4 text-sm text-[#be123c]">
            {error}
          </div>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-[10px] border border-[#eceff3] bg-white shadow-sm">
            <div className="flex items-center gap-4 border-b border-[#eceff3] px-6 py-5">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#fff1f2] text-[#e8505b]">
                {user?.avatarUrl ? (
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full">
                    <Image
                      fill
                      src={user.avatarUrl}
                      alt={user.fullName}
                      className="object-cover"
                      sizes="64px"
                    />
                  </div>
                ) : (
                  <UserCircle2 className="h-8 w-8" />
                )}
              </div>
              <div className="min-w-0">
                <h3 className="truncate text-[16px] font-bold text-[#111827]">
                  {user?.fullName ?? "Unknown user"}
                </h3>
                <p className="truncate text-[13px] text-muted-foreground">
                  {user?.email ?? user?.phone ?? "No primary identifier"}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="rounded-full border border-gray-200 px-2.5 py-0.5 text-[11px] font-medium capitalize text-[#374151]">
                    {user?.status ?? "unknown"}
                  </span>
                  <span
                    className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                      user?.isVerified ? "bg-[#ecfdf3] text-[#16a34a]" : "bg-[#fff1f2] text-[#e8505b]"
                    }`}
                  >
                    {user?.isVerified ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                    {user?.isVerified ? "Verified" : "Unverified"}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid gap-3 p-6 sm:grid-cols-3">
              <div className="rounded-[8px] border border-[#eceff3] px-4 py-3.5">
                <div className="flex items-center gap-2 text-[#9ca3af]">
                  <Mail className="h-3.5 w-3.5" />
                  <p className="text-[12px] font-semibold text-[#111827]">Email</p>
                </div>
                <p className="mt-2 truncate text-[13px] text-muted-foreground">{user?.email ?? "Not set"}</p>
              </div>
              <div className="rounded-[8px] border border-[#eceff3] px-4 py-3.5">
                <div className="flex items-center gap-2 text-[#9ca3af]">
                  <Phone className="h-3.5 w-3.5" />
                  <p className="text-[12px] font-semibold text-[#111827]">Phone</p>
                </div>
                <p className="mt-2 text-[13px] text-muted-foreground">{user?.phone ?? "Not set"}</p>
              </div>
              <div className="rounded-[8px] border border-[#eceff3] px-4 py-3.5">
                <div className="flex items-center gap-2 text-[#9ca3af]">
                  <MapPin className="h-3.5 w-3.5" />
                  <p className="text-[12px] font-semibold text-[#111827]">Addresses</p>
                </div>
                <p className="mt-2 text-[13px] text-muted-foreground">
                  {addressesLoading ? "Loading..." : String(addresses.length)}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-[10px] border border-[#eceff3] bg-white shadow-sm">
            <div className="border-b border-[#eceff3] px-6 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#e8505b]">
                Default address
              </p>
              <h3 className="mt-1 text-[15px] font-bold text-[#111827]">
                {user?.defaultAddress?.label ?? user?.defaultAddress?.locationTitle ?? "No default address"}
              </h3>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                {user?.defaultAddress?.addressSummary ??
                  "Choose a delivery address so the home feed can personalize location and restaurant context."}
              </p>
            </div>

            {user?.defaultAddress ? (
              <div className="space-y-2 px-6 py-4 text-[13px]">
                <p className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Recipient</span>
                  <span className="font-medium text-[#111827]">{user.defaultAddress.recipientName}</span>
                </p>
                <p className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Phone</span>
                  <span className="font-medium text-[#111827]">
                    {user.defaultAddress.phoneCountryCode ?? ""} {user.defaultAddress.phoneNumber}
                  </span>
                </p>
                <p className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Location</span>
                  <span className="truncate pl-4 text-right font-medium text-[#111827]">
                    {user.defaultAddress.locationTitle} · {user.defaultAddress.locationSubtitle}
                  </span>
                </p>
              </div>
            ) : null}
          </section>
        </div>

        <section className="rounded-[10px] border border-[#eceff3] bg-white shadow-sm">
          <div className="border-b border-[#eceff3] px-6 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#e8505b]">
              Delivery addresses
            </p>
            <h3 className="mt-1 text-[15px] font-bold text-[#111827]">Saved addresses</h3>
          </div>

          <div className="p-6">
            {addressesLoading ? (
              <p className="text-[13px] text-muted-foreground">Loading addresses...</p>
            ) : addressesError ? (
              <div className="rounded-[8px] border border-[#fecdd3] bg-[#fff1f2] px-4 py-3 text-[13px] text-[#be123c]">
                {addressesError}
              </div>
            ) : addresses.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">No saved addresses yet.</p>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {addresses.map((address) => (
                  <div
                    key={address.id}
                    className="rounded-[8px] border border-[#eceff3] px-5 py-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[14px] font-bold text-[#111827]">
                          {address.label ?? address.locationTitle}
                        </p>
                        <p className="mt-1 text-[13px] text-muted-foreground">{address.addressSummary}</p>
                      </div>
                      {address.isDefault ? (
                        <span className="shrink-0 rounded-full bg-[#fff1f2] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#e8505b]">
                          Default
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-3 space-y-1 text-[13px] text-muted-foreground">
                      <p>Recipient: {address.recipientName}</p>
                      <p>
                        Phone: {address.phoneCountryCode ?? ""} {address.phoneNumber}
                      </p>
                      <p>Email: {address.email ?? "Not set"}</p>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
                      {!address.isDefault && (
                        <button
                          type="button"
                          disabled={actionInProgress === address.id}
                          onClick={() => handleSetDefault(address.id)}
                          className="inline-flex h-8 items-center justify-center rounded-[6px] border border-gray-200 px-3 text-[12px] font-semibold text-[#374151] transition hover:bg-gray-50 disabled:opacity-50"
                        >
                          {actionInProgress === address.id ? "Working..." : "Set default"}
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={actionInProgress === address.id}
                        onClick={() => openEditModal(address)}
                        className="inline-flex h-8 items-center justify-center rounded-[6px] px-3 text-[12px] font-semibold text-[#374151] transition hover:bg-gray-50 disabled:opacity-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={actionInProgress === address.id}
                        onClick={() => handleDeleteAddress(address.id)}
                        className="inline-flex h-8 items-center justify-center rounded-[6px] px-3 text-[12px] font-semibold text-[#be123c] transition hover:bg-[#fff1f2] disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      {isEditModalOpen ? (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="w-full max-w-md overflow-hidden rounded-[10px] bg-white shadow-[0_24px_70px_rgba(15,23,42,0.2)]">
            <div className="border-b border-[#eceff3] px-6 py-4">
              <h3 className="text-[15px] font-bold text-[#111827]">Edit address</h3>
              <p className="mt-0.5 text-[13px] text-muted-foreground">Update the details for this saved location.</p>
            </div>
            <form onSubmit={handleEditSubmit} className="space-y-4 px-6 py-5">
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-[#374151]">Recipient name</label>
                <input
                  type="text"
                  required
                  value={editFormState.recipient_name}
                  onChange={(e) => setEditFormState(prev => ({ ...prev, recipient_name: e.target.value }))}
                  className="w-full rounded-[6px] border border-gray-200 px-3.5 py-2.5 text-[13px] text-[#111827] outline-none transition-colors focus:border-[#e8505b] focus:ring-2 focus:ring-[#e8505b]/10"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-[#374151]">Phone number</label>
                <input
                  type="text"
                  required
                  value={editFormState.phone_number}
                  onChange={(e) => setEditFormState(prev => ({ ...prev, phone_number: e.target.value }))}
                  className="w-full rounded-[6px] border border-gray-200 px-3.5 py-2.5 text-[13px] text-[#111827] outline-none transition-colors focus:border-[#e8505b] focus:ring-2 focus:ring-[#e8505b]/10"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-[#374151]">Street address / landmark</label>
                <input
                  type="text"
                  required
                  value={editFormState.address_line_1}
                  onChange={(e) => setEditFormState(prev => ({ ...prev, address_line_1: e.target.value }))}
                  className="w-full rounded-[6px] border border-gray-200 px-3.5 py-2.5 text-[13px] text-[#111827] outline-none transition-colors focus:border-[#e8505b] focus:ring-2 focus:ring-[#e8505b]/10"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  disabled={actionInProgress !== null}
                  className="inline-flex h-10 items-center justify-center rounded-[6px] px-4 text-[13px] font-semibold text-[#374151] transition hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionInProgress !== null}
                  className="inline-flex h-10 items-center justify-center rounded-[6px] bg-[#e8505b] px-4 text-[13px] font-bold text-white transition hover:bg-[#d6414c] disabled:opacity-50"
                >
                  {actionInProgress !== null ? "Saving..." : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
