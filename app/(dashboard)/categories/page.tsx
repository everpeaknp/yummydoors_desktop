"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/http";
import { Card, CardContent } from "@/components/ui/card";

export default function CategoriesPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const feedRes = await apiFetch("/home/feed?latitude=28.2096&longitude=83.9856", { auth: true });
        if (feedRes.ok) {
           const feedPayload = await feedRes.json();
           setCategories(feedPayload.data.categories || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Categories</h2>
        <p className="text-sm text-muted-foreground mt-2">Manage food categories displayed on the home feed.</p>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading categories...</div>
      ) : (
        <div className="grid gap-6 md:grid-cols-3 lg:grid-cols-4">
          {categories.map((c) => (
            <Card key={c.slug} className="overflow-hidden hover:shadow-md transition-shadow">
              <CardContent className="p-6 flex flex-col items-center justify-center text-center">
                {c.icon_url ? (
                  <img src={c.icon_url} alt={c.name} className="h-16 w-16 mb-4 object-contain" />
                ) : (
                  <div className="h-16 w-16 mb-4 bg-muted rounded-full" />
                )}
                <h3 className="font-semibold text-lg">{c.name}</h3>
                <div className="mt-3 flex gap-2">
                  <span className="text-xs bg-secondary text-primary px-2 py-1 rounded-full uppercase tracking-wider font-semibold">
                    Sort: {c.sort_order ?? 0}
                  </span>
                  {c.is_featured && (
                    <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full uppercase tracking-wider font-semibold">
                      Featured
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {categories.length === 0 && (
             <p className="text-sm text-muted-foreground">No categories found.</p>
          )}
        </div>
      )}
    </div>
  );
}
