"use client";

import { Flame, Heart } from "lucide-react";
import { FavoriteToggleButton } from "@/components/customer/favorite-toggle-button";
import {
  FALLBACK_MENU_ITEM_IMAGE,
  isUsableImageUrl,
} from "@/lib/restaurant-media";

type MenuCardProps = {
  item: any;
  restaurantId: number;
  index?: number;
  onClick: () => void;
  onFavoriteChange: (id: number, next: boolean) => void;
};

export function MenuCard({
  item,
  restaurantId,
  index,
  onClick,
  onFavoriteChange,
}: MenuCardProps) {
  const itemImage = isUsableImageUrl(item.image_url)
    ? item.image_url
    : FALLBACK_MENU_ITEM_IMAGE;

  return (
    <div className="relative group flex min-h-[100px] w-full rounded border border-gray-100 bg-white shadow-sm transition hover:shadow-md">
      {/* Floating Wishlist Button */}
      <div className="absolute -right-2 -top-2 z-10">
        <FavoriteToggleButton
          entityType="menu-item"
          entityId={item.id}
          active={item.is_favorited}
          onChange={(next) => onFavoriteChange(item.id, next)}
          className="!flex !h-8 !w-8 !min-h-[32px] !min-w-[32px] items-center justify-center !rounded-full border border-gray-200 !bg-white !p-0 shadow-md transition hover:border-[#e8505b] hover:!bg-[#fff0f0] group/fav"
          compact
        >
          <Heart
            className={`h-4 w-4 transition ${
              item.is_favorited
                ? "fill-[#e8505b] text-[#e8505b]"
                : "fill-transparent text-[#555] group-hover/fav:text-[#e8505b]"
            }`}
            strokeWidth={1.5}
          />
        </FavoriteToggleButton>
      </div>

      <div
        className="flex flex-1 cursor-pointer items-stretch justify-between"
        onClick={onClick}
      >
        <div className="flex flex-1 flex-col justify-center p-4 pr-3">
          <div className="flex items-center gap-2 mb-1">
            <h3
              className="text-[16px] font-medium text-[#222]"
              style={{ fontFamily: "Poppins, Helvetica, sans-serif" }}
            >
              {index !== undefined ? `${index + 1}. ` : ""}
              {item.name}
            </h3>
            {item.is_spicy ? (
              <Flame className="h-3.5 w-3.5 text-red-500" />
            ) : null}
          </div>
          <p
            className="line-clamp-2 text-[13px] font-normal text-[#777] mb-[10px]"
            style={{
              fontFamily: "Poppins, Helvetica, sans-serif",
              lineHeight: "19.5px",
            }}
          >
            {item.description ?? "Freshly prepared and ready to order."}
          </p>
          <div className="mt-auto">
            <p
              className="text-[15px] font-medium text-[#222]"
              style={{ fontFamily: "Poppins, Helvetica, sans-serif" }}
            >
              ${item.price.toFixed(2)}
            </p>
          </div>
        </div>

        <div className="h-full min-h-[100px] w-[100px] shrink-0 overflow-hidden rounded-r border-l border-gray-100 bg-gray-100">
          <div
            className="h-full w-full bg-cover bg-center"
            style={{ backgroundImage: `url(${itemImage})` }}
          />
        </div>
      </div>
    </div>
  );
}
