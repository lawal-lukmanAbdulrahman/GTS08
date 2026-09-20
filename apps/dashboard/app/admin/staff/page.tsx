"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminTopStrip } from "../sidebar-context";
import type { NewStaffInput } from "@gts/utils";
import { apiCall } from "../../lib/staff-api";
import { useStaffSession } from "../../lib/use-staff-session";
import { filterStaff, paginate } from "./staff-filter";
import AddStaffForm, { type CreateResult, type CreatedStaff } from "./add-staff-form";

interface StaffMember {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_blocked: boolean;
  permissions?: {
    can_process_pos: boolean;
    can_manage_inventory: boolean;
    can_view_all_orders: boolean;
    can_manage_products: boolean;
    can_handle_tickets: boolean;
  };
}

export default function AdminStaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "blocked">("all");
  const [page, setPage] = useState(1);
  const { profile } = useStaffSession();

  useEffect(() => {
    fetchStaff();
  }, []);

  const filtered = filterStaff(staff, { query, role: roleFilter, status: statusFilter });
  const paged = paginate(filtered, page, 10);

  async function createStaff(input: NewStaffInput, options: { emailCredentials: boolean }): Promise<CreateResult> {
    const result = await apiCall<CreatedStaff>("/users/staff", {
      method: "POST",
      json: { ...input, email_credentials: options.emailCredentials },
    });
    if (result.ok) return { ok: true, data: result.data };
    return { ok: false, message: result.message, errors: result.details };
  }

  const fetchStaff = async () => {
    setLoading(true);
    setError(null);
    const result = await apiCall<StaffMember[]>("/users/staff");
    if (result.ok) setStaff(result.data || []);
    else setError(result.message);
    setLoading(false);
  };

  return (
    <div className="px-4 pt-3.5 pb-6 sm:px-6 lg:px-8 lg:pt-3.5 space-y-6 max-w-[1600px] mx-auto font-sans">
      <AdminTopStrip
        breadcrumbs={[
          { label: "Staff", href: "/admin/staff" },
          { label: "Permissions" },
        ]}
      />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 dark:border-[#262626] pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Staff & Permissions</h1>
          <p className="text-xs text-gray-500 dark:text-[#9CA3AF] mt-0.5 font-mono">Manage staff roles, access levels, and granular permission flags</p>
        </div>
        {profile?.is_super_admin && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="px-4 py-2.5 text-sm font-bold rounded-[8px] bg-[#EDCF5D] text-[#010101] self-start md:self-auto"
          >
            + Add staff member
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          placeholder="Search by name or email"
          aria-label="Search staff"
          className="flex-1 min-w-[200px] px-3 py-2 text-sm rounded-[8px] border border-gray-200 dark:border-[#383838] bg-transparent"
        />
        <select
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value);
            setPage(1);
          }}
          aria-label="Filter by role"
          className="px-3 py-2 text-sm rounded-[8px] border border-gray-200 dark:border-[#383838] bg-transparent"
        >
          <option value="all">All roles</option>
          <option value="admin">Admin</option>
          <option value="cashier">Cashier</option>
          <option value="inventory_staff">Inventory staff</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as "all" | "active" | "blocked");
            setPage(1);
          }}
          aria-label="Filter by status"
          className="px-3 py-2 text-sm rounded-[8px] border border-gray-200 dark:border-[#383838] bg-transparent"
        >
          <option value="all">Any status</option>
          <option value="active">Active</option>
          <option value="blocked">Blocked</option>
        </select>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-100 dark:bg-[#1C1E22] rounded-xl border border-gray-200 dark:border-[#2A2C32]" />
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-[#1C1E22] rounded-2xl border border-gray-200 dark:border-[#2A2C32] overflow-hidden shadow-2xs">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-200 dark:border-[#2A2C32] bg-gray-50 dark:bg-[#16171A] text-gray-500 dark:text-[#6B7280] font-semibold uppercase text-[10px]">
                <th className="p-4">Staff Member</th>
                <th className="p-4">Role</th>
                <th className="p-4">POS Access</th>
                <th className="p-4">Inventory Access</th>
                <th className="p-4">Order Access</th>
                <th className="p-4">Products Access</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Record</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-[#2A2C32]/60">
              {paged.total === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-400 dark:text-[#6B7280] font-mono">
                    {staff.length === 0 ? "No staff records found" : "No one matches those filters"}
                  </td>
                </tr>
              ) : (
                paged.items.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-[#23252B] transition-colors">
                    <td className="p-4">
                      <p className="font-bold text-gray-900 dark:text-white">{s.full_name || "Staff Member"}</p>
                      <p className="text-[10px] text-gray-400 dark:text-[#6B7280] font-mono">{s.email}</p>
                    </td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                        {s.role}
                      </span>
                    </td>
                    <td className="p-4">
                      {s.role === "admin" || s.permissions?.can_process_pos ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">Granted ✓</span>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-600">Off</span>
                      )}
                    </td>
                    <td className="p-4">
                      {s.role === "admin" || s.permissions?.can_manage_inventory ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">Granted ✓</span>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-600">Off</span>
                      )}
                    </td>
                    <td className="p-4">
                      {s.role === "admin" || s.permissions?.can_view_all_orders ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">Granted ✓</span>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-600">Off</span>
                      )}
                    </td>
                    <td className="p-4">
                      {s.role === "admin" || s.permissions?.can_manage_products ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">Granted ✓</span>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-600">Off</span>
                      )}
                    </td>
                    <td className="p-4">
                      {s.is_blocked ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                          Blocked
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <Link href={`/admin/staff/${s.id}`} className="font-semibold text-gray-700 dark:text-gray-200 underline">
                        View
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {paged.pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-[#2A2C32]/60 text-sm">
              <span className="text-gray-500">
                Page {paged.page} of {paged.pages} · {paged.total} people
              </span>
              <div className="flex gap-2">
                <button type="button" disabled={paged.page <= 1} onClick={() => setPage(paged.page - 1)} className="px-3 py-1.5 rounded-[6px] border border-gray-200 dark:border-[#383838] disabled:opacity-40">
                  Previous
                </button>
                <button type="button" disabled={paged.page >= paged.pages} onClick={() => setPage(paged.page + 1)} className="px-3 py-1.5 rounded-[6px] border border-gray-200 dark:border-[#383838] disabled:opacity-40">
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {adding && (
        <AddStaffForm
          onCreate={createStaff}
          onClose={() => setAdding(false)}
          onDone={() => {
            setAdding(false);
            fetchStaff();
          }}
        />
      )}
    </div>
  );
}
