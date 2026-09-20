"use client";

import { useState } from "react";
import {
  PERMISSION_GRANTS,
  STAFF_ROLE_LABELS,
  defaultGrants,
  validateNewStaff,
  type NewStaffInput,
  type NewStaffRole,
  type PermissionGrant,
} from "@gts/utils";

export interface CreatedStaff {
  id: string;
  email: string;
  full_name: string;
  role: string;
  temporary_password: string;
  /** Whether the welcome email went out; absent from older servers. */
  email_delivery?: { sent: boolean; skipped: boolean };
}
export type CreateResult = { ok: true; data: CreatedStaff } | { ok: false; message: string; errors?: Record<string, string> };

interface Props {
  onCreate: (input: NewStaffInput, options: { emailCredentials: boolean }) => Promise<CreateResult>;
  onClose: () => void;
  /** Called when the credentials panel is dismissed, so the list can refresh. */
  onDone: () => void;
}

/**
 * Roles the form offers. Inventory staff are left out until their portal exists
 * (today they'd sign in to a blank page); the server still accepts the role.
 */
export const OFFERED_ROLES: NewStaffRole[] = ["cashier", "admin"];

const GRANT_LABELS: Record<PermissionGrant, string> = {
  can_process_pos: "Use the point of sale",
  can_void_orders: "Void their own sales",
  can_apply_discounts: "Apply manual discounts (up to 20%)",
  can_manage_inventory: "Manage inventory",
  can_view_all_orders: "View all orders",
  can_manage_products: "Manage products",
  can_handle_tickets: "Handle support tickets",
};

const FIELD = "w-full px-3 py-2 text-base rounded-[6px] border border-gray-200 dark:border-[#383838] bg-transparent";
const LABEL = "block text-sm font-semibold text-gray-600 dark:text-gray-300 mb-1";

/** The super admin adds a person: who they are, what role, and what they may do. */
export default function AddStaffForm({ onCreate, onClose, onDone }: Props) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<NewStaffRole>("cashier");
  const [grants, setGrants] = useState(defaultGrants("cashier"));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<CreatedStaff | null>(null);
  const [copied, setCopied] = useState(false);
  const [emailCredentials, setEmailCredentials] = useState(false);

  function changeRole(next: NewStaffRole) {
    setRole(next);
    setGrants(defaultGrants(next));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const check = validateNewStaff({ email, full_name: fullName, role, permissions: grants });
    if (!check.ok) {
      setErrors(check.errors);
      return;
    }
    setErrors({});
    setFailure(null);
    setBusy(true);
    const result = await onCreate(check.value, { emailCredentials });
    setBusy(false);
    if (result.ok) setCreated(result.data);
    else {
      setErrors(result.errors ?? {});
      setFailure(result.message);
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      // clipboard blocked: the password is on screen to copy by hand
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div role="dialog" aria-modal="true" aria-label="Add staff member" className="w-full max-w-lg max-h-full overflow-y-auto rounded-[12px] bg-white dark:bg-[#1C1C1C] p-6 space-y-4">
        {created ? (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Account created</h2>
            <div className="rounded-[8px] border border-gray-200 dark:border-[#262626] p-4 space-y-2 text-base">
              <p className="text-gray-500 dark:text-gray-400">Email</p>
              <p className="font-semibold text-gray-900 dark:text-white">{created.email}</p>
              <p className="text-gray-500 dark:text-gray-400 pt-1">One-time password</p>
              <div className="flex items-center gap-3">
                <code className="font-mono text-lg font-bold text-gray-900 dark:text-white break-all">{created.temporary_password}</code>
                <button type="button" onClick={() => copy(created.temporary_password)} className="px-3 py-1.5 text-sm font-semibold rounded-[6px] bg-gray-100 dark:bg-[#242424]">
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
            {created.email_delivery && (
              <p role="status" className="text-sm text-gray-700 dark:text-gray-200">
                {created.email_delivery.sent
                  ? `Welcome email sent to ${created.email}.`
                  : created.email_delivery.skipped
                    ? "Email isn't set up yet, so no welcome email was sent. Give them the password below yourself."
                    : "The welcome email couldn't be sent. Give them the password below yourself."}
              </p>
            )}
            <p className="text-sm text-amber-700 dark:text-amber-300">
              This password won&apos;t be shown again. Give it to {created.full_name} now. They'll be asked to choose their own password the first time they sign in.
            </p>
            <button type="button" onClick={onDone} className="w-full py-2.5 text-base font-bold rounded-[8px] bg-[#EDCF5D] text-[#010101]">
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Add staff member</h2>

            <div>
              <label htmlFor="new-name" className={LABEL}>Full name</label>
              <input id="new-name" value={fullName} onChange={(e) => setFullName(e.target.value)} className={FIELD} />
              {errors.full_name && <p className="text-sm text-red-600 mt-1">{errors.full_name}</p>}
            </div>
            <div>
              <label htmlFor="new-email" className={LABEL}>Email</label>
              <input id="new-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={FIELD} />
              {errors.email && <p className="text-sm text-red-600 mt-1">{errors.email}</p>}
            </div>
            <div>
              <label htmlFor="new-role" className={LABEL}>Role</label>
              <select id="new-role" value={role} onChange={(e) => changeRole(e.target.value as NewStaffRole)} className={FIELD}>
                {OFFERED_ROLES.map((r) => (
                  <option key={r} value={r}>{STAFF_ROLE_LABELS[r]}</option>
                ))}
              </select>
              {errors.role && <p className="text-sm text-red-600 mt-1">{errors.role}</p>}
            </div>

            {role === "admin" ? (
              <p className="text-sm text-gray-700 dark:text-gray-200 rounded-[8px] bg-gray-50 dark:bg-[#242424] p-3">
                Admins have full access to everything except adding people, which only you can do. For narrower access, choose Cashier or Inventory staff and pick their permissions.
              </p>
            ) : (
              <fieldset className="space-y-2">
                <legend className={LABEL}>What they can do</legend>
                {PERMISSION_GRANTS.map((key) => (
                  <label key={key} className="flex items-center gap-3 text-base text-gray-800 dark:text-gray-100 cursor-pointer">
                    <input type="checkbox" checked={grants[key]} onChange={(e) => setGrants((g) => ({ ...g, [key]: e.target.checked }))} />
                    {GRANT_LABELS[key]}
                  </label>
                ))}
                {errors.permissions && <p className="text-sm text-red-600">{errors.permissions}</p>}
              </fieldset>
            )}

            <label className="flex items-start gap-3 text-base text-gray-800 dark:text-gray-100 cursor-pointer">
              <input type="checkbox" className="mt-1" checked={emailCredentials} onChange={(e) => setEmailCredentials(e.target.checked)} />
              <span>
                Include the one-time password in their welcome message
                <span className="block text-sm text-gray-500 dark:text-gray-400">Off by default: a message isn&apos;t private, so we otherwise send a welcome note without the password.</span>
              </span>
            </label>

            {failure && (
              <p role="alert" className="text-sm text-red-600 dark:text-red-400">{failure}</p>
            )}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose} className="flex-1 py-2.5 text-base font-semibold rounded-[8px] border border-gray-200 dark:border-[#383838]">
                Cancel
              </button>
              <button type="submit" disabled={busy} className="flex-1 py-2.5 text-base font-bold rounded-[8px] bg-[#EDCF5D] text-[#010101] disabled:opacity-50">
                {busy ? "Creating..." : "Create account"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
