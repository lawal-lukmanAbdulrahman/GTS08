import { describe, it, expect } from "vitest";
import { adjustInventory, adjustAll } from "../app/api/v1/pos/_lib/inventory";

interface FakeRow {
  quantity: number;
  reserved_quantity: number;
}

/**
 * In-memory stand-in for the inventory table that behaves like Postgres for
 * the one property that matters here: an UPDATE ... WHERE quantity = X only
 * applies if the row still holds X at write time. Reads yield to the event
 * loop so concurrent callers genuinely interleave read -> read -> write.
 */
function makeFakeClient(rows: Record<string, FakeRow>) {
  const failNextUpdateFor = new Set<string>();
  const client = {
    rows,
    failNextUpdateFor,
    from(_table: string) {
      const filters: Record<string, unknown> = {};
      let updateValues: Partial<FakeRow> | null = null;
      const builder: any = {
        select() {
          return builder;
        },
        update(values: Partial<FakeRow>) {
          updateValues = values;
          return builder;
        },
        eq(column: string, value: unknown) {
          filters[column] = value;
          return builder;
        },
        async maybeSingle() {
          await Promise.resolve();
          await Promise.resolve();
          const row = rows[filters.variant_id as string];
          return { data: row ? { ...row } : null, error: null };
        },
        then(resolve: (value: unknown) => void) {
          const id = filters.variant_id as string;
          const row = rows[id];
          if (failNextUpdateFor.has(id)) {
            failNextUpdateFor.delete(id);
            return resolve({ data: null, error: { message: "boom" } });
          }
          const matches =
            row &&
            (filters.quantity === undefined || filters.quantity === row.quantity) &&
            (filters.reserved_quantity === undefined || filters.reserved_quantity === row.reserved_quantity);
          if (!matches || !updateValues) return resolve({ data: [], error: null });
          if (updateValues.quantity !== undefined) row.quantity = updateValues.quantity;
          if (updateValues.reserved_quantity !== undefined) row.reserved_quantity = updateValues.reserved_quantity;
          return resolve({ data: [{ variant_id: id }], error: null });
        },
      };
      return builder;
    },
  };
  return client;
}

describe("adjustInventory (compare-and-swap stock changes)", () => {
  it("decrements quantity when enough stock is available", async () => {
    const client = makeFakeClient({ v1: { quantity: 5, reserved_quantity: 0 } });
    const result = await adjustInventory(client, { variantId: "v1", deltaQuantity: -2, requireAvailable: 2 });
    expect(result.ok).toBe(true);
    expect(client.rows.v1!).toEqual({ quantity: 3, reserved_quantity: 0 });
  });

  it("refuses when available (quantity - reserved) is below the requirement", async () => {
    const client = makeFakeClient({ v1: { quantity: 5, reserved_quantity: 4 } });
    const result = await adjustInventory(client, { variantId: "v1", deltaQuantity: -2, requireAvailable: 2 });
    expect(result).toMatchObject({ ok: false, reason: "INSUFFICIENT_STOCK", available: 1 });
    expect(client.rows.v1!).toEqual({ quantity: 5, reserved_quantity: 4 });
  });

  it("reports a missing inventory row as insufficient stock", async () => {
    const client = makeFakeClient({});
    const result = await adjustInventory(client, { variantId: "ghost", deltaQuantity: -1, requireAvailable: 1 });
    expect(result).toMatchObject({ ok: false, reason: "INSUFFICIENT_STOCK", available: 0 });
  });

  it("never lets two cashiers both take the last unit", async () => {
    const client = makeFakeClient({ v1: { quantity: 1, reserved_quantity: 0 } });
    const [a, b] = await Promise.all([
      adjustInventory(client, { variantId: "v1", deltaQuantity: -1, requireAvailable: 1 }),
      adjustInventory(client, { variantId: "v1", deltaQuantity: -1, requireAvailable: 1 }),
    ]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
    expect(client.rows.v1!.quantity).toBe(0);
  });

  it("serialises many concurrent sales without overselling", async () => {
    const client = makeFakeClient({ v1: { quantity: 3, reserved_quantity: 0 } });
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        adjustInventory(client, { variantId: "v1", deltaQuantity: -1, requireAvailable: 1 })
      )
    );
    expect(results.filter((r) => r.ok)).toHaveLength(3);
    expect(client.rows.v1!.quantity).toBe(0);
  });

  it("does not let a reservation and a sale double-book the same unit", async () => {
    const client = makeFakeClient({ v1: { quantity: 1, reserved_quantity: 0 } });
    const [reserve, sale] = await Promise.all([
      adjustInventory(client, { variantId: "v1", deltaReserved: 1, requireAvailable: 1 }),
      adjustInventory(client, { variantId: "v1", deltaQuantity: -1, requireAvailable: 1 }),
    ]);
    expect([reserve.ok, sale.ok].filter(Boolean)).toHaveLength(1);
  });

  it("confirming a reservation releases it and takes the stock in one change", async () => {
    const client = makeFakeClient({ v1: { quantity: 4, reserved_quantity: 2 } });
    const result = await adjustInventory(client, { variantId: "v1", deltaQuantity: -2, deltaReserved: -2 });
    expect(result.ok).toBe(true);
    expect(client.rows.v1!).toEqual({ quantity: 2, reserved_quantity: 0 });
  });

  it("surfaces a database error instead of retrying forever", async () => {
    const client = makeFakeClient({ v1: { quantity: 5, reserved_quantity: 0 } });
    client.failNextUpdateFor.add("v1");
    const result = await adjustInventory(client, { variantId: "v1", deltaQuantity: -1, requireAvailable: 1 });
    expect(result).toMatchObject({ ok: false, reason: "DATABASE_ERROR" });
  });
});

describe("adjustAll (multi-line orders, all-or-nothing)", () => {
  it("applies every line when all have stock", async () => {
    const client = makeFakeClient({
      v1: { quantity: 5, reserved_quantity: 0 },
      v2: { quantity: 5, reserved_quantity: 0 },
    });
    const result = await adjustAll(client, [
      { variantId: "v1", deltaQuantity: -1, requireAvailable: 1 },
      { variantId: "v2", deltaQuantity: -2, requireAvailable: 2 },
    ]);
    expect(result.ok).toBe(true);
    expect(client.rows.v1!.quantity).toBe(4);
    expect(client.rows.v2!.quantity).toBe(3);
  });

  it("rolls back earlier lines when a later line fails", async () => {
    const client = makeFakeClient({
      v1: { quantity: 5, reserved_quantity: 0 },
      v2: { quantity: 0, reserved_quantity: 0 },
    });
    const result = await adjustAll(client, [
      { variantId: "v1", deltaQuantity: -3, requireAvailable: 3 },
      { variantId: "v2", deltaQuantity: -1, requireAvailable: 1 },
    ]);
    expect(result).toMatchObject({ ok: false, failedVariantId: "v2", reason: "INSUFFICIENT_STOCK" });
    expect(client.rows.v1!).toEqual({ quantity: 5, reserved_quantity: 0 });
  });
});

describe("adjustInventory with clampReserved (releasing a reservation that may never have been made)", () => {
  it("sells the stock and leaves reserved at zero when nothing was reserved", async () => {
    const client = makeFakeClient({ v1: { quantity: 10, reserved_quantity: 0 } });
    const r = await adjustInventory(client, { variantId: "v1", deltaQuantity: -3, deltaReserved: -3, clampReserved: true });
    expect(r.ok).toBe(true);
    expect(client.rows.v1).toEqual({ quantity: 7, reserved_quantity: 0 });
  });

  it("releases only what was actually reserved", async () => {
    const client = makeFakeClient({ v1: { quantity: 10, reserved_quantity: 2 } });
    await adjustInventory(client, { variantId: "v1", deltaQuantity: -3, deltaReserved: -3, clampReserved: true });
    expect(client.rows.v1).toEqual({ quantity: 7, reserved_quantity: 0 });
  });

  it("without the option a negative reservation is still refused (POS behaviour is unchanged)", async () => {
    const client = makeFakeClient({ v1: { quantity: 10, reserved_quantity: 0 } });
    const r = await adjustInventory(client, { variantId: "v1", deltaQuantity: -3, deltaReserved: -3 });
    expect(r.ok).toBe(false);
    expect(client.rows.v1).toEqual({ quantity: 10, reserved_quantity: 0 });
  });

  it("still refuses to take more stock than exists", async () => {
    const client = makeFakeClient({ v1: { quantity: 2, reserved_quantity: 0 } });
    const r = await adjustInventory(client, { variantId: "v1", deltaQuantity: -3, deltaReserved: -3, clampReserved: true });
    expect(r.ok).toBe(false);
  });
});
