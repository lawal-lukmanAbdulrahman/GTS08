// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeDbStub } from "./_helpers/db-stub";
import { NextResponse } from "next/server";

const db = makeDbStub();
vi.mock("@gts/database", () => ({ createServiceClient: () => db.client }));
const mockAdmin = vi.fn();
vi.mock("../app/api/v1/_lib/staff-access", async (orig) => ({ ...(await orig<typeof import("../app/api/v1/_lib/staff-access")>()), requireAdmin: (...a: unknown[]) => mockAdmin(...a) }));
const mockSendCampaign = vi.fn();
vi.mock("../app/api/v1/_lib/campaigns", async (orig) => ({ ...(await orig<typeof import("../app/api/v1/_lib/campaigns")>()), sendCampaign: (...a: unknown[]) => mockSendCampaign(...a) }));
vi.mock("../app/api/v1/_lib/email/after", () => ({ afterResponse: (t: () => Promise<unknown>) => void t() }));

import { NextRequest } from "next/server";
import { GET as list, POST as create } from "../app/api/v1/email-campaigns/route";
import { GET as one, PATCH as patch, DELETE as del } from "../app/api/v1/email-campaigns/[id]/route";
import { POST as send } from "../app/api/v1/email-campaigns/[id]/send/route";
import { GET as cron } from "../app/api/v1/cron/send-campaigns/route";

const ID = "11111111-1111-4111-8111-111111111111";
const ctx = (id = ID) => ({ params: Promise.resolve({ id }) });
const req = (method: string, body?: unknown) => new NextRequest("http://localhost:3000/api/v1/email-campaigns", { method, body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body) });
const DRAFT = { id: ID, subject: "Sale", body_html: "<p>Hi</p>", audience_type: "all", audience_params: null, status: "draft", scheduled_at: null };
const GOOD = { subject: "Sale", body: "Hello", audience_type: "all" };
const deny = () => mockAdmin.mockResolvedValue({ ok: false, response: NextResponse.json({ error: "no" }, { status: 403 }) });

beforeEach(() => {
  db.reset();
  mockAdmin.mockReset().mockResolvedValue({ ok: true, user: { id: "admin-1" }, isAdmin: true });
  mockSendCampaign.mockReset().mockResolvedValue({ sent: 5, failed: 0 });
  db.results.email_campaigns = { data: DRAFT, error: null };
});

describe("campaign routes are for admins", () => {
  it.each([["list", () => list(req("GET"))], ["create", () => create(req("POST", GOOD))], ["get", () => one(req("GET"), ctx())], ["patch", () => patch(req("PATCH", { subject: "x" }), ctx())], ["delete", () => del(req("DELETE"), ctx())], ["send", () => send(req("POST", {}), ctx())]])("%s", async (_n, run) => {
    deny();
    expect((await run()).status).toBe(403);
    expect(db.touched).toHaveLength(0);
  });
});

describe("create, read, edit, delete", () => {
  it("creates a draft, recording who", async () => {
    const res = await create(req("POST", GOOD));
    expect(res.status).toBe(201);
    expect(db.called("email_campaigns", "insert")!.args[0]).toMatchObject({ subject: "Sale", status: "draft", created_by: "admin-1" });
  });
  it("validates, and rejects bad JSON", async () => {
    expect((await create(req("POST", { subject: "" }))).status).toBe(400);
    expect((await create(req("POST", "{nope"))).status).toBe(400);
  });
  it("lists and gets, with the send result if it has been sent", async () => {
    db.results.email_campaigns = { data: [DRAFT], error: null };
    expect((await list(req("GET"))).status).toBe(200);
    db.results.email_campaigns = { data: { ...DRAFT, status: "sent", audience_params: { result: { sent: 4, failed: 1 } } }, error: null };
    expect((await (await one(req("GET"), ctx())).json()).data.result).toEqual({ sent: 4, failed: 1 });
    expect((await one(req("GET"), ctx("nope"))).status).toBe(404);
  });
  it("edits only a draft", async () => {
    expect((await patch(req("PATCH", { subject: "New" }), ctx())).status).toBe(200);
    db.results.email_campaigns = { data: { ...DRAFT, status: "sent" }, error: null };
    const res = await patch(req("PATCH", { subject: "New" }), ctx());
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("NOT_A_DRAFT");
  });
  it("deletes a draft, never a sent campaign", async () => {
    expect((await del(req("DELETE"), ctx())).status).toBe(200);
    db.results.email_campaigns = { data: { ...DRAFT, status: "sent" }, error: null };
    expect((await del(req("DELETE"), ctx())).status).toBe(409);
  });
});

describe("POST /email-campaigns/[id]/send", () => {
  it("sends a draft now, after the response", async () => {
    const res = await send(req("POST", {}), ctx());
    expect(res.status).toBe(202);
    expect(mockSendCampaign).toHaveBeenCalledTimes(1);
  });
  it("schedules for a future time instead of sending", async () => {
    const at = new Date(Date.now() + 3_600_000).toISOString();
    const res = await send(req("POST", { schedule_at: at }), ctx());
    expect(res.status).toBe(200);
    expect(db.called("email_campaigns", "update")!.args[0]).toMatchObject({ status: "scheduled", scheduled_at: at });
    expect(mockSendCampaign).not.toHaveBeenCalled();
  });
  it("refuses a past or invalid schedule, and a campaign that isn't a draft", async () => {
    expect((await send(req("POST", { schedule_at: "2020-01-01T00:00:00Z" }), ctx())).status).toBe(400);
    expect((await send(req("POST", { schedule_at: "soon" }), ctx())).status).toBe(400);
    db.results.email_campaigns = { data: { ...DRAFT, status: "sent" }, error: null };
    expect((await send(req("POST", {}), ctx())).status).toBe(409);
    expect(mockSendCampaign).not.toHaveBeenCalled();
  });
});

describe("GET /cron/send-campaigns", () => {
  it("refuses without the cron secret", async () => {
    process.env.CRON_SECRET = "s3cret";
    expect((await cron(new NextRequest("http://localhost:3000/api/v1/cron/send-campaigns"))).status).toBe(401);
    expect(db.touched).toHaveLength(0);
  });
  it("sends the campaigns that are due", async () => {
    process.env.CRON_SECRET = "s3cret";
    db.results.email_campaigns = { data: [{ ...DRAFT, status: "scheduled" }], error: null };
    const res = await cron(new NextRequest("http://localhost:3000/api/v1/cron/send-campaigns", { headers: { authorization: "Bearer s3cret" } }));
    expect(res.status).toBe(200);
    expect(mockSendCampaign).toHaveBeenCalledTimes(1);
    expect(db.called("email_campaigns", "lte")!.args[0]).toBe("scheduled_at");
  });
});
