"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/http";
import { useAuth } from "@/hooks/use-auth";
import { Plus, Edit2, Trash2 } from "lucide-react";

import { MerchantDashboardLayout } from "@/components/merchant/merchant-dashboard-layout";
import { ImageUpload } from "@/components/ui/image-upload";

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
    return (
      <MerchantDashboardLayout>
        <div className="text-[14px] text-[#868e96] p-6">Please select a restaurant to manage categories.</div>
      </MerchantDashboardLayout>
    );
  }

  return (
    <MerchantDashboardLayout>
      <div className="mb-6 flex items-center text-[13px] text-[#868e96] font-medium">
        <span className="text-[#e53e4f]">Management</span>
        <span className="mx-2">/</span>
        <span>Category structure</span>
      </div>

      <div className="bg-white rounded shadow-sm border border-[#e9ecef] overflow-hidden">
        <div className="border-b border-[#e9ecef] px-6 py-4 flex items-center justify-between text-[#495057]">
          <h2 className="text-[16px] font-semibold">Category Management</h2>
          <button 
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-2 rounded bg-[#e53e4f] px-4 py-2 text-[14px] font-semibold text-white transition-colors hover:bg-[#d63a4a]"
          >
            <Plus className="w-4 h-4" />
            Add Category
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="text-[14px] text-[#868e96]">Loading...</div>
          ) : error ? (
            <div className="text-[14px] text-red-500">{error}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[14px] text-[#495057]">
                <thead>
                  <tr className="border-b-2 border-[#dee2e6] font-bold">
                    <th className="py-3 px-2">Name</th>
                    <th className="py-3 px-2">Slug</th>
                    <th className="py-3 px-2">Sort Order</th>
                    <th className="py-3 px-2">Featured</th>
                    <th className="py-3 px-2 text-right">Edit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#dee2e6]">
                  {categories.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="py-4 px-2 font-semibold text-[#212529]">{c.name}</td>
                      <td className="py-4 px-2">{c.slug}</td>
                      <td className="py-4 px-2">{c.sort_order}</td>
                      <td className="py-4 px-2">
                        {c.is_featured ? (
                          <span className="inline-flex items-center rounded-sm bg-[#28a745] px-2 py-0.5 text-[10px] font-bold text-white">Yes</span>
                        ) : (
                          <span className="inline-flex items-center rounded-sm bg-gray-200 px-2 py-0.5 text-[10px] font-bold text-gray-700">No</span>
                        )}
                      </td>
                      <td className="py-4 px-2 text-[#e53e4f] text-right">
                        <button onClick={() => openEditModal(c)} className="hover:underline">Edit</button>
                        <span className="mx-1 text-[#868e96]">|</span>
                        <button onClick={() => handleDelete(c.id)} className="hover:underline">Delete</button>
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
        </div>

        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded w-full max-w-md overflow-hidden shadow-xl border border-[#e9ecef]">
              <div className="px-6 py-4 border-b border-[#e9ecef] flex justify-between items-center bg-[#f8f9fa]">
                <h3 className="font-semibold text-[16px] text-[#495057]">{editingId ? "Edit Category" : "Add Category"}</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-[#868e96] hover:text-[#212529] text-xl leading-none">&times;</button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-[14px] font-medium text-[#495057] mb-1">Name</label>
                  <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full rounded border border-[#ced4da] px-3 py-2 text-[14px] focus:border-[#86b7fe] outline-none" />
                </div>
                <div>
                  <label className="block text-[14px] font-medium text-[#495057] mb-1">Slug</label>
                  <input required value={formData.slug} onChange={e => setFormData({...formData, slug: e.target.value})} className="w-full rounded border border-[#ced4da] px-3 py-2 text-[14px] focus:border-[#86b7fe] outline-none" />
                </div>
                <div>
                  <label className="block text-[14px] font-medium text-[#495057] mb-1">Icon (optional)</label>
                  <ImageUpload 
                    value={formData.icon_url} 
                    folderType="categories"
                    onChange={url => setFormData({...formData, icon_url: url ?? ""})} 
                  />
                </div>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-[14px] font-medium text-[#495057] mb-1">Sort Order</label>
                    <input type="number" required value={formData.sort_order} onChange={e => setFormData({...formData, sort_order: parseInt(e.target.value)})} className="w-full rounded border border-[#ced4da] px-3 py-2 text-[14px] focus:border-[#86b7fe] outline-none" />
                  </div>
                  <div className="flex-1 flex items-center pt-6">
                    <label className="flex items-center gap-2 cursor-pointer text-[14px] text-[#495057]">
                      <input type="checkbox" checked={formData.is_featured} onChange={e => setFormData({...formData, is_featured: e.target.checked})} className="rounded text-[#e53e4f] focus:ring-[#e53e4f] w-4 h-4" />
                      Featured
                    </label>
                  </div>
                </div>
                <div className="pt-4 flex justify-end gap-3 border-t border-[#e9ecef] mt-4 pt-4">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-[14px] font-semibold text-[#6c757d] hover:bg-gray-100 rounded">Cancel</button>
                  <button type="submit" disabled={isSubmitting} className="rounded bg-[#e53e4f] px-5 py-2 text-[14px] font-semibold text-white hover:bg-[#d63a4a] disabled:opacity-50">
                    {isSubmitting ? "Saving..." : "Save Category"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </MerchantDashboardLayout>
  );
}
