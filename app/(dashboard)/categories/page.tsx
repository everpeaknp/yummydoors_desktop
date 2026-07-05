"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/http";
import { useAuth } from "@/hooks/use-auth";
import { Plus, Edit2, Trash2 } from "lucide-react";

export default function CategoriesPage() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: "", slug: "", icon_url: "", sort_order: 0, is_featured: false });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const restaurantId = user?.activeRestaurantId;

  const loadData = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/merchant/restaurants/${restaurantId}/categories`, { auth: true });
      if (res.ok) {
        const payload = await res.json();
        setCategories(payload.data || []);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to load categories.");
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function openCreateModal() {
    setFormData({ name: "", slug: "", icon_url: "", sort_order: 0, is_featured: false });
    setEditingId(null);
    setIsModalOpen(true);
  }

  function openEditModal(category: any) {
    setFormData({
      name: category.name,
      slug: category.slug,
      icon_url: category.icon_url || "",
      sort_order: category.sort_order || 0,
      is_featured: category.is_featured || false,
    });
    setEditingId(category.id);
    setIsModalOpen(true);
  }

  async function handleDelete(id: number) {
    if (!confirm("Are you sure you want to delete this category?")) return;
    try {
      const res = await apiFetch(`/merchant/restaurants/${restaurantId}/categories/${id}`, { method: "DELETE", auth: true });
      if (res.ok) {
        setCategories(categories.filter(c => c.id !== id));
      } else {
        alert("Failed to delete category.");
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
        ? `/merchant/restaurants/${restaurantId}/categories/${editingId}`
        : `/merchant/restaurants/${restaurantId}/categories`;
      const method = editingId ? "PUT" : "POST";
      
      const res = await apiFetch(url, {
        method,
        auth: true,
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setIsModalOpen(false);
        loadData();
      } else {
        const err = await res.json();
        alert(err.detail || "Failed to save category.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!restaurantId) {
    return <div className="text-sm text-muted-foreground p-6">Please select a restaurant to manage categories.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#1f2937]">Categories</h2>
          <p className="text-sm text-[#6b7280] mt-1">Organize your menu into groups like Appetizers, Mains, etc.</p>
        </div>
        <button 
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
        >
          <Plus className="w-4 h-4" />
          Add Category
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : error ? (
        <div className="text-sm text-red-500">{error}</div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#efe4d8] bg-white">
          <table className="w-full text-left text-sm text-[#6b7280]">
            <thead className="bg-[#fcfaf7] border-b border-[#efe4d8]">
              <tr>
                <th className="px-6 py-4 font-semibold text-[#1f2937]">Name</th>
                <th className="px-6 py-4 font-semibold text-[#1f2937]">Slug</th>
                <th className="px-6 py-4 font-semibold text-[#1f2937]">Sort Order</th>
                <th className="px-6 py-4 font-semibold text-[#1f2937]">Featured</th>
                <th className="px-6 py-4 font-semibold text-[#1f2937] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#efe4d8]">
              {categories.map((c) => (
                <tr key={c.id} className="hover:bg-[#fcfaf7]/50 transition-colors">
                  <td className="px-6 py-4 font-medium text-[#1f2937]">{c.name}</td>
                  <td className="px-6 py-4">{c.slug}</td>
                  <td className="px-6 py-4">{c.sort_order}</td>
                  <td className="px-6 py-4">
                    {c.is_featured ? (
                      <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-1 text-xs font-semibold text-green-700 ring-1 ring-inset ring-green-600/20">Yes</span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-gray-50 px-2 py-1 text-xs font-semibold text-gray-600 ring-1 ring-inset ring-gray-500/10">No</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => openEditModal(c)} className="p-2 text-[#6b7280] hover:text-primary transition-colors"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(c.id)} className="p-2 text-[#6b7280] hover:text-red-600 transition-colors ml-1"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
              {categories.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm">No categories found. Start by adding one.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-xl">
            <div className="px-6 py-4 border-b border-[#efe4d8] flex justify-between items-center bg-[#fcfaf7]">
              <h3 className="font-semibold text-lg text-[#1f2937]">{editingId ? "Edit Category" : "Add Category"}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-[#6b7280] hover:text-[#1f2937] text-2xl leading-none">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#1f2937] mb-1">Name</label>
                <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full rounded-xl border border-[#efe4d8] px-4 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1f2937] mb-1">Slug</label>
                <input required value={formData.slug} onChange={e => setFormData({...formData, slug: e.target.value})} className="w-full rounded-xl border border-[#efe4d8] px-4 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1f2937] mb-1">Icon URL (optional)</label>
                <input type="url" value={formData.icon_url} onChange={e => setFormData({...formData, icon_url: e.target.value})} className="w-full rounded-xl border border-[#efe4d8] px-4 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-[#1f2937] mb-1">Sort Order</label>
                  <input type="number" required value={formData.sort_order} onChange={e => setFormData({...formData, sort_order: parseInt(e.target.value)})} className="w-full rounded-xl border border-[#efe4d8] px-4 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
                </div>
                <div className="flex-1 flex items-center pt-6">
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-[#1f2937]">
                    <input type="checkbox" checked={formData.is_featured} onChange={e => setFormData({...formData, is_featured: e.target.checked})} className="rounded text-primary focus:ring-primary w-4 h-4" />
                    Featured Category
                  </label>
                </div>
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-semibold text-[#6b7280] hover:text-[#1f2937]">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="rounded-xl bg-primary px-6 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50">
                  {isSubmitting ? "Saving..." : "Save Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
