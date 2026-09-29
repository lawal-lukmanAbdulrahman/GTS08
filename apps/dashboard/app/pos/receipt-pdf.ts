import { jsPDF } from "jspdf";
import type { ReceiptData, ReceiptStore } from "./receipt";
import { layoutReceipt, paperCss, type PaperSize } from "./receipt-layout";
import { API_BASE } from "../lib/api-base";
import { authFetch } from "../lib/session";

/**
 * Cleanly generates a printable thermal-width PDF for a receipt using jsPDF.
 * Replaces Unicode currency symbols with ASCII "NGN " to avoid PDF font encoding corruption.
 */
export function generateReceiptPdf(receipt: ReceiptData, paper: PaperSize = "80mm"): jsPDF {
  const lines = layoutReceipt(receipt, paper);
  // Sanitize non-ASCII chars for standard PDF Courier font (₦ -> NGN )
  const sanitizedLines = lines.map((line) => line.replace(/₦/g, "NGN "));

  const widthMm = paper === "58mm" ? 58 : paper === "a4" ? 210 : 80;
  const marginMm = paper === "a4" ? 14 : 3;
  const printableWidthMm = widthMm - 2 * marginMm;

  // Calculate the longest line length to guarantee zero overflow
  const longestLine = Math.max(...sanitizedLines.map((l) => l.length), 32);

  // In Courier monospace: charWidth = fontSize * 0.6 pt = (fontSize * 0.6 * 25.4 / 72) mm
  // To ensure longestLine fits within printableWidthMm:
  // fontSize <= (printableWidthMm * 72) / (longestLine * 0.6 * 25.4)
  const maxSafeFontSize = Math.floor(((printableWidthMm * 72) / (longestLine * 0.6 * 25.4)) * 10) / 10;
  const fontSize = Math.min(paper === "a4" ? 10 : 7.2, Math.max(5.5, maxSafeFontSize));

  const lineSpacingMm = fontSize * 0.352778 * 1.35;
  const paddingMm = 12;
  const heightMm = Math.max(90, Math.ceil(sanitizedLines.length * lineSpacingMm + paddingMm));

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [widthMm, heightMm],
  });

  doc.setFont("courier", "normal");
  doc.setFontSize(fontSize);

  let currentY = 7;
  for (const line of sanitizedLines) {
    doc.text(line, marginMm, currentY);
    currentY += lineSpacingMm;
  }

  return doc;
}

/**
 * Triggers a browser download of the receipt as a PDF file.
 */
export function downloadReceiptPdf(receipt: ReceiptData, filename?: string): void {
  const doc = generateReceiptPdf(receipt, "80mm");
  const targetName = filename || `receipt-${receipt.orderNumber}.pdf`;
  doc.save(targetName);
}

/**
 * Silently opens the native print dialog for the receipt in an invisible iframe
 * without displacing the current UI or modal.
 */
export function printReceiptIframe(receipt: ReceiptData, paper: PaperSize = "80mm"): void {
  if (typeof window === "undefined") return;

  const lines = layoutReceipt(receipt, paper);
  const css = paperCss(paper, lines.length);

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.setAttribute("aria-hidden", "true");
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) return;

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Receipt ${receipt.orderNumber}</title>
        <style>
          ${css}
          body { margin: 0; padding: 0; }
        </style>
      </head>
      <body>
        <pre class="receipt-sheet">${lines.join("\n")}</pre>
        <script>
          window.onload = function() {
            window.focus();
            window.print();
            setTimeout(function() {
              if (window.frameElement) {
                window.frameElement.remove();
              }
            }, 1000);
          };
        </script>
      </body>
    </html>
  `);
  doc.close();
}

/**
 * Fetches receipt data from the API and downloads it as a PDF.
 */
export async function fetchAndDownloadReceipt(
  orderId: string,
  store?: ReceiptStore
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const res = await authFetch(`${API_BASE}/pos/orders/${orderId}/receipt`);
    const json = await res.json();
    if (!res.ok) {
      return { ok: false, message: json.error || "Failed to fetch receipt data." };
    }
    const receiptData: ReceiptData = {
      ...json.data,
      store: store ?? json.data.store,
    };
    downloadReceiptPdf(receiptData);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, message: err?.message || "Failed to download receipt." };
  }
}

/**
 * Fetches receipt data from the API and prints it via thermal layout.
 */
export async function fetchAndPrintReceipt(
  orderId: string,
  store?: ReceiptStore
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const res = await authFetch(`${API_BASE}/pos/orders/${orderId}/receipt`);
    const json = await res.json();
    if (!res.ok) {
      return { ok: false, message: json.error || "Failed to fetch receipt data." };
    }
    const receiptData: ReceiptData = {
      ...json.data,
      store: store ?? json.data.store,
    };
    printReceiptIframe(receiptData, "80mm");
    return { ok: true };
  } catch (err: any) {
    return { ok: false, message: err?.message || "Failed to print receipt." };
  }
}
