// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeDbStub } from "./_helpers/db-stub";
import { NextResponse } from "next/server";

const db = makeDbStub();
vi.mock("@gts/database", () => ({ createServiceClient: () => db.client }));
const mockPerm = vi.fn();
const mockAdmin = vi.fn();
vi.mock("../app/api/v1/_lib/staff-access", async (orig) => ({
  ...(await orig<typeof import("../app/api/v1/_lib/staff-access")>()),
  requirePermission: (...a: unknown[]) => mockPerm(...a),
  requireAdmin: (...a: unknown[]) => mockAdmin(...a),
}));

import { NextRequest } from "next/server";
import { GET as guideGet, PUT as guidePut } from "../app/api/v1/size-guides/[categorySlug]/route";
import { GET as slotsList } from "../app/api/v1/content-slots/route";
import { GET as slotGet, PUT as slotPut } from "../app/api/v1/content-slots/[key]/route";

const req = (method: string, body?: unknown) => new NextRequest("http://localhost:3000/api/v1/x", { method, body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body) });
const slug = (categorySlug: string) => ({ params: Promise.resolve({ categorySlug }) });
const key = (k: string) => ({ params: Promise.resolve({ key: k }) });
const denyPerm = () => mockPerm.mockResolvedValue({ ok: false, response: NextResponse.json({ error: "no" }, { status: 403 }) });
const denyAdmin = () => mockAdmin.mockResolvedValue({ ok: false, response: NextResponse.json({ error: "no" }, { status: 403 }) });
const CHART = { columns: ["Size", "Chest (cm)"], rows: [["S", 90], ["M", 96]] };

beforeEach(() => {
  db.reset();
  mockPerm.mockReset().mockResolvedValue({ ok: true, user: { id: "a1" }, isAdmin: true });
  mockAdmin.mockReset().mockResolvedValue({ ok: true, user: { id: "a1" }, isAdmin: true });
  db.results.categories = { data: { id: "c1", slug: "shirts" }, error: null };
  db.results.size_guides = { data: { title: "Size Guide", chart_data: CHART, how_to_measure: "Use a tape.", updated_at: "x" }, error: null };
  db.results.content_slots = { data: [], error: null };
});

describe("size guides", () => {
  it("is public: a category's guide by its slug", async () => {
    const res = await guideGet(req("GET"), slug("shirts"));
    expect(res.status).toBe(200);
    expect((await res.json()).data).toMatchObject({ title: "Size Guide", chart_data: CHART });
    expect(mockPerm).not.toHaveBeenCalled();
  });
  it("404s an unknown category or one with no guide, and never queries a malformed slug", async () => {
    db.results.categories = { data: null, error: null };
    expect((await guideGet(req("GET"), slug("nope"))).status).toBe(404);
    db.results.categories = { data: { id: "c1" }, error: null };
    db.results.size_guides = { data: null, error: null };
    expect((await guideGet(req("GET"), slug("shirts"))).status).toBe(404);
    db.reset();
    expect((await guideGet(req("GET"), slug("Bad Slug;--"))).status).toBe(404);
    expect(db.touched).toHaveLength(0);
  });
  it("PUT needs can_manage_products", async () => {
    denyPerm();
    expect((await guidePut(req("PUT", { chart_data: CHART }), slug("shirts"))).status).toBe(403);
    expect(db.touched).toHaveLength(0);
  });
  it("PUT creates or updates the guide for the category", async () => {
    const res = await guidePut(req("PUT", { title: " Shirt sizes ", chart_data: CHART, how_to_measure: "Measure the chest." }), slug("shirts"));
    expect(res.status).toBe(200);
    expect(db.called("size_guides", "upsert")!.args[0]).toMatchObject({ category_id: "c1", title: "Shirt sizes", chart_data: CHART });
  });
  it("PUT validates the chart, title and text", async () => {
    for (const body of [{}, { chart_data: "x" }, { chart_data: { columns: [], rows: [] } }, { chart_data: { columns: ["A"], rows: [["a", "b"]] } }, { chart_data: { columns: Array.from({ length: 11 }, () => "c"), rows: [] } }, { chart_data: { columns: ["A"], rows: Array.from({ length: 51 }, () => ["x"]) } }, { chart_data: { columns: ["A"], rows: [[{}]] } }, { chart_data: CHART, title: "x".repeat(101) }, { chart_data: CHART, how_to_measure: "x".repeat(5001) }]) {
      expect((await guidePut(req("PUT", body), slug("shirts"))).status, JSON.stringify(body).slice(0, 70)).toBe(400);
    }
    db.results.categories = { data: null, error: null };
    expect((await guidePut(req("PUT", { chart_data: CHART }), slug("nope"))).status).toBe(404);
  });
});

describe("content slots", () => {
  it("lists only active slots inside their dates, publicly", async () => {
    await slotsList(req("GET"));
    const eqs = db.calls.content_slots!.filter((c) => c.method === "eq").map((c) => c.args);
    expect(eqs).toEqual([["is_active", true]]);
    expect(db.calls.content_slots!.some((c) => c.method === "or")).toBe(true);
  });
  it("gets one slot by key, hiding one that isn't live, and rejects unknown keys", async () => {
    db.results.content_slots = { data: { slot_key: "hero_1", headline: "Hi", is_active: true, start_date: null, end_date: null }, error: null };
    expect((await slotGet(req("GET"), key("hero_1"))).status).toBe(200);
    db.results.content_slots = { data: { slot_key: "hero_1", is_active: false }, error: null };
    expect((await slotGet(req("GET"), key("hero_1"))).status).toBe(404);
    db.results.content_slots = { data: { slot_key: "hero_1", is_active: true, start_date: "2999-01-01T00:00:00Z", end_date: null }, error: null };
    expect((await slotGet(req("GET"), key("hero_1"))).status).toBe(404);
    expect((await slotGet(req("GET"), key("evil"))).status).toBe(404);
  });
  it("PUT needs an admin", async () => {
    denyAdmin();
    expect((await slotPut(req("PUT", { headline: "x" }), key("hero_1"))).status).toBe(403);
  });
  it("PUT saves the slot, recording who", async () => {
    const res = await slotPut(req("PUT", { headline: " Big sale ", cta_link: "/shop", is_active: true, start_date: "2026-09-01T00:00:00Z", end_date: null, slot_key: "hero_2", updated_by: "x" }), key("hero_1"));
    expect(res.status).toBe(200);
    const row = db.called("content_slots", "upsert")!.args[0] as Record<string, unknown>;
    expect(row).toMatchObject({ slot_key: "hero_1", headline: "Big sale", cta_link: "/shop", is_active: true, updated_by: "a1" });
  });
  it("PUT validates: unknown key, long text, unsafe links, bad dates, end before start", async () => {
    expect((await slotPut(req("PUT", { headline: "x" }), key("evil"))).status).toBe(404);
    for (const body of [{}, { headline: "x".repeat(201) }, { cta_link: "javascript:alert(1)" }, { cta_link: "//evil.example" }, { cta_link: "http://plain.example" }, { is_active: "yes" }, { start_date: "soon" }, { start_date: "2026-09-10T00:00:00Z", end_date: "2026-09-01T00:00:00Z" }]) {
      expect((await slotPut(req("PUT", body), key("hero_1"))).status, JSON.stringify(body)).toBe(400);
    }
    expect((await slotPut(req("PUT", { cta_link: "https://gts.ng/sale" }), key("hero_1"))).status).toBe(200);
  });
});
