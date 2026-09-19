import { PAPER_SIZES, type PaperSize } from "./receipt-layout";

export const DEFAULT_PAPER: PaperSize = "80mm";
const STORAGE_KEY = "gts_receipt_paper";

// Storage can be blocked (private windows, site-data settings): a receipt
// must still print, so every access falls back to the default.
export function loadPaperSize(): PaperSize {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored && stored in PAPER_SIZES ? (stored as PaperSize) : DEFAULT_PAPER;
  } catch {
    return DEFAULT_PAPER;
  }
}

export function savePaperSize(paper: PaperSize): void {
  try {
    localStorage.setItem(STORAGE_KEY, paper);
  } catch {
    // ignore: the choice just won't be remembered
  }
}
