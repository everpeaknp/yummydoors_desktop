"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Plus, SlidersHorizontal } from "lucide-react";
import { MerchantDashboardLayout } from "@/components/merchant/merchant-dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiFetch } from "@/lib/http";

type Category = { id: number; name: string; slug: string };
type AddOn = { id: number; name: string; price: number; max_quantity: number; is_available: boolean };
type ModifierGroup = { id: number; name: string; items: Array<{ id: number; name: string; price_adjustment: number }> };
type MenuItem = { id: number; name: string; price: number; is_available: boolean; modifier_groups: ModifierGroup[]; add_ons: AddOn[] };

export default function MerchantMenuPage() {
  const [restaurantId, setRestaurantId] = useState<number | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categoryName, setCategoryName] = useState("");
  const [itemName, setItemName] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const profileResponse = await apiFetch("/merchant/restaurants/me", { auth: true });
    const profile = await profileResponse.json().catch(() => null);
    const restaurant = profile?.data?.items?.[0] ?? profile?.items?.[0];
    if (!restaurant?.id) return;
    setRestaurantId(restaurant.id);
    const [categoriesResponse, itemsResponse] = await Promise.all([
      apiFetch(`/merchant/restaurants/${restaurant.id}/categories`, { auth: true }),
      apiFetch(`/merchant/restaurants/${restaurant.id}/menu-items`, { auth: true }),
    ]);
    const categoriesPayload = await categoriesResponse.json().catch(() => null);
    const itemsPayload = await itemsResponse.json().catch(() => null);
    setCategories(categoriesPayload?.data ?? []);
    setItems(itemsPayload?.data ?? []);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function createCategory(event: FormEvent) {
    event.preventDefault();
    if (!restaurantId || !categoryName.trim()) return;
    setBusy(true);
    await apiFetch(`/merchant/restaurants/${restaurantId}/categories`, { method: "POST", auth: true, body: JSON.stringify({ name: categoryName }) });
    setCategoryName(""); await load(); setBusy(false);
  }

  async function createItem(event: FormEvent) {
    event.preventDefault();
    if (!restaurantId || !itemName.trim() || !itemPrice) return;
    setBusy(true);
    await apiFetch(`/merchant/restaurants/${restaurantId}/menu-items`, { method: "POST", auth: true, body: JSON.stringify({ name: itemName, price: Number(itemPrice), category_id: categoryId ? Number(categoryId) : null }) });
    setItemName(""); setItemPrice(""); await load(); setBusy(false);
  }

  async function createAddOn(itemId: number) {
    const name = window.prompt("Add-on name");
    if (!restaurantId || !name?.trim()) return;
    const price = window.prompt("Add-on price", "0");
    await apiFetch(`/merchant/restaurants/${restaurantId}/menu-items/${itemId}/add-ons`, { method: "POST", auth: true, body: JSON.stringify({ name, price: Number(price || 0), max_quantity: 1 }) });
    await load();
  }

  return <MerchantDashboardLayout><div className="mx-auto max-w-6xl space-y-6">
    <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#e53e4f]">Catalog</p><h1 className="mt-2 text-3xl font-bold text-[#212529]">Menu and options</h1><p className="mt-2 text-sm text-[#6b7280]">Platform-generated slugs keep categories and menu items consistent. Configure modifiers and add-ons without entering technical identifiers.</p></div>
    <div className="grid gap-6 lg:grid-cols-2">
      <Card><CardContent className="space-y-4 p-6"><h2 className="text-lg font-semibold">Create category</h2><form onSubmit={createCategory} className="flex gap-3"><input value={categoryName} onChange={e => setCategoryName(e.target.value)} placeholder="Main Course" className="h-11 flex-1 rounded border px-3" /><Button disabled={busy}><Plus className="h-4 w-4" /> Add</Button></form><div className="flex flex-wrap gap-2">{categories.map(c => <span key={c.id} className="rounded-full bg-[#fff1ed] px-3 py-1 text-xs font-semibold text-[#e9572d]">{c.name} · {c.slug}</span>)}</div></CardContent></Card>
      <Card><CardContent className="space-y-4 p-6"><h2 className="text-lg font-semibold">Create menu item</h2><form onSubmit={createItem} className="grid gap-3 sm:grid-cols-2"><input value={itemName} onChange={e => setItemName(e.target.value)} placeholder="Chicken Momo" className="h-11 rounded border px-3" /><input value={itemPrice} onChange={e => setItemPrice(e.target.value)} placeholder="Price" type="number" min="0" className="h-11 rounded border px-3" /><select value={categoryId} onChange={e => setCategoryId(e.target.value)} className="h-11 rounded border px-3 sm:col-span-2"><option value="">No category</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><Button disabled={busy} className="sm:col-span-2"><Plus className="h-4 w-4" /> Add menu item</Button></form></CardContent></Card>
    </div>
    <div className="grid gap-4">{items.map(item => <Card key={item.id}><CardContent className="space-y-4 p-6"><div className="flex items-start justify-between"><div><h2 className="text-lg font-semibold">{item.name}</h2><p className="text-sm text-[#6b7280]">Rs. {item.price.toFixed(2)} · {item.is_available ? "Available" : "Unavailable"}</p></div><Button type="button" variant="secondary" onClick={() => void createAddOn(item.id)}><Plus className="h-4 w-4" /> Add add-on</Button></div><div className="grid gap-3 md:grid-cols-2"><div className="rounded-xl border border-[#e9ecef] p-4"><p className="flex items-center gap-2 text-sm font-semibold"><SlidersHorizontal className="h-4 w-4 text-[#e53e4f]" /> Modifiers</p>{item.modifier_groups.length ? item.modifier_groups.map(group => <div key={group.id} className="mt-3 text-sm"><b>{group.name}</b><p className="text-[#6b7280]">{group.items.map(option => `${option.name} (+${option.price_adjustment})`).join(", ")}</p></div>) : <p className="mt-3 text-sm text-[#9aa1ad]">No modifier groups yet.</p>}</div><div className="rounded-xl border border-[#e9ecef] p-4"><p className="text-sm font-semibold">Add-ons</p>{item.add_ons.length ? item.add_ons.map(addOn => <div key={addOn.id} className="mt-3 flex justify-between text-sm"><span>{addOn.name}</span><span>+Rs. {addOn.price.toFixed(2)} · max {addOn.max_quantity}</span></div>) : <p className="mt-3 text-sm text-[#9aa1ad]">No add-ons yet.</p>}</div></div></CardContent></Card>)}</div>
  </div></MerchantDashboardLayout>;
}
