// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

let mode: "test" | "live" = "live";
vi.mock("@gts/database", () => ({ getRequestDataMode: async () => mode }));

import { publicCache } from "../app/api/v1/_lib/public-cache";

describe("publicCache", () => {
  it("never lets a shared cache keep an answer: the CDN can't tell the demo account from a visitor, so it would serve one the other's data", async () => {
    mode = "live";
    expect(await publicCache("public, s-maxage=30")).toBe("private, no-store");
  });
  it("never lets a shared cache keep the demo account's answer, or real visitors would be served demo data", async () => {
    mode = "test";
    expect(await publicCache("public, s-maxage=30")).toBe("private, no-store");
  });
});

describe("routes that let a shared cache keep their answer", () => {
  const dir = path.join(__dirname, "../app/api");
  const files = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(path.join(d, e.name)) : e.name === "route.ts" ? [path.join(d, e.name)] : []));
  const offenders = files(dir).filter((f) => /"public,\s*(s-)?max-age/.test(fs.readFileSync(f, "utf8").replace(/publicCache\("public,[^"]*"\)/g, "")));

  it("all decide it through publicCache, so demo data can never be cached publicly", () => {
    expect(offenders.map((f) => path.relative(dir, f))).toEqual([]);
  });
});
