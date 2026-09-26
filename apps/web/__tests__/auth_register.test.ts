// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/idempotency", () => ({ withIdempotency: (h: unknown) => h }));
vi.mock("../app/api/v1/_lib/email/after", () => ({ afterResponse: (task: () => Promise<unknown>) => void task() }));
const mockWelcome = vi.fn();
vi.mock("../app/api/v1/_lib/email/events", () => ({ notifyCustomerWelcome: (...a: unknown[]) => mockWelcome(...a) }));

type Call = { table: string; method: string; args: unknown[] };
let calls: Call[] = [];
let existingCustomer: { data: unknown; error: unknown };
let createUser: { data: any; error: any };
vi.mock("@gts/database", () => ({
  createServiceClient: () => ({
    auth: { admin: { createUser: async () => createUser } },
    from: (table: string) => {
      const stub: any = new Proxy({}, {
        get(_t, prop: string) {
          if (prop === "then") return (resolve: (v: unknown) => void) => resolve({ data: null, error: null });
          return (...args: unknown[]) => {
            calls.push({ table, method: prop, args });
            if (prop === "maybeSingle") return Promise.resolve(table === "customers" ? existingCustomer : { data: null, error: null });
            return stub;
          };
        },
      });
      return stub;
    },
  }),
}));

import { NextRequest } from "next/server";
import { POST } from "../app/api/v1/auth/register/route";

const register = (body: unknown) => POST(new NextRequest("http://localhost/api/v1/auth/register", { method: "POST", body: JSON.stringify(body) }));
const GOOD = { email: "Ada@Example.com", password: "Secret123!", full_name: "Ada Obi", phone: "0803 123 4567" };
const on = (table: string, method: string) => calls.filter((c) => c.table === table && c.method === method);

describe("POST /auth/register", () => {
  beforeEach(() => {
    calls = [];
    existingCustomer = { data: null, error: null };
    createUser = { data: { user: { id: "u1" } }, error: null };
    mockWelcome.mockReset().mockResolvedValue(undefined);
  });

  it("creates the account, the customer record, and welcomes them by email", async () => {
    const res = await register(GOOD);
    expect(res.status).toBe(201);
    expect(on("customers", "insert")[0]!.args[0]).toMatchObject({ user_id: "u1", email: "ada@example.com", full_name: "Ada Obi" });
    expect(mockWelcome).toHaveBeenCalledWith(expect.anything(), { name: "Ada Obi", email: "ada@example.com" });
  });

  it("does not upsert on a column with no unique constraint (that call always failed and was swallowed)", async () => {
    await register(GOOD);
    expect(on("customers", "upsert")).toHaveLength(0);
  });

  it("reuses the customer record that already exists for this account instead of adding another", async () => {
    existingCustomer = { data: { id: "c1" }, error: null };
    await register(GOOD);
    expect(on("customers", "insert")).toHaveLength(0);
  });

  it("still registers if the welcome email can't be prepared", async () => {
    mockWelcome.mockRejectedValue(new Error("boom"));
    expect((await register(GOOD)).status).toBe(201);
  });

  it("sends no welcome when the address is already registered", async () => {
    createUser = { data: { user: null }, error: { message: "User already registered" } };
    const res = await register(GOOD);
    expect(res.status).toBe(409);
    expect(mockWelcome).not.toHaveBeenCalled();
  });

  it.each([{}, { ...GOOD, email: "nope" }, { ...GOOD, password: "123" }])("rejects %j without creating anything", async (body) => {
    expect((await register(body)).status).toBe(400);
    expect(mockWelcome).not.toHaveBeenCalled();
  });
});
