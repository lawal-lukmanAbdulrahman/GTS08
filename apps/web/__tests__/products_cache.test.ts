// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeDbStub } from "./_helpers/db-stub";

const db = makeDbStub();
vi.mock("@gts/database", () => ({ createServiceClient: () => db.client }));
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
  it("lets a shared cache keep the public list for a short while, since it is the same for everyone", async () => {
    const res = await GET(new NextRequest("http://localhost:3000/api/v1/products"));
    expect(res.headers.get("Cache-Control")).toBe("public, s-maxage=30, stale-while-revalidate=120");
  });
  it("never lets a shared cache keep an answer given to someone signed in (staff see cost prices)", async () => {
    user = { id: "u1" };
    const res = await GET(new NextRequest("http://localhost:3000/api/v1/products"));
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });
});
