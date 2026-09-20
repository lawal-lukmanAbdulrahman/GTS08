import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetUser = vi.fn();
vi.mock("../app/api/v1/auth/utils", () => ({
  getAuthenticatedUser: (...args: unknown[]) => mockGetUser(...args),
}));

let roleResult: { data: unknown; error: unknown } = { data: null, error: null };
let settingsRead: { data: unknown; error: unknown } = { data: null, error: null };
let upsertResult: { data: unknown; error: unknown } = { data: null, error: null };
const upsertSpy = vi.fn();
const readQueue: Array<{ data: unknown; error: unknown }> = [];
const upsertQueue: Array<{ data: unknown; error: unknown }> = [];

function makeFrom(table: string) {
  const stub: any = {
    select: vi.fn(() => stub),
    eq: vi.fn(() => stub),
    upsert: vi.fn((...args: unknown[]) => {
      upsertSpy(table, ...args);
      return stub;
    }),
    single: vi.fn(() => Promise.resolve(table === "users" ? roleResult : upsertQueue.shift() ?? upsertResult)),
    maybeSingle: vi.fn(() => Promise.resolve(table === "users" ? roleResult : readQueue.shift() ?? settingsRead)),
  };
  return stub;
}
vi.mock("@gts/database", () => ({
  createServiceClient: () => ({ from: (table: string) => makeFrom(table) }),
}));

import { NextRequest } from "next/server";
import { GET, PATCH } from "../app/api/v1/settings/route";

const STORE = {
  store_name: "GTS",
  store_address: "12 Allen Avenue, Ikeja, Lagos",
  support_phone: "0803 123 4567",
  whatsapp_number: null,
  support_email: "hello@gts.ng",
};

function patch(body: unknown) {
  return new NextRequest("http://localhost:3000/api/v1/settings", {
    method: "PATCH",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("GET /api/v1/settings", () => {
  beforeEach(() => {
    settingsRead = { data: STORE, error: null };
  });

  it("returns the public store details without needing a login", async () => {
    const res = await GET(new NextRequest("http://localhost:3000/api/v1/settings"));
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual(STORE);
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it("falls back to defaults if the settings row doesn't exist yet", async () => {
    settingsRead = { data: null, error: null };
    const res = await GET(new NextRequest("http://localhost:3000/api/v1/settings"));
    const { data } = await res.json();
    expect(data.store_name).toBe("GTS");
    expect(data.store_address).toBeNull();
  });

  it("still returns the details, with the default website, if the website column isn't in the database yet", async () => {
    readQueue.push({ data: null, error: { message: "column settings.store_website does not exist" } });
    settingsRead = { data: STORE, error: null };
    const res = await GET(new NextRequest("http://localhost:3000/api/v1/settings"));
    expect(res.status).toBe(200);
    expect((await res.json()).data).toMatchObject({ store_name: "GTS", store_website: null });
  });

  it("reports a database error", async () => {
    settingsRead = { data: null, error: { message: "boom" } };
    const res = await GET(new NextRequest("http://localhost:3000/api/v1/settings"));
    expect(res.status).toBe(500);
    expect((await res.json()).code).toBe("DATABASE_ERROR");
  });
});

describe("PATCH /api/v1/settings website (before the column exists)", () => {
  beforeEach(() => {
    upsertSpy.mockReset();
    mockGetUser.mockResolvedValue({ id: "admin-1", email: "admin@gts.ng" });
    roleResult = { data: { role: "admin", is_blocked: false }, error: null };
  });

  it("saves the other fields and says the website couldn't be saved yet", async () => {
    upsertQueue.push({ data: null, error: { message: "Could not find the 'store_website' column of 'settings' in the schema cache" } });
    upsertResult = { data: STORE, error: null };
    const res = await PATCH(patch({ store_name: "GTS", store_website: "gtswears.com" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.warning).toMatch(/website/i);
    expect(upsertSpy.mock.calls.at(-1)![1]).not.toHaveProperty("store_website");
  });
});

describe("PATCH /api/v1/settings (admin only)", () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    upsertSpy.mockReset();
    mockGetUser.mockResolvedValue({ id: "admin-1", email: "admin@gts.ng" });
    roleResult = { data: { role: "admin" }, error: null };
    upsertResult = { data: STORE, error: null };
  });

  it("returns 401 with no login", async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await PATCH(patch({ store_name: "X" }));
    expect(res.status).toBe(401);
    expect(upsertSpy).not.toHaveBeenCalled();
  });

  it.each(["cashier", "inventory_staff", "customer"])("returns 403 for a %s, even one with POS access", async (role) => {
    roleResult = { data: { role }, error: null };
    const res = await PATCH(patch({ store_name: "X" }));
    expect(res.status).toBe(403);
    expect(upsertSpy).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid JSON", async () => {
    const res = await PATCH(patch("{not json"));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_BODY");
  });

  it("returns 400 with field errors for invalid values and writes nothing", async () => {
    const res = await PATCH(patch({ store_name: "", support_phone: "abc" }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(Object.keys(body.details).sort()).toEqual(["store_name", "support_phone"]);
    expect(upsertSpy).not.toHaveBeenCalled();
  });

  it("saves only the validated store fields onto the singleton row", async () => {
    const res = await PATCH(
      patch({ store_address: "  12 Allen Avenue,\nIkeja ", tax_rate: 0, currency: "USD" })
    );
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual(STORE);

    const [table, row, options] = upsertSpy.mock.calls[0]!;
    expect(table).toBe("settings");
    expect(row).toMatchObject({
      id: "00000000-0000-0000-0000-000000000001",
      store_address: "12 Allen Avenue, Ikeja",
    });
    expect(row).not.toHaveProperty("tax_rate");
    expect(row).not.toHaveProperty("currency");
    expect(row).toHaveProperty("updated_at");
    expect(options).toEqual({ onConflict: "id" });
  });

  it("lets an admin clear an optional field", async () => {
    await PATCH(patch({ support_phone: "" }));
    expect(upsertSpy.mock.calls[0]![1]).toMatchObject({ support_phone: null });
  });

  it("reports a database error", async () => {
    upsertResult = { data: null, error: { message: "column store_address does not exist" } };
    const res = await PATCH(patch({ store_address: "x" }));
    expect(res.status).toBe(500);
    expect((await res.json()).code).toBe("DATABASE_ERROR");
  });
});
