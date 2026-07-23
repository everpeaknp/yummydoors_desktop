"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Search, SlidersHorizontal } from "lucide-react";
import { MerchantDashboardLayout } from "@/components/merchant/merchant-dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ImageUpload } from "@/components/ui/image-upload";
import { apiFetch } from "@/lib/http";

type Category = { id: number; name: string; slug: string; icon_url: string | null; sort_order: number; is_featured: boolean };
type AddOn = { id: number; name: string; price: number; max_quantity: number; is_available: boolean };
type ModifierGroup = { id: number; name: string; items: Array<{ id: number; name: string; price_adjustment: number }> };
type MenuItem = { id: number; name: string; price: number; is_available: boolean; modifier_groups: ModifierGroup[]; add_ons: AddOn[] };

export default function MerchantMenuPage() {
  const [restaurantId, setRestaurantId] = useState<number | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categoryName, setCategoryName] = useState("");
  const [categorySearch, setCategorySearch] = useState("");
  const [categoryImage, setCategoryImage] = useState("");
  const [categoryFeatured, setCategoryFeatured] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [itemName, setItemName] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [itemImage, setItemImage] = useState<string | null>(null);
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
    const existing = categories.find((category) => category.name.trim().toLowerCase() === categoryName.trim().toLowerCase());
    if (existing && !window.confirm(`“${existing.name}” already exists. Use the existing category instead?`)) { setBusy(false); return; }
    if (existing) { setCategoryId(String(existing.id)); setCategoryName(""); setBusy(false); return; }
    await apiFetch(`/merchant/restaurants/${restaurantId}/categories`, { method: "POST", auth: true, body: JSON.stringify({ name: categoryName, icon_url: categoryImage || null, is_featured: categoryFeatured }) });
    setCategoryName(""); setCategoryImage(""); setCategoryFeatured(false); await load(); setBusy(false);
  }

  async function saveCategory(event: FormEvent) {
    event.preventDefault();
    if (!restaurantId || !editingCategoryId || !categoryName.trim()) return;
    setBusy(true);
    await apiFetch(`/merchant/restaurants/${restaurantId}/categories/${editingCategoryId}`, { method: "PUT", auth: true, body: JSON.stringify({ name: categoryName, icon_url: categoryImage || null, is_featured: categoryFeatured }) });
    setEditingCategoryId(null); setCategoryName(""); setCategoryImage(""); setCategoryFeatured(false); await load(); setBusy(false);
  }

  async function createItem(event: FormEvent) {
    event.preventDefault();
    if (!restaurantId || !itemName.trim() || !itemPrice) return;
    setBusy(true);
    await apiFetch(`/merchant/restaurants/${restaurantId}/menu-items`, { method: "POST", auth: true, body: JSON.stringify({ name: itemName, price: Number(itemPrice), category_id: categoryId ? Number(categoryId) : null, image_url: itemImage }) });
    setItemName(""); setItemPrice(""); setItemImage(null); await load(); setBusy(false);
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
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <Card><CardContent className="space-y-5 p-6"><div><h2 className="text-lg font-semibold">Menu categories</h2><p className="text-sm text-[#6b7280]">Choose an existing category or create one for this restaurant. Slugs are managed automatically.</p></div><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-[#9aa1ad]" /><input value={categorySearch} onChange={e => setCategorySearch(e.target.value)} placeholder="Search existing categories" className="h-10 w-full rounded border pl-9 pr-3" /></div><div className="space-y-2">{categories.filter(c => c.name.toLowerCase().includes(categorySearch.toLowerCase())).map(c => <div key={c.id} className="flex items-center justify-between rounded-xl border border-[#e9ecef] p-3"><div className="flex items-center gap-3">{c.icon_url ? <img src={c.icon_url} alt="" className="h-10 w-10 rounded-lg object-cover" /> : <div className="h-10 w-10 rounded-lg bg-[#fff1ed]" />}<div><p className="font-semibold">{c.name}</p><p className="text-xs text-[#868e96]">{c.is_featured ? "Featured" : "Standard"}</p></div></div><button type="button" className="inline-flex items-center gap-1 text-sm font-semibold text-[#e53e4f]" onClick={() => { setEditingCategoryId(c.id); setCategoryName(c.name); setCategoryImage(c.icon_url || ""); setCategoryFeatured(c.is_featured); }}><Pencil className="h-3.5 w-3.5" /> Edit</button></div>)}</div><form onSubmit={editingCategoryId ? saveCategory : createCategory} className="space-y-3 border-t border-[#e9ecef] pt-4"><h3 className="font-semibold">{editingCategoryId ? "Edit category" : "Create category"}</h3><input value={categoryName} onChange={e => setCategoryName(e.target.value)} placeholder="Main Course" className="h-11 w-full rounded border px-3" /><ImageUpload value={categoryImage || null} onChange={url => setCategoryImage(url || "")} folderType="categories" disabled={busy} /><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={categoryFeatured} onChange={e => setCategoryFeatured(e.target.checked)} /> Feature this category</label><div className="flex gap-2"><Button disabled={busy}><Plus className="h-4 w-4" /> {editingCategoryId ? "Save changes" : "Add category"}</Button>{editingCategoryId ? <Button type="button" variant="secondary" onClick={() => setEditingCategoryId(null)}>Cancel</Button> : null}</div></form></CardContent></Card>
      <Card><CardContent className="space-y-4 p-6"><h2 className="text-lg font-semibold">Create menu item</h2><form onSubmit={createItem} className="grid gap-3 sm:grid-cols-2"><input value={itemName} onChange={e => setItemName(e.target.value)} placeholder="Chicken Momo" className="h-11 rounded border px-3" /><input value={itemPrice} onChange={e => setItemPrice(e.target.value)} placeholder="Price" type="number" min="0" className="h-11 rounded border px-3" /><select value={categoryId} onChange={e => setCategoryId(e.target.value)} className="h-11 rounded border px-3 sm:col-span-2"><option value="">No category</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><div className="sm:col-span-2"><ImageUpload value={itemImage} onChange={setItemImage} folderType="menu_items" disabled={busy} /></div><Button disabled={busy} className="sm:col-span-2"><Plus className="h-4 w-4" /> Add menu item</Button></form></CardContent></Card>
    </div>
    <div className="grid gap-4">{items.map(item => <Card key={item.id}><CardContent className="space-y-4 p-6"><div className="flex items-start justify-between"><div><h2 className="text-lg font-semibold">{item.name}</h2><p className="text-sm text-[#6b7280]">Rs. {item.price.toFixed(2)} · {item.is_available ? "Available" : "Unavailable"}</p></div><Button type="button" variant="secondary" onClick={() => void createAddOn(item.id)}><Plus className="h-4 w-4" /> Add add-on</Button></div><div className="grid gap-3 md:grid-cols-2"><div className="rounded-xl border border-[#e9ecef] p-4"><p className="flex items-center gap-2 text-sm font-semibold"><SlidersHorizontal className="h-4 w-4 text-[#e53e4f]" /> Modifiers</p>{item.modifier_groups.length ? item.modifier_groups.map(group => <div key={group.id} className="mt-3 text-sm"><b>{group.name}</b><p className="text-[#6b7280]">{group.items.map(option => `${option.name} (+${option.price_adjustment})`).join(", ")}</p></div>) : <p className="mt-3 text-sm text-[#9aa1ad]">No modifier groups yet.</p>}</div><div className="rounded-xl border border-[#e9ecef] p-4"><p className="text-sm font-semibold">Add-ons</p>{item.add_ons.length ? item.add_ons.map(addOn => <div key={addOn.id} className="mt-3 flex justify-between text-sm"><span>{addOn.name}</span><span>+Rs. {addOn.price.toFixed(2)} · max {addOn.max_quantity}</span></div>) : <p className="mt-3 text-sm text-[#9aa1ad]">No add-ons yet.</p>}</div></div></CardContent></Card>)}</div>
  </div></MerchantDashboardLayout>;
}
