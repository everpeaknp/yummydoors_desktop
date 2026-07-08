"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Plus, Minus } from "lucide-react";
import { FALLBACK_MENU_ITEM_IMAGE, isUsableImageUrl } from "@/lib/restaurant-media";

type ModifierItem = {
  id: number;
  name: string;
  price_adjustment: number;
  is_available: boolean;
};

type ModifierGroup = {
  id: number;
  name: string;
  is_required: boolean;
  min_selections: number;
  max_selections: number;
  items: ModifierItem[];
};

type MenuItemDetail = {
  id: number;
  name: string;
  description: string | null;
  image_url: string | null;
  price: number;
  modifier_groups?: ModifierGroup[];
};

type MenuItemModalProps = {
  isOpen: boolean;
  onClose: () => void;
  item: MenuItemDetail | null;
  onAddToCart: (itemId: number, quantity: number, modifierIds: number[]) => void;
};

export function MenuItemModal({ isOpen, onClose, item, onAddToCart }: MenuItemModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [selectedModifiers, setSelectedModifiers] = useState<Record<number, number[]>>({});

  // Reset state when a new item is opened
  if (!item) return null;

  const itemImage = isUsableImageUrl(item.image_url) ? item.image_url : FALLBACK_MENU_ITEM_IMAGE;

  const handleModifierToggle = (groupId: number, modifierId: number, maxSelections: number) => {
    setSelectedModifiers((prev) => {
      const currentSelections = prev[groupId] || [];
      if (currentSelections.includes(modifierId)) {
        return {
          ...prev,
          [groupId]: currentSelections.filter((id) => id !== modifierId),
        };
      } else {
        if (maxSelections === 1) {
          // Radio button behavior
          return {
            ...prev,
            [groupId]: [modifierId],
          };
        }
        if (currentSelections.length >= maxSelections) {
          return prev; // Ignore if max reached
        }
        return {
          ...prev,
          [groupId]: [...currentSelections, modifierId],
        };
      }
    });
  };

  const calculateTotalPrice = () => {
    let total = item.price;
    item.modifier_groups?.forEach((group) => {
      const selections = selectedModifiers[group.id] || [];
      group.items.forEach((mod) => {
        if (selections.includes(mod.id)) {
          total += mod.price_adjustment;
        }
      });
    });
    return total * quantity;
  };

  const handleAddToCart = () => {
    // Validate required groups
    let isValid = true;
    item.modifier_groups?.forEach((group) => {
      const selections = selectedModifiers[group.id] || [];
      if (group.is_required && selections.length < group.min_selections) {
        isValid = false;
      }
    });

    if (!isValid) {
      alert("Please select required options before adding to cart.");
      return;
    }

    const allSelectedModifierIds = Object.values(selectedModifiers).flat();
    onAddToCart(item.id, quantity, allSelectedModifierIds);
    onClose();
    // Reset state after add
    setQuantity(1);
    setSelectedModifiers({});
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={item.name}>
      <div className="flex flex-col bg-white">
        <div className="p-6 pb-2">
          <h5 className="font-semibold text-[#111] mb-3">Quantity</h5>
          <div className="flex w-full items-center justify-between rounded border border-gray-300 px-4 py-2">
            <button
              className="text-gray-400 hover:text-gray-900 focus:outline-none"
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              disabled={quantity <= 1}
            >
              <Minus className="h-5 w-5" strokeWidth={1.5} />
            </button>
            <span className="font-semibold text-[#111]">{quantity}</span>
            <button
              className="text-gray-400 hover:text-gray-900 focus:outline-none"
              onClick={() => setQuantity(quantity + 1)}
            >
              <Plus className="h-5 w-5" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Modifier Groups */}
        {item.modifier_groups && item.modifier_groups.length > 0 && (
          <div className="border-t border-gray-100 bg-white px-6 py-4">
            {item.modifier_groups.map((group) => {
              const isRadio = group.max_selections === 1;
              const selections = selectedModifiers[group.id] || [];
              
              return (
                <div key={group.id} className="mb-6 last:mb-0">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-bold text-[#111]">{group.name}</h3>
                    {group.is_required && (
                      <span className="rounded bg-orange-100 px-2 py-1 text-[11px] font-bold text-orange-700">
                        Required
                      </span>
                    )}
                  </div>
                  <div className="space-y-3">
                    {group.items.map((mod) => {
                      const isSelected = selections.includes(mod.id);
                      return (
                        <label
                          key={mod.id}
                          className="flex cursor-pointer items-center justify-between py-2 group"
                        >
                          <div className="flex items-center gap-3">
                            {isRadio ? (
                              <div className="relative flex h-5 w-5 items-center justify-center">
                                <input
                                  type="radio"
                                  name={`group-${group.id}`}
                                  checked={isSelected}
                                  onChange={() => handleModifierToggle(group.id, mod.id, group.max_selections)}
                                  className="peer sr-only"
                                />
                                <div className="h-5 w-5 rounded-full border-[2px] border-gray-300 peer-checked:border-[#e8505b]"></div>
                                <div className="absolute h-2.5 w-2.5 rounded-full bg-[#e8505b] opacity-0 peer-checked:opacity-100 transition-opacity"></div>
                              </div>
                            ) : (
                              <div className="relative flex h-5 w-5 items-center justify-center">
                                <input
                                  type="checkbox"
                                  name={`group-${group.id}`}
                                  checked={isSelected}
                                  onChange={() => handleModifierToggle(group.id, mod.id, group.max_selections)}
                                  className="peer sr-only"
                                />
                                <div className="h-5 w-5 rounded-[3px] border-[2px] border-gray-300 peer-checked:bg-[#e8505b] peer-checked:border-[#e8505b] transition-colors"></div>
                                <svg className="absolute h-3.5 w-3.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              </div>
                            )}
                            <span className="text-[15px] text-[#444] group-hover:text-[#111]">{mod.name}</span>
                          </div>
                          {mod.price_adjustment > 0 && (
                            <span className="text-[14px] text-gray-500">+ ${mod.price_adjustment.toFixed(2)}</span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer Actions */}
        <div className="bg-[#f8f8f8] p-5 flex items-center gap-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="flex-1 h-[44px] rounded-[3px] border-2 border-[#111] bg-white font-bold text-[#111] transition hover:bg-gray-50"
          >
            Cancel
          </button>
          
          <button
            onClick={handleAddToCart}
            className="flex-1 h-[44px] rounded-[3px] bg-[#e8505b] font-bold text-white transition hover:bg-[#d6414c]"
          >
            Add to cart
          </button>
        </div>
      </div>
    </Modal>
  );
}
