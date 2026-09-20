// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeDbStub } from "./_helpers/db-stub";

const db = makeDbStub();
vi.mock("@gts/database", () => ({ createServiceClient: () => db.client }));
let authUser: { id: string; email?: string } | null = null;
vi.mock("../app/api/v1/auth/utils", async (orig) => ({ ...(await orig<typeof import("../app/api/v1/auth/utils")>()), getAuthenticatedUser: async () => authUser }));

import { NextRequest } from "next/server";
import { GET } from "../app/api/v1/orders/customer/route";

const call = (qs = "") => GET(new NextRequest(`http://localhost:3000/api/v1/orders/customer${qs}`));

beforeEach(() => {
  db.reset();
  authUser = null;
  db.results.customers = { data: [{ id: "c1" }], error: null };
  db.results.orders = { data: [{ id: "o1", order_number: "GTS-1", status: "paid" }], error: null };
});

describe("GET /orders/customer shows a signed-in person their own orders and nobody else's", () => {
  it("refuses a caller who isn't signed in, whatever they put in the address, without touching the database", async () => {
    for (const qs of ["", "?email=victim@example.com", "?customerId=11111111-1111-4111-8111-111111111111", "?userId=abc"]) {
      const res = await call(qs);
      expect(res.status, qs).toBe(401);
    }
    expect(db.touched).toHaveLength(0);
  });

  it("looks up only the signed-in user's own customer records, ignoring email, customerId and userId in the address", async () => {
    authUser = { id: "u1", email: "Me@Example.com" };
    await call("?email=victim@example.com&customerId=11111111-1111-4111-8111-111111111111&userId=someone-else");
    const or = db.called("customers", "or")!.args[0] as string;
    expect(or).toContain("user_id.eq.u1");
    expect(or).toContain("email.eq.me@example.com");
    expect(or).not.toMatch(/victim|someone-else|1111/);
    const ids = db.called("orders", "in")!.args[1] as string[];
    expect(ids).toEqual(["c1"]);
  });

  it("never sends internal columns: IP address, session, notes, cashier", async () => {
    authUser = { id: "u1", email: "me@example.com" };
    await call();
    const select = String(db.called("orders", "select")!.args[0]);
    expect(select).not.toMatch(/\*|ip_address|session_id|internal_notes|cashier_id/);
    expect(select).toContain("order_number");
  });

  it("returns an empty list when they have no orders, and hides internal errors", async () => {
    authUser = { id: "u1", email: "me@example.com" };
    db.results.customers = { data: [], error: null };
    expect((await (await call()).json()).data).toEqual([]);
    db.results.customers = { data: [{ id: "c1" }], error: null };
    db.results.orders = { data: null, error: { message: "relation secret_t missing" } };
    const res = await call();
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toMatch(/secret_t/);
  });

  it("can't be made to add filters through an email containing filter syntax", async () => {
    authUser = { id: "u1", email: "a@b.co,role.eq.admin" };
    await call();
    const or = db.called("customers", "or")!.args[0] as string;
    expect((or.match(/,/g) ?? []).length).toBe(1); // only the one we wrote between the two conditions
  });
});
