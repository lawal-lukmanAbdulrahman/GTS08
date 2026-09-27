// @vitest-environment node
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Migration 00025 made these unique per data set: (column, is_test). An upsert must name both,
// or it fails (no matching constraint) or, with no target at all, collides with the other set.
const PER_MODE_KEYS: Record<string, string> = { brands: "name", content_slots: "slot_key", products: "slug", categories: "slug", promos: "code" };

function routeFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? routeFiles(p) : /\.ts$/.test(e.name) ? [p] : [];
  });
}

describe("upserts on per-mode unique keys", () => {
  const files = routeFiles(path.join(__dirname, "../app/api"));
  const found: string[] = [];
  for (const file of files) {
    const src = fs.readFileSync(file, "utf8");
    for (const m of src.matchAll(/\.from\("([a-z_]+)"\)\s*\.upsert\(/g)) {
      const table = m[1]!;
      if (!(table in PER_MODE_KEYS)) continue;
      const call = src.slice(m.index!, m.index! + 1500);
      const end = call.search(/\)\s*(\.select|;|\n\s*\n)/);
      found.push(`${path.relative(path.join(__dirname, ".."), file)} ${table} ${(end > 0 ? call.slice(0, end + 1) : call).match(/onConflict:\s*"([^"]*)"/)?.[1] ?? "(none)"}`);
    }
  }

  it("finds the upserts it checks", () => {
    expect(found.length).toBeGreaterThanOrEqual(4);
  });

  it.each(found.map((f) => [f]))("%s names the data set in its conflict target", (entry) => {
    const [, table, target] = entry.split(" ");
    expect(target).toBe(`${PER_MODE_KEYS[table!]},is_test`);
  });
});
