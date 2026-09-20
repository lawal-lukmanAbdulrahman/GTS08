// @vitest-environment node
import { describe, it, expect, vi, afterEach } from "vitest";
import { serverError, readJson } from "../app/api/v1/_lib/http";
import { NextRequest } from "next/server";

afterEach(() => vi.restoreAllMocks());

describe("serverError", () => {
  it("turns a malformed JSON body into a 400, not a 500", async () => {
    let caught: unknown;
    try {
      JSON.parse("{not json");
    } catch (e) {
      caught = e;
    }
    const res = serverError(caught);
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_BODY");
  });

  it("answers 500 for anything else, without echoing the internal message", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = serverError(new Error('relation "secret_table" does not exist'));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.code).toBe("SERVER_ERROR");
    expect(JSON.stringify(body)).not.toMatch(/secret_table|relation/);
  });

  it("logs the real error server-side so it can still be debugged", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    serverError(new Error("boom"));
    expect(spy).toHaveBeenCalled();
  });

  it("copes with a thrown non-Error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await serverError("just a string")).status).toBe(500);
  });
});

describe("readJson", () => {
  const post = (raw: string) => new NextRequest("http://localhost:3000/x", { method: "POST", body: raw });

  it("returns the parsed body", async () => {
    expect(await readJson(post('{"a":1}'))).toEqual({ ok: true, body: { a: 1 } });
  });

  it("returns a ready 400 response for bad JSON", async () => {
    const r = await readJson(post("{oops"));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(400);
  });

  it("returns a 400 for an empty body", async () => {
    const r = await readJson(post(""));
    expect(r.ok).toBe(false);
  });
});
