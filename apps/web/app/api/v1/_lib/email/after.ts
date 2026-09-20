import { after } from "next/server";

/**
 * Runs a task once the response has gone out (Next's `after`), so a slow email
 * never delays the person waiting. Outside a request (tests, scripts) it just runs.
 */
export function afterResponse(task: () => Promise<unknown>): void {
  try {
    after(task);
  } catch {
    void task().catch(() => undefined);
  }
}
