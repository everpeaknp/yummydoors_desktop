"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/http";
import { Card, CardContent } from "@/components/ui/card";

export default function PromosPage() {
  const [promos, setPromos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const feedRes = await apiFetch("/home/feed?latitude=28.2096&longitude=83.9856", { auth: true });
        if (feedRes.ok) {
           const feedPayload = await feedRes.json();
           setPromos(feedPayload.data.promos || []);
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
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Merchandising Banners</h2>
        <p className="text-sm text-muted-foreground mt-2">Manage marketing campaigns, hero carousels, and promotional banners.</p>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading promos...</div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {promos.map((p) => (
            <Card key={p.id} className="overflow-hidden shadow-sm">
              <div 
                className="h-48 w-full bg-cover bg-center" 
                style={{ backgroundImage: `url(${p.image_url || 'https://via.placeholder.com/800x400'})` }} 
              />
              <CardContent className="p-5 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-xl">{p.title}</h3>
                  {p.subtitle && <p className="text-sm text-muted-foreground">{p.subtitle}</p>}
                  <div className="mt-2 flex gap-2">
                    <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-md font-medium uppercase tracking-wider">
                      {p.placement.replace('_', ' ')}
                    </span>
                    <span className="text-xs border border-muted px-2 py-1 rounded-md font-medium uppercase tracking-wider text-muted-foreground">
                      Target: {p.target_type}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {p.is_active ? 'Active' : 'Inactive'}
                  </span>
                  {p.cta_text && (
                    <button className="text-sm bg-primary text-primary-foreground px-4 py-2 rounded-lg font-semibold mt-2">
                      {p.cta_text}
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {promos.length === 0 && (
             <p className="text-sm text-muted-foreground">No active promos found.</p>
          )}
        </div>
      )}
    </div>
  );
}
