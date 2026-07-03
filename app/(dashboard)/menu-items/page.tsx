"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/http";
import { Card, CardContent } from "@/components/ui/card";

export default function MenuItemsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        // Just visualize what's available via home feed for a quick view
        const feedRes = await apiFetch("/home/feed?latitude=28.2096&longitude=83.9856", { auth: true });
        if (feedRes.ok) {
           const feedPayload = await feedRes.json();
           // Combine recommended and popular for visualization
           const combined = [
             ...(feedPayload.data.recommended_items || []),
             ...(feedPayload.data.popular_foods || [])
           ];
           // Deduplicate by id
           const unique = Array.from(new Map(combined.map(item => [item.id, item])).values());
           setItems(unique);
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
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Menu Catalog</h2>
        <p className="text-sm text-muted-foreground mt-2">Manage all featured and popular food items across restaurants.</p>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading menu items...</div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {items.map((m) => (
            <Card key={m.slug} className="flex overflow-hidden">
              <div 
                className="w-32 bg-cover bg-center bg-muted flex-shrink-0" 
                style={{ backgroundImage: `url(${m.image_url || 'https://via.placeholder.com/150'})` }} 
              />
              <CardContent className="p-4 flex flex-col justify-center flex-1">
                <h3 className="font-semibold text-base">{m.name}</h3>
                <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{m.description}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="font-semibold text-lg text-primary">{m.currency_code} {m.price}</span>
                  <span className={`text-xs px-2 py-1 rounded-full font-semibold ${m.food_type === 'veg' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {m.food_type === 'veg' ? 'VEG' : 'NON-VEG'}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
          {items.length === 0 && (
             <p className="text-sm text-muted-foreground">No menu items found.</p>
          )}
        </div>
      )}
    </div>
  );
}
