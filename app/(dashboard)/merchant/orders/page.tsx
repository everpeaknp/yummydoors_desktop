"use client";

import Link from "next/link";
import { MerchantDashboardLayout } from "@/components/merchant/merchant-dashboard-layout";
import { ChevronLeft, ChevronRight } from "lucide-react";

const ORDERS_MOCK = [
  { id: 1, restaurant: "Bella Napoli", user: "Lukas Schulz", date: "24/05/2020", status: "Pending" },
  { id: 13, restaurant: "Da Alfredo", user: "Jhon Doe", date: "24/05/2020", status: "Cancelled" },
  { id: 14, restaurant: "Taxo Mex", user: "Valeria Felice", date: "24/05/2020", status: "Processed" },
  { id: 15, restaurant: "Bella Napoli", user: "Lukas Schulz", date: "24/05/2020", status: "Pending" },
  { id: 16, restaurant: "Da Alfredo", user: "Jhon Doe", date: "24/05/2020", status: "Processed" },
];

export default function MerchantOrdersPage() {
  return (
    <MerchantDashboardLayout>
      <div className="mb-6 flex items-center text-[13px] text-[#868e96] font-medium">
        <span className="text-[#e53e4f]">Dashboard</span>
        <span className="mx-2">/</span>
        <span>Orders</span>
      </div>

      <div className="bg-white rounded shadow-sm border border-[#e9ecef] overflow-hidden">
        <div className="border-b border-[#e9ecef] px-6 py-4 flex items-center gap-2 text-[#495057]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7"></rect>
            <rect x="14" y="3" width="7" height="7"></rect>
            <rect x="14" y="14" width="7" height="7"></rect>
            <rect x="3" y="14" width="7" height="7"></rect>
          </svg>
          <h2 className="text-[16px] font-semibold">Orders Table Example</h2>
        </div>
        
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center text-[14px] text-[#495057]">
              Show 
              <select className="mx-2 border border-[#ced4da] rounded px-2 py-1 outline-none focus:border-[#86b7fe]">
                <option>10</option>
                <option>25</option>
                <option>50</option>
              </select> 
              entries
            </div>
            <div className="flex items-center text-[14px] text-[#495057]">
              Search:
              <input type="text" className="ml-2 border border-[#ced4da] rounded px-3 py-1 outline-none focus:border-[#86b7fe] w-[200px]" />
            </div>
          </div>

          <table className="w-full text-left text-[14px] text-[#495057]">
            <thead>
              <tr className="border-b-2 border-[#dee2e6]">
                <th className="py-3 px-2 font-bold cursor-pointer group hover:text-[#212529]">
                  <div className="flex items-center justify-between">
                    ID
                    <div className="flex flex-col text-[8px] opacity-30 group-hover:opacity-100">
                      <span>▲</span><span>▼</span>
                    </div>
                  </div>
                </th>
                <th className="py-3 px-2 font-bold cursor-pointer group hover:text-[#212529]">
                  <div className="flex items-center justify-between">
                    Restaurant
                    <div className="flex flex-col text-[8px] opacity-30 group-hover:opacity-100">
                      <span>▲</span><span>▼</span>
                    </div>
                  </div>
                </th>
                <th className="py-3 px-2 font-bold cursor-pointer group hover:text-[#212529]">
                  <div className="flex items-center justify-between">
                    User
                    <div className="flex flex-col text-[8px] opacity-30 group-hover:opacity-100">
                      <span>▲</span><span>▼</span>
                    </div>
                  </div>
                </th>
                <th className="py-3 px-2 font-bold cursor-pointer group hover:text-[#212529]">
                  <div className="flex items-center justify-between">
                    Date
                    <div className="flex flex-col text-[8px] opacity-30 group-hover:opacity-100">
                      <span>▲</span><span>▼</span>
                    </div>
                  </div>
                </th>
                <th className="py-3 px-2 font-bold cursor-pointer group hover:text-[#212529]">
                  <div className="flex items-center justify-between">
                    Status
                    <div className="flex flex-col text-[8px] opacity-30 group-hover:opacity-100">
                      <span>▲</span><span>▼</span>
                    </div>
                  </div>
                </th>
                <th className="py-3 px-2 font-bold cursor-pointer group hover:text-[#212529]">
                  <div className="flex items-center justify-between">
                    Edit
                    <div className="flex flex-col text-[8px] opacity-30 group-hover:opacity-100">
                      <span>▲</span><span>▼</span>
                    </div>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#dee2e6]">
              {ORDERS_MOCK.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="py-4 px-2">{order.id}</td>
                  <td className="py-4 px-2">{order.restaurant}</td>
                  <td className="py-4 px-2">{order.user}</td>
                  <td className="py-4 px-2">{order.date}</td>
                  <td className="py-4 px-2">
                    <span 
                      className={`px-3 py-1 text-[12px] font-semibold rounded-[4px] text-white ${
                        order.status === "Pending" ? "bg-[#f5b800]" : 
                        order.status === "Cancelled" ? "bg-[#e53e4f]" : "bg-[#28a745]"
                      }`}
                    >
                      {order.status}
                    </span>
                  </td>
                  <td className="py-4 px-2 text-[#e53e4f]">
                    <Link href={`/merchant/orders/${order.id}`} className="hover:underline">Edit</Link>
                    <span className="mx-1 text-[#868e96]">|</span>
                    <button className="hover:underline">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-y-2 border-[#dee2e6] font-bold">
                <td className="py-3 px-2">ID</td>
                <td className="py-3 px-2">Restaurant</td>
                <td className="py-3 px-2">User</td>
                <td className="py-3 px-2">Date</td>
                <td className="py-3 px-2">Status</td>
                <td className="py-3 px-2">Edit</td>
              </tr>
            </tfoot>
          </table>
          
          <div className="flex justify-between items-center mt-6 text-[14px] text-[#495057]">
            <div>Showing 1 to 5 of 5 entries</div>
            <div className="flex border border-[#ced4da] rounded overflow-hidden">
              <button className="px-3 py-1.5 hover:bg-gray-100 border-r border-[#ced4da]">Previous</button>
              <button className="px-3 py-1.5 bg-[#e53e4f] text-white">1</button>
              <button className="px-3 py-1.5 hover:bg-gray-100 border-l border-[#ced4da]">Next</button>
            </div>
          </div>
        </div>
      </div>
    </MerchantDashboardLayout>
  );
}
