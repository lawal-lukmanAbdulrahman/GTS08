// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const created: Array<{ url: string; key: string; options: any }> = [];
const signIn = vi.fn();
const signOut = vi.fn();
vi.mock("@supabase/supabase-js", () => ({
  createClient: (url: string, key: string, options: any) => {
    created.push({ url, key, options });
    return { auth: { signInWithPassword: (...a: unknown[]) => signIn(...a), signOut: (...a: unknown[]) => signOut(...a) } };
  },
}));

import { verifyPassword } from "../app/api/v1/_lib/verify-password";

describe("verifyPassword", () => {
  beforeEach(() => {
    created.length = 0;
    signIn.mockReset().mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    signOut.mockReset().mockResolvedValue({ error: null });
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://proj.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
  });

  it("is true for a correct password and false for a wrong one", async () => {
    expect(await verifyPassword("a@b.co", "right")).toBe(true);
    signIn.mockResolvedValue({ data: { user: null }, error: { message: "Invalid login credentials" } });
    expect(await verifyPassword("a@b.co", "wrong")).toBe(false);
  });

  it("checks with the public key on a throwaway client, never with the service key", async () => {
    await verifyPassword("a@b.co", "x");
    expect(created).toHaveLength(1);
    expect(created[0]!.key).toBe("anon-key");
    expect(created[0]!.options.auth).toMatchObject({ persistSession: false, autoRefreshToken: false });
  });

  it("ends the session it opened, so a check leaves nothing signed in", async () => {
    await verifyPassword("a@b.co", "x");
    expect(signOut).toHaveBeenCalled();
  });

  it("is false (not an error) when the auth service can't be reached", async () => {
    signIn.mockRejectedValue(new Error("offline"));
    expect(await verifyPassword("a@b.co", "x")).toBe(false);
  });

  it("is false for an empty email or password without calling out", async () => {
    expect(await verifyPassword("", "x")).toBe(false);
    expect(await verifyPassword("a@b.co", "")).toBe(false);
    expect(signIn).not.toHaveBeenCalled();
  });
});
