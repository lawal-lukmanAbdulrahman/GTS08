import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { logActivity, clientIp } from "../app/api/v1/_lib/activity";

function makeClient(result: { error: unknown } | "throw") {
  const insert = vi.fn(() => (result === "throw" ? Promise.reject(new Error("net")) : Promise.resolve(result)));
  const from = vi.fn(() => ({ insert }));
  return { client: { from }, from, insert };
}

describe("logActivity", () => {
  beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));

  it("writes an activity_logs row for the actor", async () => {
    const { client, from, insert } = makeClient({ error: null });
    await logActivity(client, {
      actorId: "u1",
      action: "pos.sale",
      targetType: "order",
      targetId: "o1",
      changes: { total: 4500000 },
      ip: "1.2.3.4",
    });
    expect(from).toHaveBeenCalledWith("activity_logs");
    expect(insert).toHaveBeenCalledWith({
      actor_id: "u1",
      action: "pos.sale",
      target_type: "order",
      target_id: "o1",
      changes: { total: 4500000 },
      ip_address: "1.2.3.4",
    });
  });

  it("defaults optional fields to null", async () => {
    const { client, insert } = makeClient({ error: null });
    await logActivity(client, { actorId: "u1", action: "auth.logout", targetType: "user" });
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ target_id: null, changes: null, ip_address: null })
    );
  });

  it("never throws when the insert reports an error (the sale has already happened)", async () => {
    const { client } = makeClient({ error: { message: "db down" } });
    await expect(
      logActivity(client, { actorId: "u1", action: "pos.sale", targetType: "order" })
    ).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });

  it("never throws when the network call itself fails", async () => {
    const { client } = makeClient("throw");
    await expect(
      logActivity(client, { actorId: "u1", action: "pos.sale", targetType: "order" })
    ).resolves.toBeUndefined();
  });

  it("truncates an oversize IP so it fits the column", async () => {
    const { client, insert } = makeClient({ error: null });
    await logActivity(client, { actorId: "u1", action: "auth.login", targetType: "user", ip: "x".repeat(100) });
    expect((insert.mock.calls[0] as any)[0].ip_address).toHaveLength(45);
  });
});

describe("clientIp", () => {
  const withHeaders = (h: Record<string, string>) => new NextRequest("http://localhost/x", { headers: h });

  it("takes the first address from x-forwarded-for", () => {
    expect(clientIp(withHeaders({ "x-forwarded-for": "9.9.9.9, 10.0.0.1" }))).toBe("9.9.9.9");
  });
  it("falls back to x-real-ip", () => {
    expect(clientIp(withHeaders({ "x-real-ip": "8.8.8.8" }))).toBe("8.8.8.8");
  });
  it("is null when the request carries no address", () => {
    expect(clientIp(withHeaders({}))).toBeNull();
  });
});
