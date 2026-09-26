// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendEmail, sendEmailBatch } from "../app/api/v1/_lib/email/send";
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

describe("sendEmail reliability", () => {
  it("sends an idempotency key so a retried event can't email twice", async () => {
    await sendEmail({ ...MSG, idempotencyKey: "order-paid/abc" });
    expect(fetchMock.mock.calls[0]![1].headers["Idempotency-Key"]).toBe("order-paid/abc");
  });

  it("tries once more after a rate limit, honouring Retry-After", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: "slow down" }), { status: 429, headers: { "retry-after": "0" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "em_2" }), { status: 200 }));
    expect(await sendEmail(MSG)).toEqual({ ok: true, id: "em_2" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("tries once more after a server error, and then gives up", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 503 }));
    const r = await sendEmail(MSG);
    expect(r).toMatchObject({ ok: false });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry a refusal that will never succeed", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ name: "validation_error", message: "The from address is invalid" }), { status: 422 }));
    await sendEmail(MSG);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("puts Resend's own explanation in the reason, so a wrong sender or unverified domain is obvious", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ name: "validation_error", message: "The gts.ng domain is not verified." }), { status: 403 }));
    const r = await sendEmail(MSG);
    expect(r.ok === false && r.reason).toMatch(/not verified/);
  });
});

describe("sendEmailBatch", () => {
  const msg = (n: number) => ({ ...MSG, to: `p${n}@example.com` });

  it("sends many messages in one request each, up to 100, and counts them", async () => {
    fetchMock.mockImplementation(async (_u: string, init: { body: string }) => new Response(JSON.stringify({ data: JSON.parse(init.body).map((_: unknown, i: number) => ({ id: `id${i}` })) }), { status: 200 }));
    const r = await sendEmailBatch(Array.from({ length: 230 }, (_, i) => msg(i)));
    expect(r).toEqual({ sent: 230, failed: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0]![0]).toBe("https://api.resend.com/emails/batch");
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toHaveLength(100);
    expect(JSON.parse(fetchMock.mock.calls[2]![1].body)).toHaveLength(30);
  });

  it("counts a refused group as failed and carries on with the rest", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: "bad" }), { status: 422 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: "a" }] }), { status: 200 }));
    const r = await sendEmailBatch([...Array.from({ length: 100 }, (_, i) => msg(i)), msg(200)]);
    expect(r).toEqual({ sent: 1, failed: 100 });
  });

  it("drops invalid addresses up front and counts them as failed", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: [{ id: "a" }] }), { status: 200 }));
    const r = await sendEmailBatch([msg(1), { ...MSG, to: "nope" }]);
    expect(r).toEqual({ sent: 1, failed: 1 });
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toHaveLength(1);
  });

  it("does nothing, quietly, when email isn't configured", async () => {
    delete process.env.EMAIL_FROM;
    expect(await sendEmailBatch([msg(1)])).toEqual({ sent: 0, failed: 1, skipped: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("carries each message's own headers, e.g. List-Unsubscribe", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: [{ id: "a" }] }), { status: 200 }));
    await sendEmailBatch([{ ...msg(1), headers: { "List-Unsubscribe": "<mailto:a@b.co>" } }]);
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)[0].headers).toEqual({ "List-Unsubscribe": "<mailto:a@b.co>" });
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
