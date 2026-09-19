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
}

const GRANTS: Array<{ key: keyof PermissionsView; label: string; hint?: string }> = [
  { key: "can_process_pos", label: "Use the point of sale" },
  { key: "can_void_orders", label: "Void their own sales", hint: "Same-day sales they took payment for" },
  { key: "can_apply_discounts", label: "Apply manual discounts", hint: "Capped at 20% of a sale" },
  { key: "can_manage_inventory", label: "Manage inventory" },
  { key: "can_view_all_orders", label: "View all orders" },
  { key: "can_manage_products", label: "Manage products" },
  { key: "can_handle_tickets", label: "Handle support tickets" },
];

/** What an admin can change about a staff member: which actions they may take, and whether they can sign in at all. */
export default function PermissionEditor({ name, permissions, isAdminAccount, isBlocked, onSavePermissions, onSetBlocked }: Props) {
  const [draft, setDraft] = useState<PermissionsView>(permissions);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingBlock, setConfirmingBlock] = useState(false);

  if (isAdminAccount) {
    return <p className="text-sm text-gray-700 dark:text-gray-200">{name} is an admin, so they have full access. Admin access isn&apos;t edited here.</p>;
  }

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

      <div className="border-t border-gray-200 dark:border-[#262626] pt-4 space-y-2">
        {isBlocked ? (
          <>
            <p className="text-sm text-red-600 dark:text-red-400 font-semibold">This account is blocked.</p>
            <button type="button" onClick={() => setBlocked(false)} className="px-3 py-1.5 text-xs font-semibold rounded-[6px] bg-gray-100 dark:bg-[#242424]">
              Unblock {name}
            </button>
          </>
        ) : confirmingBlock ? (
          <div className="space-y-2">
            <p className="text-sm text-gray-700 dark:text-gray-200">
              {name} will be signed out and can&apos;t sign in until you unblock them.
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setConfirmingBlock(false)} className="px-3 py-1.5 text-xs font-semibold rounded-[6px] border border-gray-200 dark:border-[#383838]">
                Keep active
              </button>
              <button type="button" onClick={() => setBlocked(true)} className="px-3 py-1.5 text-xs font-bold rounded-[6px] bg-red-600 text-white">
                Yes, block
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmingBlock(true)} className="px-3 py-1.5 text-xs font-semibold rounded-[6px] text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50">
            Block {name}
          </button>
        )}
      </div>
    </div>
  );
}
