import { after } from "next/server";
import { getRequestDataMode, runWithDataMode, type DataMode } from "@gts/database";

/**
 * Runs a task once the response has gone out (Next's `after`), so a slow email
 * never delays the person waiting. Outside a request (tests, scripts) it just runs.
 *
 * The request's data mode is read now, while the request is still in scope, and
 * the task runs pinned to it: work for the demo account stays in demo data and
 * never sends real mail.
 */
export function afterResponse(task: () => Promise<unknown>): void {
  let mode: Promise<DataMode>;
  try {
    mode = getRequestDataMode();
  } catch {
    mode = Promise.resolve("live"); // a failure here must never break the action this task belongs to
  }
  const run = async () => runWithDataMode(await mode, task);
  try {
    after(run);
  } catch {
    void run().catch(() => undefined);
  }
}
