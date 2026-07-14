"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ImageIcon } from "lucide-react";
import Image from "next/image";

import { SiteNavbar } from "@/components/layout/site-navbar";
import { apiFetch } from "@/lib/http";
import { extractApiErrorMessage, readJsonSafely } from "@/lib/api-utils";
import type { RestaurantDetail } from "../page"; // We can fetch the same detail, or just the gallery images. Let's just fetch the detail.

export default function RestaurantGalleryPage() {
  const params = useParams<{ slug: string }>();
  const slug = typeof params?.slug === "string" ? params.slug : "";

  const [detail, setDetail] = useState<RestaurantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRestaurant = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch(`/restaurants/${slug}`, { auth: true });
      const payload = await readJsonSafely<{ data?: RestaurantDetail }>(response);
      if (!response.ok) {
        throw new Error(extractApiErrorMessage(payload, "Failed to load gallery."));
      }
      if (payload?.data) {
        setDetail(payload.data);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to load gallery.");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void loadRestaurant();
  }, [loadRestaurant]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#faf7f2] text-sm text-muted-foreground">
        Loading gallery...
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#faf7f2]">
        <div className="rounded-[14px] border border-[#ffd8cc] bg-[#fff4ef] p-6 text-center text-[#9a3412]">
          <p className="font-semibold">{error || "Restaurant not found."}</p>
          <Link href={`/restaurants/${slug}`} className="mt-4 inline-block hover:underline">
            Go back
          </Link>
        </div>
      </div>
    );
  }

  const { restaurant } = detail;
  const galleryImages = [
    ...(restaurant.cover_image_url ? [restaurant.cover_image_url] : []),
    ...(restaurant.logo_url ? [restaurant.logo_url] : []),
    ...(detail.gallery_images?.map((g) => g.image_url) || []),
  ];

  return (
    <div className="min-h-screen bg-[#faf7f2] text-gray-800 antialiased pb-20">
      <SiteNavbar className="sticky top-0 z-50 bg-white/85 backdrop-blur-xl" />

      <main className="mx-auto w-full max-w-7xl px-6 py-12 lg:px-10">
        <Link
          href={`/restaurants/${slug}`}
          className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-[#555] hover:text-[#111]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to {restaurant.name}
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-[#111] flex items-center gap-3">
            <ImageIcon className="h-7 w-7 text-primary" />
            Photo Gallery
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            {galleryImages.length} photos for {restaurant.name}
          </p>
        </div>

        {galleryImages.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 py-20 text-center text-gray-500">
            No photos available for this restaurant.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {galleryImages.map((imgUrl, i) => (
              <div
                key={i}
                className="group relative aspect-square overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm"
              >
                <Image
                  src={imgUrl}
                  alt={`${restaurant.name} photo ${i + 1}`}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                />
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
