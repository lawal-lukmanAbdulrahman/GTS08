import { describe, it, expect, vi } from "vitest";

vi.mock("@gts/database", () => ({
  createServiceClient: vi.fn().mockImplementation(() => ({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    }),
  })),
}));

import { NextRequest, NextResponse } from "next/server";
import { withIdempotency } from "../lib/idempotency";
import { generateIdempotencyKey, idempotentFetch } from "@gts/utils";

describe("Idempotency Engine", () => {
  it("generates valid UUIDv4 or timestamped idempotency keys", () => {
    const key1 = generateIdempotencyKey();
    const key2 = generateIdempotencyKey();
    expect(key1).toBeTruthy();
    expect(key2).toBeTruthy();
    expect(key1).not.toBe(key2);
  });

  it("transparently passes through non-mutating GET requests", async () => {
    const mockHandler = vi.fn().mockImplementation(async () => {
      return NextResponse.json({ success: true, count: 42 });
    });

    const wrapped = withIdempotency(mockHandler);
    const req = new NextRequest("http://localhost:3000/api/v1/test", {
      method: "GET",
    });

    const res = await wrapped(req);
    expect(mockHandler).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.count).toBe(42);
  });

  it("transparently passes through mutating requests without Idempotency-Key", async () => {
    const mockHandler = vi.fn().mockImplementation(async () => {
      return NextResponse.json({ success: true, action: "created" }, { status: 201 });
    });

    const wrapped = withIdempotency(mockHandler);
    const req = new NextRequest("http://localhost:3000/api/v1/test", {
      method: "POST",
      body: JSON.stringify({ item: "A" }),
    });

    const res = await wrapped(req);
    expect(mockHandler).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(201);
  });

  it("caches and replays identical responses on duplicate Idempotency-Key", async () => {
    let executionCount = 0;
    const mockHandler = vi.fn().mockImplementation(async () => {
      executionCount++;
      return NextResponse.json({ success: true, orderId: "ord_123", executionCount });
    });

    const wrapped = withIdempotency(mockHandler);
    const idemKey = "test_key_" + Date.now();

    // First request
    const req1 = new NextRequest("http://localhost:3000/api/v1/orders", {
      method: "POST",
      headers: { "Idempotency-Key": idemKey, "Content-Type": "application/json" },
      body: JSON.stringify({ cart: ["item1"] }),
    });

    const res1 = await wrapped(req1);
    expect(res1.status).toBe(200);
    const data1 = await res1.json();
    expect(data1.executionCount).toBe(1);
    expect(mockHandler).toHaveBeenCalledTimes(1);

    // Second identical request (retry or double-click)
    const req2 = new NextRequest("http://localhost:3000/api/v1/orders", {
      method: "POST",
      headers: { "Idempotency-Key": idemKey, "Content-Type": "application/json" },
      body: JSON.stringify({ cart: ["item1"] }),
    });

    const res2 = await wrapped(req2);
    expect(res2.status).toBe(200);
    expect(res2.headers.get("Idempotent-Replayed")).toBe("true");
    const data2 = await res2.json();
    // Replayed from cache — handler was NOT executed a second time
    expect(data2.executionCount).toBe(1);
    expect(mockHandler).toHaveBeenCalledTimes(1);
  });

  it("rejects request if the same Idempotency-Key is reused with a different payload", async () => {
    const mockHandler = vi.fn().mockImplementation(async () => {
      return NextResponse.json({ success: true });
    });

    const wrapped = withIdempotency(mockHandler);
    const idemKey = "test_mismatch_" + Date.now();

    const req1 = new NextRequest("http://localhost:3000/api/v1/checkout", {
      method: "POST",
      headers: { "Idempotency-Key": idemKey, "Content-Type": "application/json" },
      body: JSON.stringify({ amount: 5000 }),
    });
    await wrapped(req1);

    // Same key, different body
    const req2 = new NextRequest("http://localhost:3000/api/v1/checkout", {
      method: "POST",
      headers: { "Idempotency-Key": idemKey, "Content-Type": "application/json" },
      body: JSON.stringify({ amount: 9999 }),
    });

    const res2 = await wrapped(req2);
    expect(res2.status).toBe(422);
    const data2 = await res2.json();
    expect(data2.code).toBe("IDEMPOTENCY_KEY_PAYLOAD_MISMATCH");
  });

  it("handles in-flight concurrent requests by returning 409 Conflict", async () => {
    let resolveFirst: any;
    const slowPromise = new Promise((resolve) => {
      resolveFirst = resolve;
    });

    const mockHandler = vi.fn().mockImplementation(async () => {
      await slowPromise;
      return NextResponse.json({ success: true, processed: true });
    });

    const wrapped = withIdempotency(mockHandler);
    const idemKey = "test_concurrent_" + Date.now();

    const req1 = new NextRequest("http://localhost:3000/api/v1/inventory/adjust", {
      method: "PUT",
      headers: { "Idempotency-Key": idemKey, "Content-Type": "application/json" },
      body: JSON.stringify({ variant_id: "v1", delta: 5 }),
    });

    const req2 = new NextRequest("http://localhost:3000/api/v1/inventory/adjust", {
      method: "PUT",
      headers: { "Idempotency-Key": idemKey, "Content-Type": "application/json" },
      body: JSON.stringify({ variant_id: "v1", delta: 5 }),
    });

    // Start first request (holds in-flight lock)
    const p1 = wrapped(req1);

    // Second request arrives while first is still executing
    const res2 = await wrapped(req2);
    expect(res2.status).toBe(409);
    const data2 = await res2.json();
    expect(data2.code).toBe("IDEMPOTENCY_CONFLICT_IN_FLIGHT");
    expect(res2.headers.get("Retry-After")).toBe("2");

    // Complete first request
    resolveFirst();
    const res1 = await p1;
    expect(res1.status).toBe(200);
  });

  describe("Client-side idempotentFetch", () => {
    it("automatically injects an Idempotency-Key on POST requests", async () => {
      const mockNativeFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true })));
      globalThis.fetch = mockNativeFetch;

      await idempotentFetch("http://localhost:3000/api/v1/checkout", {
        method: "POST",
        body: JSON.stringify({ test: 123 }),
      });

      expect(mockNativeFetch).toHaveBeenCalledTimes(1);
      const passedOptions = mockNativeFetch.mock.calls[0]![1];
      const headers = passedOptions.headers as Headers;
      expect(headers.has("Idempotency-Key")).toBe(true);
      expect(headers.get("Idempotency-Key")).toMatch(/^[a-zA-Z0-9_-]+$/);
    });

    it("does NOT inject an Idempotency-Key on GET requests", async () => {
      const mockNativeFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true })));
      globalThis.fetch = mockNativeFetch;

      await idempotentFetch("http://localhost:3000/api/v1/products", {
        method: "GET",
      });

      expect(mockNativeFetch).toHaveBeenCalledTimes(1);
      const passedOptions = mockNativeFetch.mock.calls[0]![1];
      const headers = passedOptions.headers as Headers;
      expect(headers.has("Idempotency-Key")).toBe(false);
    });

    it("preserves explicitly passed custom idempotencyKey", async () => {
      const mockNativeFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true })));
      globalThis.fetch = mockNativeFetch;

      const customKey = "custom_retry_key_999";
      await idempotentFetch("http://localhost:3000/api/v1/checkout", {
        method: "POST",
        idempotencyKey: customKey,
      });

      expect(mockNativeFetch).toHaveBeenCalledTimes(1);
      const passedOptions = mockNativeFetch.mock.calls[0]![1];
      const headers = passedOptions.headers as Headers;
      expect(headers.get("Idempotency-Key")).toBe(customKey);
    });
  });
});
