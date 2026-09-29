"use client";

import { useState } from "react";
import type { PermissionsView } from "../../../lib/staff-types";

export type SaveResult = { ok: true } | { ok: false; message: string };

interface Props {
  name: string;
  permissions: PermissionsView;
  isAdminAccount: boolean;
  isBlocked: boolean;
  onSavePermissions: (changes: Partial<PermissionsView>) => Promise<SaveResult>;
  onSetBlocked: (blocked: boolean) => Promise<SaveResult>;
  /** The viewer may block or unblock this account. */
  canBlockAdmin?: boolean;
  /** The viewer is an admin and may permanently remove this staff account. */
  canDelete?: boolean;
  onDelete?: () => Promise<SaveResult>;
  onDeleted?: () => void;
}

const GRANTS: Array<{ key: keyof PermissionsView; label: string; hint?: string }> = [
  { key: "can_process_pos", label: "Use the point of sale" },
  { key: "can_void_orders", label: "Void their own sales", hint: "Same-day sales they took payment for" },
  { key: "can_apply_discounts", label: "Apply manual discounts", hint: "Capped at 20% of a sale" },
  { key: "can_manage_inventory", label: "Manage inventory" },
  { key: "can_view_all_orders", label: "View all orders" },
  { key: "can_manage_products", label: "Manage products" },
  { key: "can_handle_tickets", label: "Handle support tickets" },
  { key: "can_manage_broadcasts", label: "Manage broadcasts & popups", hint: "Create, edit, and publish store banners and popup announcements" },
  { key: "can_update_order_status", label: "Update order status", hint: "Confirm orders, mark ready for pickup, hold, move back" },
  { key: "can_mark_orders_paid", label: "Mark orders as paid", hint: "Confirm and record customer payment" },
  { key: "can_complete_pickup", label: "Complete order pickup", hint: "Perform handover and complete pickup at the counter" },
  { key: "can_cancel_orders", label: "Cancel customer orders", hint: "Cancel uncollected orders with a reason" },
];

/** What an admin can change about a staff member: which actions they may take, and whether they can sign in at all. */
export default function PermissionEditor({
  name,
  permissions,
  isAdminAccount,
  isBlocked,
  onSavePermissions,
  onSetBlocked,
  canBlockAdmin = false,
  canDelete = false,
  onDelete,
  onDeleted,
}: Props) {
  const [draft, setDraft] = useState<PermissionsView>(permissions);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingBlock, setConfirmingBlock] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const changes: Partial<PermissionsView> = {};
  for (const { key } of GRANTS) if (draft[key] !== permissions[key]) changes[key] = draft[key];
  const changed = Object.keys(changes).length > 0;

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    const result = await onSavePermissions(changes);
    setSaving(false);
    if (result.ok) setSaved(true);
    else setError(result.message);
  }

  async function setBlocked(blocked: boolean) {
    setError(null);
    const result = await onSetBlocked(blocked);
    if (result.ok) setConfirmingBlock(false);
    else setError(result.message);
  }

  async function removeStaff() {
    if (!onDelete) return;
    setDeleting(true);
    setError(null);
    const r = await onDelete();
    setDeleting(false);
    if (r.ok) {
      if (onDeleted) onDeleted();
    } else {
      setError(r.message);
      setConfirmingDelete(false);
    }
  }

  const blockAndDangerControls = (
    <div className="border-t border-gray-200 dark:border-[#262626] pt-4 space-y-3">
      {isBlocked && (
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-red-600 animate-pulse" />
          <p className="text-xs sm:text-sm text-red-600 dark:text-red-400 font-bold">This account is currently blocked.</p>
        </div>
      )}

      {confirmingBlock ? (
        <div className="space-y-2 p-3 bg-red-50/60 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-lg">
          <p className="text-xs sm:text-sm text-red-950 dark:text-red-200 font-medium">
            {name} will be signed out and can&apos;t sign in until you unblock them.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConfirmingBlock(false)}
              className="px-3 py-1.5 text-xs font-semibold rounded-md border border-gray-300 dark:border-[#383838] bg-white dark:bg-[#242424] text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#2A2A2A] transition-colors"
            >
              Keep active
            </button>
            <button
              type="button"
              onClick={() => setBlocked(true)}
              className="px-3 py-1.5 text-xs font-bold rounded-md bg-[#DC2626] hover:bg-[#B91C1C] text-white shadow-xs transition-colors"
            >
              Yes, block
            </button>
          </div>
        </div>
      ) : confirmingDelete ? (
        <div className="space-y-2 p-3 bg-red-50/60 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-lg">
          <p className="text-xs sm:text-sm text-red-950 dark:text-red-200 font-medium">
            {name} can&apos;t sign in again and disappears from the staff list. The sales and logs they made stay on record under their name. This can&apos;t be undone.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              disabled={deleting}
              className="px-3 py-1.5 text-xs font-semibold rounded-md border border-gray-300 dark:border-[#383838] bg-white dark:bg-[#242424] text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#2A2A2A] transition-colors"
            >
              Keep {name}
            </button>
            <button
              type="button"
              onClick={() => void removeStaff()}
              disabled={deleting}
              className="px-3 py-1.5 text-xs font-bold rounded-md bg-[#991B1B] hover:bg-[#7F1D1D] text-white shadow-xs transition-colors disabled:opacity-50"
            >
              {deleting ? "Deleting..." : "Yes, delete"}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2.5">
          {isBlocked ? (
            <button
              type="button"
              onClick={() => setBlocked(false)}
              className="px-3.5 py-2 text-xs font-bold rounded-[6px] bg-gray-200 hover:bg-gray-300 dark:bg-[#2A2A2A] dark:hover:bg-[#333333] text-gray-800 dark:text-gray-100 transition-colors shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
            >
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Unblock {name}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setConfirmingDelete(false);
                setConfirmingBlock(true);
              }}
              className="px-3.5 py-2 text-xs font-bold rounded-[6px] bg-[#DC2626] hover:bg-[#B91C1C] text-white shadow-xs active:scale-95 transition-all cursor-pointer inline-flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5 shrink-0 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
              <span>Block {name}</span>
            </button>
          )}

          {canDelete && (
            <button
              type="button"
              onClick={() => {
                setConfirmingBlock(false);
                setConfirmingDelete(true);
              }}
              className="px-3.5 py-2 text-xs font-bold rounded-[6px] bg-[#991B1B] hover:bg-[#7F1D1D] text-white shadow-xs active:scale-95 transition-all cursor-pointer inline-flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5 shrink-0 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span>Delete Staff</span>
            </button>
          )}
        </div>
      )}
    </div>
  );

  if (isAdminAccount) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-700 dark:text-gray-200">{name} is an admin, so they have full access. Their permissions aren&apos;t edited here.</p>
        {(canBlockAdmin || canDelete) && (
          <>
            {error && (
              <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            )}
            {blockAndDangerControls}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <ul className="space-y-2">
        {GRANTS.map(({ key, label, hint }) => (
          <li key={key}>
            <label className="flex items-start gap-3 text-sm text-gray-800 dark:text-gray-100 cursor-pointer">
              <input
                type="checkbox"
                checked={draft[key]}
                onChange={(e) => {
                  setSaved(false);
                  setDraft((d) => ({ ...d, [key]: e.target.checked }));
                }}
                className="mt-0.5"
              />
              <span>
                {label}
                {hint && <span className="block text-xs text-gray-500 dark:text-gray-400">{hint}</span>}
              </span>
            </label>
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={!changed || saving}
          onClick={save}
          className="px-4 py-2 text-xs font-bold rounded-[6px] bg-[#EDCF5D] text-[#010101] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? "Saving..." : "Save permissions"}
        </button>
        {saved && <span className="text-xs text-emerald-600 dark:text-emerald-400">Permissions saved.</span>}
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {blockAndDangerControls}
    </div>
  );
}
