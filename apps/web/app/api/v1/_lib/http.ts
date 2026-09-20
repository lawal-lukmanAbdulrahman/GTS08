import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const INVALID_BODY = { error: "Invalid JSON body.", code: "INVALID_BODY" };

/**
 * The response for an unexpected error in a route's catch-all. A body that
 * wasn't valid JSON is the caller's mistake (400); anything else is ours (500)
 * and is logged in full but never described to the caller, since the message
 * can name tables, columns or internals.
 */
export function serverError(err: unknown): NextResponse {
  if (err instanceof SyntaxError) return NextResponse.json(INVALID_BODY, { status: 400 });
  console.error("[api] unexpected error:", err);
  return NextResponse.json({ error: "Something went wrong. Please try again.", code: "SERVER_ERROR" }, { status: 500 });
}

/** Reads a JSON request body, returning a ready 400 response when it isn't valid JSON. */
export async function readJson(request: NextRequest): Promise<{ ok: true; body: unknown } | { ok: false; response: NextResponse }> {
  try {
    return { ok: true, body: await request.json() };
  } catch {
    return { ok: false, response: NextResponse.json(INVALID_BODY, { status: 400 }) };
  }
}

/**
 * A database failure as a response: the real message goes to the server log, and the
 * caller gets a generic one, since the text can name tables, columns or constraints.
 */
export function dbError(error: { message?: string } | null | undefined, code = "DATABASE_ERROR", status = 500): NextResponse {
  console.error(`[api] ${code}:`, error?.message ?? error);
  return NextResponse.json({ error: "Something went wrong. Please try again.", code }, { status });
}
