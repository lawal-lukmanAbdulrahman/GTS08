import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeDbStub } from "./_helpers/db-stub";

const db = makeDbStub();
vi.mock("@gts/database", () => ({
  createServiceClient: () => db.client,
  getRequestDataMode: () => Promise.resolve("live"),
}));
vi.mock("@/lib/idempotency", () => ({ withIdempotency: (h: unknown) => h }));
vi.mock("../app/api/v1/_lib/activity", () => ({
  clientIp: () => "127.0.0.1",
  logActivity: () => Promise.resolve(),
}));
vi.mock("../app/api/v1/_lib/storefront-cache", () => ({
  invalidateStorefrontCaches: () => Promise.resolve(),
}));
vi.mock("../app/api/v1/_lib/public-cache", () => ({
  publicCache: { tag: () => undefined },
}));
vi.mock("../app/api/v1/pos/_lib/inventory", () => ({
  adjustInventory: () => Promise.resolve({ ok: true }),
}));

// Route Handlers
import { NextRequest } from "next/server";
import { POST as postProducts, PUT as putProducts, DELETE as deleteProducts } from "../app/api/v1/products/route";
import { GET as getCategories, POST as postCategories } from "../app/api/v1/categories/route";
import { PUT as putInventory } from "../app/api/v1/inventory/[id]/route";
import { POST as postPromos } from "../app/api/v1/promos/route";
import { POST as postPickupStations } from "../app/api/v1/pickup-stations/route";
import { GET as getAdminCustomers } from "../app/api/v1/admin/customers/route";
import { POST as disableCustomer } from "../app/api/v1/admin/customers/[id]/disable/route";
import { GET as getPosOrders, POST as postPosOrders } from "../app/api/v1/pos/orders/route";
import { PATCH as patchSettings } from "../app/api/v1/settings/route";
import { GET as getStaffList, POST as postStaff } from "../app/api/v1/users/staff/route";

// Mock auth utilities
const mockAuthUser = vi.fn();
vi.mock("../app/api/v1/auth/utils", () => ({
  getAuthenticatedUser: (...a: unknown[]) => mockAuthUser(...a),
  sanitizeEmail: (e: string) => e?.trim().toLowerCase(),
  sanitizeSqlInput: (s: string) => s,
}));

function makeRequest(url: string, method: string, body?: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe("Role-Based Access Control (RBAC) & Permission Boundaries", () => {
  beforeEach(() => {
    db.reset();
    mockAuthUser.mockReset();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. CUSTOMER BOUNDARIES: Customers CANNOT access staff or admin routes
  // ───────────────────────────────────────────────────────────────────────────
  describe("Customer boundary enforcement", () => {
    const customerUser = { id: "customer-100", email: "customer@example.com" };

    beforeEach(() => {
      mockAuthUser.mockResolvedValue(customerUser);
      // User table returns customer role
      db.results.users = {
        data: {
          id: customerUser.id,
          email: customerUser.email,
          role: "customer",
          is_blocked: false,
          employee_permissions: null,
        },
        error: null,
      };
    });

    it("Customer is strictly blocked from creating products (403)", async () => {
      const req = makeRequest("http://localhost:3000/api/v1/products", "POST", { name: "Hacked Item" });
      const res = await postProducts(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.code).toBe("FORBIDDEN");
    });

    it("Customer is strictly blocked from updating products (403)", async () => {
      const req = makeRequest("http://localhost:3000/api/v1/products", "PUT", {
        id: "11111111-1111-4111-8111-111111111111",
        base_price: 100,
      });
      const res = await putProducts(req);
      expect(res.status).toBe(403);
    });

    it("Customer is strictly blocked from deleting products (403)", async () => {
      const req = makeRequest("http://localhost:3000/api/v1/products?id=11111111-1111-4111-8111-111111111111", "DELETE");
      const res = await deleteProducts(req);
      expect(res.status).toBe(403);
    });

    it("Customer is strictly blocked from creating categories (403)", async () => {
      const req = makeRequest("http://localhost:3000/api/v1/categories", "POST", { name: "Illegal Category" });
      const res = await postCategories(req);
      expect(res.status).toBe(403);
    });

    it("Customer is strictly blocked from creating promo codes (403)", async () => {
      const req = makeRequest("http://localhost:3000/api/v1/promos", "POST", {
        code: "HACK100",
        discount_type: "percentage",
        discount_value: 99,
      });
      const res = await postPromos(req);
      expect(res.status).toBe(403);
    });

    it("Customer is strictly blocked from creating pickup stations (403)", async () => {
      const req = makeRequest("http://localhost:3000/api/v1/pickup-stations", "POST", {
        name: "Fake Hub",
        address_line1: "Nowhere",
        city: "Lagos",
      });
      const res = await postPickupStations(req);
      expect(res.status).toBe(403);
    });

    it("Customer is strictly blocked from managing customer accounts (403)", async () => {
      const req = makeRequest("http://localhost:3000/api/v1/admin/customers", "GET");
      const res = await getAdminCustomers(req);
      expect(res.status).toBe(403);
    });

    it("Customer is strictly blocked from disabling customers (403)", async () => {
      const req = makeRequest("http://localhost:3000/api/v1/admin/customers/other-user/disable", "POST", {
        reason: "Malicious request",
      });
      const res = await disableCustomer(req, { params: Promise.resolve({ id: "other-user" }) });
      expect(res.status).toBe(403);
    });

    it("Customer is strictly blocked from listing staff members (403)", async () => {
      const req = makeRequest("http://localhost:3000/api/v1/users/staff", "GET");
      const res = await getStaffList(req);
      expect(res.status).toBe(403);
    });

    it("Customer is strictly blocked from modifying system settings (403)", async () => {
      const req = makeRequest("http://localhost:3000/api/v1/settings", "PATCH", { store_name: "Defaced" });
      const res = await patchSettings(req);
      expect(res.status).toBe(403);
    });

    it("Customer is strictly blocked from processing POS till sales (403)", async () => {
      const req = makeRequest("http://localhost:3000/api/v1/pos/orders", "POST", {
        items: [{ variant_id: "11111111-1111-4111-8111-111111111111", quantity: 1 }],
        payment_method: "cash",
      });
      const res = await postPosOrders(req);
      expect(res.status).toBe(403);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. EMPLOYEE ROLE-SPECIFIC GATING: Allowed roles perform assigned actions only
  // ───────────────────────────────────────────────────────────────────────────
  describe("Employee role-specific permission gating", () => {
    // A. Cashier with POS access only
    it("Cashier without can_manage_products cannot create products (403)", async () => {
      mockAuthUser.mockResolvedValue({ id: "cashier-1", email: "cashier@gts.ng" });
      db.results.users = {
        data: {
          id: "cashier-1",
          email: "cashier@gts.ng",
          role: "cashier",
          is_blocked: false,
          employee_permissions: {
            can_process_pos: true,
            can_manage_products: false,
            can_manage_inventory: false,
          },
        },
        error: null,
      };

      const req = makeRequest("http://localhost:3000/api/v1/products", "POST", { name: "Cashier Product" });
      const res = await postProducts(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.code).toBe("PERMISSION_DENIED");
      expect(json.error).toMatch(/permission to manage products/i);
    });

    it("Cashier cannot alter inventory stock levels without can_manage_inventory (403)", async () => {
      mockAuthUser.mockResolvedValue({ id: "cashier-1", email: "cashier@gts.ng" });
      db.results.users = {
        data: {
          id: "cashier-1",
          email: "cashier@gts.ng",
          role: "cashier",
          is_blocked: false,
          employee_permissions: {
            can_process_pos: true,
            can_manage_inventory: false,
          },
        },
        error: null,
      };

      const req = makeRequest("http://localhost:3000/api/v1/inventory/11111111-1111-4111-8111-111111111111", "PUT", {
        adjustment_type: "add",
        quantity: 10,
        reason: "Test",
      });
      const res = await putInventory(req, { params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" }) });
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.code).toBe("PERMISSION_DENIED");
    });

    // B. Inventory staff without POS access
    it("Inventory staff without can_process_pos cannot access POS orders (403)", async () => {
      mockAuthUser.mockResolvedValue({ id: "inv-staff-1", email: "inv@gts.ng" });
      db.results.users = {
        data: {
          id: "inv-staff-1",
          email: "inv@gts.ng",
          role: "inventory_staff",
          is_blocked: false,
          employee_permissions: {
            can_manage_inventory: true,
            can_process_pos: false,
          },
        },
        error: null,
      };

      const req = makeRequest("http://localhost:3000/api/v1/pos/orders", "GET");
      const res = await getPosOrders(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.code).toBe("POS_ACCESS_DENIED");
    });

    it("Inventory staff cannot create or delete promo codes (403)", async () => {
      mockAuthUser.mockResolvedValue({ id: "inv-staff-1", email: "inv@gts.ng" });
      db.results.users = {
        data: {
          id: "inv-staff-1",
          email: "inv@gts.ng",
          role: "inventory_staff",
          is_blocked: false,
          employee_permissions: {
            can_manage_inventory: true,
          },
        },
        error: null,
      };

      const req = makeRequest("http://localhost:3000/api/v1/promos", "POST", {
        code: "INV-DEAL",
        discount_type: "percentage",
        discount_value: 10,
      });
      const res = await postPromos(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.code).toBe("FORBIDDEN");
    });

    it("Staff member cannot create new staff accounts unless super_admin (403)", async () => {
      mockAuthUser.mockResolvedValue({ id: "manager-1", email: "manager@gts.ng" });
      db.results.users = {
        data: {
          id: "manager-1",
          email: "manager@gts.ng",
          role: "admin",
          is_super_admin: false, // ordinary admin, not super admin
          is_blocked: false,
        },
        error: null,
      };

      const req = makeRequest("http://localhost:3000/api/v1/users/staff", "POST", {
        full_name: "New Person",
        email: "newperson@gts.ng",
        role: "cashier",
      });
      const res = await postStaff(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.code).toBe("SUPER_ADMIN_ONLY");
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. ADMIN CAPABILITIES: Admin can perform all operations
  // ───────────────────────────────────────────────────────────────────────────
  describe("Admin full capabilities and access", () => {
    const adminUser = { id: "admin-super", email: "admin@gts.ng" };

    beforeEach(() => {
      mockAuthUser.mockResolvedValue(adminUser);
      db.results.users = {
        data: {
          id: adminUser.id,
          email: adminUser.email,
          role: "admin",
          is_super_admin: true,
          is_blocked: false,
        },
        error: null,
      };
    });

    it("Admin can view categories including inactive (?all=true) without 403", async () => {
      db.results.categories = {
        data: [{ id: "cat-1", name: "Fashion", slug: "fashion", is_active: false, sort_order: 1 }],
        error: null,
      };

      const req = makeRequest("http://localhost:3000/api/v1/categories?all=true", "GET");
      const res = await getCategories(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.length).toBe(1);
    });

    it("Admin can create new categories with subcategories", async () => {
      db.results.categories = {
        data: { id: "cat-123", name: "Footwear", slug: "footwear" },
        error: null,
      };

      const req = makeRequest("http://localhost:3000/api/v1/categories", "POST", {
        name: "Footwear",
        description: "Shoes and sneakers",
        sub_categories: ["Sneakers", "Boots"],
      });
      const res = await postCategories(req);
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data.name).toBe("Footwear");
    });

    it("Admin can adjust inventory counts without permission rejection", async () => {
      db.results.inventory = {
        data: {
          id: "inv-1",
          variant_id: "11111111-1111-4111-8111-111111111111",
          quantity: 20,
          reserved_quantity: 0,
          low_stock_threshold: 5,
        },
        error: null,
      };
      db.results.stock_movements = { data: {}, error: null };

      const req = makeRequest("http://localhost:3000/api/v1/inventory/11111111-1111-4111-8111-111111111111", "PUT", {
        adjustment_type: "add",
        quantity: 15,
        reason: "Stock replenishment",
      });
      const res = await putInventory(req, { params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" }) });
      expect(res.status).toBe(200);
    });

    it("Admin can create promo codes with full parameters", async () => {
      db.results.promos = {
        data: {
          id: "promo-1",
          code: "SUPER50",
          discount_type: "percentage",
          discount_value: 50,
          max_uses: 100,
          starts_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 86400000).toISOString(),
          is_active: true,
        },
        error: null,
      };

      const req = makeRequest("http://localhost:3000/api/v1/promos", "POST", {
        code: "SUPER50",
        discount_type: "percentage",
        discount_value: 50,
        max_uses: 100,
        starts_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 86400000).toISOString(),
      });
      const res = await postPromos(req);
      expect(res.status).toBe(201);
    });

    it("Admin can create and configure pickup stations", async () => {
      db.results.pickup_stations = {
        data: {
          id: "station-1",
          name: "Ikeja Hub",
          address_line1: "12 Allen Avenue",
          city: "Ikeja",
          state: "Lagos",
          is_active: true,
          is_default: true,
        },
        error: null,
      };

      const req = makeRequest("http://localhost:3000/api/v1/pickup-stations", "POST", {
        name: "Ikeja Hub",
        address_line1: "12 Allen Avenue",
        city: "Ikeja",
        state: "Lagos",
        is_default: true,
      });
      const res = await postPickupStations(req);
      expect(res.status).toBe(201);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. API CONTRACT SHAPES: Handlers reject invalid shapes with 400 Bad Request
  // ───────────────────────────────────────────────────────────────────────────
  describe("API payload contract validation", () => {
    beforeEach(() => {
      mockAuthUser.mockResolvedValue({ id: "admin-1", email: "admin@gts.ng" });
      db.results.users = {
        data: { id: "admin-1", email: "admin@gts.ng", role: "admin", is_super_admin: true, is_blocked: false },
        error: null,
      };
    });

    it("POST /categories rejects empty name with 400 VALIDATION_ERROR", async () => {
      const req = makeRequest("http://localhost:3000/api/v1/categories", "POST", { name: "   " });
      const res = await postCategories(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.code).toBe("VALIDATION_ERROR");
      expect(json.details?.name).toBeDefined();
    });

    it("POST /promos rejects invalid percentage (> 100) with 400 VALIDATION_ERROR", async () => {
      const req = makeRequest("http://localhost:3000/api/v1/promos", "POST", {
        code: "INVALID120",
        discount_type: "percentage",
        discount_value: 120,
        max_uses: 10,
        starts_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 86400000).toISOString(),
      });
      const res = await postPromos(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.code).toBe("VALIDATION_ERROR");
      expect(json.details?.discount_value).toBeDefined();
    });

    it("POST /pickup-stations rejects missing street address with 400 ADDRESS_REQUIRED", async () => {
      const req = makeRequest("http://localhost:3000/api/v1/pickup-stations", "POST", {
        name: "Station Without Address",
        city: "Lagos",
      });
      const res = await postPickupStations(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.code).toBe("ADDRESS_REQUIRED");
    });

    it("PUT /inventory/[id] rejects non-numeric or negative quantity with 400 VALIDATION_ERROR", async () => {
      const req = makeRequest("http://localhost:3000/api/v1/inventory/11111111-1111-4111-8111-111111111111", "PUT", {
        adjustment_type: "add",
        quantity: -5,
        reason: "Test negative",
      });
      const res = await putInventory(req, { params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" }) });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.code).toBe("VALIDATION_ERROR");
      expect(json.details?.quantity).toBeDefined();
    });
  });
});
