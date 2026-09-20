import type { CartLine } from "./pos-types";

export const MAX_HELD_SALES = 8;
const PREFIX = "gts_held_sales:";

export interface HeldSale {
  id: string;
  heldAt: string;
  lines: CartLine[];
  discountText: string;
}

const keyFor = (staffId: string) => `${PREFIX}${staffId}`;

const isHeld = (v: unknown): v is HeldSale => {
  const h = v as HeldSale | null;
  return !!h && typeof h.id === "string" && typeof h.heldAt === "string" && Array.isArray(h.lines) && typeof h.discountText === "string";
};

function read(staffId: string): HeldSale[] {
  try {
    const raw = localStorage.getItem(keyFor(staffId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isHeld) : [];
  } catch {
    return [];
  }
}

function write(staffId: string, sales: HeldSale[]): boolean {
  try {
    localStorage.setItem(keyFor(staffId), JSON.stringify(sales));
    return true;
  } catch {
    return false;
  }
}

/** Parked sales for this till user, newest first. */
export function loadHeldSales(staffId: string): HeldSale[] {
  return read(staffId);
}

/** Parks a cart so the cashier can serve someone else. Returns it, or null if there was nothing to park or storage failed. */
export function holdSale(staffId: string, sale: { lines: CartLine[]; discountText: string }): HeldSale | null {
  if (sale.lines.length === 0) return null;
  const held: HeldSale = {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `h${Date.now()}${Math.random().toString(16).slice(2)}`,
    heldAt: new Date().toISOString(),
    lines: sale.lines,
    discountText: sale.discountText,
  };
  const next = [held, ...read(staffId)].slice(0, MAX_HELD_SALES);
  return write(staffId, next) ? held : null;
}

export function discardHeldSale(staffId: string, id: string): void {
  write(staffId, read(staffId).filter((h) => h.id !== id));
}

/** Everyone's parked sales: called at sign-out so a shared till doesn't keep the last person's carts. */
export function clearHeldSales(): void {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith(PREFIX)) localStorage.removeItem(k);
  } catch {
    // storage blocked: nothing was kept
  }
}
