import * as XLSX from "xlsx";

export interface OrderExportItem {
  id: string;
  order_number: string;
  created_at: string;
  status: string;
  payment_status: "unpaid" | "paid";
  payment_method?: string | null;
  total: number;
  customer?: { full_name?: string; email?: string; phone?: string } | null;
  pickup_station?: {
    name: string;
    address_line1: string;
    city: string;
    state: string;
    phone?: string | null;
  } | null;
}

/**
 * Formats order status into a readable string
 */
function formatStatusLabel(s: string): string {
  if (s === "ready_for_pickup") return "Ready for Pickup";
  if (s === "on_hold") return "On Hold";
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
}

/**
 * Exports orders list to an Excel (.xlsx) file with professional formatting and column widths.
 */
export function exportOrdersToExcel(
  orders: OrderExportItem[],
  fileName: string = `gts-orders-export-${new Date().toISOString().slice(0, 10)}.xlsx`
) {
  const rows = orders.map((o, idx) => {
    const totalNaira = o.total > 100000 ? o.total / 100 : o.total;

    return {
      "No.": idx + 1,
      "Order Number": o.order_number,
      "Date Placed": new Date(o.created_at).toLocaleString("en-NG"),
      "Customer Name": o.customer?.full_name || "Guest Customer",
      "Customer Email": o.customer?.email || "—",
      "Customer Phone": o.customer?.phone || "—",
      "Pickup Station": o.pickup_station?.name || "Main Store",
      "Station Address": o.pickup_station ? `${o.pickup_station.address_line1}, ${o.pickup_station.city}, ${o.pickup_station.state}` : "—",
      "Fulfillment Status": formatStatusLabel(o.status),
      "Payment Status": o.payment_status === "paid" ? "PAID" : "UNPAID",
      "Payment Method": (o.payment_method || "—").toUpperCase(),
      "Total Amount (NGN)": totalNaira,
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Set intelligent column widths
  worksheet["!cols"] = [
    { wch: 6 },  // No.
    { wch: 22 }, // Order Number
    { wch: 22 }, // Date Placed
    { wch: 24 }, // Customer Name
    { wch: 28 }, // Customer Email
    { wch: 18 }, // Customer Phone
    { wch: 22 }, // Pickup Station
    { wch: 36 }, // Station Address
    { wch: 20 }, // Fulfillment Status
    { wch: 16 }, // Payment Status
    { wch: 18 }, // Payment Method
    { wch: 18 }, // Total Amount
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "GTS Orders");

  XLSX.writeFile(workbook, fileName);
}
