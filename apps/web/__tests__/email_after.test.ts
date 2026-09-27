// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { runWithDataMode, currentDataModeOverride } from "../../../packages/database/src/data-scope";

const scheduled: Array<() => Promise<unknown>> = [];
vi.mock("next/server", () => ({ after: (fn: () => Promise<unknown>) => scheduled.push(fn) }));
vi.mock("@gts/database", () => ({ getRequestDataMode: async () => "test", runWithDataMode }));

import { afterResponse } from "../app/api/v1/_lib/email/after";

describe("afterResponse", () => {
  it("runs the task later, still in the mode of the request that scheduled it", async () => {
    let seen: string | undefined;
    afterResponse(async () => {
      seen = currentDataModeOverride();
    });
    expect(seen).toBeUndefined();
    await scheduled[0]!();
    expect(seen).toBe("test");
  });
});

describe("afterResponse when the mode can't be read", () => {
  it("never throws into the action it belongs to, and still runs the task", async () => {
    vi.resetModules();
    vi.doMock("@gts/database", () => ({ getRequestDataMode: () => { throw new Error("boom"); }, runWithDataMode }));
    const { afterResponse: after2 } = await import("../app/api/v1/_lib/email/after");
    let ran = false;
    expect(() => after2(async () => { ran = true; })).not.toThrow();
    await scheduled.at(-1)!();
    expect(ran).toBe(true);
  });
});
