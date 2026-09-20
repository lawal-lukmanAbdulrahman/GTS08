// @vitest-environment node
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "../app/api/v1");

function routeFiles(dir = ROOT, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) routeFiles(p, out);
    else if (entry.name === "route.ts") out.push(p);
  }
  return out;
}

describe("no route echoes an internal error message to the caller", () => {
  it("never puts `<something>.message` into a response's `error` field", () => {
    const offenders: string[] = [];
    for (const file of routeFiles()) {
      fs.readFileSync(file, "utf8").split("\n").forEach((line, i) => {
        // `error: error.message` / `error: err.message`: a database or library message reaching the caller.
        // (Our own validation messages, e.g. `check.message`, are written for the caller and are fine.)
        if (/\berror:\s*(?:error|err|e|\w*Error|\w*Err)\.message\b/.test(line)) offenders.push(`${path.relative(ROOT, file)}:${i + 1}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});
