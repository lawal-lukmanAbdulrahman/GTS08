// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { makeDbStub } from "./_helpers/db-stub";
import { filterText, filterEmail } from "../app/api/v1/_lib/filter";

const db = makeDbStub();
vi.mock("@gts/database", () => ({ createServiceClient: () => db.client }));

describe("filterText / filterEmail (what may be put into a database filter)", () => {
  it("keeps letters, numbers, spaces and a few harmless marks, and drops anything that could change the filter", () => {
    expect(filterText("air fryer 5.5L-pro")).toBe("air fryer 5.5L-pro");
    expect(filterText("x%,status.eq.draft")).toBe("xstatus.eq.draft");
    expect(filterText("a(b)c*d\\e'f\"g;h")).toBe("abcdefgh");
    expect(filterText("é ü 日本")).toBe("é ü 日本");
  });
  it("trims and caps the length", () => {
    expect(filterText("  hi  ")).toBe("hi");
    expect(filterText("x".repeat(500))).toHaveLength(60);
  });
  it("makes an email safe to put in a filter", () => {
    expect(filterEmail("Me@Example.com")).toBe("me@example.com");
    expect(filterEmail("a@b.co,role.eq.admin")).toBe("a@b.corole.eq.admin".replace("corole", "co" + "role")); // no comma survives
    expect(filterEmail("a@b.co,x")).not.toContain(",");
  });
});

describe("GET /products/search", () => {
  it("can't have extra filter conditions added through the search text", async () => {
    const { GET } = await import("../app/api/v1/products/search/route");
    const { NextRequest } = await import("next/server");
    db.results.products = { data: [], error: null, count: 0 };
    await GET(new NextRequest("http://localhost:3000/api/v1/products/search?q=" + encodeURIComponent("x%,status.eq.draft,cost_price.gt.0")));
    const or = db.called("products", "or")!.args[0] as string;
    // Only the three commas between the four conditions we wrote may remain.
    expect((or.match(/,/g) ?? []).length).toBe(3);
    expect(or).not.toMatch(/[()%]\s*,\s*status/);
  });
});
