import { describe, it, expect } from "vitest";
import { transitionOrderStatus } from "../app/api/v1/pos/_lib/order-status";

function makeFakeClient(orders: Record<string, { status: string }>) {
  return {
    orders,
    from(_table: string) {
      const filters: Record<string, unknown> = {};
      let patch: Record<string, unknown> = {};
      const builder: any = {
        update(values: Record<string, unknown>) {
          patch = values;
          return builder;
        },
        eq(column: string, value: unknown) {
          filters[column] = value;
          return builder;
        },
        select() {
          return builder;
        },
        then(resolve: (value: unknown) => void) {
          const row = orders[filters.id as string];
          if (!row || row.status !== filters.status) return resolve({ data: [], error: null });
          Object.assign(row, patch);
          return resolve({ data: [{ id: filters.id }], error: null });
        },
      };
      return builder;
    },
  };
}

describe("transitionOrderStatus (guarded state change)", () => {
  it("changes the status when the order is still in the expected state", async () => {
    const client = makeFakeClient({ o1: { status: "pending_payment" } });
    const ok = await transitionOrderStatus(client, "o1", "pending_payment", { status: "completed" });
    expect(ok).toBe(true);
    expect(client.orders.o1!.status).toBe("completed");
  });

  it("refuses when the order already moved on", async () => {
    const client = makeFakeClient({ o1: { status: "cancelled" } });
    const ok = await transitionOrderStatus(client, "o1", "pending_payment", { status: "completed" });
    expect(ok).toBe(false);
    expect(client.orders.o1!.status).toBe("cancelled");
  });

  it("lets only one of two racing transitions win", async () => {
    const client = makeFakeClient({ o1: { status: "pending_payment" } });
    const [confirm, cancel] = await Promise.all([
      transitionOrderStatus(client, "o1", "pending_payment", { status: "completed" }),
      transitionOrderStatus(client, "o1", "pending_payment", { status: "cancelled" }),
    ]);
    expect([confirm, cancel].filter(Boolean)).toHaveLength(1);
  });
});
