"use client";

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, Bike, Clock3, Mail, MapPin, Phone, ShieldCheck } from "lucide-react";

import { SiteNavbar } from "@/components/layout/site-navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { mapStoredAddress } from "@/lib/auth-mappers";
import { apiFetch } from "@/lib/http";
import type { StoredCustomerAddress } from "@/lib/auth-storage";
import { useAuth } from "@/hooks/use-auth";

const APPLICATION_PHONE = "9862936014";

type FormState = {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  vehicle: string;
  availability: string;
  note: string;
};

const initialState: FormState = {
  fullName: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  vehicle: "bike",
  availability: "full_time",
  note: "",
};

function extractErrorMessage(payload: unknown) {
  if (typeof payload === "object" && payload !== null) {
    const data = payload as { detail?: unknown; message?: unknown };
    if (typeof data.detail === "string" && data.detail.trim()) {
      return data.detail;
    }
    if (Array.isArray(data.detail) && data.detail.length > 0) {
      return data.detail
        .map((issue) => (typeof issue === "object" && issue !== null ? (issue as { msg?: string }).msg : ""))
        .filter(Boolean)
        .join(" ");
    }
    if (typeof data.message === "string" && data.message.trim()) {
      return data.message;
    }
  }
  return "Something went wrong while submitting your application.";
}

export default function BecomeARiderPage() {
  const { hydrated, user } = useAuth();
  const [form, setForm] = useState<FormState>(initialState);
  const [savedAddresses, setSavedAddresses] = useState<StoredCustomerAddress[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(false);
  const [addressesError, setAddressesError] = useState<string | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const ready = useMemo(
    () =>
      Boolean(
        form.fullName.trim() &&
          form.phone.trim() &&
          form.email.trim() &&
          form.address.trim() &&
          form.city.trim(),
    ),
    [form.address, form.city, form.email, form.fullName, form.phone],
  );

  const selectedAddress = useMemo(
    () => savedAddresses.find((address) => address.id === selectedAddressId) ?? null,
    [savedAddresses, selectedAddressId],
  );

  useEffect(() => {
    const authenticatedUser = user;
    if (!hydrated || !authenticatedUser) return;
    setForm((current) => ({
      ...current,
      fullName: current.fullName || authenticatedUser.fullName || "",
      email: current.email || authenticatedUser.email || "",
      phone: current.phone || authenticatedUser.phone || "",
      address:
        current.address ||
        authenticatedUser.defaultAddress?.addressSummary ||
        authenticatedUser.defaultAddress?.locationTitle ||
        authenticatedUser.defaultAddress?.addressLine1 ||
        "",
      city:
        current.city ||
        authenticatedUser.defaultAddress?.city ||
        authenticatedUser.defaultAddress?.area ||
        "",
    }));
  }, [hydrated, user]);

  useEffect(() => {
    const authenticatedUser = user;
    if (!hydrated || !authenticatedUser) return;
    const defaultAddressId = authenticatedUser.defaultAddressId;

    let cancelled = false;

    async function loadSavedAddresses() {
      setAddressesLoading(true);
      setAddressesError(null);

      try {
        const response = await apiFetch("/me/addresses", { auth: true });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(extractErrorMessage(payload));
        }

        const rawAddresses = Array.isArray(payload)
          ? payload
          : Array.isArray((payload as { data?: unknown } | null)?.data)
            ? ((payload as { data: unknown[] }).data ?? [])
            : [];

        if (cancelled) return;

        const mapped = rawAddresses.map(mapStoredAddress);
        setSavedAddresses(mapped);
        setSelectedAddressId((current) => {
          if (current !== null) return current;
          if (defaultAddressId !== null) return defaultAddressId;
          return mapped.find((address) => address.isDefault)?.id ?? mapped[0]?.id ?? null;
        });
      } catch (caught) {
        if (cancelled) return;
        setSavedAddresses([]);
        setSelectedAddressId(null);
        setAddressesError(caught instanceof Error ? caught.message : "Failed to load saved addresses.");
      } finally {
        if (!cancelled) {
          setAddressesLoading(false);
        }
      }
    }

    void loadSavedAddresses();

    return () => {
      cancelled = true;
    };
  }, [hydrated, user]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!ready) return;
    setLoading(true);
    setError(null);

    try {
      const response = await apiFetch("/rider-applications", {
        method: "POST",
        auth: true,
        body: JSON.stringify({
          full_name: form.fullName.trim() || null,
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          city_area: form.city.trim(),
          address: form.address.trim() || null,
          vehicle_type: form.vehicle.trim(),
          availability: form.availability.trim(),
          notes: form.note.trim() || null,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(extractErrorMessage(payload));
      }

      setSubmitted(true);
      setForm((current) => ({ ...current, note: "" }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to submit rider application.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f8fb]">
      <SiteNavbar variant="light" />

      <main className="mx-auto w-full max-w-5xl px-4 pb-12 pt-[104px] sm:px-6 lg:px-8">
        <div className="mb-4 flex items-center justify-between">
          <Link href="/restaurants" className="inline-flex h-11 items-center gap-2 rounded-xl px-0 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Back to restaurants
          </Link>
        </div>

        <Card className="overflow-hidden border-[#eceff3] shadow-[0_12px_40px_rgba(15,23,42,0.08)]">
          <div className="bg-gradient-to-r from-[#ff7a32] via-[#ff6320] to-[#ff8d3d] px-6 py-8 text-white sm:px-8">
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em]">
              <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1">Customer to rider</span>
              <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1">Open application</span>
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Become a rider</h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/90 sm:text-base">
              Apply from the customer app. This does not switch your account automatically.
              We review the details first, then enable rider access from the backend.
            </p>
          </div>

          <CardContent className="grid gap-6 p-6 lg:grid-cols-[1.25fr_0.75fr] lg:p-8">
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="rounded-2xl border border-[#e6ebf0] bg-[#f8fafc] p-4 text-sm text-[#475569]">
                <p className="font-semibold text-[#111827]">Signed in as {user?.fullName || "your account"}</p>
                <p className="mt-1">
                  Your profile details are pulled from your session. Rider-specific details below are the only fields you need to add.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="fullName" className="text-sm font-medium text-foreground">Full name</label>
                  <Input
                    id="fullName"
                    value={form.fullName}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
                    placeholder="Your full name"
                    disabled={Boolean(user?.fullName)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="phone" className="text-sm font-medium text-foreground">Phone</label>
                  <Input
                    id="phone"
                    value={form.phone}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                    placeholder="+977..."
                    disabled={Boolean(user?.phone)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium text-foreground">Email</label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                    placeholder="you@example.com"
                    disabled={Boolean(user?.email)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="city" className="text-sm font-medium text-foreground">City / area</label>
                  <Input
                    id="city"
                    value={form.city}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setForm((prev) => ({ ...prev, city: e.target.value }))}
                    placeholder="Pokhara, Kathmandu, ..."
                    required
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <label htmlFor="address" className="text-sm font-medium text-foreground">Address</label>
                  {addressesLoading ? (
                    <div className="flex h-11 items-center rounded-md border border-input bg-background px-3 text-sm text-muted-foreground">
                      Loading saved addresses...
                    </div>
                  ) : savedAddresses.length > 0 ? (
                    <div className="space-y-2">
                      <select
                        id="address"
                        value={selectedAddressId ?? ""}
                        onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                          const nextId = Number(e.target.value);
                          const nextAddress = savedAddresses.find((item) => item.id === nextId) ?? null;
                          setSelectedAddressId(Number.isFinite(nextId) ? nextId : null);
                          if (nextAddress) {
                            setForm((prev) => ({
                              ...prev,
                              address: nextAddress.addressSummary || nextAddress.locationTitle || "",
                              city: prev.city || nextAddress.city || nextAddress.area || "",
                            }));
                          }
                        }}
                        className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none ring-offset-background transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        {savedAddresses.map((address) => (
                          <option key={address.id} value={address.id}>
                            {address.label ?? address.locationTitle ?? address.addressSummary ?? "Saved address"}
                          </option>
                        ))}
                      </select>

                      {selectedAddress ? (
                        <div className="rounded-md border border-dashed border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                          <p className="font-medium text-foreground">
                            {selectedAddress.label ?? selectedAddress.locationTitle}
                          </p>
                          <p>{selectedAddress.addressSummary || selectedAddress.addressLine1 || "Selected saved address"}</p>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <Input
                      id="address"
                      value={form.address}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setForm((prev) => ({ ...prev, address: e.target.value }))}
                      placeholder="Street, area, landmark, or saved address"
                      required
                    />
                  )}
                  {addressesError ? (
                    <p className="text-xs text-red-600">{addressesError}</p>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="vehicle" className="text-sm font-medium text-foreground">Vehicle type</label>
                  <select
                    id="vehicle"
                    value={form.vehicle}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) => setForm((prev) => ({ ...prev, vehicle: e.target.value }))}
                    className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none ring-offset-background transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="bike">Bike</option>
                    <option value="scooter">Scooter</option>
                    <option value="car">Car</option>
                    <option value="bicycle">Bicycle</option>
                    <option value="walk">Walk / on foot</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label htmlFor="availability" className="text-sm font-medium text-foreground">Availability</label>
                  <select
                    id="availability"
                    value={form.availability}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) => setForm((prev) => ({ ...prev, availability: e.target.value }))}
                    className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none ring-offset-background transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="full_time">Full time</option>
                    <option value="part_time">Part time</option>
                    <option value="weekends">Weekends only</option>
                    <option value="flexible">Flexible</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="note" className="text-sm font-medium text-foreground">Notes</label>
                <textarea
                  id="note"
                  value={form.note}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setForm((prev) => ({ ...prev, note: e.target.value }))}
                  placeholder="Experience, documents, preferred zone, or anything else the team should know."
                  rows={6}
                  className="flex min-h-32 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none ring-offset-background transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <Button type="submit" className="gap-2" disabled={!ready || loading}>
                  <Mail className="h-4 w-4" />
                  {loading ? "Sending..." : "Send application"}
                </Button>
                <a href={`tel:${APPLICATION_PHONE}`} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-secondary px-4 text-sm font-medium text-secondary-foreground transition-colors hover:bg-[#ffe8d3]">
                  <Phone className="h-4 w-4" />
                  Call support
                </a>
              </div>

              {error ? (
                <p className="text-sm text-red-600">{error}</p>
              ) : null}

              {submitted ? (
                <p className="text-sm text-muted-foreground">
                  Your rider application was submitted. Admin notifications and email alerts were sent for review.
                </p>
              ) : null}
            </form>

            <aside className="space-y-4">
              <Card className="border-[#eceff3]">
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-[#fff0e6] p-3 text-[#ff6f2c]">
                      <Bike className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold">How this works</h2>
                      <p className="text-xs text-muted-foreground">Customer-facing intake</p>
                    </div>
                  </div>

                  <div className="space-y-3 text-sm text-[#374151]">
                    <div className="flex items-start gap-3">
                      <ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-600" />
                      <p>We review the request before rider access is granted.</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <Clock3 className="mt-0.5 h-4 w-4 text-[#ff6f2c]" />
                      <p>After approval, the backend can assign the rider role and dashboard.</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <MapPin className="mt-0.5 h-4 w-4 text-[#ff6f2c]" />
                      <p>This is separate from merchant signup and separate from customer orders.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-[#eceff3] bg-[#fafafa]">
                <CardContent className="space-y-3 p-5">
                  <h3 className="text-sm font-bold">Direct contact</h3>
                  <p className="text-sm text-muted-foreground">Use these contacts if you need direct support.</p>
                  <div className="space-y-2 text-sm">
                    <p className="block font-semibold text-primary">{`support@yummydoors.com`}</p>
                    <a className="block font-semibold text-primary hover:underline" href={`tel:${APPLICATION_PHONE}`}>
                      {APPLICATION_PHONE}
                    </a>
                  </div>
                </CardContent>
              </Card>
            </aside>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
