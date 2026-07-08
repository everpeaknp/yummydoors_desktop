"use client";

import { MinusCircle, Calendar, Clock } from "lucide-react";
type OrderItem = {
  cartItemId: string; // temporary id for UI
  menu_item_id: number;
  name: string;
  price: number;
  quantity: number;
  modifier_ids: number[];
};

type PricingBreakdown = {
  items_total: number;
  delivery_fee: number;
  coupon_discount: number;
  subtotal_amount: number;
  total_amount: number;
};

type OrderSummaryPanelProps = {
  restaurantId: number;
  items: OrderItem[];
  pricing: PricingBreakdown | null;
  onRemoveItem: (cartItemId: string) => void;
  onCheckout: () => void;
  isCalculating: boolean;
};

export function OrderSummaryPanel({
  restaurantId,
  items,
  pricing,
  onRemoveItem,
  onCheckout,
  isCalculating,
}: OrderSummaryPanelProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-[4px] border border-gray-100 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-[16px] font-bold text-[#111]">Order Summary</h3>
        <p className="text-sm text-gray-500">Your cart is empty.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-[3px] shadow-sm mb-5">
      <div className="bg-[#444444] px-5 py-[18px] flex justify-between items-center text-center">
        <h3 className="text-[18px] font-bold text-white m-0 leading-none w-full text-center">Order Summary</h3>
      </div>
      
      <div className="px-5 py-5">
        <ul className="mb-4 max-h-[300px] overflow-y-auto no-scrollbar space-y-3">
          {items.map((item) => (
            <li key={item.cartItemId} className="flex justify-between items-start text-[14px] text-[#444] font-medium pb-1">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onRemoveItem(item.cartItemId)}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                >
                  <MinusCircle className="h-4 w-4 font-light" strokeWidth={1.5} />
                </button>
                <span className="text-[#444]">{item.quantity}x {item.name}</span>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="font-bold text-[#111]">${item.price}</span>
              </div>
            </li>
          ))}
        </ul>

        {pricing && (
          <ul className="border-t border-gray-200 pt-4 space-y-3 opacity-100 transition-opacity" style={{ opacity: isCalculating ? 0.5 : 1 }}>
            <li className="flex justify-between text-[14px] font-medium text-[#444]">
              <span>Subtotal</span>
              <span>${pricing.items_total}</span>
            </li>
            {pricing.coupon_discount > 0 && (
              <li className="flex justify-between text-[14px] font-medium text-[#e8505b]">
                <span>Discount</span>
                <span>-${pricing.coupon_discount}</span>
              </li>
            )}
            <li className="flex justify-between text-[14px] font-medium text-[#444]">
              <span>Delivery fee</span>
              <span>${pricing.delivery_fee}</span>
            </li>
            <li className="flex justify-between text-[16px] font-bold text-[#111] pt-2">
              <span className="uppercase">Total</span>
              <span>${pricing.total_amount}</span>
            </li>
          </ul>
        )}

        <div className="mt-6 border-t border-gray-200 pt-5">
          <div className="flex items-center justify-between mb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" value="delivery" name="opt_order" className="peer sr-only" defaultChecked />
              <div className="h-[18px] w-[18px] rounded-full border-[2px] border-gray-300 flex items-center justify-center peer-checked:border-[#e8505b]">
                <div className="h-[8px] w-[8px] rounded-full bg-[#e8505b] opacity-0 peer-checked:opacity-100 transition-opacity"></div>
              </div>
              <span className="text-[14px] text-[#444]">Delivery</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" value="takeaway" name="opt_order" className="peer sr-only" />
              <div className="h-[18px] w-[18px] rounded-full border-[2px] border-gray-300 flex items-center justify-center peer-checked:border-[#e8505b]">
                <div className="h-[8px] w-[8px] rounded-full bg-[#e8505b] opacity-0 peer-checked:opacity-100 transition-opacity"></div>
              </div>
              <span className="text-[14px] text-[#444]">Take away</span>
            </label>
          </div>

          <div className="space-y-3 mb-6">
            <div className="relative border border-gray-200 rounded-[3px]">
              <select className="w-full appearance-none bg-transparent py-2.5 px-3 text-[14px] text-[#444] outline-none">
                <option>Day</option>
                <option>Today</option>
                <option>Tomorrow</option>
              </select>
              <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
            </div>
            <div className="relative border border-gray-200 rounded-[3px]">
              <select className="w-full appearance-none bg-transparent py-2.5 px-3 text-[14px] text-[#444] outline-none">
                <option>Time</option>
                <option>Lunch</option>
                <option>Dinner</option>
              </select>
              <Clock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
            </div>
          </div>

          <button
            onClick={onCheckout}
            disabled={isCalculating || items.length === 0}
            className="w-full rounded-[3px] bg-[#e8505b] py-[12px] text-[14px] font-bold text-white transition hover:bg-[#d6414c] disabled:opacity-50"
          >
            {isCalculating ? "Calculating..." : "Order Now"}
          </button>
          <div className="text-center mt-2">
            <small className="text-[12px] text-gray-500">No money charged on this steps</small>
          </div>
        </div>
      </div>
    </div>
  );
}
