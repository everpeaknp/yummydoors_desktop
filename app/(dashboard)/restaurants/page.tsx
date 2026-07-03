"use client";

import { useEffect, useState } from "react";

import { SiteNavbar } from "@/components/layout/site-navbar";
import { apiFetch } from "@/lib/http";
import { Card, CardContent } from "@/components/ui/card";

export default function RestaurantsPage() {
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await apiFetch("/restaurants");
        if (res.ok) {
          const payload = await res.json();
          setRestaurants(payload?.data?.items || []);
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
    <div className="min-h-screen bg-[#fcfcfd]">
      <SiteNavbar className="sticky top-0 z-40" />
      <main className="mx-auto w-full max-w-7xl px-6 py-10 lg:px-10">
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Restaurants</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Browse restaurants available to the current customer feed.
            </p>
          </div>

          {loading ? (
            <div className="text-sm text-muted-foreground">Loading restaurants...</div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {restaurants.map((r) => (
                <Card key={r.slug} className="overflow-hidden">
                  <div
                    className="h-32 w-full bg-cover bg-center"
                    style={{ backgroundImage: `url(${r.cover_image_url || "https://via.placeholder.com/400x200"})` }}
                  />
                  <CardContent className="p-5">
                    <div className="flex items-center gap-4">
                      {r.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.logo_url} alt={r.name} className="h-12 w-12 rounded-full border shadow-sm" />
                      ) : null}
                      <div>
                        <h3 className="font-semibold text-lg">{r.name}</h3>
                        <p className="text-xs text-muted-foreground">
                          {r.primary_cuisine_label} • {r.city}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800">
                        ★ {r.rating_average} ({r.review_count})
                      </span>
                      {r.has_free_delivery ? (
                        <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800">
                          Free Delivery
                        </span>
                      ) : null}
                      {r.is_featured ? (
                        <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs font-semibold text-yellow-800">
                          Featured
                        </span>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {restaurants.length === 0 ? (
                <p className="text-sm text-muted-foreground">No restaurants found.</p>
              ) : null}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
