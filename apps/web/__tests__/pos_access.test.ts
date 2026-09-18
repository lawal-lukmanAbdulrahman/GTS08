import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetAuthenticatedUser = vi.fn();
vi.mock("../app/api/v1/auth/utils", () => ({
  getAuthenticatedUser: (...args: unknown[]) => mockGetAuthenticatedUser(...args),
}));

const mockMaybeSingle = vi.fn();
const mockServiceClient = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: mockMaybeSingle,
      })),
    })),
  })),
};
vi.mock("@gts/database", () => ({
  createServiceClient: () => mockServiceClient,
}));

import { NextRequest } from "next/server";
import { requirePosAccess } from "../app/api/v1/pos/_lib/access";

function makeRequest() {
  return new NextRequest("http://localhost:3000/api/v1/pos/orders", { method: "POST" });
}

describe("requirePosAccess", () => {
  beforeEach(() => {
    mockGetAuthenticatedUser.mockReset();
    mockMaybeSingle.mockReset();
  });

  it("rejects with 401 when there is no authenticated user", async () => {
    mockGetAuthenticatedUser.mockResolvedValue(null);
    const result = await requirePosAccess(makeRequest());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
  });

  it("rejects with 403 when can_process_pos is false", async () => {
    mockGetAuthenticatedUser.mockResolvedValue({ id: "user-1", email: "cashier@gts.ng" });
    mockMaybeSingle.mockResolvedValue({
      data: { role: "cashier", employee_permissions: { can_process_pos: false } },
      error: null,
    });
    const result = await requirePosAccess(makeRequest());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(403);
  });

  it("rejects with 403 for a customer role even if flag were somehow true", async () => {
    mockGetAuthenticatedUser.mockResolvedValue({ id: "user-1", email: "shopper@gts.ng" });
    mockMaybeSingle.mockResolvedValue({
      data: { role: "customer", employee_permissions: { can_process_pos: true } },
      error: null,
    });
    const result = await requirePosAccess(makeRequest());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(403);
  });

  it("allows a cashier with can_process_pos = true", async () => {
    mockGetAuthenticatedUser.mockResolvedValue({ id: "user-1", email: "cashier@gts.ng" });
    mockMaybeSingle.mockResolvedValue({
      data: { role: "cashier", employee_permissions: { can_process_pos: true } },
      error: null,
    });
    const result = await requirePosAccess(makeRequest());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.user.id).toBe("user-1");
      expect(result.role).toBe("cashier");
    }
  });

  it("allows an admin with can_process_pos = true", async () => {
    mockGetAuthenticatedUser.mockResolvedValue({ id: "admin-1", email: "admin@gts.ng" });
    mockMaybeSingle.mockResolvedValue({
      data: { role: "admin", employee_permissions: { can_process_pos: true } },
      error: null,
    });
    const result = await requirePosAccess(makeRequest());
    expect(result.ok).toBe(true);
  });
});
