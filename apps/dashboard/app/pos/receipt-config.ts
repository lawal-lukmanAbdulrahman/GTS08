import type { ReceiptStore } from "./receipt";

/**
 * Store details printed in the receipt header. All optional public values,
 * set via NEXT_PUBLIC_STORE_* in the dashboard's env; anything unset is
 * simply left off the receipt.
 */
export function getReceiptStore(): ReceiptStore {
  return {
    name: process.env.NEXT_PUBLIC_STORE_NAME || "GTS",
    address: process.env.NEXT_PUBLIC_STORE_ADDRESS || undefined,
    phone: process.env.NEXT_PUBLIC_STORE_PHONE || undefined,
  };
}
