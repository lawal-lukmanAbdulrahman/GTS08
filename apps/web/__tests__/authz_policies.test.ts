// @vitest-environment node
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { ROUTE_POLICIES, type Method } from "../app/api/v1/_lib/route-policies";

const ROOT = path.resolve(__dirname, "../app/api/v1");
const METHODS: Method[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];

function routeFiles(dir = ROOT, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) routeFiles(p, out);
    else if (entry.name === "route.ts") out.push(p);
  }
  return out;
}

/** The source of one exported handler: from its declaration to the next top-level export. */
function handlerSource(source: string, method: Method): string | null {
  const start = source.search(new RegExp(`export (?:async function|const) ${method}\\b`));
  if (start < 0) return null;
  const rest = source.slice(start + 1);
  const next = rest.search(/\nexport /);
  return next < 0 ? source.slice(start) : source.slice(start, start + 1 + next);
}

const discovered: Array<{ route: string; method: Method; body: string; file: string }> = [];
for (const file of routeFiles()) {
  const route = path.relative(ROOT, path.dirname(file)).split(path.sep).join("/");
  const source = fs.readFileSync(file, "utf8");
  for (const method of METHODS) {
    const body = handlerSource(source, method);
    if (body !== null) discovered.push({ route, method, body, file: source });
  }
}

function markersFor(policy: string): Array<RegExp> {
  const parts = policy.split("|");
  return parts.flatMap((p): RegExp[] => {
    if (p === "public") return [];
    if (p === "stub") return [/Not implemented|notImplemented/];
    if (p === "session") return [/status: 401|status: 401|UNAUTHORIZED|getAuthenticatedUser|createClient/];
    if (p === "optionalStaff") return [/optionalStaff\(/];
    if (p === "staff") return [/requireStaff\(/];
    if (p === "pos") return [/requirePosAccess\(/];
    if (p === "admin") return [/requireAdmin\(/];
    if (p === "super_admin") return [/requireSuperAdmin\(/];
    if (p === "webhook") return [/signatureMatches\(/];
    if (p === "cron") return []; // checked against the whole file below (handlers share one `run` that calls requireCron)
    if (p.startsWith("permission:")) return [new RegExp(`requirePermission\\(request, "${p.slice(11)}"\\)`)];
    if (p.startsWith("pos-permission:")) return [new RegExp(`requirePosPermission\\(request, "${p.slice(15)}"\\)`)];
    throw new Error(`Unknown policy "${policy}"`);
  });
}

describe("route policy manifest", () => {
  it("finds the routes (guards against the walker silently finding none)", () => {
    expect(discovered.length).toBeGreaterThan(60);
  });

  it.each(discovered.map((d) => [`${d.method} /${d.route}`, d] as const))("%s declares a policy", (_name, d) => {
    expect(ROUTE_POLICIES[d.route]?.[d.method], `Add "${d.method}" for "${d.route}" to route-policies.ts`).toBeTruthy();
  });

  it("lists nothing that no longer exists", () => {
    const real = new Set(discovered.map((d) => `${d.method} ${d.route}`));
    const stale: string[] = [];
    for (const [route, methods] of Object.entries(ROUTE_POLICIES)) {
      for (const method of Object.keys(methods)) if (!real.has(`${method} ${route}`)) stale.push(`${method} ${route}`);
    }
    expect(stale).toEqual([]);
  });

  describe("every handler enforces the policy it declares", () => {
    it.each(discovered.map((d) => [`${d.method} /${d.route}`, d] as const))("%s", (_name, d) => {
      const policy = ROUTE_POLICIES[d.route]?.[d.method];
      if (!policy) return; // reported by the test above
      if (policy === "cron") {
        expect(d.file, `${d.method} /${d.route} declares "cron" but the file never calls requireCron`).toMatch(/requireCron\(request\)/);
      }
      for (const marker of markersFor(policy)) {
        expect(d.body, `${d.method} /${d.route} declares "${policy}" but its code doesn't contain ${marker}`).toMatch(marker);
      }
    });
  });

  it("no route trusts a development-mode bypass for authentication", () => {
    const offenders = discovered.filter((d) => /NODE_ENV\s*===?\s*["']development["']/.test(d.body) && /getAuthenticatedUser|requireAdmin|requirePermission/.test(d.body));
    expect(offenders.map((o) => `${o.method} /${o.route}`)).toEqual([]);
  });

  it("no source file contains a fallback secret or API key", () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.tsx?$/.test(e.name)) {
          const src = fs.readFileSync(p, "utf8");
          if (/(SECRET|API_KEY|API_SECRET|PRIVATE_KEY)[A-Z_]*\s*\|\|\s*["'][^"']+["']/.test(src)) offenders.push(path.relative(ROOT, p));
        }
      }
    };
    walk(ROOT);
    expect(offenders).toEqual([]);
  });

  it("no route echoes an internal error message from its catch-all (use serverError)", () => {
    const offenders = discovered
      .filter((d) => /error: \w+\.message \|\|/.test(d.body))
      .map((d) => `${d.method} /${d.route}`);
    expect(offenders).toEqual([]);
  });
});
