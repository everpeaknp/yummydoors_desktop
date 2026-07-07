"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Edit2, Plus, Table2, Trash2 } from "lucide-react";

import { SiteNavbar } from "@/components/layout/site-navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { apiFetch } from "@/lib/http";
import {
  DEFAULT_TABLE_FORM,
  extractApiErrorMessage,
  type RestaurantTableForm,
  type RestaurantTableSummary,
} from "@/lib/reservations";

export default function MerchantTablesPage() {
  const { hydrated, accessToken, user } = useAuth();
  const restaurantId = user?.activeRestaurantId;

  const [tables, setTables] = useState<RestaurantTableSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingTableId, setEditingTableId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<RestaurantTableForm>(DEFAULT_TABLE_FORM);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const summary = useMemo(
    () => ({
      total: tables.length,
      active: tables.filter((table) => table.status === "active").length,
      zones: new Set(tables.map((table) => table.zone || "Indoor")).size,
    }),
    [tables],
  );

  const loadTables = useCallback(async () => {
    if (!restaurantId) {
      setTables([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch(`/merchant/restaurants/${restaurantId}/reservation-tables`, { auth: true });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(extractApiErrorMessage(payload));
      }
      setTables(Array.isArray(payload?.data) ? payload.data : []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to load reservation tables.");
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    if (!hydrated || !accessToken) {
      return;
    }
    void loadTables();
  }, [accessToken, hydrated, loadTables]);

  function openCreateModal() {
    setEditingTableId(null);
    setForm(DEFAULT_TABLE_FORM);
    setIsModalOpen(true);
  }

  function openEditModal(table: RestaurantTableSummary) {
    setEditingTableId(table.id);
    setForm({
      code: table.code,
      label: table.label,
      zone: table.zone ?? "",
      min_guest_count: table.min_guest_count,
      max_guest_count: table.max_guest_count,
      status: table.status,
      sort_order: table.sort_order,
    });
    setIsModalOpen(true);
  }

  async function handleDelete(tableId: number) {
    if (!restaurantId || !window.confirm("Delete this table from the booking inventory?")) {
      return;
    }

    setError(null);
    setSuccess(null);
    try {
      const response = await apiFetch(
        `/merchant/restaurants/${restaurantId}/reservation-tables/${tableId}`,
        {
          method: "DELETE",
          auth: true,
        },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(extractApiErrorMessage(payload));
      }
      setTables((current) => current.filter((table) => table.id !== tableId));
      setSuccess("Table deleted from reservation inventory.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to delete table.");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!restaurantId) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const path = editingTableId
        ? `/merchant/restaurants/${restaurantId}/reservation-tables/${editingTableId}`
        : `/merchant/restaurants/${restaurantId}/reservation-tables`;
      const method = editingTableId ? "PUT" : "POST";

      const response = await apiFetch(path, {
        method,
        auth: true,
        body: JSON.stringify({
          code: form.code.trim(),
          label: form.label.trim(),
          zone: form.zone.trim() || null,
          min_guest_count: Number(form.min_guest_count),
          max_guest_count: Number(form.max_guest_count),
          status: form.status,
          sort_order: Number(form.sort_order),
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(extractApiErrorMessage(payload));
      }

      setIsModalOpen(false);
      setForm(DEFAULT_TABLE_FORM);
      setEditingTableId(null);
      setSuccess(editingTableId ? "Table updated." : "Table created.");
      await loadTables();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to save table.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!hydrated) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Preparing table inventory...</div>;
  }

  if (!accessToken) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#faf7f2] pb-16">
      <SiteNavbar className="sticky top-0 z-50 bg-white/85 backdrop-blur-xl" />
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-12 lg:px-10">
        <section className="flex flex-col gap-5 rounded-[28px] border border-[#efe4d8] bg-white px-7 py-8 shadow-[0_24px_70px_rgba(15,23,42,0.06)] lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-primary">Merchant Table Inventory</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#1f2937]">Define exactly which tables the booking flow can assign.</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[#6b7280]">
              This inventory is what the mobile select-table screen and merchant reservation queue should stay in sync with.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/merchant/reservations">
              <Button variant="secondary">Open Reservations</Button>
            </Link>
            <Button onClick={openCreateModal}>
              <Plus className="mr-2 h-4 w-4" />
              Add Table
            </Button>
          </div>
        </section>

        {!restaurantId ? (
          <Card className="border-[#efe4d8]">
            <CardContent className="space-y-3">
              <h2 className="text-xl font-semibold text-[#1f2937]">No restaurant context selected</h2>
              <p className="text-sm leading-7 text-[#6b7280]">
                Select a merchant restaurant first so the reservation table inventory can attach to the right branch.
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

            <section className="grid gap-4 md:grid-cols-3">
              {[
                { label: "Tracked tables", value: summary.total },
                { label: "Named zones", value: summary.zones },
                { label: "Booking categories", value: new Set(tables.map((table) => table.category)).size },
              ].map((item) => (
                <Card key={item.label} className="border-[#efe4d8] bg-white">
                  <CardContent className="flex items-center gap-4 p-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff4ec]">
                      <Table2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-[#6b7280]">{item.label}</p>
                      <p className="mt-1 text-2xl font-semibold text-[#1f2937]">{item.value}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </section>

            {loading ? (
              <Card className="border-[#efe4d8]">
                <CardContent className="text-sm text-[#6b7280]">Loading reservation tables...</CardContent>
              </Card>
            ) : (
              <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {tables.map((table) => (
                  <Card key={table.id} className="border-[#efe4d8] bg-white">
                    <CardContent className="space-y-4 p-6">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">{table.code}</p>
                          <h2 className="mt-2 text-xl font-semibold text-[#1f2937]">{table.label}</h2>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => openEditModal(table)}
                            className="rounded-xl border border-[#efe4d8] p-2 text-[#6b7280] transition hover:border-[#ffd5bf] hover:text-primary"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(table.id)}
                            className="rounded-xl border border-[#efe4d8] p-2 text-[#6b7280] transition hover:border-[#ffd5bf] hover:text-[#dc2626]"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <div className="grid gap-3 text-sm text-[#6b7280]">
                        <p>
                          <span className="font-medium text-[#1f2937]">Zone:</span> {table.zone ?? "Indoor"}
                        </p>
                        <p>
                          <span className="font-medium text-[#1f2937]">Guests:</span> {table.min_guest_count} to {table.max_guest_count}
                        </p>
                        <p>
                          <span className="font-medium text-[#1f2937]">Booking category:</span> {table.category}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {tables.length === 0 ? (
                  <Card className="border-dashed border-[#efe4d8] md:col-span-2 xl:col-span-3">
                    <CardContent className="space-y-3 text-sm text-[#6b7280]">
                      <h2 className="text-lg font-semibold text-[#1f2937]">No tables created yet</h2>
                      <p>Start by creating the first table so booking availability can stop behaving like a mock flow.</p>
                    </CardContent>
                  </Card>
                ) : null}
              </section>
            )}
          </>
        )}
      </main>

      {isModalOpen ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 px-4 py-8 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-[28px] border border-[#efe4d8] bg-white shadow-[0_28px_90px_rgba(15,23,42,0.16)]">
            <div className="border-b border-[#efe4d8] px-7 py-6">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
                {editingTableId ? "Update table" : "Create table"}
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-[#1f2937]">
                {editingTableId ? "Refine this booking table" : "Add a new booking table"}
              </h2>
            </div>

            <form className="space-y-5 px-7 py-7" onSubmit={handleSubmit}>
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#1f2937]">Code</label>
                  <Input value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} placeholder="T-01" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#1f2937]">Label</label>
                  <Input value={form.label} onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))} placeholder="Window Table 1" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#1f2937]">Zone</label>
                  <Input value={form.zone} onChange={(event) => setForm((current) => ({ ...current, zone: event.target.value }))} placeholder="Indoor" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#1f2937]">Status</label>
                  <select
                    value={form.status}
                    onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
                    className="flex h-12 w-full rounded-xl border border-input bg-white px-4 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#1f2937]">Min guests</label>
                  <Input
                    type="number"
                    min={1}
                    value={form.min_guest_count}
                    onChange={(event) => setForm((current) => ({ ...current, min_guest_count: Number(event.target.value) }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#1f2937]">Max guests</label>
                  <Input
                    type="number"
                    min={1}
                    value={form.max_guest_count}
                    onChange={(event) => setForm((current) => ({ ...current, max_guest_count: Number(event.target.value) }))}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium text-[#1f2937]">Sort order</label>
                  <Input
                    type="number"
                    min={0}
                    value={form.sort_order}
                    onChange={(event) => setForm((current) => ({ ...current, sort_order: Number(event.target.value) }))}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-[#efe4d8] pt-5">
                <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Saving..." : editingTableId ? "Save changes" : "Create table"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
