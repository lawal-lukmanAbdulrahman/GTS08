// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireAdmin = vi.fn();
vi.mock("../app/api/v1/_lib/staff-access", async (orig) => ({
  ...(await orig<typeof import("../app/api/v1/_lib/staff-access")>()),
  requireAdmin: (...a: unknown[]) => mockRequireAdmin(...a),
}));
const mockSend = vi.fn();
vi.mock("../app/api/v1/_lib/email/send", () => ({ sendEmail: (...a: unknown[]) => mockSend(...a) }));
vi.mock("@gts/database", () => ({ createServiceClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { store_name: "GTS Wears" }, error: null }) }) }) }) }) }));

import { NextRequest } from "next/server";
import { GET, POST } from "../app/api/v1/settings/email/route";

const env = { ...process.env };
let n = 0;
const admin = () => ({ ok: true, user: { id: `admin-${++n}`, email: "boss@gts.ng" }, isAdmin: true, fullName: "Boss" });
const get = () => GET(new NextRequest("http://localhost/api/v1/settings/email"));
const post = () => POST(new NextRequest("http://localhost/api/v1/settings/email", { method: "POST" }));

beforeEach(() => {
  process.env = { ...env, RESEND_API_KEY: "re_secret_key", EMAIL_FROM: "GTS Wears <hello@gts.ng>" };
  mockRequireAdmin.mockReset().mockImplementation(async () => admin());
  mockSend.mockReset().mockResolvedValue({ ok: true, id: "em_1" });
});

describe("GET /settings/email", () => {
  it("says whether email is set up and shows the sender, never the key", async () => {
    const res = await get();
    const body = await res.json();
    expect(body.data).toEqual({ configured: true, from: "GTS Wears <hello@gts.ng>", missing: [] });
    expect(JSON.stringify(body)).not.toContain("re_secret_key");
  });

  it("lists exactly what is missing", async () => {
    delete process.env.EMAIL_FROM;
    expect((await (await get()).json()).data).toEqual({ configured: false, from: null, missing: ["EMAIL_FROM"] });
    delete process.env.RESEND_API_KEY;
    expect((await (await get()).json()).data.missing).toEqual(["RESEND_API_KEY", "EMAIL_FROM"]);
  });

  it("is for admins only", async () => {
    const { NextResponse } = await import("next/server");
    mockRequireAdmin.mockResolvedValue({ ok: false, response: NextResponse.json({}, { status: 403 }) });
    expect((await get()).status).toBe(403);
  });
});

describe("POST /settings/email (send a test)", () => {
  it("sends a test message to the signed-in admin's own address and nobody else's", async () => {
    const res = await post();
    expect(res.status).toBe(200);
    expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ to: "boss@gts.ng" }));
    expect((await res.json()).data).toEqual({ sent: true, to: "boss@gts.ng" });
  });

  it("says plainly when email isn't configured", async () => {
    mockSend.mockResolvedValue({ ok: false, skipped: true, reason: "Email is not configured." });
    const res = await post();
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("EMAIL_NOT_CONFIGURED");
  });

  it("passes on Resend's own explanation when it refuses, so a wrong sender is obvious", async () => {
    mockSend.mockResolvedValue({ ok: false, reason: "Resend answered 403: The gts.ng domain is not verified." });
    const res = await post();
    expect(res.status).toBe(502);
    expect((await res.json()).error).toMatch(/not verified/);
  });

  it("limits how often one admin can send tests", async () => {
    const same = admin();
    mockRequireAdmin.mockResolvedValue(same);
    for (let i = 0; i < 3; i++) expect((await post()).status).toBe(200);
    const res = await post();
    expect(res.status).toBe(429);
    expect(mockSend).toHaveBeenCalledTimes(3);
  });

  it("refuses when the admin has no email address on file", async () => {
    mockRequireAdmin.mockResolvedValue({ ...admin(), user: { id: "x", email: null } });
    expect((await post()).status).toBe(400);
    expect(mockSend).not.toHaveBeenCalled();
  });
});
