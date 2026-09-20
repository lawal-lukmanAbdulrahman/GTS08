import { createServerClient, createServiceClient } from "@gts/database";
import type { NextRequest } from "next/server";

/**
 * Prevents and sanitizes input parameters against SQL Injection attacks and malicious payloads.
 */
export function sanitizeSqlInput(input: unknown): string {
  if (typeof input !== "string") return "";

  let sanitized = input
    .trim()
    .replace(/\0/g, "") // Remove null bytes
    .replace(/[\b\t\n\r\x1a]/g, ""); // Remove control characters

  // Neutralize common SQL Injection syntax patterns & keywords
  const sqlKeywordsRegex = /(\b(UNION\s+SELECT|SELECT\s+.*\s+FROM|INSERT\s+INTO|DELETE\s+FROM|DROP\s+TABLE|ALTER\s+TABLE|UPDATE\s+.*\s+SET|EXEC(\s|\+)+(s|x)p|\bOR\b\s+['"]?1['"]?\s*=\s*['"]?1|--|\/\*|\*\/)\b)/gi;

  // Escape quotes and semicolons if any remain
  sanitized = sanitized.replace(sqlKeywordsRegex, "").replace(/['";]/g, "");

  return sanitized;
}

/**
 * Validates and sanitizes email inputs.
 */
export function sanitizeEmail(email: unknown): string {
  const sanitized = sanitizeSqlInput(email).toLowerCase();
  return sanitized;
}

export async function getAuthenticatedUser(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader ? authHeader.replace(/^Bearer\s+/i, "").trim() : null;

  const serviceClient = createServiceClient();

  if (token) {
    const { data, error } = await serviceClient.auth.getUser(token);
    if (!error && data.user) {
      return data.user;
    }
  }

  // Fallback to server cookies
  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase.auth.getUser();
    if (!error && data.user) {
      return data.user;
    }
  } catch {
    // ignore
  }

  return null;
}
