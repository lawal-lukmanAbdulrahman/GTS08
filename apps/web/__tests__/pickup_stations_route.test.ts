// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeDbStub } from "./_helpers/db-stub";
import { NextResponse, NextRequest } from "next/server";

const db = makeDbStub();
vi.mock("@gts/database", () => ({ createServiceClient: () => db.client }));

const mockAdmin = vi.fn();
const mockOptionalStaff = vi.fn();
vi.mock("../app/api/v1/_lib/staff-access", () => ({
  requireAdmin: (...a: unknown[]) => mockAdmin(...a),
  optionalStaff: (...a: unknown[]) => mockOptionalStaff(...a),
}));

import { GET as getStations, POST as createStation } from "../app/api/v1/pickup-stations/route";
import { GET as getStation, PATCH as updateStation, DELETE as deleteStation } from "../app/api/v1/pickup-stations/[id]/route";

const S1 = {
  id: "11111111-2222-3333-4444-555555555555",
  name: "GTS Flagship Store",
  address_line1: "12 Marina, Lagos Island",
  address_line2: "Opposite Union Bank",
  city: "Lagos Island",
  state: "Lagos",
  phone: "08012345678",
  operating_hours: "Mon-Sat: 9am - 7pm",
  notes: "Free parking available",
  is_active: true,
  is_default: true,
};

const req = (method = "GET", url = "http://localhost:3000/api/v1/pickup-stations", body?: unknown) =>
  new NextRequest(url, { method, body: body === undefined ? undefined : JSON.stringify(body) });

beforeEach(() => {
  db.reset();
  mockAdmin.mockReset().mockResolvedValue({ ok: true, user: { id: "admin-1" } });
  mockOptionalStaff.mockReset().mockResolvedValue(null);
  db.results.pickup_stations = { data: [S1], error: null };
  db.results.orders = { data: null, error: null, count: 0 };
});

describe("GET /api/v1/pickup-stations", () => {
  it("returns active pickup stations for public visitors", async () => {
    const res = await getStations(req("GET"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toHaveLength(1);
    expect(json.data[0].name).toBe("GTS Flagship Store");

    const calls = db.calls.pickup_stations!;
    expect(calls.some((c) => c.method === "eq" && c.args[0] === "is_active" && c.args[1] === true)).toBe(true);
  });

  it("returns all stations (including inactive) when staff query with all=true", async () => {
    mockOptionalStaff.mockResolvedValue({ user: { id: "staff-1" }, role: "admin" });
    const res = await getStations(req("GET", "http://localhost:3000/api/v1/pickup-stations?all=true"));
    expect(res.status).toBe(200);

    const calls = db.calls.pickup_stations!;
    expect(calls.some((c) => c.method === "eq" && c.args[0] === "is_active")).toBe(false);
  });
});

describe("POST /api/v1/pickup-stations", () => {
  it("denies non-admin callers", async () => {
    mockAdmin.mockResolvedValue({ ok: false, response: NextResponse.json({ error: "no" }, { status: 403 }) });
    const res = await createStation(req("POST", undefined, { name: "Ikeja Hub", address_line1: "Allen" }));
    expect(res.status).toBe(403);
  });

  it("validates required name and address_line1", async () => {
    let res = await createStation(req("POST", undefined, { name: "" }));
    expect(res.status).toBe(400);

    res = await createStation(req("POST", undefined, { name: "Ikeja Hub", address_line1: "" }));
    expect(res.status).toBe(400);
  });

  it("creates a station and unsets previous default if new station is default", async () => {
    db.results.pickup_stations = { data: { ...S1, id: "22222222-2222-3333-4444-555555555555", name: "Ikeja Hub" }, error: null };
    const res = await createStation(req("POST", undefined, {
      name: "Ikeja Hub",
      address_line1: "15 Allen Ave",
      city: "Ikeja",
      is_default: true,
    }));

    expect(res.status).toBe(201);
    expect(db.called("pickup_stations", "insert")).toBeTruthy();
    expect(db.called("pickup_stations", "update")).toBeTruthy();
  });
});

describe("GET /api/v1/pickup-stations/[id]", () => {
  const ctx = { params: Promise.resolve({ id: S1.id }) };

  it("returns station details when found", async () => {
    db.results.pickup_stations = { data: S1, error: null };
    const res = await getStation(req("GET"), ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.name).toBe("GTS Flagship Store");
  });

  it("404s when station does not exist", async () => {
    db.results.pickup_stations = { data: null, error: null };
    const res = await getStation(req("GET"), ctx);
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/v1/pickup-stations/[id]", () => {
  const ctx = { params: Promise.resolve({ id: S1.id }) };

  it("denies non-admin callers", async () => {
    mockAdmin.mockResolvedValue({ ok: false, response: NextResponse.json({ error: "no" }, { status: 403 }) });
    const res = await updateStation(req("PATCH", undefined, { name: "New Name" }), ctx);
    expect(res.status).toBe(403);
  });

  it("rejects empty name update", async () => {
    const res = await updateStation(req("PATCH", undefined, { name: "  " }), ctx);
    expect(res.status).toBe(400);
  });

  it("updates station attributes successfully", async () => {
    db.results.pickup_stations = { data: { ...S1, name: "Updated Name" }, error: null };
    const res = await updateStation(req("PATCH", undefined, { name: "Updated Name" }), ctx);
    expect(res.status).toBe(200);
    expect(db.called("pickup_stations", "update")).toBeTruthy();
  });
});

describe("DELETE /api/v1/pickup-stations/[id]", () => {
  const ctx = { params: Promise.resolve({ id: S1.id }) };

  it("denies non-admin callers", async () => {
    mockAdmin.mockResolvedValue({ ok: false, response: NextResponse.json({ error: "no" }, { status: 403 }) });
    const res = await deleteStation(req("DELETE"), ctx);
    expect(res.status).toBe(403);
  });

  it("soft-deletes (sets is_active: false) when orders reference this station", async () => {
    db.results.orders = { data: null, error: null, count: 5 };
    const res = await deleteStation(req("DELETE"), ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.deactivated).toBe(true);
    expect(db.called("pickup_stations", "update")).toBeTruthy();
  });

  it("hard-deletes when no orders reference this station", async () => {
    db.results.orders = { data: null, error: null, count: 0 };
    const res = await deleteStation(req("DELETE"), ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(db.called("pickup_stations", "delete")).toBeTruthy();
  });
});
