"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Clock3, MapPin, ReceiptText, UsersRound } from "lucide-react";

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

export default function ReservationsPage() {
  const router = useRouter();
  const { hydrated, accessToken } = useAuth();
  const hasLoadedRef = useRef(false);

  const [reservations, setReservations] = useState<ReservationResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    if (!accessToken) {
      router.replace("/login");
      return;
    }
    if (hasLoadedRef.current) {
      return;
    }
    hasLoadedRef.current = true;

    let cancelled = false;

    async function loadReservations() {
      setLoading(true);
      setError(null);
      try {
        const response = await apiFetch("/reservations", { auth: true });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(extractApiErrorMessage(payload));
        }
        if (!cancelled) {
          setReservations(Array.isArray(payload?.data) ? payload.data : []);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Failed to load reservations.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadReservations();

    return () => {
      cancelled = true;
    };
  }, [accessToken, hydrated, router]);

  const summary = useMemo(() => {
    return reservations.reduce(
      (acc, reservation) => {
        acc.total += 1;
        if (canCancelReservation(reservation.status)) acc.active += 1;
        if (reservation.status === "completed") acc.completed += 1;
        if (reservation.status === "cancelled" || reservation.status === "no_show") acc.closed += 1;
        return acc;
      },
      { total: 0, active: 0, completed: 0, closed: 0 },
    );
  }, [reservations]);

  if (!hydrated) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Preparing reservations...</div>;
  }

  if (!accessToken) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#fcfcfd]">
      <SiteNavbar className="sticky top-0 z-40" />
      <main className="mx-auto w-full max-w-7xl space-y-8 px-6 py-10 lg:px-10">
        <section className="flex flex-col gap-5 rounded-[28px] border border-[#efe4d8] bg-white px-7 py-8 shadow-[0_24px_70px_rgba(15,23,42,0.06)] lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-primary">My Reservations</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#1f2937]">
              Follow every booking in one place.
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[#6b7280]">
              This is the customer-side reservation inbox for YummyDoors desktop. Booking status, table assignment, and the restaurant timeline all land here.
            </p>
          </div>
          <Link href="/restaurants">
            <Button>Book another restaurant</Button>
          </Link>
        </section>

        {error ? (
          <div className="rounded-[18px] border border-[#ffd8cc] bg-[#fff4ef] px-5 py-4 text-sm text-[#9a3412]">
            {error}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "All", value: summary.total, icon: ReceiptText },
            { label: "Active", value: summary.active, icon: CalendarDays },
            { label: "Completed", value: summary.completed, icon: Clock3 },
            { label: "Closed", value: summary.closed, icon: UsersRound },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.label} className="border-[#efe4d8] bg-white">
                <CardContent className="flex items-center gap-4 p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff4ec]">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-[#6b7280]">{item.label}</p>
                    <p className="mt-1 text-2xl font-semibold text-[#1f2937]">{item.value}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </section>

        {loading ? (
          <Card className="border-[#efe4d8]">
            <CardContent className="text-sm text-[#6b7280]">Loading your reservations...</CardContent>
          </Card>
        ) : reservations.length === 0 ? (
          <Card className="border-[#efe4d8] bg-white">
            <CardContent className="space-y-3">
              <h2 className="text-xl font-semibold text-[#1f2937]">No reservations yet</h2>
              <p className="text-sm leading-7 text-[#6b7280]">
                As soon as you reserve a table from a restaurant page, the booking will appear here.
              </p>
              <Link href="/restaurants">
                <Button>Browse restaurants</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-5">
            {reservations.map((reservation) => (
              <Link
                key={reservation.id}
                href={`/reservations/${reservation.id}`}
                className="block rounded-[28px] border border-[#efe4d8] bg-white p-6 shadow-[0_16px_50px_rgba(15,23,42,0.05)] transition hover:border-[#ffd0be] hover:shadow-[0_18px_55px_rgba(249,115,22,0.10)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">
                      {reservation.reservation_code}
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold text-[#1f2937]">
                      {reservation.restaurant_name}
                    </h2>
                    <p className="mt-2 text-sm text-[#6b7280]">
                      Reserved for {reservation.contact_name}
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

                <div className="mt-5 grid gap-3 text-sm text-[#6b7280] md:grid-cols-2 xl:grid-cols-4">
                  <p className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-primary" />
                    {formatReservationDate(reservation.reservation_date)}
                  </p>
                  <p className="flex items-center gap-2">
                    <Clock3 className="h-4 w-4 text-primary" />
                    {formatReservationTime(reservation.reservation_time)}
                  </p>
                  <p className="flex items-center gap-2">
                    <UsersRound className="h-4 w-4 text-primary" />
                    {reservation.guest_count} guest{reservation.guest_count === 1 ? "" : "s"}
                  </p>
                  <p className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    {reservation.selected_table_label ?? "Table not assigned yet"}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
