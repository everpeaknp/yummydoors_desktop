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
      <div className="overflow-hidden rounded-[4px] border border-gray-100 bg-white shadow-sm">
        <div className="bg-[#4a4a4a] px-6 py-4">
          <h3 className="text-[16px] font-bold text-white">Reserve a table</h3>
        </div>
        <div className="p-6">
          <h3 className="text-[15px] font-bold text-[#111]">Table booking is not active</h3>
          <p className="mt-2 text-[14px] text-gray-500">
            {restaurantName} is live for ordering, but merchant booking slots have not been enabled yet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[4px] border border-gray-100 bg-white shadow-sm">
      <div className="bg-[#4a4a4a] px-6 py-4">
        <h3 className="text-[16px] font-bold text-white">Reserve a table</h3>
      </div>
      <div className="p-6 space-y-6">

        {!hydrated ? (
          <div className="rounded-[4px] border border-gray-100 bg-gray-50 px-4 py-4 text-sm text-gray-500">
            Preparing booking flow...
          </div>
        ) : !accessToken ? (
          <div className="rounded-[4px] border border-gray-100 bg-gray-50 px-5 py-5">
            <div className="flex items-start gap-3">
              <Lock className="mt-0.5 h-4 w-4 text-[#111]" />
              <div className="space-y-3">
                <p className="text-[14px] font-semibold text-[#111]">
                  Sign in first to keep reservations attached to your account.
                </p>
                <div className="flex gap-3">
                  <Link href="/login">
                    <Button className="h-9 rounded-[4px] px-4 text-xs font-bold">Sign in</Button>
                  </Link>
                  <Link href="/signup">
                    <Button variant="secondary" className="h-9 rounded-[4px] border-gray-200 bg-white px-4 text-xs font-bold shadow-sm">Create account</Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-[13px] font-bold text-[#111]">Date</label>
                <Input
                  type="date"
                  className="rounded-[4px] border-gray-200 shadow-sm"
                  min={new Date().toISOString().slice(0, 10)}
                  value={reservationDate}
                  onChange={(event) => setReservationDate(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-[13px] font-bold text-[#111]">Guests</label>
                <Input
                  type="number"
                  className="rounded-[4px] border-gray-200 shadow-sm"
                  min={1}
                  max={50}
                  value={guestCount}
                  onChange={(event) => setGuestCount(Math.max(1, Number(event.target.value) || 1))}
                  required
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[13px] font-bold text-[#111]">Time slot</label>
              {loadingSlots ? (
                <div className="rounded-[4px] border border-gray-100 bg-gray-50 px-4 py-4 text-[13px] text-gray-500">
                  Loading available slots...
                </div>
              ) : slots.length === 0 ? (
                <div className="rounded-[4px] border border-gray-100 bg-gray-50 px-4 py-4 text-[13px] text-gray-500">
                  No bookable slots are available for {formatReservationDate(reservationDate)}.
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {slots.map((slot) => (
                    <button
                      key={slot.time}
                      type="button"
                      disabled={!slot.is_available}
                      onClick={() => setSelectedTime(slot.time)}
                      className={`rounded-[4px] border px-3 py-1.5 text-[13px] font-bold transition ${
                        selectedTime === slot.time
                          ? "border-[#111] bg-[#111] text-white"
                          : slot.is_available
                            ? "border-gray-200 bg-white text-gray-600 hover:border-gray-400"
                            : "cursor-not-allowed border-gray-100 bg-gray-50 text-gray-300"
                      }`}
                    >
                      {formatReservationTime(slot.time)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedTime ? (
              <div className="space-y-2">
                <label className="text-[13px] font-bold text-[#111]">Preferred table</label>
                <select
                  value={selectedTableId}
                  onChange={(event) => setSelectedTableId(event.target.value)}
                  className="flex h-10 w-full rounded-[4px] border border-gray-200 bg-white px-3 text-[14px] text-[#111] outline-none transition-colors focus:border-[#111] shadow-sm"
                >
                  <option value="">Any available table</option>
                  {availableTables.map((table) => (
                    <option key={table.id} value={table.id}>
                      {table.label}
                      {table.zone ? ` • ${table.zone}` : ""}
                      {` • seats ${table.min_guest_count}-${table.max_guest_count}`}
                    </option>
                  ))}
                </select>
                {loadingTables ? (
                  <p className="text-[12px] text-gray-500">Loading matching tables...</p>
                ) : null}
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-[13px] font-bold text-[#111]">Name</label>
                <Input className="rounded-[4px] border-gray-200 shadow-sm" value={contactName} onChange={(event) => setContactName(event.target.value)} required />
              </div>
              <div className="space-y-2">
                <label className="text-[13px] font-bold text-[#111]">Phone</label>
                <Input className="rounded-[4px] border-gray-200 shadow-sm" value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} required />
              </div>
              <div className="space-y-2">
                <label className="text-[13px] font-bold text-[#111]">Email</label>
                <Input
                  type="email"
                  className="rounded-[4px] border-gray-200 shadow-sm"
                  value={contactEmail}
                  onChange={(event) => setContactEmail(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[13px] font-bold text-[#111]">Occasion</label>
                <Input
                  className="rounded-[4px] border-gray-200 shadow-sm"
                  value={occasion}
                  onChange={(event) => setOccasion(event.target.value)}
                  placeholder="Birthday..."
                />
              </div>
            </div>

            {error ? (
              <div className="rounded-[4px] border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-medium text-red-600">
                {error}
              </div>
            ) : null}

            {success ? (
              <div className="rounded-[4px] border border-green-200 bg-green-50 px-4 py-3 text-[13px] font-medium text-green-700">
                {success}
              </div>
            ) : null}

            <Button
              type="submit"
              className="w-full h-11 rounded-[4px] font-bold text-[14px]"
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
          </form>
        )}
      </div>
    </div>
  );
}
