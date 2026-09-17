import { describe, it, expect, vi } from "vitest";

// Mock Supabase Database Module
vi.mock("@gts/database", () => {
  return {
    createServerClient: vi.fn().mockImplementation(async () => ({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    })),
    createServiceClient: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "products") {
          const mockQuery: any = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            gte: vi.fn().mockReturnThis(),
            lte: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            range: vi.fn().mockImplementation(() =>
              Promise.resolve({
                data: [
                  {
                    id: "prod-1",
                    name: "GTS Classic Shirt",
                    slug: "gts-classic-shirt",
                    base_price: 1500000,
                    compare_at_price: null,
                    cost_price: 800000, // SHOULD BE SUPPRESSED
                    status: "active",
                    is_featured: false,
                    total_sold: 10,
                    average_rating: 4.5,
                    review_count: 5,
                    created_at: "2026-06-01T00:00:00Z",
                    category: { name: "Shirts", slug: "shirts" },
                    images: [{ cloudinary_public_id: "gts/img1", is_primary: true }],
                    variants: [
                      {
                        id: "var-1",
                        size: "M",
                        color: "Blue",
                        price_modifier: 0,
                        is_active: true,
                        inventory: [{ quantity: 10, reserved_quantity: 0 }],
                      },
                    ],
                  },
                ],
                count: 1,
                error: null,
              })
            ),
          };
          return mockQuery;
        }
        if (table === "users") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: "cust-1", role: "customer", is_blocked: false },
              error: null,
            }),
          };
        }
        if (table === "orders") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: "ord-1",
                order_number: "GTS-202606-000100",
                status: "processing",
                customer: { email: "tunde@example.com" },
              },
              error: null,
            }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }),
    })),
  };
});

describe("Backend Security & Spec Compliance Test Suite", () => {
  it("Contract #1: GET /api/v1/products must NOT leak cost_price in public payload", async () => {
    const { GET } = await import("../app/api/v1/products/route");
    const req = new Request("http://localhost:3000/api/v1/products");
    const res = await GET(req as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toBeDefined();
    expect(body.data.length).toBeGreaterThan(0);

    // Verify cost_price is completely suppressed
    const product = body.data[0];
    expect(product).not.toHaveProperty("cost_price");
    expect(product.base_price).toBe(1500000); // ₦15,000 in kobo
  });

  it("Contract #2: Unauthenticated POST /api/v1/products must return HTTP 401 Unauthorized", async () => {
    const { POST } = await import("../app/api/v1/products/route");
    const req = new Request("http://localhost:3000/api/v1/products", {
      method: "POST",
      body: JSON.stringify({ name: "Hacked Shirt", slug: "hacked-shirt", base_price: 100 }),
    });

    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.code).toBe("UNAUTHORIZED");
  });

  it("Contract #3: Customer role attempting Admin POST /api/v1/products must return HTTP 403 Forbidden", async () => {
    const database = await import("@gts/database");
    (database.createServerClient as any).mockImplementationOnce(async () => ({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "cust-1" } }, error: null }),
      },
    }));

    const { POST } = await import("../app/api/v1/products/route");
    const req = new Request("http://localhost:3000/api/v1/products", {
      method: "POST",
      body: JSON.stringify({ name: "Unauthorized Item", slug: "unauthorized", base_price: 500000 }),
    });

    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.code).toBe("FORBIDDEN");
  });

  it("Contract #4: Public GET /api/v1/orders/track requires both order_number AND matching email", async () => {
    const { GET } = await import("../app/api/v1/orders/track/route");

    // Missing email query param
    const reqInvalid = new Request("http://localhost:3000/api/v1/orders/track?order_number=GTS-202606-000100");
    const resInvalid = await GET(reqInvalid as any);
    expect(resInvalid.status).toBe(400);

    // Mismatched email
    const reqWrongEmail = new Request(
      "http://localhost:3000/api/v1/orders/track?order_number=GTS-202606-000100&email=attacker@evil.com"
    );
    const resWrongEmail = await GET(reqWrongEmail as any);
    expect(resWrongEmail.status).toBe(404);
  });

  it("Contract #5: Paystack webhook POST /api/v1/webhooks/paystack with invalid signature must be rejected", async () => {
    const { POST } = await import("../app/api/v1/webhooks/paystack/route");

    const req = new Request("http://localhost:3000/api/v1/webhooks/paystack", {
      method: "POST",
      headers: {
        "x-paystack-signature": "fake_invalid_signature_hash",
      },
      body: JSON.stringify({ event: "charge.success", data: { reference: "gts_ref_123" } }),
    });

    // Enforce production mode check
    const origEnv = process.env.NODE_ENV;
    (process.env as any).NODE_ENV = "production";

    const res = await POST(req as any);
    const body = await res.json();

    (process.env as any).NODE_ENV = origEnv;

    expect(res.status).toBe(401);
    expect(body.code).toBe("UNAUTHORIZED");
  });
});
