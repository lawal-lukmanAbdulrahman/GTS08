// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeDbStub } from "./_helpers/db-stub";

const db = makeDbStub();
vi.mock("@gts/database", () => ({ createServiceClient: () => db.client, getRequestDataMode: async () => "live" }));
let user: { id: string } | null = null;
vi.mock("../app/api/v1/auth/utils", async (orig) => ({ ...(await orig<typeof import("../app/api/v1/auth/utils")>()), getAuthenticatedUser: async () => user }));

import { NextRequest } from "next/server";
import { GET } from "../app/api/v1/products/route";

beforeEach(() => {
  db.reset();
  user = null;
  db.results.products = { data: [], error: null, count: 0 };
  db.results.users = { data: { role: "customer" }, error: null };
});

describe("GET /products caching", () => {
  it("is not kept by a shared cache: the list differs between the demo account and everyone else", async () => {
    const res = await GET(new NextRequest("http://localhost:3000/api/v1/products"));
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });
  it("tells the dashboard when each product was last changed", async () => {
    db.results.products = { data: [{ id: "p1", name: "Shirt", slug: "shirt", base_price: 100, status: "active", created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-20T10:00:00Z", images: [], variants: [] }], error: null, count: 1 };
    const { data } = await (await GET(new NextRequest("http://localhost:3000/api/v1/products"))).json();
    expect(data[0].updated_at).toBe("2026-09-20T10:00:00Z");
  });
  it("never lets a shared cache keep an answer given to someone signed in (staff see cost prices)", async () => {
    user = { id: "u1" };
    const res = await GET(new NextRequest("http://localhost:3000/api/v1/products"));
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });
});
