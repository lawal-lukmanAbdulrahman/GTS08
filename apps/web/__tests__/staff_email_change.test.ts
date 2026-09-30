import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockRequireStaff = vi.fn();
const mockVerifyPassword = vi.fn();
const mockAuthUpdate = vi.fn();
const mockLog = vi.fn();

vi.mock("../app/api/v1/_lib/staff-access", () => ({
  requireStaff: (...a: unknown[]) => mockRequireStaff(...a),
}));

vi.mock("../app/api/v1/_lib/verify-password", () => ({
  verifyPassword: (...a: unknown[]) => mockVerifyPassword(...a),
}));

vi.mock("../app/api/v1/_lib/activity", () => ({
  logActivity: (...a: unknown[]) => mockLog(...a),
  clientIp: () => "1.2.3.4",
}));

type Result = { data?: unknown; error?: unknown };
let userLookupResult: Result = { data: null, error: null };
let userUpdateResult: Result = { data: { id: "u1" }, error: null };

vi.mock("@gts/database", () => ({
  createServiceClient: () => ({
    auth: { admin: { updateUserById: (...a: unknown[]) => mockAuthUpdate(...a) } },
    from: (_table: string) => {
      const stub: any = {
        select: () => stub,
        eq: () => stub,
        update: () => stub,
        maybeSingle: async () => userLookupResult,
        single: async () => userUpdateResult,
        then: (resolve: (v: unknown) => void) => resolve(userUpdateResult),
      };
      return stub;
    },
  }),
}));

import { POST } from "../app/api/v1/staff/me/email/route";

const ADMIN_STAFF = {
  ok: true,
  user: { id: "u1", email: "admin@gts.ng" },
  isAdmin: true,
  role: "admin",
  fullName: "Admin User",
};

const CASHIER_STAFF = {
  ok: true,
  user: { id: "u2", email: "cashier@gts.ng" },
  isAdmin: false,
  role: "cashier",
  fullName: "Cashier",
};

function postReq(body: unknown) {
  return new NextRequest("http://localhost:3000/api/v1/staff/me/email", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/v1/staff/me/email", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userLookupResult = { data: null, error: null };
    userUpdateResult = { data: { id: "u1" }, error: null };
    mockAuthUpdate.mockResolvedValue({ data: {}, error: null });
  });

  it("blocks non-admin staff with 403 PERMISSION_DENIED", async () => {
    mockRequireStaff.mockResolvedValue(CASHIER_STAFF);

    const res = await POST(postReq({ new_email: "new@gts.ng", current_password: "password" }));
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.code).toBe("PERMISSION_DENIED");
  });

  it("validates invalid email format and missing password", async () => {
    mockRequireStaff.mockResolvedValue(ADMIN_STAFF);

    const res = await POST(postReq({ new_email: "notanemail", current_password: "" }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.details?.new_email).toBeDefined();
    expect(json.details?.current_password).toBeDefined();
  });

  it("rejects when new email matches current email", async () => {
    mockRequireStaff.mockResolvedValue(ADMIN_STAFF);

    const res = await POST(postReq({ new_email: "admin@gts.ng", current_password: "validpassword" }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.details?.new_email).toMatch(/different/i);
  });

  it("rejects with 400 when current password is wrong", async () => {
    mockRequireStaff.mockResolvedValue(ADMIN_STAFF);
    mockVerifyPassword.mockResolvedValue(false);

    const res = await POST(postReq({ new_email: "newadmin@gts.ng", current_password: "wrongpassword" }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.code).toBe("CURRENT_PASSWORD_INCORRECT");
  });

  it("rejects with 409 when new email is already in use", async () => {
    mockRequireStaff.mockResolvedValue(ADMIN_STAFF);
    mockVerifyPassword.mockResolvedValue(true);
    userLookupResult = { data: { id: "other-user-id" }, error: null };

    const res = await POST(postReq({ new_email: "taken@gts.ng", current_password: "validpassword" }));
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.code).toBe("EMAIL_IN_USE");
  });

  it("updates auth, database, logs activity, and returns 200 on success", async () => {
    mockRequireStaff.mockResolvedValue(ADMIN_STAFF);
    mockVerifyPassword.mockResolvedValue(true);
    userLookupResult = { data: null, error: null };

    const res = await POST(postReq({ new_email: "newadmin@gts.ng", current_password: "validpassword" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.email).toBe("newadmin@gts.ng");
    expect(mockAuthUpdate).toHaveBeenCalledWith("u1", {
      email: "newadmin@gts.ng",
      email_confirm: true,
    });
    expect(mockLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "profile.change_email",
        actorId: "u1",
        changes: { old_email: "admin@gts.ng", new_email: "newadmin@gts.ng" },
      })
    );
  });
});
