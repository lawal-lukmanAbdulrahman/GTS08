#!/usr/bin/env node
/**
 * Lint ratchet: fails when any file has MORE lint errors than the recorded
 * baseline (or a file with no recorded errors gains some). Legacy errors don't
 * block work; new ones do, and the baseline can only go down.
 *
 *   node scripts/lint-ratchet.cjs            # check
 *   node scripts/lint-ratchet.cjs --update   # record the current counts (after fixing some)
 */
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const BASELINE = path.join(ROOT, ".lint-baseline.json");
const APPS = ["apps/web", "apps/dashboard"];

function errorsFor(app) {
  let out;
  try {
    out = execFileSync("npx", ["eslint", ".", "--format", "json", "--no-error-on-unmatched-pattern"], { cwd: path.join(ROOT, app), maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] }).toString();
  } catch (e) {
    out = e.stdout ? e.stdout.toString() : "[]"; // eslint exits 1 when there are errors; the JSON is still on stdout
  }
  const counts = {};
  for (const file of JSON.parse(out || "[]")) {
    if (file.errorCount > 0) counts[path.relative(ROOT, file.filePath)] = file.errorCount;
  }
  return counts;
}

const current = Object.assign({}, ...APPS.map(errorsFor));

if (process.argv.includes("--update")) {
  fs.writeFileSync(BASELINE, JSON.stringify(current, Object.keys(current).sort(), 2) + "\n");
  console.log(`Baseline updated: ${Object.keys(current).length} files, ${Object.values(current).reduce((a, b) => a + b, 0)} errors.`);
  process.exit(0);
}

const baseline = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, "utf8")) : {};
const worse = Object.entries(current).filter(([file, n]) => n > (baseline[file] ?? 0));
const total = Object.values(current).reduce((a, b) => a + b, 0);
const baseTotal = Object.values(baseline).reduce((a, b) => a + b, 0);

if (worse.length) {
  console.error("New lint errors (more than the baseline allows):");
  for (const [file, n] of worse) console.error(`  ${file}: ${n} (baseline ${baseline[file] ?? 0})`);
  process.exit(1);
}
const better = baseTotal - total;
console.log(`Lint OK: ${total} legacy errors remain${better > 0 ? ` (${better} fewer than the baseline: run with --update to lock in the progress)` : ""}.`);
