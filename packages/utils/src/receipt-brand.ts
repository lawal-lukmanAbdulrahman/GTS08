/**
 * The wording every receipt shares (printed, on screen, WhatsApp, email and the
 * online confirmation), taken from the shop's handwritten receipt. Name and phone
 * come from Store Details when set; the website too (falling back to www.GTS08.com).
 */
export const RECEIPT_WEBSITE = "www.GTS08.com";
export const RECEIPT_THANKS = "Thanks for your patronage.";

const DEFAULT_NAME = "GTS Wears";
const DEFAULT_PHONE = "08148308129";

export interface ReceiptBrand {
  name: string;
  phone: string;
  website: string;
  thanks: string;
  orderAlso: string;
}

const clean = (v: string | null | undefined, fallback: string) => (typeof v === "string" && v.trim() ? v.trim() : fallback);

/** How a website is printed: as typed, minus "https://" and any trailing slash. */
const shown = (v: string | null | undefined) => clean(v, RECEIPT_WEBSITE).replace(/^https?:\/\//i, "").replace(/\/+$/, "");

export function receiptBrand(store?: { name?: string | null; phone?: string | null; website?: string | null }): ReceiptBrand {
  const website = shown(store?.website);
  return {
    name: clean(store?.name, DEFAULT_NAME),
    phone: clean(store?.phone, DEFAULT_PHONE),
    website,
    thanks: RECEIPT_THANKS,
    orderAlso: `Order also: ${website}`,
  };
}
