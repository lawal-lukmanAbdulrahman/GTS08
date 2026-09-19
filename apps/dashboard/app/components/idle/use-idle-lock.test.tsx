import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useIdleLock } from "./use-idle-lock";

const MIN = 60 * 1000;

describe("useIdleLock (cashier spec Part 8, rule 6)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const setup = (opts = {}) => renderHook(() => useIdleLock({ warnAfterMs: 25 * MIN, lockAfterMs: 30 * MIN, ...opts }));
  const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

  it("starts active", () => {
    expect(setup().result.current.state).toBe("active");
  });

  it("warns after 25 minutes idle", () => {
    const { result } = setup();
    advance(25 * MIN - 1);
    expect(result.current.state).toBe("active");
    advance(1);
    expect(result.current.state).toBe("warning");
  });

  it("locks after 30 minutes idle", () => {
    const { result } = setup();
    advance(30 * MIN);
    expect(result.current.state).toBe("locked");
  });

  it("activity resets the clock, so someone working at the till never gets locked", () => {
    const { result } = setup();
    advance(24 * MIN);
    act(() => void document.dispatchEvent(new Event("mousedown")));
    advance(24 * MIN);
    expect(result.current.state).toBe("active");
    advance(2 * MIN);
    expect(result.current.state).toBe("warning");
  });

  it.each(["mousedown", "keydown", "touchstart", "wheel"])("counts a %s as activity", (type) => {
    const { result } = setup();
    advance(26 * MIN);
    expect(result.current.state).toBe("warning");
    act(() => void document.dispatchEvent(new Event(type)));
    expect(result.current.state).toBe("active");
  });

  it("clears the warning when the cashier taps 'stay logged in'", () => {
    const { result } = setup();
    advance(26 * MIN);
    act(() => result.current.stayActive());
    expect(result.current.state).toBe("active");
    advance(24 * MIN);
    expect(result.current.state).toBe("active");
  });

  it("stays locked no matter what happens on the page until it's unlocked", () => {
    const { result } = setup();
    advance(31 * MIN);
    act(() => void document.dispatchEvent(new Event("mousedown")));
    act(() => void document.dispatchEvent(new Event("keydown")));
    expect(result.current.state).toBe("locked");
    act(() => result.current.stayActive());
    expect(result.current.state).toBe("locked");
  });

  it("unlocking starts a fresh idle period", () => {
    const { result } = setup();
    advance(31 * MIN);
    act(() => result.current.unlock());
    expect(result.current.state).toBe("active");
    advance(24 * MIN);
    expect(result.current.state).toBe("active");
    advance(2 * MIN);
    expect(result.current.state).toBe("warning");
  });

  it("does nothing when disabled (e.g. nobody is signed in)", () => {
    const { result } = setup({ enabled: false });
    advance(60 * MIN);
    expect(result.current.state).toBe("active");
  });

  it("stops listening when it unmounts", () => {
    const remove = vi.spyOn(document, "removeEventListener");
    setup().unmount();
    expect(remove).toHaveBeenCalledWith("mousedown", expect.any(Function));
  });
});
