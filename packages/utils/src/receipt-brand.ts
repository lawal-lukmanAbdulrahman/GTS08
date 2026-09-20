/**
 * The wording every receipt shares (printed, on screen, WhatsApp, email and the
 * online confirmation), taken from the shop's handwritten receipt. Name and phone
 * come from Store Details when set; the website is fixed until Store Details has a field for it.
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

export function receiptBrand(store?: { name?: string | null; phone?: string | null }): ReceiptBrand {
  return {
    name: clean(store?.name, DEFAULT_NAME),
    phone: clean(store?.phone, DEFAULT_PHONE),
    website: RECEIPT_WEBSITE,
    thanks: RECEIPT_THANKS,
    orderAlso: `Order also: ${RECEIPT_WEBSITE}`,
  };
}
