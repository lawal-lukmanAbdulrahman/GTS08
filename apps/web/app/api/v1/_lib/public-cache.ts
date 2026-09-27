import { getRequestDataMode } from "@gts/database";

/**
 * The Cache-Control for an answer a shared cache (the CDN) may keep. The demo
 * account's answers are demo data, so they are never cached publicly: a CDN
 * would otherwise serve them to real visitors.
 */
export async function publicCache(value: string): Promise<string> {
  return (await getRequestDataMode()) === "test" ? "private, no-store" : value;
}
