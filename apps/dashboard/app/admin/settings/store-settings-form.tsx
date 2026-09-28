"use client";

import { useMemo, useState } from "react";
import { validateStoreSettings } from "@gts/utils";
import { layoutReceipt } from "../../pos/receipt-layout";

export interface StoreDetails {
  store_name: string;
  store_address: string | null;
  support_phone: string | null;
  whatsapp_number: string | null;
  support_email: string;
  store_website?: string | null;
  /** Hours a pay-on-pickup order holds its items before it cancels itself. */
  pickup_hold_hours?: number;
  footer_about?: string | null;
  instagram_url?: string | null;
  facebook_url?: string | null;
  tiktok_url?: string | null;
  x_url?: string | null;
  linkedin_url?: string | null;
}

export type SaveResult =
  | { ok: true; saved: StoreDetails; warning?: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

interface Props {
  initial: StoreDetails;
  onSave: (values: StoreDetails) => Promise<SaveResult>;
}

type FormValues = Record<keyof StoreDetails, string>;
type FieldKey = keyof StoreDetails;

const toForm = (d: StoreDetails): FormValues => ({
  store_name: d.store_name,
  store_address: d.store_address ?? "",
  support_phone: d.support_phone ?? "",
  whatsapp_number: d.whatsapp_number ?? "",
  support_email: d.support_email,
  store_website: d.store_website ?? "",
  pickup_hold_hours: String(d.pickup_hold_hours ?? 48),
  footer_about: d.footer_about ?? "",
  instagram_url: d.instagram_url ?? "",
  facebook_url: d.facebook_url ?? "",
  tiktok_url: d.tiktok_url ?? "",
  x_url: d.x_url ?? "",
  linkedin_url: d.linkedin_url ?? "",
});

/** What the form sends: the text fields as typed, the hold time as a number (validated like the server does). */
function toPayload(values: FormValues): Record<string, unknown> {
  const raw = values.pickup_hold_hours.trim();
  return { ...values, pickup_hold_hours: raw === "" ? Number.NaN : Number(raw) };
}

type FieldDef = { key: FieldKey; label: string; hint?: string; type?: string; multiline?: boolean };

const CHECKOUT_FIELDS: FieldDef[] = [
  {
    key: "pickup_hold_hours",
    label: "Hold pickup orders for (hours)",
    type: "number",
    hint: "How long a pay-on-pickup order keeps its items before it cancels itself and they go back on sale. 1 to 336 (14 days).",
  },
];

const FOOTER_FIELDS: FieldDef[] = [
  { key: "footer_about", label: "About the shop", multiline: true, hint: "A line or two shown in the storefront footer. Leave blank to hide it." },
  { key: "instagram_url", label: "Instagram link", type: "url", hint: "Full address, e.g. https://instagram.com/yourshop. Blank hides the icon." },
  { key: "facebook_url", label: "Facebook link", type: "url" },
  { key: "tiktok_url", label: "TikTok link", type: "url" },
  { key: "x_url", label: "X (Twitter) link", type: "url" },
  { key: "linkedin_url", label: "LinkedIn link", type: "url" },
];

const FIELDS: FieldDef[] = [
  { key: "store_name", label: "Store name", hint: "Printed at the top of every receipt." },
  { key: "store_address", label: "Address", hint: "Printed under the store name. Leave blank to omit." },
  { key: "support_phone", label: "Phone number", hint: "Printed under the store name on receipts." },
  { key: "whatsapp_number", label: "WhatsApp number", hint: "Shown to customers on the storefront." },
  { key: "support_email", label: "Support email", type: "email" },
  { key: "store_website", label: "Website", hint: "Printed at the foot of receipts as “Order also: …”. Leave blank to use www.GTS08.com." },
];

const SAMPLE_SALE = {
  orderNumber: "GTS-000000-000001",
  items: [],
  subtotal: 0,
  discountAmount: 0,
  total: 0,
  paymentMethod: "cash" as const,
  cashierName: "Cashier",
  createdAt: new Date().toISOString(),
};

/** The top of a receipt (name, address, phone) for the given store details. */
function receiptHeader(values: FormValues): string {
  const lines = layoutReceipt(
    {
      ...SAMPLE_SALE,
      store: {
        name: values.store_name.trim() || "GTS",
        address: values.store_address.trim() || undefined,
        phone: values.support_phone.trim() || undefined,
      },
    },
    "80mm"
  );
  return lines.slice(0, lines.indexOf("")).join("\n");
}

export default function StoreSettingsForm({ initial, onSave }: Props) {
  const [saved, setSaved] = useState<FormValues>(() => toForm(initial));
  const [values, setValues] = useState<FormValues>(() => toForm(initial));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [warning, setWarning] = useState<string | null>(null);

  const dirty = (Object.keys(values) as Array<keyof FormValues>).some((k) => values[k] !== saved[k]);
  const preview = useMemo(() => receiptHeader(values), [values]);

  function change(key: keyof FormValues, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
    setStatus("idle");
    setFormError(null);
    setErrors((e) => {
      const { [key]: _removed, ...rest } = e;
      return rest;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "saving" || !dirty) return;

    // Same rules the server enforces, so problems show up instantly.
    const check = validateStoreSettings(toPayload(values));
    if (!check.ok) {
      setErrors(check.errors);
      return;
    }

    setStatus("saving");
    setFormError(null);
    const result = await onSave(check.value as StoreDetails);
    if (result.ok) {
      const next = toForm(result.saved);
      setSaved(next);
      setValues(next);
      setErrors({});
      setWarning(result.warning ?? null);
      setStatus("saved");
    } else {
      setStatus("idle");
      setErrors(result.fieldErrors ?? {});
      setFormError(result.message);
    }
  }

  function renderField({ key, label, hint, type, multiline }: FieldDef) {
    const common = {
      id: `store-${key}`,
      value: values[key],
      "aria-invalid": !!errors[key],
      "aria-describedby": errors[key] ? `store-${key}-error` : undefined,
      className: `w-full px-3 py-2 text-sm rounded-[6px] border bg-white dark:bg-[#1C1C1C] ${errors[key] ? "border-red-500" : "border-gray-200 dark:border-[#383838]"}`,
    };
    return (
      <div key={key} className="space-y-1">
        <label htmlFor={`store-${key}`} className="text-xs font-semibold text-gray-700 dark:text-gray-200">
          {label}
        </label>
        {multiline ? (
          <textarea {...common} rows={3} onChange={(e) => change(key, e.target.value)} />
        ) : (
          <input {...common} type={type ?? "text"} min={type === "number" ? 1 : undefined} max={type === "number" ? 336 : undefined} onChange={(e) => change(key, e.target.value)} />
        )}
        {errors[key] ? (
          <p id={`store-${key}-error`} className="text-xs text-red-600 dark:text-red-400">
            {errors[key]}
          </p>
        ) : (
          hint && <p className="text-[11px] text-gray-500 dark:text-gray-400">{hint}</p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-6 lg:grid-cols-[minmax(0,32rem)_1fr] items-start">
      <div className="space-y-4">
        {FIELDS.map(renderField)}

        <h3 className="pt-2 text-sm font-bold text-gray-900 dark:text-white">Checkout</h3>
        {CHECKOUT_FIELDS.map(renderField)}

        <h3 className="pt-2 text-sm font-bold text-gray-900 dark:text-white">Storefront footer</h3>
        <p className="text-[11px] text-gray-500 dark:text-gray-400 -mt-2">
          The footer also shows the address, phone, WhatsApp and support email above.
        </p>
        {FOOTER_FIELDS.map(renderField)}

        {formError && (
          <p role="alert" className="text-xs text-red-600 dark:text-red-400">
            {formError}
          </p>
        )}
        {status === "saved" && warning && (
          <p role="status" className="text-sm text-amber-700 dark:text-amber-300">{warning}</p>
        )}
        {status === "saved" && (
          <p role="status" className="text-xs text-emerald-600 dark:text-emerald-400">
            Store details saved.
          </p>
        )}

        <button
          type="submit"
          disabled={!dirty || status === "saving"}
          className="px-5 py-2.5 rounded-[8px] bg-[#EDCF5D] text-[#010101] font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {status === "saving" ? "Saving..." : "Save changes"}
        </button>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Receipt header preview (80 mm)</p>
        <div className="inline-block bg-white text-black shadow-md rounded-[4px] px-4 py-3 border border-gray-200 overflow-x-auto max-w-full">
          <pre data-testid="receipt-header-preview" className="m-0 text-[11px] leading-snug font-mono whitespace-pre">
            {preview}
          </pre>
        </div>
      </div>
    </form>
  );
}
