"use client";

import { useCallback, useEffect, useState } from "react";
import { Percent } from "lucide-react";
import { MerchantDashboardLayout } from "@/components/merchant/merchant-dashboard-layout";
import { apiFetch } from "@/lib/http";

type DiscountType = "percentage" | "fixed" | "free_delivery";

type Promotion = {
  id: number;
  code: string;
  discountType: DiscountType;
  discountValue: number;
  maxDiscountAmount: number | null;
  minOrderAmount: number;
  isActive: boolean;
  expiresAt: string | null;
  usageLimit: number | null;
  perUserLimit: number | null;
  timesUsed: number;
  description: string | null;
};

function formatDate(value: string | null) {
  if (!value) return "No expiry";
  return new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function formatDiscount(promo: Promotion) {
  if (promo.discountType === "free_delivery") return "Free delivery";
  if (promo.discountType === "percentage") {
    return `${promo.discountValue}% off${promo.maxDiscountAmount ? ` (up to Rs. ${promo.maxDiscountAmount})` : ""}`;
  }
  return `Rs. ${promo.discountValue} off`;
}

async function extractApiErrorMessage(response: Response, fallback: string) {
  const payload = await response.json().catch(() => null);
  return payload?.detail || fallback;
}

const emptyForm = {
  code: "",
  discountType: "percentage" as DiscountType,
  discountValue: "",
  maxDiscountAmount: "",
  minOrderAmount: "",
  usageLimit: "",
  perUserLimit: "",
  expiresAt: "",
  description: "",
};

export default function MerchantCouponsPage() {
  const [items, setItems] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [actioningId, setActioningId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/merchant/promotions", { auth: true });
      if (!res.ok) throw new Error(await extractApiErrorMessage(res, "Failed to load coupons."));
      const data: Promotion[] = await res.json();
      setItems(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load coupons.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate() {
    if (!form.code.trim() || !form.discountValue.trim()) {
      setError("Code and discount value are required.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await apiFetch("/merchant/promotions", {
        method: "POST",
        auth: true,
        body: JSON.stringify({
          code: form.code.trim(),
          discountType: form.discountType,
          discountValue: Number(form.discountValue),
          maxDiscountAmount: form.maxDiscountAmount.trim() ? Number(form.maxDiscountAmount) : null,
          minOrderAmount: form.minOrderAmount.trim() ? Number(form.minOrderAmount) : 0,
          usageLimit: form.usageLimit.trim() ? Number(form.usageLimit) : null,
          perUserLimit: form.perUserLimit.trim() ? Number(form.perUserLimit) : null,
          expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
          description: form.description.trim() || null,
        }),
      });
      if (!res.ok) throw new Error(await extractApiErrorMessage(res, "Failed to create coupon."));
      const created: Promotion = await res.json();
      setItems((prev) => [created, ...prev]);
      setForm(emptyForm);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create coupon.");
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleActive(promo: Promotion) {
    setActioningId(promo.id);
    setError(null);
    try {
      const res = await apiFetch(`/merchant/promotions/${promo.id}`, {
        method: "PATCH",
        auth: true,
        body: JSON.stringify({ isActive: !promo.isActive }),
      });
      if (!res.ok) throw new Error(await extractApiErrorMessage(res, "Failed to update coupon."));
      const updated: Promotion = await res.json();
      setItems((prev) => prev.map((p) => (p.id === promo.id ? updated : p)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update coupon.");
    } finally {
      setActioningId(null);
    }
  }

  async function handleDelete(promo: Promotion) {
    if (!window.confirm(`Permanently delete coupon ${promo.code}?`)) return;
    setActioningId(promo.id);
    setError(null);
    try {
      const res = await apiFetch(`/merchant/promotions/${promo.id}`, { method: "DELETE", auth: true });
      if (!res.ok) throw new Error(await extractApiErrorMessage(res, "Failed to delete coupon."));
      setItems((prev) => prev.filter((p) => p.id !== promo.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete coupon.");
    } finally {
      setActioningId(null);
    }
  }

  return (
    <MerchantDashboardLayout>
      <div className="mx-auto max-w-[900px] px-6 py-8">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#fff1f2] text-[#e8505b]">
            <Percent className="h-4 w-4" />
          </span>
          <div>
            <h1 className="text-xl font-bold text-[#111827]">Your coupons</h1>
            <p className="text-sm text-muted-foreground">
              Self-funded discount codes for your restaurant only — the discount comes out of your margin, not the
              platform&apos;s.
            </p>
          </div>
        </div>

        {error ? (
          <div className="mt-5 rounded-[10px] border border-[#fecdd3] bg-[#fff1f2] px-4 py-3 text-sm text-[#be123c]">
            {error}
          </div>
        ) : null}

        <div className="mt-6 rounded-[10px] border border-[#eceff3] bg-white p-5">
          <h3 className="mb-3 text-sm font-semibold text-[#111827]">Create a coupon</h3>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <input
              placeholder="CODE (e.g. RESTO20)"
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
              className="rounded-[8px] border border-gray-200 px-3 py-2 text-sm uppercase"
            />
            <select
              value={form.discountType}
              onChange={(e) => setForm((f) => ({ ...f, discountType: e.target.value as DiscountType }))}
              className="rounded-[8px] border border-gray-200 px-3 py-2 text-sm"
            >
              <option value="percentage">Percentage off</option>
              <option value="fixed">Fixed amount off</option>
              <option value="free_delivery">Free delivery</option>
            </select>
            <input
              placeholder={form.discountType === "free_delivery" ? "Value (unused)" : "Discount value"}
              type="number"
              value={form.discountValue}
              onChange={(e) => setForm((f) => ({ ...f, discountValue: e.target.value }))}
              className="rounded-[8px] border border-gray-200 px-3 py-2 text-sm"
            />
            <input
              placeholder="Max discount (Rs., optional)"
              type="number"
              value={form.maxDiscountAmount}
              onChange={(e) => setForm((f) => ({ ...f, maxDiscountAmount: e.target.value }))}
              className="rounded-[8px] border border-gray-200 px-3 py-2 text-sm"
            />
            <input
              placeholder="Min order amount (Rs.)"
              type="number"
              value={form.minOrderAmount}
              onChange={(e) => setForm((f) => ({ ...f, minOrderAmount: e.target.value }))}
              className="rounded-[8px] border border-gray-200 px-3 py-2 text-sm"
            />
            <input
              placeholder="Usage limit (optional)"
              type="number"
              value={form.usageLimit}
              onChange={(e) => setForm((f) => ({ ...f, usageLimit: e.target.value }))}
              className="rounded-[8px] border border-gray-200 px-3 py-2 text-sm"
            />
            <input
              placeholder="Per-customer limit (optional)"
              type="number"
              value={form.perUserLimit}
              onChange={(e) => setForm((f) => ({ ...f, perUserLimit: e.target.value }))}
              className="rounded-[8px] border border-gray-200 px-3 py-2 text-sm"
            />
            <input
              type="date"
              value={form.expiresAt}
              onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
              className="rounded-[8px] border border-gray-200 px-3 py-2 text-sm"
            />
            <input
              placeholder="Description (optional)"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="col-span-2 rounded-[8px] border border-gray-200 px-3 py-2 text-sm md:col-span-3"
            />
          </div>
          <button
            type="button"
            disabled={creating}
            onClick={handleCreate}
            className="mt-4 rounded-[8px] bg-[#e8505b] px-4 py-2 text-sm font-semibold text-white hover:bg-[#d6414c] disabled:opacity-50"
          >
            {creating ? "Creating..." : "Create coupon"}
          </button>
        </div>

        <div className="mt-6 space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading coupons...</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">You haven&apos;t created any coupons yet.</p>
          ) : (
            items.map((promo) => (
              <div key={promo.id} className="rounded-[10px] border border-[#eceff3] bg-white p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[14px] font-semibold text-[#111827]">{promo.code}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          promo.isActive ? "bg-[#ecfdf3] text-[#16a34a]" : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {promo.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <p className="mt-1 text-[13px] text-[#111827]">{formatDiscount(promo)}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Min order Rs. {promo.minOrderAmount} · Used {promo.timesUsed}
                      {promo.usageLimit ? `/${promo.usageLimit}` : ""} times
                      {promo.perUserLimit ? ` · ${promo.perUserLimit} per customer` : ""} · {formatDate(promo.expiresAt)}
                    </p>
                    {promo.description ? (
                      <p className="mt-1 text-[11px] text-muted-foreground">{promo.description}</p>
                    ) : null}
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    disabled={actioningId === promo.id}
                    onClick={() => void handleToggleActive(promo)}
                    className="rounded-[8px] border border-gray-200 px-3 py-1.5 text-[12px] font-semibold text-[#374151] hover:bg-gray-50 disabled:opacity-50"
                  >
                    {actioningId === promo.id ? "Working..." : promo.isActive ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    type="button"
                    disabled={actioningId === promo.id}
                    onClick={() => void handleDelete(promo)}
                    className="rounded-[8px] border border-[#fecdd3] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#be123c] hover:bg-[#fff1f2] disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </MerchantDashboardLayout>
  );
}
