"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Edit2, Plus, Trash2 } from "lucide-react";
import { MerchantDashboardLayout } from "@/components/merchant/merchant-dashboard-layout";

import { apiFetch } from "@/lib/http";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";

type Promo = {
  id: number;
  title: string;
  subtitle: string | null;
  image_url: string;
  image_url_mobile: string | null;
  placement: "home_carousel" | "home_banner";
  target_type: string;
  target_id: number | null;
  target_url: string | null;
  cta_text: string | null;
  sort_order: number;
  is_active: boolean;
  start_at: string | null;
  end_at: string | null;
};

type PromoForm = {
  title: string;
  subtitle: string;
  image_url: string;
  image_url_mobile: string;
  placement: "home_carousel" | "home_banner";
  target_url: string;
  cta_text: string;
  sort_order: number;
  is_active: boolean;
  start_at: string;
  end_at: string;
};

const initialForm: PromoForm = {
  title: "",
  subtitle: "",
  image_url: "",
  image_url_mobile: "",
  placement: "home_carousel",
  target_url: "",
  cta_text: "",
  sort_order: 0,
  is_active: true,
  start_at: "",
  end_at: "",
};

function extractErrorMessage(payload: any) {
  if (typeof payload?.detail === "string" && payload.detail.trim()) {
    return payload.detail;
  }
  if (typeof payload?.message === "string" && payload.message.trim()) {
    return payload.message;
  }
  return "Something went wrong.";
}

function toDateTimeLocal(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export default function PromosPage() {
  const { user } = useAuth();
  const restaurantId = user?.activeRestaurantId;

  const [promos, setPromos] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPromoId, setEditingPromoId] = useState<number | null>(null);
  const [form, setForm] = useState<PromoForm>(initialForm);
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch(`/merchant/restaurants/${restaurantId}/promos`, { auth: true });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(extractErrorMessage(payload));
      }
      setPromos(payload?.data ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to load promos.");
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function openCreateModal() {
    setEditingPromoId(null);
    setForm(initialForm);
    setSuccess(null);
    setError(null);
    setIsModalOpen(true);
  }

  function openEditModal(promo: Promo) {
    setEditingPromoId(promo.id);
    setForm({
      title: promo.title,
      subtitle: promo.subtitle ?? "",
      image_url: promo.image_url,
      image_url_mobile: promo.image_url_mobile ?? "",
      placement: promo.placement,
      target_url: promo.target_url ?? "",
      cta_text: promo.cta_text ?? "",
      sort_order: promo.sort_order,
      is_active: promo.is_active,
      start_at: toDateTimeLocal(promo.start_at),
      end_at: toDateTimeLocal(promo.end_at),
    });
    setSuccess(null);
    setError(null);
    setIsModalOpen(true);
  }

  async function handleDelete(promoId: number) {
    if (!restaurantId || !confirm("Delete this promo?")) {
      return;
    }
    setError(null);
    setSuccess(null);
    try {
      const response = await apiFetch(`/merchant/restaurants/${restaurantId}/promos/${promoId}`, {
        method: "DELETE",
        auth: true,
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(extractErrorMessage(payload));
      }
      setPromos((current) => current.filter((promo) => promo.id !== promoId));
      setSuccess("Promo deleted.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to delete promo.");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!restaurantId) return;

    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const path = editingPromoId
        ? `/merchant/restaurants/${restaurantId}/promos/${editingPromoId}`
        : `/merchant/restaurants/${restaurantId}/promos`;
      const method = editingPromoId ? "PUT" : "POST";

      const response = await apiFetch(path, {
        method,
        auth: true,
        body: JSON.stringify({
          title: form.title.trim(),
          subtitle: form.subtitle.trim() || null,
          image_url: form.image_url.trim(),
          image_url_mobile: form.image_url_mobile.trim() || null,
          placement: form.placement,
          target_url: form.target_url.trim() || null,
          cta_text: form.cta_text.trim() || null,
          sort_order: Number(form.sort_order),
          is_active: form.is_active,
          start_at: form.start_at || null,
          end_at: form.end_at || null,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(extractErrorMessage(payload));
      }

      setIsModalOpen(false);
      setSuccess(editingPromoId ? "Promo updated." : "Promo created.");
      await loadData();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to save promo.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!restaurantId) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Please select a restaurant in merchant mode to manage promos.
      </div>
    );
  }

  return (
    <MerchantDashboardLayout>
      <div className="mb-6 flex items-center text-[13px] text-[#868e96] font-medium">
        <span className="text-[#e53e4f]">Management</span>
        <span className="mx-2">/</span>
        <span>Promos and merchandising</span>
      </div>

      <div className="bg-white rounded shadow-sm border border-[#e9ecef] overflow-hidden">
        <div className="border-b border-[#e9ecef] px-6 py-4 flex items-center justify-between text-[#495057]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#1f2937]">Promos and Merchandising</h2>
          <p className="mt-1 text-sm text-[#6b7280]">
            Manage restaurant-targeted banners and offers that can feed discovery surfaces.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Add Promo
        </button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-[#ffd8cc] bg-[#fff4ef] px-5 py-4 text-sm text-[#9a3412]">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="rounded-2xl border border-[#d4f3db] bg-[#f3fff6] px-5 py-4 text-sm text-[#166534]">
          {success}
        </div>
      ) : null}

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading promos...</div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {promos.map((promo) => (
            <Card key={promo.id} className="overflow-hidden border-[#efe4d8]">
              <div
                className="h-48 w-full bg-cover bg-center bg-[#fcfaf7]"
                style={{ backgroundImage: `url(${promo.image_url})` }}
              />
              <CardContent className="space-y-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-bold text-[#1f2937]">{promo.title}</h3>
                    {promo.subtitle ? (
                      <p className="text-sm text-[#6b7280]">{promo.subtitle}</p>
                    ) : null}
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEditModal(promo)}
                      className="rounded-lg border border-[#efe4d8] p-2 text-[#6b7280] transition hover:text-primary"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(promo.id)}
                      className="rounded-lg border border-[#efe4d8] p-2 text-[#6b7280] transition hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-[#fff4ec] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                    {promo.placement.replace("_", " ")}
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${
                      promo.is_active
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {promo.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="text-sm text-[#6b7280]">
                  {promo.cta_text ? <p>CTA: {promo.cta_text}</p> : null}
                  {promo.target_url ? <p className="break-all">Target URL: {promo.target_url}</p> : null}
                </div>
              </CardContent>
            </Card>
          ))}

          {promos.length === 0 ? (
            <p className="text-sm text-muted-foreground">No promos set for this restaurant yet.</p>
          ) : null}
        </div>
      )}

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-[#efe4d8] bg-[#fcfaf7] px-6 py-4">
              <h3 className="text-lg font-semibold text-[#1f2937]">
                {editingPromoId ? "Edit Promo" : "Create Promo"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-2xl leading-none text-[#6b7280] hover:text-[#1f2937]"
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5 p-6">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1.5 md:col-span-2">
                  <span className="text-sm font-medium text-[#1f2937]">Title</span>
                  <input
                    required
                    value={form.title}
                    onChange={(event) => setForm({ ...form, title: event.target.value })}
                    className="w-full rounded-xl border border-[#efe4d8] px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                  />
                </label>
                <label className="space-y-1.5 md:col-span-2">
                  <span className="text-sm font-medium text-[#1f2937]">Subtitle</span>
                  <input
                    value={form.subtitle}
                    onChange={(event) => setForm({ ...form, subtitle: event.target.value })}
                    className="w-full rounded-xl border border-[#efe4d8] px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-[#1f2937]">Image URL</span>
                  <input
                    required
                    value={form.image_url}
                    onChange={(event) => setForm({ ...form, image_url: event.target.value })}
                    className="w-full rounded-xl border border-[#efe4d8] px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-[#1f2937]">Mobile Image URL</span>
                  <input
                    value={form.image_url_mobile}
                    onChange={(event) => setForm({ ...form, image_url_mobile: event.target.value })}
                    className="w-full rounded-xl border border-[#efe4d8] px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-[#1f2937]">Placement</span>
                  <select
                    value={form.placement}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        placement: event.target.value as Promo["placement"],
                      })
                    }
                    className="w-full rounded-xl border border-[#efe4d8] px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                  >
                    <option value="home_carousel">Home Carousel</option>
                    <option value="home_banner">Home Banner</option>
                  </select>
                </label>
                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-[#1f2937]">Sort Order</span>
                  <input
                    type="number"
                    value={form.sort_order}
                    onChange={(event) => setForm({ ...form, sort_order: Number(event.target.value) })}
                    className="w-full rounded-xl border border-[#efe4d8] px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-[#1f2937]">CTA Text</span>
                  <input
                    value={form.cta_text}
                    onChange={(event) => setForm({ ...form, cta_text: event.target.value })}
                    className="w-full rounded-xl border border-[#efe4d8] px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-[#1f2937]">Target URL</span>
                  <input
                    value={form.target_url}
                    onChange={(event) => setForm({ ...form, target_url: event.target.value })}
                    className="w-full rounded-xl border border-[#efe4d8] px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-[#1f2937]">Start At</span>
                  <input
                    type="datetime-local"
                    value={form.start_at}
                    onChange={(event) => setForm({ ...form, start_at: event.target.value })}
                    className="w-full rounded-xl border border-[#efe4d8] px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-[#1f2937]">End At</span>
                  <input
                    type="datetime-local"
                    value={form.end_at}
                    onChange={(event) => setForm({ ...form, end_at: event.target.value })}
                    className="w-full rounded-xl border border-[#efe4d8] px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                  />
                </label>
              </div>

              <label className="flex items-center gap-3 rounded-2xl border border-[#efe4d8] bg-[#fcfaf7] px-4 py-4 text-sm text-[#1f2937]">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(event) => setForm({ ...form, is_active: event.target.checked })}
                />
                Promo is active
              </label>

              <div className="flex justify-end gap-3 border-t border-[#efe4d8] pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-[#6b7280] hover:text-[#1f2937]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-primary px-6 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
                >
                  {submitting ? "Saving..." : editingPromoId ? "Save Promo" : "Create Promo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
      </div>
    </MerchantDashboardLayout>
  );
}
