"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Clock3,
  MapPin,
  Phone,
  ReceiptText,
  UserRound,
} from "lucide-react";

import { SiteNavbar } from "@/components/layout/site-navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { apiFetch } from "@/lib/http";
import {
  canCancelReservation,
  extractApiErrorMessage,
  formatReservationDate,
  formatReservationStatus,
  formatReservationTime,
  getStatusTone,
  type ReservationResponse,
} from "@/lib/reservations";

export default function ReservationDetailPage() {
  const params = useParams<{ id: string }>();
  const reservationId = Number(params?.id);
  const router = useRouter();
  const { hydrated, accessToken } = useAuth();
  const hasLoadedRef = useRef(false);

  const [reservation, setReservation] = useState<ReservationResponse | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    if (!accessToken) {
      router.replace("/login");
      return;
    }
    if (!Number.isFinite(reservationId)) {
      setError("Invalid reservation id.");
      setLoading(false);
      return;
    }
    if (hasLoadedRef.current) {
      return;
    }
    hasLoadedRef.current = true;

    let cancelled = false;

    async function loadReservation() {
      setLoading(true);
      setError(null);
      try {
        const response = await apiFetch(`/reservations/${reservationId}`, { auth: true });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(extractApiErrorMessage(payload));
        }
        if (!cancelled) {
          setReservation(payload?.data ?? null);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Failed to load reservation.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadReservation();

    return () => {
      cancelled = true;
    };
  }, [accessToken, hydrated, reservationId, router]);

  async function handleCancel() {
    if (!reservation) {
      return;
    }

    setCancelling(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await apiFetch(`/reservations/${reservation.id}/cancel`, {
        method: "POST",
        auth: true,
        body: JSON.stringify({
          reason: cancelReason.trim() || null,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(extractApiErrorMessage(payload));
      }

      setReservation(payload?.data ?? null);
      setSuccess("Reservation cancelled.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to cancel reservation.");
    } finally {
      setCancelling(false);
    }
  }

  if (!hydrated) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Preparing reservation detail...</div>;
  }

  if (!accessToken) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#fcfcfd]">
      <SiteNavbar className="sticky top-0 z-40" />
      <main className="mx-auto w-full max-w-7xl space-y-8 px-6 py-10 lg:px-10">
        <Link
          href="/reservations"
          className="inline-flex items-center gap-2 text-sm font-medium text-[#6b7280] transition hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to my reservations
        </Link>

        {error ? (
          <div className="rounded-[18px] border border-[#ffd8cc] bg-[#fff4ef] px-5 py-4 text-sm text-[#9a3412]">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="rounded-[18px] border border-[#d4f3db] bg-[#f3fff6] px-5 py-4 text-sm text-[#166534]">
            {success}
          </div>
        ) : null}

        {loading ? (
          <Card className="border-[#efe4d8]">
            <CardContent className="text-sm text-[#6b7280]">Loading reservation...</CardContent>
          </Card>
        ) : reservation ? (
          <div className="grid gap-8 xl:grid-cols-[1.05fr_0.95fr]">
            <Card className="border-[#efe4d8] bg-white">
              <CardContent className="space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#efe4d8] pb-5">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">
                      {reservation.reservation_code}
                    </p>
                    <h1 className="mt-2 text-3xl font-semibold text-[#1f2937]">
                      {reservation.restaurant_name}
                    </h1>
                    <p className="mt-2 text-sm text-[#6b7280]">
                      This booking is tied to your YummyDoors account and mirrors the same status stream merchants see.
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${getStatusTone(
                      reservation.status,
                    )}`}
                  >
                    {formatReservationStatus(reservation.status)}
                  </span>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {[
                    { label: "Date", value: formatReservationDate(reservation.reservation_date), Icon: CalendarDays },
                    { label: "Time", value: formatReservationTime(reservation.reservation_time), Icon: Clock3 },
                    {
                      label: "Guests",
                      value: `${reservation.guest_count} guest${reservation.guest_count === 1 ? "" : "s"}`,
                      Icon: UserRound,
                    },
                    { label: "Table", value: reservation.selected_table_label ?? "Not assigned", Icon: MapPin },
                    { label: "Contact", value: reservation.contact_name, Icon: ReceiptText },
                    { label: "Phone", value: reservation.contact_phone, Icon: Phone },
                  ].map(({ label, value, Icon }) => {
                    return (
                      <div
                        key={label}
                        className="rounded-2xl border border-[#efe4d8] bg-[#fcfaf7] px-4 py-4"
                      >
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#8a8f98]">
                          {label}
                        </p>
                        <p className="mt-2 flex items-center gap-2 text-sm font-medium text-[#1f2937]">
                          <Icon className="h-4 w-4 text-primary" />
                          {value}
                        </p>
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-3 rounded-2xl border border-[#efe4d8] bg-[#fcfaf7] px-5 py-5">
                  <p className="text-sm font-semibold text-[#1f2937]">Booking notes</p>
                  <p className="text-sm leading-7 text-[#6b7280]">
                    Occasion: {reservation.occasion ?? "Standard booking"}
                  </p>
                  <p className="text-sm leading-7 text-[#6b7280]">
                    Special request: {reservation.special_request ?? "No special request left."}
                  </p>
                  <p className="text-sm leading-7 text-[#6b7280]">
                    Cancellation note: {reservation.cancellation_reason ?? "No cancellation recorded."}
                  </p>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-semibold text-[#1f2937]">Status timeline</p>
                  <div className="space-y-3">
                    {reservation.status_events.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-[#efe4d8] px-4 py-4 text-sm text-[#8a8f98]">
                        No events recorded yet.
                      </div>
                    ) : (
                      reservation.status_events.map((event, index) => (
                        <div
                          key={`${event.created_at}-${index}`}
                          className="rounded-2xl border border-[#efe4d8] bg-white px-4 py-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-[#1f2937]">
                              {formatReservationStatus(event.status)}
                            </p>
                            <p className="text-xs text-[#8a8f98]">
                              {new Date(event.created_at).toLocaleString()}
                            </p>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-[#6b7280]">
                            {event.note ?? "No note attached for this transition."}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className="border-[#efe4d8] bg-white">
                <CardContent className="space-y-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">
                    Restaurant shortcut
                  </p>
                  <h2 className="text-2xl font-semibold text-[#1f2937]">{reservation.restaurant_name}</h2>
                  <p className="text-sm leading-7 text-[#6b7280]">
                    Return to the restaurant page if you want to browse dishes or make another booking later.
                  </p>
                  <Link href={`/restaurants/${reservation.restaurant_slug}`}>
                    <Button>Open restaurant</Button>
                  </Link>
                </CardContent>
              </Card>

              <Card className="border-[#efe4d8] bg-white">
                <CardContent className="space-y-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">
                    Need to cancel?
                  </p>
                  <p className="text-sm leading-7 text-[#6b7280]">
                    Pending and active reservations can be cancelled here. Finalized bookings stay visible for history, but cannot be changed.
                  </p>
                  <textarea
                    value={cancelReason}
                    onChange={(event) => setCancelReason(event.target.value)}
                    rows={4}
                    className="w-full rounded-2xl border border-[#efe4d8] bg-white px-4 py-3 text-sm text-[#1f2937] outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
                    placeholder="Optional reason for cancellation"
                    disabled={!canCancelReservation(reservation.status)}
                  />
                  <Button
                    variant="secondary"
                    disabled={!canCancelReservation(reservation.status) || cancelling}
                    onClick={() => void handleCancel()}
                  >
                    {cancelling ? "Cancelling..." : "Cancel reservation"}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
