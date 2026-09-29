import * as XLSX from "xlsx";
import { formatWAT } from "@gts/utils";

export interface SaleRecordItem {
  id: string;
  order_number: string;
  channel: "walk_in" | "whatsapp" | "online" | "pickup" | string;
  status: string;
  payment_status: "unpaid" | "paid" | string;
  payment_method?: string | null;
  total: number; // kobo
  subtotal?: number; // kobo
  discount_amount?: number; // kobo
  created_at: string;
  internal_notes?: string | null;
  customer?: {
    full_name?: string;
    email?: string;
    phone?: string;
  } | null;
  items?: Array<{
    id: string;
    quantity: number;
    unit_price: number;
    line_total: number;
    product_snapshot?: {
      name?: string;
      size?: string | null;
      color?: string | null;
    } | null;
  }>;
  cashier_name?: string | null;
}

/**
 * Exports sales records to an Excel (.xlsx) file with professional formatting and column widths.
 */
export function exportSalesToExcel(
  sales: SaleRecordItem[],
  fileName: string = `gts-sales-log-${new Date().toISOString().slice(0, 10)}.xlsx`
) {
  const rows = sales.map((sale, idx) => {
    const totalNaira = sale.total ? sale.total / 100 : 0;
    const subtotalNaira = sale.subtotal ? sale.subtotal / 100 : totalNaira;
    const discountNaira = sale.discount_amount ? sale.discount_amount / 100 : 0;

    const itemsSummary =
      sale.items && sale.items.length > 0
        ? sale.items
            .map((i) => {
              const name = i.product_snapshot?.name || "Item";
              const variant = [i.product_snapshot?.size, i.product_snapshot?.color].filter(Boolean).join("/");
              return `${i.quantity}x ${name}${variant ? ` (${variant})` : ""}`;
            })
            .join("; ")
        : "—";

    const channelLabel =
      sale.channel === "walk_in"
        ? "Walk-in"
        : sale.channel === "whatsapp"
        ? "WhatsApp"
        : "Storefront";

    return {
      "S/N": idx + 1,
      "Order / Receipt ID": sale.order_number,
      "Date & Time (WAT)": formatWAT(sale.created_at),
      "Channel": channelLabel,
      "Customer Name": sale.customer?.full_name || (sale.channel === "walk_in" ? "Walk-in Guest" : "—"),
      "Customer Phone": sale.customer?.phone || "—",
      "Customer Email": sale.customer?.email || "—",
      "Items Count": sale.items?.reduce((acc, i) => acc + i.quantity, 0) || 0,
      "Items Description": itemsSummary,
      "Payment Method": sale.payment_method || "—",
      "Payment Status": sale.payment_status?.toUpperCase() || "PAID",
      "Subtotal (NGN)": subtotalNaira,
      "Discount (NGN)": discountNaira,
      "Total Amount (NGN)": totalNaira,
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);

  ws["!cols"] = [
    { wch: 6 },  // S/N
    { wch: 22 }, // Order ID
    { wch: 24 }, // Date & Time
    { wch: 14 }, // Channel
    { wch: 22 }, // Customer Name
    { wch: 16 }, // Customer Phone
    { wch: 26 }, // Customer Email
    { wch: 12 }, // Items Count
    { wch: 38 }, // Items Description
    { wch: 16 }, // Payment Method
    { wch: 14 }, // Payment Status
    { wch: 16 }, // Subtotal
    { wch: 16 }, // Discount
    { wch: 18 }, // Total Amount
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sales Log");
  XLSX.writeFile(wb, fileName);
}
