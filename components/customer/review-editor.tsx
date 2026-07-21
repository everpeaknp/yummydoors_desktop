"use client";

import { useEffect, useMemo, useState } from "react";
import { ImageIcon, Star, Trash2, X } from "lucide-react";

import { ImageUpload } from "@/components/ui/image-upload";
import { Button } from "@/components/ui/button";
import { extractApiErrorMessage, readJsonSafely, unwrapApiData } from "@/lib/api-utils";
import { apiFetch } from "@/lib/http";

export type ReviewPayload = {
  id: number;
  user_id: number | null;
  author_name: string;
  rating: number;
  comment: string | null;
  source: string;
  created_at: string;
  is_mine: boolean;
  can_edit: boolean;
  image_urls: string[];
};

type ReviewEligibility = {
  can_create_review: boolean;
  requires_delivered_order: boolean;
  existing_review_id: number | null;
  reason: string | null;
};

type ReviewEditorProps = {
  restaurantSlug: string;
  viewerReview: ReviewPayload | null;
  eligibility: ReviewEligibility | null;
  orderId?: number;
  onSaved: () => Promise<void> | void;
};

export function ReviewEditor({
  restaurantSlug,
  viewerReview,
  eligibility,
  orderId,
  onSaved,
}: ReviewEditorProps) {
  const [rating, setRating] = useState(viewerReview?.rating ?? 5);
  const [comment, setComment] = useState(viewerReview?.comment ?? "");
  const [imageUrls, setImageUrls] = useState<string[]>(viewerReview?.image_urls ?? []);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const mode = viewerReview ? "edit" : "create";

  useEffect(() => {
    setRating(viewerReview?.rating ?? 5);
    setComment(viewerReview?.comment ?? "");
    setImageUrls(viewerReview?.image_urls ?? []);
  }, [viewerReview]);

  const blockedReason = useMemo(() => {
    if (viewerReview) {
      return null;
    }
    if (!eligibility) {
      return "Sign in to review this restaurant.";
    }
    if (!eligibility.can_create_review) {
      return eligibility.reason ?? "You cannot review this restaurant yet.";
    }
    return null;
  }, [eligibility, viewerReview]);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    const response = await apiFetch(
      mode === "edit"
        ? `/restaurants/${restaurantSlug}/reviews/${viewerReview?.id}`
        : `/restaurants/${restaurantSlug}/reviews`,
      {
        method: mode === "edit" ? "PATCH" : "POST",
        auth: true,
        body: JSON.stringify({
          rating,
          comment: comment.trim() || null,
          image_urls: imageUrls,
          ...(mode === "create" && orderId ? { order_id: orderId } : {}),
        }),
      },
    );

    const payload = await readJsonSafely(response);
    if (!response.ok) {
      setSubmitting(false);
      setError(
        extractApiErrorMessage(
          payload,
          mode === "edit" ? "Failed to update review." : "Failed to create review.",
        ),
      );
      return;
    }

    unwrapApiData(payload);
    setSubmitting(false);
    setSuccess(mode === "edit" ? "Review updated." : "Review published.");
    await onSaved();
  }

  async function handleDelete() {
    if (!viewerReview) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    const response = await apiFetch(`/restaurants/${restaurantSlug}/reviews/${viewerReview.id}`, {
      method: "DELETE",
      auth: true,
    });
    const payload = await readJsonSafely(response);
    if (!response.ok) {
      setSubmitting(false);
      setError(extractApiErrorMessage(payload, "Failed to delete review."));
      return;
    }

    setSubmitting(false);
    setComment("");
    setRating(5);
    setImageUrls([]);
    setSuccess("Review removed.");
    await onSaved();
  }

  return (
    <div className="rounded-2xl border border-border bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Your review
          </p>
          <h3 className="mt-2 text-lg font-semibold text-foreground">
            {viewerReview ? "Update your feedback" : "Share your experience"}
          </h3>
        </div>
        {viewerReview ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              void handleDelete();
            }}
            disabled={submitting}
            className="h-10 px-3 text-[#b91c1c] hover:bg-[#fff1f2]"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        ) : null}
      </div>

      {blockedReason ? (
        <p className="mt-4 text-sm leading-7 text-muted-foreground">{blockedReason}</p>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setRating(value)}
                className={`inline-flex h-10 w-10 items-center justify-center rounded-full border transition ${
                  rating >= value
                    ? "border-[#ffd39f] bg-[#fff5e8] text-[#f59e0b]"
                    : "border-border bg-white text-[#9ca3af]"
                }`}
              >
                <Star className={`h-4 w-4 ${rating >= value ? "fill-current" : ""}`} />
              </button>
            ))}
          </div>

          <textarea
            rows={4}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="What stood out about the food, service, or delivery?"
            className="mt-4 w-full resize-none rounded-2xl border border-input bg-white px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15"
          />

          <div className="mt-5 rounded-2xl border border-border bg-[#fafafa] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                  Photos
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Add up to 5 photos with your review.
                </p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-3 py-1 text-xs font-semibold text-muted-foreground">
                <ImageIcon className="h-4 w-4" />
                {imageUrls.length}/5
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {imageUrls.map((url, index) => (
                <div key={`${url}-${index}`} className="space-y-2">
                  <ImageUpload
                    value={url}
                    onChange={(next) => {
                      setImageUrls((current) =>
                        next
                          ? current.map((item, itemIndex) =>
                              itemIndex === index ? next : item,
                            )
                          : current.filter((_, itemIndex) => itemIndex !== index),
                      );
                    }}
                    folderType="restaurant_reviews"
                    clientScope="web"
                    disabled={submitting}
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() =>
                        setImageUrls((current) =>
                          current.filter((_, itemIndex) => itemIndex !== index),
                        )
                      }
                      disabled={submitting}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-white px-3 py-1 text-xs font-semibold text-muted-foreground transition hover:bg-muted/50 disabled:opacity-60"
                    >
                      <X className="h-3.5 w-3.5" />
                      Remove
                    </button>
                  </div>
                </div>
              ))}

              {imageUrls.length < 5 ? (
                <ImageUpload
                  value={null}
                  onChange={(next) => {
                    if (!next) return;
                    setImageUrls((current) => [...current, next]);
                  }}
                  folderType="restaurant_reviews"
                  clientScope="web"
                  disabled={submitting}
                />
              ) : null}
            </div>
          </div>

          {error ? (
            <div className="mt-4 rounded-2xl border border-[#fbcfe8] bg-[#fff1f2] px-4 py-3 text-sm text-[#be123c]">
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="mt-4 rounded-2xl border border-[#d9f99d] bg-[#f7fee7] px-4 py-3 text-sm text-[#3f6212]">
              {success}
            </div>
          ) : null}

          <div className="mt-4 flex justify-end">
            <Button
              type="button"
              onClick={() => {
                void handleSubmit();
              }}
              disabled={submitting}
            >
              {submitting ? "Saving..." : viewerReview ? "Update review" : "Publish review"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
