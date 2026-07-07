"use client";

import { useState } from "react";
import { Heart } from "lucide-react";

import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/http";
import { extractApiErrorMessage, readJsonSafely } from "@/lib/api-utils";
import { useAuth } from "@/hooks/use-auth";

type FavoriteEntityType = "restaurant" | "menu-item";

type FavoriteToggleButtonProps = {
  entityType: FavoriteEntityType;
  entityId: number;
  active: boolean;
  onChange: (next: boolean) => void;
  className?: string;
  compact?: boolean;
};

function buildPath(entityType: FavoriteEntityType, entityId: number) {
  if (entityType === "restaurant") {
    return `/favorites/restaurants/${entityId}`;
  }
  return `/favorites/menu-items/${entityId}`;
}

export function FavoriteToggleButton({
  entityType,
  entityId,
  active,
  onChange,
  className,
  compact = false,
}: FavoriteToggleButtonProps) {
  const { accessToken } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleToggle() {
    if (!accessToken) {
      window.location.href = "/login";
      return;
    }

    setLoading(true);
    setError(null);
    const response = await apiFetch(buildPath(entityType, entityId), {
      method: active ? "DELETE" : "POST",
      auth: true,
    });
    const payload = await readJsonSafely(response);
    if (!response.ok) {
      setLoading(false);
      setError(
        extractApiErrorMessage(
          payload,
          active ? "Failed to remove favorite." : "Failed to save favorite.",
        ),
      );
      return;
    }
    setLoading(false);
    onChange(!active);
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        type="button"
        variant="secondary"
        onClick={() => {
          void handleToggle();
        }}
        disabled={loading}
        className={className}
        title={active ? "Remove from wishlist" : "Save to wishlist"}
      >
        <Heart className={`h-4 w-4 ${active ? "fill-current text-primary" : "text-[#6b7280]"}`} />
        {!compact ? (
          <span className={active ? "text-primary" : "text-[#4b5563]"}>
            {loading ? "Saving..." : active ? "Saved" : "Save"}
          </span>
        ) : null}
      </Button>
      {error && !compact ? <p className="text-xs text-[#be123c]">{error}</p> : null}
    </div>
  );
}
