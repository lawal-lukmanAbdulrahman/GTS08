// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendEmail } from "../app/api/v1/_lib/email/send";
import { esc } from "../app/api/v1/_lib/email/html";

const fetchMock = vi.fn();
const env = { ...process.env };
const MSG = { to: "ada@example.com", subject: "Hello", html: "<p>Hi</p>", text: "Hi" };

beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue(new Response(JSON.stringify({ id: "em_1" }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  process.env.RESEND_API_KEY = "re_test_key";
  process.env.EMAIL_FROM = "GTS <hello@gts.ng>";
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  process.env = { ...env };
});

describe("sendEmail (Resend)", () => {
  it("posts the message to Resend with the key, sender, recipient and both bodies", async () => {
    const r = await sendEmail(MSG);
    expect(r).toEqual({ ok: true, id: "em_1" });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers.Authorization).toBe("Bearer re_test_key");
    expect(JSON.parse(init.body)).toMatchObject({ from: "GTS <hello@gts.ng>", to: ["ada@example.com"], subject: "Hello", html: "<p>Hi</p>", text: "Hi" });
  });

  it("does nothing, quietly, when Resend isn't configured (dev machines, CI)", async () => {
    delete process.env.RESEND_API_KEY;
    const r = await sendEmail(MSG);
    expect(r).toMatchObject({ ok: false, skipped: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does nothing when there is no sender address configured", async () => {
    delete process.env.EMAIL_FROM;
    expect(await sendEmail(MSG)).toMatchObject({ ok: false, skipped: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["", "not-an-email", "a@b", "x@y.com, evil@z.com", "a@b.com\nBcc: c@d.com", "  "])("refuses to send to %j", async (to) => {
    expect(await sendEmail({ ...MSG, to })).toMatchObject({ ok: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports (never throws) when Resend refuses", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ message: "domain not verified" }), { status: 403 }));
    const r = await sendEmail(MSG);
    expect(r).toMatchObject({ ok: false });
    expect(r.ok === false && r.reason).toMatch(/403/);
  });

  it("reports (never throws) when the network fails", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    expect(await sendEmail(MSG)).toMatchObject({ ok: false });
  });

  it("never puts the API key or the message body in a log line", async () => {
    fetchMock.mockResolvedValue(new Response("nope", { status: 500 }));
    const spy = vi.spyOn(console, "error");
    await sendEmail({ ...MSG, html: "<p>secret-body-123</p>", text: "secret-body-123" });
    expect(JSON.stringify(spy.mock.calls)).not.toMatch(/re_test_key|secret-body-123/);
  });

  it("adds a reply-to when one is configured", async () => {
    process.env.EMAIL_REPLY_TO = "support@gts.ng";
    await sendEmail(MSG);
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body).reply_to).toBe("support@gts.ng");
  });
});

describe("esc", () => {
  it("escapes everything that could break out of HTML", () => {
    expect(esc(`<script>alert("x")</script> & 'y'`)).toBe("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;y&#39;");
  });
  it("copes with null and numbers", () => {
    expect(esc(null)).toBe("");
    expect(esc(undefined)).toBe("");
    expect(esc(42)).toBe("42");
  });
});
