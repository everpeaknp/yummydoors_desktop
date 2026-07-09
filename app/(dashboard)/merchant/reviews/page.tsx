"use client";

import { useCallback, useEffect, useState } from "react";
import { Star } from "lucide-react";
import { MerchantDashboardLayout } from "@/components/merchant/merchant-dashboard-layout";
import { apiFetch } from "@/lib/http";

type Review = {
  id: number;
  user_id: number;
  reviewer_name: string;
  rating: number;
  content: string | null;
  merchant_reply: string | null;
  created_at: string;
};

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`h-4 w-4 ${s <= rating ? "fill-[#f5b800] text-[#f5b800]" : "text-gray-200"}`}
          strokeWidth={1.5}
        />
      ))}
    </div>
  );
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function MerchantReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyingId, setReplyingId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadReviews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/reviews/merchant/me", { auth: true });
      if (!res.ok) throw new Error("Failed to load reviews");
      const data: Review[] = await res.json();
      setReviews(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  const submitReply = async (reviewId: number) => {
    if (!replyText.trim()) return;
    setSubmitting(true);
    try {
      const res = await apiFetch(`/reviews/merchant/${reviewId}/reply`, {
        method: "POST",
        auth: true,
        body: JSON.stringify({ reply: replyText.trim() }),
      });
      if (!res.ok) throw new Error("Failed to submit reply");
      const updated: Review = await res.json();
      setReviews((prev) => prev.map((r) => (r.id === reviewId ? updated : r)));
      setReplyingId(null);
      setReplyText("");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Reply failed");
    } finally {
      setSubmitting(false);
    }
  };

  const avgRating =
    reviews.length > 0
      ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
      : "—";

  return (
    <MerchantDashboardLayout>
      <div className="mb-6 flex items-center text-[13px] text-[#868e96] font-medium">
        <span className="text-[#e53e4f]">Dashboard</span>
        <span className="mx-2">/</span>
        <span>Reviews</span>
      </div>

      {/* Summary bar */}
      <div className="mb-6 bg-white rounded shadow-sm border border-[#e9ecef] px-6 py-4 flex items-center gap-6">
        <div className="text-center">
          <div className="text-[32px] font-bold text-[#212529]">{avgRating}</div>
          <div className="text-[12px] text-[#868e96]">Average Rating</div>
          {reviews.length > 0 && (
            <StarRating rating={Math.round(parseFloat(avgRating))} />
          )}
        </div>
        <div className="h-12 border-l border-[#e9ecef]" />
        <div className="text-center">
          <div className="text-[32px] font-bold text-[#212529]">{reviews.length}</div>
          <div className="text-[12px] text-[#868e96]">Total Reviews</div>
        </div>
        <div className="h-12 border-l border-[#e9ecef]" />
        <div className="text-center">
          <div className="text-[32px] font-bold text-[#212529]">
            {reviews.filter((r) => r.merchant_reply).length}
          </div>
          <div className="text-[12px] text-[#868e96]">Replied</div>
        </div>
      </div>

      <div className="bg-white rounded shadow-sm border border-[#e9ecef] overflow-hidden">
        <div className="border-b border-[#e9ecef] px-6 py-4 flex items-center justify-between">
          <h2 className="text-[16px] font-semibold text-[#495057]">Customer Reviews</h2>
          <button onClick={loadReviews} className="text-[13px] text-[#e53e4f] hover:underline">
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="py-16 text-center text-[#868e96] text-[14px]">Loading reviews…</div>
        ) : error ? (
          <div className="py-16 text-center text-[#e53e4f] text-[14px]">{error}</div>
        ) : reviews.length === 0 ? (
          <div className="py-16 text-center text-[#868e96] text-[14px]">No reviews yet.</div>
        ) : (
          <div className="divide-y divide-[#e9ecef]">
            {reviews.map((review) => (
              <div key={review.id} className="p-6">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-[15px] text-[#212529]">
                        {review.reviewer_name}
                      </span>
                      <StarRating rating={review.rating} />
                    </div>
                    <span className="text-[12px] text-[#868e96]">{formatDate(review.created_at)}</span>
                  </div>
                  {!review.merchant_reply && replyingId !== review.id && (
                    <button
                      onClick={() => {
                        setReplyingId(review.id);
                        setReplyText("");
                      }}
                      className="text-[13px] text-[#0d84ff] hover:underline"
                    >
                      Reply
                    </button>
                  )}
                </div>

                {review.content && (
                  <p className="text-[14px] text-[#495057] leading-relaxed mt-2">{review.content}</p>
                )}

                {/* Merchant reply */}
                {review.merchant_reply && (
                  <div className="mt-4 ml-4 border-l-2 border-[#e53e4f] pl-4 bg-[#fff5f6] rounded-r py-2 pr-3">
                    <div className="text-[12px] font-semibold text-[#e53e4f] mb-1">Your reply</div>
                    <p className="text-[13px] text-[#495057] leading-relaxed">{review.merchant_reply}</p>
                  </div>
                )}

                {/* Reply input */}
                {replyingId === review.id && (
                  <div className="mt-4 ml-4 border-l-2 border-[#ced4da] pl-4">
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      rows={3}
                      placeholder="Write your reply…"
                      className="w-full border border-[#ced4da] rounded px-3 py-2 text-[13px] outline-none focus:border-[#e53e4f] resize-none"
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => submitReply(review.id)}
                        disabled={submitting || !replyText.trim()}
                        className="px-4 py-1.5 bg-[#e53e4f] text-white text-[13px] font-semibold rounded disabled:opacity-50 hover:bg-[#c62a3a] transition"
                      >
                        {submitting ? "Posting…" : "Post Reply"}
                      </button>
                      <button
                        onClick={() => setReplyingId(null)}
                        className="px-4 py-1.5 text-[13px] text-[#868e96] hover:text-[#495057]"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </MerchantDashboardLayout>
  );
}
