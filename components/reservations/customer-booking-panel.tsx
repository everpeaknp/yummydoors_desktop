"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock3, Lock, PartyPopper, UsersRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { apiFetch } from "@/lib/http";
import {
  extractApiErrorMessage,
  formatReservationDate,
  formatReservationTime,
  type ReservationAvailabilityResponse,
} from "@/lib/reservations";

type CustomerBookingPanelProps = {
  restaurantSlug: string;
  restaurantName: string;
  supportsTableBooking: boolean;
};

function getDefaultReservationDate() {
  const nextDay = new Date();
  nextDay.setDate(nextDay.getDate() + 1);
  return nextDay.toISOString().slice(0, 10);
}

export function CustomerBookingPanel({
  restaurantSlug,
  restaurantName,
  supportsTableBooking,
}: CustomerBookingPanelProps) {
  const router = useRouter();
  const { hydrated, accessToken, user } = useAuth();

  const [reservationDate, setReservationDate] = useState(getDefaultReservationDate);
  const [guestCount, setGuestCount] = useState(2);
  const [selectedTime, setSelectedTime] = useState("");
  const [selectedTableId, setSelectedTableId] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [occasion, setOccasion] = useState("");
  const [specialRequest, setSpecialRequest] = useState("");

  const [slotPayload, setSlotPayload] = useState<ReservationAvailabilityResponse | null>(null);
  const [tablePayload, setTablePayload] = useState<ReservationAvailabilityResponse | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [loadingTables, setLoadingTables] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setContactName((current) => current || user?.fullName || "");
    setContactPhone((current) => current || user?.phone || "");
    setContactEmail((current) => current || user?.email || "");
  }, [user?.email, user?.fullName, user?.phone]);

  useEffect(() => {
    if (!supportsTableBooking) {
      return;
    }

    let cancelled = false;

    async function loadSlots() {
      setLoadingSlots(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          reservation_date: reservationDate,
          guest_count: String(guestCount),
        });

        const response = await apiFetch(
          `/restaurants/${restaurantSlug}/reservations/availability?${params.toString()}`,
          { auth: Boolean(accessToken) },
        );
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(extractApiErrorMessage(payload));
        }

        const nextData = payload?.data as ReservationAvailabilityResponse;
        if (cancelled) {
          return;
        }

        setSlotPayload(nextData);
        setSelectedTableId("");
        const firstAvailableSlot =
          nextData?.slots?.find((slot) => slot.is_available)?.time ?? "";
        setSelectedTime((current) => {
          if (current && nextData?.slots?.some((slot) => slot.time === current && slot.is_available)) {
            return current;
          }
          return firstAvailableSlot;
        });
      } catch (caught) {
        if (!cancelled) {
          setSlotPayload(null);
          setSelectedTime("");
          setTablePayload(null);
          setError(caught instanceof Error ? caught.message : "Failed to load reservation slots.");
        }
      } finally {
        if (!cancelled) {
          setLoadingSlots(false);
        }
      }
    }

    void loadSlots();

    return () => {
      cancelled = true;
    };
  }, [accessToken, guestCount, reservationDate, restaurantSlug, supportsTableBooking]);

  useEffect(() => {
    if (!supportsTableBooking || !selectedTime) {
      setTablePayload(null);
      setSelectedTableId("");
      return;
    }

    let cancelled = false;

    async function loadTables() {
      setLoadingTables(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          reservation_date: reservationDate,
          guest_count: String(guestCount),
          reservation_time: selectedTime,
        });

        const response = await apiFetch(
          `/restaurants/${restaurantSlug}/reservations/availability?${params.toString()}`,
          { auth: Boolean(accessToken) },
        );
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(extractApiErrorMessage(payload));
        }

        const nextData = payload?.data as ReservationAvailabilityResponse;
        if (cancelled) {
          return;
        }

        setTablePayload(nextData);
        setSelectedTableId((current) => {
          if (current && nextData.available_tables.some((table) => String(table.id) === current)) {
            return current;
          }
          return "";
        });
      } catch (caught) {
        if (!cancelled) {
          setTablePayload(null);
          setSelectedTableId("");
          setError(caught instanceof Error ? caught.message : "Failed to load available tables.");
        }
      } finally {
        if (!cancelled) {
          setLoadingTables(false);
        }
      }
    }

    void loadTables();

    return () => {
      cancelled = true;
    };
  }, [accessToken, guestCount, reservationDate, restaurantSlug, selectedTime, supportsTableBooking]);

  const slots = useMemo(() => slotPayload?.slots ?? [], [slotPayload]);
  const availableTables = tablePayload?.available_tables ?? [];
  const selectedSlotMeta = useMemo(
    () => slots.find((slot) => slot.time === selectedTime) ?? null,
    [selectedTime, slots],
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken) {
      router.push("/login");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await apiFetch(`/restaurants/${restaurantSlug}/reservations`, {
        method: "POST",
        auth: true,
        body: JSON.stringify({
          reservation_date: reservationDate,
          reservation_time: selectedTime,
          guest_count: guestCount,
          contact_name: contactName.trim(),
          contact_phone: contactPhone.trim(),
          contact_email: contactEmail.trim() || null,
          occasion: occasion.trim() || null,
          special_request: specialRequest.trim() || null,
          table_id: selectedTableId ? Number(selectedTableId) : null,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(extractApiErrorMessage(payload));
      }

      const reservationId = payload?.data?.id;
      setSuccess("Reservation created successfully.");
      if (reservationId) {
        router.push(`/reservations/${reservationId}`);
        return;
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to create reservation.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!supportsTableBooking) {
    return (
      <Card className="border-[#efe4d8] bg-white">
        <CardContent className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Reservations
          </p>
          <h3 className="text-xl font-semibold text-foreground">Table booking is not active here yet</h3>
          <p className="text-sm leading-7 text-muted-foreground">
            {restaurantName} is live for ordering, but merchant booking slots have not been enabled yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-[#efe4d8] bg-white">
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Reserve a table
          </p>
          <h3 className="text-2xl font-semibold text-foreground">Book this restaurant without leaving the menu</h3>
          <p className="text-sm leading-7 text-muted-foreground">
            Choose a date, guest count, and an open slot. If the merchant manages tables, we will let the customer pick one too.
          </p>
        </div>

        {!hydrated ? (
          <div className="rounded-2xl border border-border bg-[#fcfcfd] px-4 py-4 text-sm text-muted-foreground">
            Preparing booking flow...
          </div>
        ) : !accessToken ? (
          <div className="rounded-2xl border border-[#efe4d8] bg-[#fcfaf7] px-5 py-5">
            <div className="flex items-start gap-3">
              <Lock className="mt-0.5 h-4 w-4 text-primary" />
              <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">
                  Sign in first to keep reservations attached to your YummyDoors account.
                </p>
                <div className="flex gap-3">
                  <Link href="/login">
                    <Button>Sign in</Button>
                  </Link>
                  <Link href="/signup">
                    <Button variant="secondary">Create account</Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  Reservation date
                </label>
                <Input
                  type="date"
                  min={new Date().toISOString().slice(0, 10)}
                  value={reservationDate}
                  onChange={(event) => setReservationDate(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <UsersRound className="h-4 w-4 text-primary" />
                  Guests
                </label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={guestCount}
                  onChange={(event) => setGuestCount(Math.max(1, Number(event.target.value) || 1))}
                  required
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Clock3 className="h-4 w-4 text-primary" />
                Time slot
              </label>
              {loadingSlots ? (
                <div className="rounded-2xl border border-border bg-[#fcfcfd] px-4 py-4 text-sm text-muted-foreground">
                  Loading available slots...
                </div>
              ) : slots.length === 0 ? (
                <div className="rounded-2xl border border-[#efe4d8] bg-[#fcfaf7] px-4 py-4 text-sm text-muted-foreground">
                  No bookable slots are available for {formatReservationDate(reservationDate)}.
                </div>
              ) : (
                <div className="flex flex-wrap gap-2.5">
                  {slots.map((slot) => (
                    <button
                      key={slot.time}
                      type="button"
                      disabled={!slot.is_available}
                      onClick={() => setSelectedTime(slot.time)}
                      className={`rounded-full border px-3 py-2 text-sm font-medium transition ${
                        selectedTime === slot.time
                          ? "border-primary bg-[#fff4ec] text-primary"
                          : slot.is_available
                            ? "border-border bg-white text-foreground hover:border-primary/35"
                            : "cursor-not-allowed border-[#eceef3] bg-[#f8fafc] text-[#a0a8b5]"
                      }`}
                    >
                      {formatReservationTime(slot.time)}
                    </button>
                  ))}
                </div>
              )}
              {selectedSlotMeta ? (
                <p className="text-xs text-muted-foreground">
                  {selectedSlotMeta.remaining_tables > 0
                    ? `${selectedSlotMeta.remaining_tables} table option${
                        selectedSlotMeta.remaining_tables === 1 ? "" : "s"
                      } still open for this slot.`
                    : "This slot has no free tables left."}
                </p>
              ) : null}
            </div>

            {selectedTime ? (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Preferred table</label>
                <select
                  value={selectedTableId}
                  onChange={(event) => setSelectedTableId(event.target.value)}
                  className="flex h-12 w-full rounded-xl border border-input bg-white px-4 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
                >
                  <option value="">Let the restaurant assign the table</option>
                  {availableTables.map((table) => (
                    <option key={table.id} value={table.id}>
                      {table.label}
                      {table.zone ? ` • ${table.zone}` : ""}
                      {` • seats ${table.min_guest_count}-${table.max_guest_count}`}
                    </option>
                  ))}
                </select>
                {loadingTables ? (
                  <p className="text-xs text-muted-foreground">Loading matching tables...</p>
                ) : null}
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Contact name</label>
                <Input value={contactName} onChange={(event) => setContactName(event.target.value)} required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Phone number</label>
                <Input value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Email</label>
                <Input
                  type="email"
                  value={contactEmail}
                  onChange={(event) => setContactEmail(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <PartyPopper className="h-4 w-4 text-primary" />
                  Occasion
                </label>
                <Input
                  value={occasion}
                  onChange={(event) => setOccasion(event.target.value)}
                  placeholder="Birthday, team dinner, anniversary..."
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Special request</label>
              <textarea
                value={specialRequest}
                onChange={(event) => setSpecialRequest(event.target.value)}
                rows={4}
                className="w-full rounded-2xl border border-input bg-white px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15"
                placeholder="Add notes for seating, celebration setup, or any restaurant instruction."
              />
            </div>

            {error ? (
              <div className="rounded-2xl border border-[#ffd8cc] bg-[#fff4ef] px-4 py-3 text-sm text-[#9a3412]">
                {error}
              </div>
            ) : null}

            {success ? (
              <div className="rounded-2xl border border-[#d4f3db] bg-[#f3fff6] px-4 py-3 text-sm text-[#166534]">
                {success}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs leading-6 text-muted-foreground">
                Your booking stays attached to your account and will appear inside My Reservations.
              </p>
              <Button
                type="submit"
                disabled={
                  submitting ||
                  loadingSlots ||
                  !selectedTime ||
                  !contactName.trim() ||
                  !contactPhone.trim()
                }
              >
                {submitting ? "Confirming..." : "Reserve table"}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
