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
  children?: React.ReactNode;
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
  children,
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
    try {
      const response = await apiFetch(buildPath(entityType, entityId), {
        method: active ? "DELETE" : "POST",
        auth: true,
      });
      const payload = await readJsonSafely(response);
      if (!response.ok) {
        setError(
          extractApiErrorMessage(
            payload,
            active ? "Failed to remove favorite." : "Failed to save favorite.",
          ),
        );
        return;
      }
      onChange(!active);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "";
      setError(
        message === "Failed to fetch"
          ? "Could not reach the YummyDoors API. Check backend deployment or CORS."
          : message
            ? message
          : active
            ? "Failed to remove favorite."
            : "Failed to save favorite.",
      );
    } finally {
      setLoading(false);
    }
  }

  const buttonContent = (
    <Button
      type="button"
      variant="secondary"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void handleToggle();
      }}
      disabled={loading}
      className={className}
      title={active ? "Remove from wishlist" : "Save to wishlist"}
    >
      {children ? (
        children
      ) : (
        <>
          <Heart className={`h-4 w-4 ${active ? "fill-current text-[#e8505b]" : "text-[#6b7280]"}`} />
          {!compact ? (
            <span className={active ? "text-[#e8505b]" : "text-[#4b5563]"}>
              {loading ? "Saving..." : active ? "Saved" : "Save"}
            </span>
          ) : null}
        </>
      )}
    </Button>
  );

  if (compact) {
    return buttonContent;
  }

  return (
    <div className="flex flex-col items-start gap-2">
      {buttonContent}
      {error ? <p className="text-xs text-[#be123c]">{error}</p> : null}
    </div>
  );
}
