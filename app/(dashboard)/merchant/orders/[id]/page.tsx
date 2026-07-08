"use client";

import Image from "next/image";
import { MerchantDashboardLayout } from "@/components/merchant/merchant-dashboard-layout";

const ORDER_ITEMS = [
  { id: 45, item: "Enchiladas", qty: 2, options: "Extra Tomato, Extra Pepper", price: "$12" },
  { id: 48, item: "Burrito", qty: 1, options: "-", price: "$8" },
  { id: 89, item: "Chicken", qty: 1, options: "-", price: "$10" },
  { id: 83, item: "Cheese Cake", qty: 2, options: "-", price: "$20" },
];

export default function MerchantEditOrderPage({ params }: { params: { id: string } }) {
  return (
    <MerchantDashboardLayout>
      <div className="mb-6 flex items-center text-[13px] text-[#868e96] font-medium">
        <span className="text-[#e53e4f]">Dashboard</span>
        <span className="mx-2">/</span>
        <span>Edit Order</span>
      </div>

      <div className="bg-white rounded shadow-sm border border-[#e9ecef] overflow-hidden">
        <div className="border-b border-[#e9ecef] px-6 py-5">
          <h2 className="text-[22px] font-medium text-[#495057]">Edit Order ID {params.id}</h2>
        </div>
        
        <div className="p-8">
          <div className="flex justify-between items-start mb-10">
            <div className="flex gap-6">
              <div className="h-16 w-16 rounded-full overflow-hidden shrink-0 border border-gray-200 relative">
                 <Image src="https://images.unsplash.com/photo-1552566626-52f8b828add9?q=80&w=150&auto=format&fit=crop" alt="Restaurant" fill className="object-cover" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="text-[20px] font-bold text-[#495057]">Da Alfredo</h3>
                  <span className="px-2 py-0.5 text-[11px] font-bold rounded-sm text-white bg-[#f5b800]">Pending</span>
                </div>
                
                <div className="grid grid-cols-[120px_1fr] gap-y-2 text-[14px] text-[#868e96]">
                  <div className="font-semibold text-[#495057]">Client</div>
                  <div>Mark Twain</div>
                  
                  <div className="font-semibold text-[#495057]">Date and time</div>
                  <div>5 November 2020 08.30pm</div>
                  
                  <div className="font-semibold text-[#495057]">Address</div>
                  <div>Barda Bonilla 24 apt. 10, 2414 London</div>
                  
                  <div className="font-semibold text-[#495057]">Client Contacts</div>
                  <div className="text-[#e53e4f]">98432983242 - mark@hotmail.com</div>
                  
                  <div className="font-semibold text-[#495057]">Payment</div>
                  <div>Paied via Paypal</div>
                  
                  <div className="font-semibold text-[#495057]">Withdrawal</div>
                  <div>Delivery</div>
                </div>
                
                <button className="mt-6 px-4 py-2 bg-[#e53e4f] text-white rounded text-[14px] font-semibold flex items-center gap-2 hover:bg-[#d63a4a] transition">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                  Edit order detail
                </button>
              </div>
            </div>
            
            <div className="flex gap-2">
              <button className="px-4 py-2 bg-[#e9ecef] text-[#495057] rounded-full text-[13px] font-bold flex items-center gap-1.5 hover:bg-[#dde2e6] transition">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                Send order
              </button>
              <button className="px-4 py-2 bg-[#e9ecef] text-[#495057] rounded-full text-[13px] font-bold flex items-center gap-1.5 hover:bg-[#dde2e6] transition">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                Cancel
              </button>
            </div>
          </div>

          <h3 className="text-[18px] font-semibold text-[#495057] mb-4">Order detail</h3>
          
          <table className="w-full text-left text-[14px] text-[#495057] mb-6">
            <thead>
              <tr className="border-b-2 border-[#dee2e6] font-bold">
                <th className="py-3 px-2">Item ID</th>
                <th className="py-3 px-2">Item</th>
                <th className="py-3 px-2">Quantity</th>
                <th className="py-3 px-2">Options</th>
                <th className="py-3 px-2">Edit</th>
                <th className="py-3 px-2 text-right">Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#dee2e6]">
              {ORDER_ITEMS.map((item, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="py-4 px-2">{item.id}</td>
                  <td className="py-4 px-2">{item.item}</td>
                  <td className="py-4 px-2">{item.qty}</td>
                  <td className="py-4 px-2">{item.options}</td>
                  <td className="py-4 px-2 text-[#e53e4f]">
                    <button className="hover:underline">Edit</button>
                    <span className="mx-1 text-[#868e96]">|</span>
                    <button className="hover:underline">Delete</button>
                  </td>
                  <td className="py-4 px-2 font-bold text-right">{item.price}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-y-2 border-[#dee2e6] font-bold">
                <td className="py-3 px-2">Item ID</td>
                <td className="py-3 px-2">Item</td>
                <td className="py-3 px-2">Quantity</td>
                <td className="py-3 px-2">Options</td>
                <td className="py-3 px-2">Edit</td>
                <td className="py-3 px-2 text-right">Price</td>
              </tr>
            </tfoot>
          </table>

          <div className="flex justify-end mt-8">
            <div className="w-[300px] text-[14px]">
              <div className="flex justify-between py-1 text-[#868e96] font-semibold">
                <span>Subtotal</span>
                <span>$40.00</span>
              </div>
              <div className="flex justify-between py-1 text-[#868e96] font-semibold">
                <span>Delivery Fee</span>
                <span>$7.00</span>
              </div>
              <div className="flex justify-between py-2 text-[20px] font-bold text-[#e53e4f] mt-2 border-t border-[#dee2e6]">
                <span>TOTAL</span>
                <span>$47.00</span>
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </MerchantDashboardLayout>
  );
}
