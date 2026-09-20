import { formatKobo, formatWAT, receiptBrand } from "@gts/utils";
import type { PaidOrder } from "../_lib/checkout-client";

/** The online order confirmation, laid out like the shop's handwritten receipt. Every figure is the server's. */
export default function OrderReceipt({ order }: { order: PaidOrder }) {
  const brand = receiptBrand();
  const th = "py-1 text-xs font-semibold text-gray-500";
  const td = "py-2 align-top text-sm text-[#010101]";

  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 text-left shadow-sm font-sans">
      <div className="text-center">
        <p className="text-lg font-extrabold tracking-wide text-[#010101]">{brand.name.toUpperCase()}</p>
        <p className="text-sm text-gray-600">{brand.phone}</p>
      </div>

      <dl className="mt-4 space-y-1 border-y border-gray-200 py-3 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-gray-500">Date:</dt>
          <dd className="font-medium">{order.created_at ? formatWAT(order.created_at) : ""}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-gray-500">Receipt No:</dt>
          <dd className="font-mono font-bold">{order.order_number}</dd>
        </div>
      </dl>

      <table className="mt-3 w-full">
        <thead>
          <tr className="border-b border-gray-200">
            <th className={`${th} text-left w-10`}>Qty</th>
            <th className={`${th} text-left`}>Description</th>
            <th className={`${th} text-right`}>Unit price</th>
            <th className={`${th} text-right`}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item, i) => {
            const variant = [item.size, item.color].filter(Boolean).join(" / ");
            return (
              <tr key={i} className="border-b border-gray-100">
                <td className={td}>{item.quantity}</td>
                <td className={td}>
                  {item.name}
                  {variant && <span className="block text-xs text-gray-500">{variant}</span>}
                </td>
                <td className={`${td} text-right whitespace-nowrap`}>{formatKobo(item.unit_price)}</td>
                <td className={`${td} text-right whitespace-nowrap`}>{formatKobo(item.line_total)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="mt-3 space-y-1 text-sm">
        {(order.discount_amount ?? 0) > 0 && (
          <div className="flex justify-between"><span className="text-gray-500">Discount</span><span>-{formatKobo(order.discount_amount!)}</span></div>
        )}
        {order.delivery_fee !== undefined && (
          <div className="flex justify-between"><span className="text-gray-500">Delivery</span><span>{formatKobo(order.delivery_fee)}</span></div>
        )}
        <div className="flex items-baseline gap-2 pt-1 text-base font-extrabold">
          <span>Total</span>
          <span aria-hidden="true" className="flex-1 border-b border-dashed border-gray-400" />
          <span aria-hidden="true">→</span>
          <span data-testid="receipt-total">{formatKobo(order.total)}</span>
        </div>
      </div>

      <div className="mt-5 text-center text-sm">
        <p className="text-gray-700">{brand.thanks}</p>
        <p className="font-bold text-[#010101]">{brand.orderAlso}</p>
      </div>
    </div>
  );
}
