"use client";

import type { PermissionsView } from "../lib/staff-types";

interface Props {
  permissions: PermissionsView;
  isAdmin: boolean;
}

// Grants an admin can give, in the words a cashier would use.
const GRANTS: Array<{ key: keyof PermissionsView; label: string }> = [
  { key: "can_process_pos", label: "Use the point of sale" },
  { key: "can_void_orders", label: "Void your own sales" },
  { key: "can_apply_discounts", label: "Apply manual discounts (up to 20% of a sale)" },
  { key: "can_manage_inventory", label: "Manage inventory" },
  { key: "can_view_all_orders", label: "View all orders" },
  { key: "can_manage_products", label: "Manage products" },
  { key: "can_handle_tickets", label: "Handle support tickets" },
  { key: "can_manage_broadcasts", label: "Manage broadcasts & popups" },
];

/** What this staff member can and can't do, so a missing button never feels like a bug. */
export default function PermissionList({ permissions, isAdmin }: Props) {
  if (isAdmin) {
    return <p className="text-sm text-gray-700 dark:text-gray-200">You&apos;re an admin, so you have full access to everything.</p>;
  }

  const allowed = GRANTS.filter((g) => permissions[g.key]);
  const missing = GRANTS.filter((g) => !permissions[g.key]);

  const everyone = ["Update your phone number", "Change your password", "See your own sales and activity"];
  if (permissions.can_process_pos) everyone.push("Flag a product with a problem");

  return (
    <div className="space-y-4">
      <div>
        <p id="can-list" className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">
          You can
        </p>
        <ul aria-labelledby="can-list" className="flex flex-wrap gap-1.5">
          {[...allowed.map((g) => g.label), ...everyone].map((label) => (
            <li key={label} className="text-xs px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300">
              {label}
            </li>
          ))}
        </ul>
      </div>

      {missing.length > 0 && (
        <div>
          <p id="cannot-list" className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">
            Ask an admin if you need
          </p>
          <ul aria-labelledby="cannot-list" className="flex flex-wrap gap-1.5">
            {missing.map((g) => (
              <li key={g.key} className="text-xs px-2.5 py-1 rounded-full bg-gray-100 dark:bg-[#242424] text-gray-500 dark:text-gray-400">
                {g.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
