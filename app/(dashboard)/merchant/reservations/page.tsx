"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Store,
  UsersRound,
} from "lucide-react";

import { MerchantDashboardLayout } from "@/components/merchant/merchant-dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { apiFetch } from "@/lib/http";
import {
  extractApiErrorMessage,
  formatReservationDate,
  formatReservationStatus,
  getStatusTone,
  RESERVATION_STATUS_OPTIONS,
  type ReservationResponse,
  type ReservationStatus,
  type RestaurantTableSummary,
} from "@/lib/reservations";

const MUTABLE_STATUSES: ReservationStatus[] = ["pending", "confirmed", "seated"];

const ACTIONS: Array<{
  status: ReservationStatus;
  label: string;
  variant: "primary" | "secondary";
}> = [
  { status: "confirmed", label: "Confirm", variant: "secondary" },
  { status: "seated", label: "Seat Guest", variant: "secondary" },
  { status: "completed", label: "Complete", variant: "primary" },
  { status: "no_show", label: "No Show", variant: "secondary" },
  { status: "cancelled", label: "Cancel", variant: "secondary" },
];

export default function MerchantReservationsPage() {
  const { hydrated, accessToken, user } = useAuth();
  const restaurantId = user?.activeRestaurantId;

  const [reservations, setReservations] = useState<ReservationResponse[]>([]);
  const [tables, setTables] = useState<RestaurantTableSummary[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [draftNote, setDraftNote] = useState("");
  const [draftTableId, setDraftTableId] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<ReservationStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedReservation =
    reservations.find((reservation) => reservation.id === selectedId) ?? reservations[0] ?? null;

  const eligibleTables = useMemo(() => {
    if (!selectedReservation) {
      return tables;
    }
    return tables.filter(
      (table) =>
        table.min_guest_count <= selectedReservation.guest_count &&
        selectedReservation.guest_count <= table.max_guest_count,
    );
  }, [selectedReservation, tables]);

  const summary = useMemo(() => {
    const counts = {
      total: reservations.length,
      pending: 0,
      confirmed: 0,
      seated: 0,
      completed: 0,
    };

    reservations.forEach((reservation) => {
      if (reservation.status === "pending") counts.pending += 1;
      if (reservation.status === "confirmed") counts.confirmed += 1;
      if (reservation.status === "seated") counts.seated += 1;
      if (reservation.status === "completed") counts.completed += 1;
    });

    return counts;
  }, [reservations]);

  const loadReservations = useCallback(
    async (showLoading = true) => {
      if (!restaurantId) {
        setReservations([]);
        setTables([]);
        setLoading(false);
        return;
      }

      if (showLoading) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      setError(null);
      try {
        const params = new URLSearchParams();
        if (dateFilter) {
          params.set("reservation_date", dateFilter);
        }
        if (statusFilter) {
          params.set("status", statusFilter);
        }

        const [reservationsResponse, tablesResponse] = await Promise.all([
          apiFetch(
            `/merchant/restaurants/${restaurantId}/reservations${
              params.size ? `?${params.toString()}` : ""
            }`,
            { auth: true },
          ),
          apiFetch(`/merchant/restaurants/${restaurantId}/reservation-tables`, { auth: true }),
        ]);

        const [reservationsPayload, tablesPayload] = await Promise.all([
          reservationsResponse.json().catch(() => null),
          tablesResponse.json().catch(() => null),
        ]);

        if (!reservationsResponse.ok) {
          throw new Error(extractApiErrorMessage(reservationsPayload));
        }
        if (!tablesResponse.ok) {
          throw new Error(extractApiErrorMessage(tablesPayload));
        }

        const nextReservations: ReservationResponse[] = Array.isArray(reservationsPayload?.data)
          ? reservationsPayload.data
          : [];
        const nextTables: RestaurantTableSummary[] = Array.isArray(tablesPayload?.data)
          ? tablesPayload.data
          : [];

        setReservations(nextReservations);
        setTables(nextTables);
        setSelectedId((current) =>
          current && nextReservations.some((reservation) => reservation.id === current)
            ? current
            : nextReservations[0]?.id ?? null,
        );
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Failed to load reservations.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [dateFilter, restaurantId, statusFilter],
  );

  useEffect(() => {
    if (!hydrated || !accessToken) {
      return;
    }
    void loadReservations(true);
  }, [accessToken, hydrated, loadReservations]);

  useEffect(() => {
    if (!selectedReservation) {
      setDraftNote("");
      setDraftTableId("");
      return;
    }
    setDraftNote("");
    setDraftTableId(selectedReservation.selected_table?.id ? String(selectedReservation.selected_table.id) : "");
  }, [selectedReservation]);

  async function handleStatusUpdate(status: ReservationStatus) {
    if (!restaurantId || !selectedReservation) {
      return;
    }

    setUpdatingStatus(status);
    setError(null);
    setSuccess(null);
    try {
      const response = await apiFetch(
        `/merchant/restaurants/${restaurantId}/reservations/${selectedReservation.id}/status`,
        {
          method: "POST",
          auth: true,
          body: JSON.stringify({
            status,
            note: draftNote.trim() || null,
            table_id: draftTableId ? Number(draftTableId) : null,
          }),
        },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(extractApiErrorMessage(payload));
      }
      setSuccess(`Reservation moved to ${formatReservationStatus(status)}.`);
      await loadReservations(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to update reservation.");
    } finally {
      setUpdatingStatus(null);
    }
  }

  if (!hydrated) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Preparing reservation surface...</div>;
  }

  if (!accessToken) {
    return null;
  }

  return (
    <MerchantDashboardLayout>
      <div className="mb-6 flex items-center text-[13px] text-[#868e96] font-medium">
        <span className="text-[#e53e4f]">Management</span>
        <span className="mx-2">/</span>
        <span>Reservation queue</span>
      </div>

      <div className="bg-white rounded shadow-sm border border-[#e9ecef] overflow-hidden">
        <div className="border-b border-[#e9ecef] px-6 py-4 flex items-center justify-between text-[#495057]">
          <h2 className="text-[16px] font-semibold">Reservation Queue</h2>
          <div className="flex gap-2">
            <Link href="/merchant/tables">
              <button className="inline-flex items-center justify-center gap-2 rounded bg-[#e9ecef] px-4 py-2 text-[14px] font-semibold text-[#495057] transition-colors hover:bg-[#dee2e6]">
                Manage Tables
              </button>
            </Link>
          </div>
        </div>

        <div className="p-6">

        {!restaurantId ? (
          <Card className="border-[#efe4d8]">
            <CardContent className="space-y-3">
              <h2 className="text-xl font-semibold text-[#1f2937]">No restaurant context selected</h2>
              <p className="text-sm leading-7 text-[#6b7280]">
                Switch into a merchant restaurant first, then the reservation queue will hydrate against that restaurant.
              </p>
              <Link href="/merchant">
                <Button>Open Merchant Dashboard</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <>
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

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {[
                { label: "All reservations", value: summary.total, icon: ClipboardList },
                { label: "Pending", value: summary.pending, icon: Clock3 },
                { label: "Confirmed", value: summary.confirmed, icon: CalendarDays },
                { label: "Seated", value: summary.seated, icon: UsersRound },
                { label: "Completed", value: summary.completed, icon: CheckCircle2 },
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

            <Card className="border-[#efe4d8] bg-white">
              <CardContent className="grid gap-4 p-6 lg:grid-cols-[1fr_220px_180px_auto] lg:items-end">
                <div>
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.22em] text-primary">Reservation filters</p>
                  <p className="text-sm text-[#6b7280]">Use the same date and status slices the ops team will need later in admin.</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#1f2937]">Date</label>
                  <Input type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#1f2937]">Status</label>
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                    className="flex h-12 w-full rounded-xl border border-input bg-white px-4 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
                  >
                    <option value="">All statuses</option>
                    {RESERVATION_STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-3">
                  <Button onClick={() => void loadReservations(true)} disabled={refreshing}>
                    {refreshing ? "Refreshing..." : "Apply"}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setDateFilter("");
                      setStatusFilter("");
                    }}
                  >
                    Reset
                  </Button>
                </div>
              </CardContent>
            </Card>

            <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
              <div className="space-y-4">
                {loading ? (
                  <Card className="border-[#efe4d8]">
                    <CardContent className="text-sm text-[#6b7280]">Loading reservation queue...</CardContent>
                  </Card>
                ) : reservations.length === 0 ? (
                  <Card className="border-[#efe4d8]">
                    <CardContent className="space-y-3 text-sm text-[#6b7280]">
                      <h2 className="text-lg font-semibold text-[#1f2937]">No reservations in this slice</h2>
                      <p>New customer table bookings will land here as soon as they are created from the restaurant detail flow.</p>
                    </CardContent>
                  </Card>
                ) : (
                  reservations.map((reservation) => (
                    <button
                      key={reservation.id}
                      type="button"
                      onClick={() => setSelectedId(reservation.id)}
                      className={`w-full rounded-[24px] border p-5 text-left transition ${
                        selectedReservation?.id === reservation.id
                          ? "border-primary bg-[#fff7f2] shadow-[0_18px_40px_rgba(249,115,22,0.12)]"
                          : "border-[#efe4d8] bg-white hover:border-[#ffd5bf]"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-[#1f2937]">{reservation.contact_name}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[#8a8f98]">
                            {reservation.reservation_code}
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
                      <div className="mt-4 grid gap-3 text-sm text-[#6b7280] sm:grid-cols-2">
                        <p>
                          <span className="font-medium text-[#1f2937]">When:</span>{" "}
                          {formatReservationDate(reservation.reservation_date)} at {reservation.reservation_time}
                        </p>
                        <p>
                          <span className="font-medium text-[#1f2937]">Guests:</span> {reservation.guest_count}
                        </p>
                        <p>
                          <span className="font-medium text-[#1f2937]">Table:</span>{" "}
                          {reservation.selected_table_label ?? "Not assigned yet"}
                        </p>
                        <p>
                          <span className="font-medium text-[#1f2937]">Occasion:</span>{" "}
                          {reservation.occasion ?? "Standard booking"}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>

              <Card className="border-[#efe4d8] bg-white">
                <CardContent className="space-y-6">
                  {selectedReservation ? (
                    <>
                      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#efe4d8] pb-5">
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">Reservation detail</p>
                          <h2 className="mt-2 text-2xl font-semibold text-[#1f2937]">{selectedReservation.contact_name}</h2>
                          <p className="mt-2 text-sm text-[#6b7280]">
                            {formatReservationDate(selectedReservation.reservation_date)} at{" "}
                            {selectedReservation.reservation_time}
                          </p>
                        </div>
                        <span
                          className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${getStatusTone(
                            selectedReservation.status,
                          )}`}
                        >
                          {formatReservationStatus(selectedReservation.status)}
                        </span>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        {[
                          ["Reservation code", selectedReservation.reservation_code],
                          ["Guests", String(selectedReservation.guest_count)],
                          ["Phone", selectedReservation.contact_phone],
                          ["Email", selectedReservation.contact_email ?? "Not provided"],
                          ["Table", selectedReservation.selected_table_label ?? "Not assigned"],
                          ["Zone", selectedReservation.selected_table_zone ?? "Not assigned"],
                        ].map(([label, value]) => (
                          <div key={label} className="rounded-2xl border border-[#efe4d8] bg-[#fcfaf7] px-4 py-4">
                            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#8a8f98]">{label}</p>
                            <p className="mt-2 text-sm font-medium text-[#1f2937]">{value}</p>
                          </div>
                        ))}
                      </div>

                      <div className="grid gap-5 lg:grid-cols-[1fr_220px]">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-[#1f2937]">Operational note</label>
                          <textarea
                            value={draftNote}
                            onChange={(event) => setDraftNote(event.target.value)}
                            rows={4}
                            className="w-full rounded-2xl border border-[#efe4d8] bg-white px-4 py-3 text-sm text-[#1f2937] outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
                            placeholder="Add a note for confirmation, seating, completion, or cancellation."
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-[#1f2937]">Assign table</label>
                          <select
                            value={draftTableId}
                            onChange={(event) => setDraftTableId(event.target.value)}
                            className="flex h-12 w-full rounded-xl border border-input bg-white px-4 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
                          >
                            <option value="">No assignment</option>
                            {eligibleTables.map((table) => (
                              <option key={table.id} value={table.id}>
                                {table.label} {table.zone ? `• ${table.zone}` : ""} • {table.min_guest_count}-{table.max_guest_count}
                              </option>
                            ))}
                          </select>
                          <p className="text-xs leading-6 text-[#8a8f98]">
                            Only tables matching the reservation guest count are shown.
                          </p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <p className="text-sm font-medium text-[#1f2937]">Status actions</p>
                        <div className="flex flex-wrap gap-3">
                          {ACTIONS.filter((action) =>
                            MUTABLE_STATUSES.includes(selectedReservation.status) ||
                            action.status === selectedReservation.status,
                          ).map((action) => (
                            <Button
                              key={action.status}
                              variant={action.variant}
                              disabled={
                                updatingStatus !== null ||
                                selectedReservation.status === action.status ||
                                !MUTABLE_STATUSES.includes(selectedReservation.status)
                              }
                              onClick={() => void handleStatusUpdate(action.status)}
                            >
                              {updatingStatus === action.status ? "Updating..." : action.label}
                            </Button>
                          ))}
                        </div>
                        {!MUTABLE_STATUSES.includes(selectedReservation.status) ? (
                          <p className="text-xs leading-6 text-[#8a8f98]">
                            Finalized reservations can still be reviewed here, but not moved to another state.
                          </p>
                        ) : null}
                      </div>

                      <div className="space-y-4">
                        <div>
                          <p className="text-sm font-medium text-[#1f2937]">Timeline</p>
                          <p className="mt-1 text-xs text-[#8a8f98]">This mirrors the reservation event stream that mobile will consume later.</p>
                        </div>
                        <div className="space-y-3">
                          {selectedReservation.status_events.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-[#efe4d8] px-4 py-4 text-sm text-[#8a8f98]">
                              No status events recorded yet.
                            </div>
                          ) : (
                            selectedReservation.status_events.map((event, index) => (
                              <div key={`${event.created_at}-${index}`} className="rounded-2xl border border-[#efe4d8] bg-[#fcfaf7] px-4 py-4">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  <p className="text-sm font-semibold text-[#1f2937]">{formatReservationStatus(event.status)}</p>
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
                    </>
                  ) : (
                    <div className="space-y-3 text-sm text-[#6b7280]">
                      <Store className="h-10 w-10 text-primary/40" />
                      <h2 className="text-xl font-semibold text-[#1f2937]">Choose a reservation</h2>
                      <p>Select a booking from the queue to assign tables and progress its status.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>
          </>
        )}
        </div>
      </div>
    </MerchantDashboardLayout>
  );
}
