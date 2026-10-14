"use client";

import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { apiCall } from "../../lib/staff-api";
import type { CustomerSummary } from "../customers/types";

let cachedCustomerList: CustomerSummary[] | null = null;

interface CustomerSelectModalProps {
  isOpen: boolean;
  selectedIds: string[];
  onClose: () => void;
  onConfirm: (selectedIds: string[], selectedCustomers?: CustomerSummary[]) => void;
}

export default function CustomerSelectModal({
  isOpen,
  selectedIds,
  onClose,
  onConfirm,
}: CustomerSelectModalProps) {
  const [mounted, setMounted] = useState(false);
  const [customers, setCustomers] = useState<CustomerSummary[]>(cachedCustomerList || []);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [currentSelected, setCurrentSelected] = useState<string[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setCurrentSelected([...selectedIds]);
      setSearch("");
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";

      // If cached, display instantly with 0ms loading lag
      if (cachedCustomerList && cachedCustomerList.length > 0) {
        setCustomers(cachedCustomerList);
        setLoading(false);
      } else {
        setLoading(true);
      }

      // Revalidate in background to keep data fresh
      apiCall<any>("/admin/customers")
        .then((res) => {
          if (res.ok && res.data) {
            const list: CustomerSummary[] = Array.isArray(res.data)
              ? res.data
              : Array.isArray(res.data.customers)
              ? res.data.customers
              : Array.isArray((res as any).customers)
              ? (res as any).customers
              : [];
            cachedCustomerList = list;
            setCustomers(list);
          }
        })
        .finally(() => setLoading(false));

      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen, selectedIds]);

  const filteredCustomers = useMemo(() => {
    const list = Array.isArray(customers) ? customers : [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (c) =>
        c?.fullName?.toLowerCase().includes(q) ||
        c?.email?.toLowerCase().includes(q) ||
        c?.phone?.toLowerCase().includes(q)
    );
  }, [customers, search]);

  if (!isOpen || !mounted) return null;

  const toggleSelect = (id: string) => {
    setCurrentSelected((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (currentSelected.length === filteredCustomers.length) {
      setCurrentSelected([]);
    } else {
      setCurrentSelected(filteredCustomers.map((c) => c.id));
    }
  };

  const handleApply = () => {
    const selectedCustomers = customers.filter((c) => currentSelected.includes(c.id));
    onConfirm(currentSelected, selectedCustomers);
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity animate-in fade-in"
        onClick={onClose}
      />

      <div className="relative w-full max-w-2xl bg-white dark:bg-[#181818] rounded-2xl shadow-2xl border border-gray-200 dark:border-[#2C2C2C] flex flex-col max-h-[85vh] z-10 overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 dark:border-[#262626] flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">
              Target Specific Customers
            </h2>
            <p className="text-xs text-gray-500 dark:text-[#8E8E8E] mt-0.5">
              Select one or more customer accounts eligible to redeem this promo code
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-[#222222] border border-gray-200 dark:border-[#333333] flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search & Actions Bar */}
        <div className="p-4 border-b border-gray-100 dark:border-[#262626] bg-gray-50/50 dark:bg-[#141414]/50 flex items-center justify-between gap-3">
          <div className="relative flex-1">
            <svg
              className="absolute left-3 top-2.5 w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search customers by name, email, or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#1E1E1E] text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-[#EDCF5D]"
            />
          </div>

          <button
            type="button"
            onClick={toggleSelectAll}
            className="px-3 py-2 text-xs font-semibold rounded-xl border border-gray-200 dark:border-[#2A2A2A] hover:bg-white dark:hover:bg-[#222] text-gray-700 dark:text-gray-300 transition-colors cursor-pointer"
          >
            {currentSelected.length === filteredCustomers.length && filteredCustomers.length > 0
              ? "Deselect All"
              : "Select All"}
          </button>
        </div>

        {/* Customer List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 divide-y divide-gray-100 dark:divide-[#222222]">
          {loading ? (
            <div className="py-12 text-center text-xs text-gray-400">Loading customers...</div>
          ) : filteredCustomers.length === 0 ? (
            <div className="py-12 text-center text-xs text-gray-400">
              No matching customers found
            </div>
          ) : (
            filteredCustomers.map((cust) => {
              const isSelected = currentSelected.includes(cust.id);
              return (
                <div
                  key={cust.id}
                  onClick={() => toggleSelect(cust.id)}
                  className={`pt-2 flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-amber-500/10 border border-amber-500/30"
                      : "hover:bg-gray-50 dark:hover:bg-[#1E1E1E]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="w-4 h-4 rounded text-black accent-[#EDCF5D] cursor-pointer"
                    />
                    <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-[#2A2A2A] flex items-center justify-center font-bold text-xs text-gray-700 dark:text-gray-300">
                      {(cust.fullName || cust.email || "C").charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-gray-900 dark:text-white">
                        {cust.fullName || "Unnamed Customer"}
                      </div>
                      <div className="text-[11px] text-gray-500 dark:text-gray-400">
                        {cust.email} {cust.phone ? `• ${cust.phone}` : ""}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                      !cust.isDisabled && !cust.deletedAt
                        ? "bg-emerald-500/10 text-emerald-500"
                        : "bg-red-500/10 text-red-500"
                    }`}>
                      {cust.deletedAt ? "Deleted" : cust.isDisabled ? "Disabled" : "Active"}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-[#262626] bg-gray-50/50 dark:bg-[#141414]/50 flex items-center justify-between">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            <strong className="text-gray-900 dark:text-white">{currentSelected.length}</strong> customer{currentSelected.length === 1 ? "" : "s"} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-gray-200 dark:border-[#2C2C2C] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#222] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="px-5 py-2 text-xs font-bold rounded-xl bg-[#010101] text-white dark:bg-[#EDCF5D] dark:text-[#121316] hover:bg-[#EDCF5D] hover:text-[#010101] dark:hover:bg-white transition-all shadow-md cursor-pointer"
            >
              Apply Selection ({currentSelected.length})
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
