// @vitest-environment node
import { describe, it, expect, vi } from "vitest";

const created: Array<{ options?: { global?: { fetch?: unknown } } }> = [];
vi.mock("@supabase/supabase-js", () => ({
  createClient: (_url: string, _key: string, options?: { global?: { fetch?: unknown } }) => {
    created.push({ options });
    return {};
  },
}));
vi.mock("@supabase/ssr", () => ({ createServerClient: () => ({}) }));

import { createServiceClient } from "../../../packages/database/src/server";
import { scopedServerFetch } from "../../../packages/database/src/data-scope";

describe("createServiceClient", () => {
  it("scopes business tables to the current test/live mode by default", () => {
    created.length = 0;
    createServiceClient();
    expect(created[0]!.options?.global?.fetch).toBe(scopedServerFetch);
  });

  it("can be asked to see both modes, for jobs that keep shared stock and payments consistent", () => {
    created.length = 0;
    createServiceClient({ allModes: true });
    expect(created[0]!.options?.global?.fetch).toBeUndefined();
  });
});
