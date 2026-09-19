import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

const mockApiCall = vi.fn();
const mockSignOut = vi.fn();
vi.mock("./staff-api", () => ({ apiCall: (...a: unknown[]) => mockApiCall(...a) }));
vi.mock("./session", () => ({ signOut: (...a: unknown[]) => mockSignOut(...a), getSessionUser: () => null }));

import { useStaffSession } from "./use-staff-session";

const PROFILE = {
  id: "u1",
  email: "ada@gts.ng",
  full_name: "Ada Cashier",
  phone: null,
  role: "cashier",
  is_admin: false,
  permissions: { can_process_pos: true, can_void_orders: false, can_apply_discounts: false },
};

describe("useStaffSession", () => {
  beforeEach(() => {
    mockApiCall.mockReset();
    mockSignOut.mockReset();
  });

  it("loads the signed-in staff member's profile and permissions", async () => {
    mockApiCall.mockResolvedValue({ ok: true, status: 200, data: PROFILE });
    const { result } = renderHook(() => useStaffSession());
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.profile).toEqual(PROFILE);
    expect(result.current.error).toBeNull();
    expect(mockApiCall).toHaveBeenCalledWith("/staff/me");
  });

  it("reports why it couldn't load, and can try again", async () => {
    mockApiCall.mockResolvedValueOnce({ ok: false, status: 0, message: "Couldn't reach the server." });
    const { result } = renderHook(() => useStaffSession());
    await waitFor(() => expect(result.current.error).toBe("Couldn't reach the server."));
    expect(result.current.profile).toBeNull();

    mockApiCall.mockResolvedValueOnce({ ok: true, status: 200, data: PROFILE });
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.profile).toEqual(PROFILE));
    expect(result.current.error).toBeNull();
  });

  it("tells the caller whether they can use the POS or are an admin", async () => {
    mockApiCall.mockResolvedValue({ ok: true, status: 200, data: PROFILE });
    const { result } = renderHook(() => useStaffSession());
    await waitFor(() => expect(result.current.profile).not.toBeNull());
    expect(result.current.canUsePos).toBe(true);
    expect(result.current.isAdmin).toBe(false);
  });

  it("signs out through the shared sign-out", async () => {
    mockApiCall.mockResolvedValue({ ok: true, status: 200, data: PROFILE });
    const { result } = renderHook(() => useStaffSession());
    await waitFor(() => expect(result.current.profile).not.toBeNull());
    act(() => void result.current.signOut());
    expect(mockSignOut).toHaveBeenCalled();
  });
});
