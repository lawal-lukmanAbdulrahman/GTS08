// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const rpc = vi.fn();
let mode: "test" | "live" = "live";
vi.mock("@gts/database", () => ({
  getRequestDataMode: async () => mode,
  createServiceClient: () => ({
    rpc: (...a: unknown[]) => rpc(...a),
    from: () => {
      const stub: any = new Proxy({}, { get: (_t, p: string) => (p === "then" ? (r: (v: unknown) => void) => r({ data: [], error: null }) : () => stub) });
      return stub;
    },
  }),
}));

import { NextRequest } from "next/server";
import { GET } from "../app/api/v1/search/route";

const search = (q: string) => GET(new NextRequest(`http://localhost/api/v1/search?q=${encodeURIComponent(q)}`));

describe("GET /search", () => {
  beforeEach(() => {
    rpc.mockReset().mockResolvedValue({ data: [], error: null });
    mode = "live";
  });

  it("searches the live catalogue for everyone else", async () => {
    await search("shirt");
    expect(rpc).toHaveBeenCalledWith("search_products", expect.objectContaining({ search_query: "shirt", data_is_test: false }));
  });

  it("searches the demo catalogue for the demo account", async () => {
    mode = "test";
    await search("shirt");
    expect(rpc).toHaveBeenCalledWith("search_products", expect.objectContaining({ data_is_test: true }));
  });
});
