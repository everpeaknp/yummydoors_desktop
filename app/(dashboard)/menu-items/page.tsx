"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/http";
import { useAuth } from "@/hooks/use-auth";
import { Plus, Edit2, Trash2 } from "lucide-react";

export default function MenuItemsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ 
    name: "", slug: "", description: "", price: 0, 
    currency_code: "NPR", category_id: "", food_type: "veg", image_url: "" 
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const restaurantId = user?.activeRestaurantId;

  const loadData = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const [menuRes, catRes] = await Promise.all([
        apiFetch(`/merchant/restaurants/${restaurantId}/menu-items`, { auth: true }),
        apiFetch(`/merchant/restaurants/${restaurantId}/categories`, { auth: true })
      ]);
      
      if (menuRes.ok) {
        const payload = await menuRes.json();
        setItems(payload.data || []);
      } else {
        const payload = await menuRes.json().catch(() => null);
        setError(payload?.detail || payload?.message || "Failed to load menu items.");
      }
      if (catRes.ok) {
        const payload = await catRes.json();
        setCategories(payload.data || []);
      } else {
        const payload = await catRes.json().catch(() => null);
        setError(payload?.detail || payload?.message || "Failed to load categories.");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to load menu items.");
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function openCreateModal() {
    setFormData({ name: "", slug: "", description: "", price: 0, currency_code: "NPR", category_id: "", food_type: "veg", image_url: "" });
    setEditingId(null);
    setIsModalOpen(true);
  }

  function openEditModal(item: any) {
    setFormData({
      name: item.name,
      slug: item.slug,
      description: item.description || "",
      price: item.price || 0,
      currency_code: item.currency_code || "NPR",
      category_id: item.category_id || "",
      food_type: item.food_type || "veg",
      image_url: item.image_url || "",
    });
    setEditingId(item.id);
    setIsModalOpen(true);
  }

  async function handleDelete(id: number) {
    if (!confirm("Are you sure you want to delete this menu item?")) return;
    try {
      const res = await apiFetch(`/merchant/restaurants/${restaurantId}/menu-items/${id}`, { method: "DELETE", auth: true });
      if (res.ok) {
        setItems(items.filter(i => i.id !== id));
      } else {
        alert("Failed to delete menu item.");
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const url = editingId 
        ? `/merchant/restaurants/${restaurantId}/menu-items/${editingId}`
        : `/merchant/restaurants/${restaurantId}/menu-items`;
      const method = editingId ? "PUT" : "POST";
      
      const payload = {
        ...formData,
        category_id: formData.category_id ? parseInt(formData.category_id) : null,
      };

      const res = await apiFetch(url, {
        method,
        auth: true,
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setIsModalOpen(false);
        loadData();
      } else {
        const err = await res.json();
        alert(err.detail || "Failed to save menu item.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!restaurantId) {
    return <div className="text-sm text-muted-foreground p-6">Please select a restaurant to manage menu items.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#1f2937]">Menu Catalog</h2>
          <p className="text-sm text-[#6b7280] mt-1">Manage all food items across your restaurant.</p>
        </div>
        <button 
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
        >
          <Plus className="w-4 h-4" />
          Add Item
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : error ? (
        <div className="text-sm text-red-500">{error}</div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {items.map((m) => (
            <div key={m.id} className="flex overflow-hidden rounded-2xl border border-[#efe4d8] bg-white hover:border-[#ffd5bf] transition-colors group">
              <div 
                className="w-32 bg-cover bg-center bg-[#fcfaf7] flex-shrink-0 border-r border-[#efe4d8]" 
                style={{ backgroundImage: `url(${m.image_url || 'https://via.placeholder.com/150'})` }} 
              />
              <div className="p-4 flex flex-col justify-center flex-1 relative">
                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                  <button onClick={() => openEditModal(m)} className="p-1.5 bg-white/90 backdrop-blur rounded-lg text-[#6b7280] hover:text-primary border border-[#efe4d8]"><Edit2 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleDelete(m.id)} className="p-1.5 bg-white/90 backdrop-blur rounded-lg text-[#6b7280] hover:text-red-600 border border-[#efe4d8]"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
                <h3 className="font-semibold text-base text-[#1f2937] pr-12">{m.name}</h3>
                <p className="text-xs text-[#6b7280] line-clamp-2 mt-1">{m.description || "No description provided."}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="font-semibold text-lg text-primary">{m.currency_code} {m.price}</span>
                  <span className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wider ${m.food_type === 'veg' ? 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20' : m.food_type === 'vegan' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20' : 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20'}`}>
                    {m.food_type}
                  </span>
                </div>
              </div>
            </div>
          ))}
          {items.length === 0 && (
             <p className="text-sm text-muted-foreground col-span-full">No menu items found. Start by adding one.</p>
          )}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto pt-24 pb-12">
          <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-xl my-auto">
            <div className="px-6 py-4 border-b border-[#efe4d8] flex justify-between items-center bg-[#fcfaf7] sticky top-0 z-10">
              <h3 className="font-semibold text-lg text-[#1f2937]">{editingId ? "Edit Menu Item" : "Add Menu Item"}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-[#6b7280] hover:text-[#1f2937] text-2xl leading-none">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#1f2937] mb-1">Name</label>
                  <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full rounded-xl border border-[#efe4d8] px-4 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#1f2937] mb-1">Slug</label>
                  <input required value={formData.slug} onChange={e => setFormData({...formData, slug: e.target.value})} className="w-full rounded-xl border border-[#efe4d8] px-4 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-[#1f2937] mb-1">Description</label>
                <textarea rows={3} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full rounded-xl border border-[#efe4d8] px-4 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none" />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#1f2937] mb-1">Price</label>
                  <input type="number" step="0.01" required value={formData.price} onChange={e => setFormData({...formData, price: parseFloat(e.target.value)})} className="w-full rounded-xl border border-[#efe4d8] px-4 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#1f2937] mb-1">Currency</label>
                  <input required value={formData.currency_code} onChange={e => setFormData({...formData, currency_code: e.target.value})} className="w-full rounded-xl border border-[#efe4d8] px-4 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none bg-gray-50" readOnly />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#1f2937] mb-1">Food Type</label>
                  <select value={formData.food_type} onChange={e => setFormData({...formData, food_type: e.target.value})} className="w-full rounded-xl border border-[#efe4d8] px-4 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none">
                    <option value="veg">Vegetarian</option>
                    <option value="non_veg">Non-Vegetarian</option>
                    <option value="vegan">Vegan</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#1f2937] mb-1">Category</label>
                  <select value={formData.category_id} onChange={e => setFormData({...formData, category_id: e.target.value})} className="w-full rounded-xl border border-[#efe4d8] px-4 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none">
                    <option value="">No Category</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#1f2937] mb-1">Image URL (optional)</label>
                  <input type="url" value={formData.image_url} onChange={e => setFormData({...formData, image_url: e.target.value})} className="w-full rounded-xl border border-[#efe4d8] px-4 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
                </div>
              </div>
              
              <div className="pt-4 flex justify-end gap-3 border-t border-[#efe4d8] mt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-semibold text-[#6b7280] hover:text-[#1f2937]">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="rounded-xl bg-primary px-6 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50">
                  {isSubmitting ? "Saving..." : "Save Menu Item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
