import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const apiCall = vi.fn();
vi.mock("./staff-api", () => ({ apiCall: (...a: unknown[]) => apiCall(...a) }));

import { useLive } from "./use-live";

const ok = (data: unknown) => Promise.resolve({ ok: true, status: 200, data });
const fail = (message = "down") => Promise.resolve({ ok: false, status: 500, message });
const flush = async () => { await act(async () => { await Promise.resolve(); }); };

function setHidden(hidden: boolean) {
  Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("useLive (polls an endpoint so a screen follows the data)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    apiCall.mockReset();
    setHidden(false);
  });
  afterEach(() => vi.useRealTimers());

  it("loads straight away and then on every interval", async () => {
    apiCall.mockImplementation(() => ok({ n: apiCall.mock.calls.length }));
    const { result } = renderHook(() => useLive<{ n: number }>("/live/summary", { intervalMs: 5000 }));
    await flush();
    expect(result.current.data).toEqual({ n: 1 });
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(result.current.data).toEqual({ n: 2 });
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(result.current.data).toEqual({ n: 3 });
  });

  it("keeps the last good data and reports the error when a refresh fails", async () => {
    apiCall.mockImplementationOnce(() => ok({ n: 1 })).mockImplementation(() => fail("boom"));
    const { result } = renderHook(() => useLive<{ n: number }>("/x", { intervalMs: 1000 }));
    await flush();
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(result.current.data).toEqual({ n: 1 });
    expect(result.current.error).toBe("boom");
  });

  it("backs off after failures instead of hammering a struggling server", async () => {
    apiCall.mockImplementation(() => fail());
    renderHook(() => useLive("/x", { intervalMs: 1000 }));
    await flush();
    const before = apiCall.mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(apiCall.mock.calls.length - before).toBeLessThan(6); // would be 10 without backoff
  });

  it("stops polling while the tab is hidden and catches up the moment it's shown", async () => {
    apiCall.mockImplementation(() => ok({ n: apiCall.mock.calls.length }));
    renderHook(() => useLive("/x", { intervalMs: 1000 }));
    await flush();
    act(() => setHidden(true));
    const hiddenAt = apiCall.mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(apiCall.mock.calls.length).toBe(hiddenAt);
    act(() => setHidden(false));
    await flush();
    expect(apiCall.mock.calls.length).toBe(hiddenAt + 1);
  });

  it("refresh() fetches immediately", async () => {
    apiCall.mockImplementation(() => ok({ n: apiCall.mock.calls.length }));
    const { result } = renderHook(() => useLive<{ n: number }>("/x", { intervalMs: 60_000 }));
    await flush();
    await act(async () => { result.current.refresh(); });
    expect(result.current.data).toEqual({ n: 2 });
  });

  it("does nothing while disabled, and stops when unmounted", async () => {
    apiCall.mockImplementation(() => ok({}));
    const { rerender, unmount } = renderHook(({ enabled }) => useLive("/x", { intervalMs: 1000, enabled }), { initialProps: { enabled: false } });
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(apiCall).not.toHaveBeenCalled();
    rerender({ enabled: true });
    await flush();
    expect(apiCall).toHaveBeenCalledTimes(1);
    unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(apiCall).toHaveBeenCalledTimes(1);
  });

  it("ignores a slow response that arrives after a newer one", async () => {
    let resolveSlow!: (v: unknown) => void;
    apiCall.mockImplementationOnce(() => new Promise((r) => (resolveSlow = r))).mockImplementation(() => ok({ n: "new" }));
    const { result } = renderHook(() => useLive<{ n: string }>("/x", { intervalMs: 60_000 }));
    await act(async () => { result.current.refresh(); });
    expect(result.current.data).toEqual({ n: "new" });
    await act(async () => { resolveSlow({ ok: true, status: 200, data: { n: "old" } }); });
    expect(result.current.data).toEqual({ n: "new" });
  });

  it("drops the old data when the path changes, so one filter's numbers are never shown under another's name", async () => {
    apiCall.mockImplementation((path: string) => ok({ path }));
    const { result, rerender } = renderHook(({ path }) => useLive<{ path: string }>(path, { intervalMs: 60_000 }), { initialProps: { path: "/a" } });
    await flush();
    expect(result.current.data).toEqual({ path: "/a" });
    apiCall.mockImplementation(() => new Promise(() => undefined));
    rerender({ path: "/b" });
    expect(result.current.data).toBeNull();
  });
});
