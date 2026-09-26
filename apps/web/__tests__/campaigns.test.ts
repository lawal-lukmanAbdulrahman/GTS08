// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeDbStub } from "./_helpers/db-stub";

const db = makeDbStub();
const mockBatch = vi.fn();
vi.mock("../app/api/v1/_lib/email/send", () => ({ sendEmailBatch: (...a: unknown[]) => mockBatch(...a) }));

import { validateCampaign, bodyToHtml, resolveAudience, sendCampaign, MAX_RECIPIENTS } from "../app/api/v1/_lib/campaigns";
import { campaignEmail } from "../app/api/v1/_lib/email/templates";

const ok = (o: unknown, mode: "create" | "update" = "create") => { const r = validateCampaign(o, mode); if (!r.ok) throw new Error(JSON.stringify(r.errors)); return r.value; };
const errs = (o: unknown, mode: "create" | "update" = "create") => { const r = validateCampaign(o, mode); return r.ok ? null : r.errors; };
const BASE = { subject: "  Big   sale ", body: "Hello\n\nSave 20%", audience_type: "all" };

describe("validateCampaign", () => {
  it("accepts a plain-text body and stores it as safe HTML", () => {
    const v = ok({ ...BASE, preview_text: "Save now", cta_label: "Shop", cta_link: "https://gts.ng/sale" });
    expect(v).toMatchObject({ subject: "Big sale", preview_text: "Save now", audience_type: "all", cta_link: "https://gts.ng/sale" });
    expect(v.body_html).toContain("<p");
  });
  it("never lets markup through: the body is escaped", () => {
    expect(bodyToHtml("<script>alert(1)</script>\n\nline2")).not.toContain("<script>");
    expect(bodyToHtml("a\n\nb").match(/<p/g)).toHaveLength(2);
  });
  it("validates every field", () => {
    for (const body of [{}, { ...BASE, subject: "" }, { ...BASE, subject: "x".repeat(256) }, { ...BASE, preview_text: "x".repeat(91) }, { ...BASE, body: "" }, { ...BASE, body: "x".repeat(20001) }, { ...BASE, audience_type: "everyone" }, { ...BASE, cta_link: "javascript:x" }, { ...BASE, cta_label: "Go" }, { ...BASE, audience_type: "custom" }, { ...BASE, audience_type: "custom", audience_params: { emails: ["nope"] } }]) {
      expect(errs(body), JSON.stringify(body).slice(0, 60)).toBeTruthy();
    }
  });
  it("takes a custom list of emails, lower-cased and de-duplicated", () => {
    expect(ok({ ...BASE, audience_type: "custom", audience_params: { emails: ["A@b.co", "a@b.co", "c@d.co"] } }).audience_params).toEqual({ emails: ["a@b.co", "c@d.co"] });
  });
  it("on update, only the fields sent", () => {
    expect(ok({ subject: "New" }, "update")).toEqual({ subject: "New" });
    expect(errs({}, "update")).toEqual({ _body: expect.any(String) });
  });
  it("refuses opted_in_only until consent is recorded somewhere", () => {
    expect(errs({ ...BASE, audience_type: "opted_in_only" })?.audience_type).toMatch(/opt-in/i);
  });
});

describe("resolveAudience", () => {
  beforeEach(() => db.reset());
  it("all: every customer with an address, once each, lower-cased", async () => {
    db.results.customers = { data: [{ email: "A@b.co" }, { email: "a@b.co" }, { email: "c@d.co" }, { email: "" }, { email: "bad" }], error: null };
    expect(await resolveAudience(db.client, "all", null)).toEqual(["a@b.co", "c@d.co"]);
  });
  it("custom: exactly the list given", async () => {
    expect(await resolveAudience(db.client, "custom", { emails: ["x@y.co"] })).toEqual(["x@y.co"]);
  });
  it("ordered_last_30 and never_ordered split customers by paid orders", async () => {
    db.results.customers = { data: [{ id: "c1", email: "a@b.co" }, { id: "c2", email: "c@d.co" }], error: null };
    db.results.orders = { data: [{ customer_id: "c1" }], error: null };
    expect(await resolveAudience(db.client, "ordered_last_30", null)).toEqual(["a@b.co"]);
    expect(await resolveAudience(db.client, "never_ordered", null)).toEqual(["c@d.co"]);
  });
  it("stops at the recipient cap", async () => {
    db.results.customers = { data: Array.from({ length: MAX_RECIPIENTS + 50 }, (_, i) => ({ email: `u${i}@x.co` })), error: null };
    expect(await resolveAudience(db.client, "all", null)).toHaveLength(MAX_RECIPIENTS);
  });
  it("leaves out anyone who has opted out of marketing email, whichever audience", async () => {
    db.results.customers = { data: [{ id: "c1", email: "a@b.co" }, { id: "c2", email: "Out@d.co" }], error: null };
    db.results.users = { data: [{ email: "out@d.co" }], error: null };
    expect(await resolveAudience(db.client, "all", null)).toEqual(["a@b.co"]);
    expect(await resolveAudience(db.client, "custom", { emails: ["a@b.co", "out@d.co"] })).toEqual(["a@b.co"]);
  });
  it("throws (safely) on a database error", async () => {
    db.results.customers = { data: null, error: { message: "boom" } };
    await expect(resolveAudience(db.client, "all", null)).rejects.toThrow();
  });
});

describe("sendCampaign", () => {
  const CAMPAIGN = { id: "cm1", subject: "Sale", preview_text: null, body_html: "<p>Hi</p>", cta_label: null, cta_link: null, audience_type: "custom", audience_params: { emails: ["a@b.co", "c@d.co", "e@f.co"] }, status: "draft" };
  beforeEach(() => {
    db.reset();
    mockBatch.mockReset().mockImplementation(async (messages: unknown[]) => ({ sent: messages.length, failed: 0 }));
    db.results.email_campaigns = { data: [{ id: "cm1" }], error: null };
    db.results.settings = { data: { store_name: "GTS" }, error: null };
  });

  it("claims the campaign so it can only be sent once, sends to each recipient, and records the outcome", async () => {
    const r = await sendCampaign(db.client, CAMPAIGN as never);
    expect(r).toEqual({ sent: 3, failed: 0 });
    expect(mockBatch).toHaveBeenCalledTimes(1);
    expect((mockBatch.mock.calls[0]![0] as Array<{ to: string }>).map((m) => m.to)).toEqual(["a@b.co", "c@d.co", "e@f.co"]);
    const updates = db.calls.email_campaigns!.filter((c) => c.method === "update").map((c) => c.args[0] as Record<string, unknown>);
    expect(updates[0]).toMatchObject({ status: "sending" });
    expect(updates.at(-1)).toMatchObject({ status: "sent", recipient_count: 3 });
  });
  it("puts an unsubscribe route in every message", async () => {
    process.env.EMAIL_REPLY_TO = "help@gts.ng";
    await sendCampaign(db.client, CAMPAIGN as never);
    for (const m of mockBatch.mock.calls[0]![0] as Array<{ headers: Record<string, string>; html: string }>) {
      expect(m.headers["List-Unsubscribe"]).toMatch(/^<mailto:/);
      expect(m.html).toMatch(/unsubscribe/i);
    }
    delete process.env.EMAIL_REPLY_TO;
  });
  it("counts failures without stopping, and is 'failed' only if nothing went out", async () => {
    mockBatch.mockResolvedValueOnce({ sent: 2, failed: 1 });
    expect(await sendCampaign(db.client, CAMPAIGN as never)).toEqual({ sent: 2, failed: 1 });
    db.reset();
    db.results.email_campaigns = { data: [{ id: "cm1" }], error: null };
    db.results.settings = { data: { store_name: "GTS" }, error: null };
    mockBatch.mockReset().mockResolvedValue({ sent: 0, failed: 3 });
    await sendCampaign(db.client, CAMPAIGN as never);
    expect(db.calls.email_campaigns!.filter((c) => c.method === "update").at(-1)!.args[0]).toMatchObject({ status: "failed" });
  });
  it("does nothing if someone else already claimed it", async () => {
    db.results.email_campaigns = { data: [], error: null };
    expect(await sendCampaign(db.client, CAMPAIGN as never)).toBeNull();
    expect(mockBatch).not.toHaveBeenCalled();
  });
  it("marks it failed, rather than leaving it stuck sending, if the audience can't be built", async () => {
    db.results.customers = { data: null, error: { message: "boom" } };
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await sendCampaign(db.client, { ...CAMPAIGN, audience_type: "all", audience_params: null } as never);
    spy.mockRestore();
    expect(db.calls.email_campaigns!.filter((c) => c.method === "update").at(-1)!.args[0]).toMatchObject({ status: "failed" });
  });
});

describe("campaignEmail", () => {
  it("shows the body, the button and how to stop these emails, with an escaped store name", () => {
    const m = campaignEmail({ store: { name: "<b>GTS</b>" }, subject: "Sale", preview: "Save", bodyHtml: "<p>Hi</p>", ctaLabel: "Shop", ctaUrl: "https://gts.ng/sale", unsubscribeEmail: "help@gts.ng" });
    expect(m.html).toContain("<p>Hi</p>");
    expect(m.html).toContain('href="https://gts.ng/sale"');
    expect(m.html).toMatch(/unsubscribe/i);
    expect(m.html).not.toContain("<b>GTS</b>");
    expect(m.text).toContain("help@gts.ng");
  });
});
