// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeDbStub } from "./_helpers/db-stub";
import { consumePromo } from "../app/api/v1/_lib/promo-use";

const db = makeDbStub();
beforeEach(() => {
  db.reset();
  db.results.promos = { data: { id: "p1", used_count: 4 }, error: null };
  db.results.promo_code_uses = { data: null, error: null };
});

describe("consumePromo (counts a code once, when its order is paid)", () => {
  it("records the use and adds one to the count", async () => {
    await consumePromo(db.client, { code: "WELCOME10", orderId: "o1" });
    expect(db.called("promo_code_uses", "insert")!.args[0]).toMatchObject({ promo_id: "p1", order_id: "o1" });
    expect(db.called("promos", "update")!.args[0]).toEqual({ used_count: 5 });
  });
  it("does nothing for an order with no code", async () => {
    await consumePromo(db.client, { code: null, orderId: "o1" });
    expect(db.touched).toHaveLength(0);
  });
  it("counts an order's code only once, however many times payment is reported", async () => {
    db.results.promo_code_uses = { data: [{ id: "u1" }], error: null };
    await consumePromo(db.client, { code: "WELCOME10", orderId: "o1" });
    expect(db.called("promos", "update")).toBeUndefined();
  });
  it("never throws, so a counting hiccup can't undo a payment", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    db.results.promos = { data: null, error: { message: "boom" } };
    await expect(consumePromo(db.client, { code: "WELCOME10", orderId: "o1" })).resolves.toBeUndefined();
    spy.mockRestore();
  });
});
