/**
 * Security, SQL Injection & Cross-Site Scripting (XSS) Guards
 * Reusable across Storefront, Dashboard, and API Route Handlers.
 */

// SQL Injection attack signatures
const SQL_INJECTION_KEYWORDS =
  /;\s*(DROP|DELETE|INSERT|UPDATE|SELECT|ALTER|TRUNCATE|EXEC|UNION|CREATE|GRANT|REVOKE)\b/i;
const SQL_COMMENT_PATTERN = /(--|\/\*|\*\/)/;
const SQL_BOOLEAN_TAUTOLOGY =
  /\b(OR|AND)\b\s+['"]?([^'"\s]+)['"]?\s*=\s*['"]?\2['"]?/i;
const SQL_UNION_SELECT = /\bUNION\s+(ALL\s+)?SELECT\b/i;
const DANGEROUS_CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

// XSS Attack signatures
const SCRIPT_TAG_REGEX = /<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi;
const DANGEROUS_TAGS_REGEX = /<\s*(iframe|object|embed|applet|meta|link|style|base|form)[^>]*>/gi;
const EVENT_HANDLER_REGEX = /\bon\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
const JAVASCRIPT_PROTOCOL_REGEX = /(javascript|vbscript|data\s*:\s*text\/html)\s*:/gi;

export interface ValidationResult {
  isSafe: boolean;
  error?: string;
}

/**
 * Checks if a user string contains SQL Injection patterns
 */
export function validateSqlSafe(
  input: unknown,
  fieldName = "Field"
): ValidationResult {
  if (input === null || input === undefined || typeof input !== "string") {
    return { isSafe: true };
  }

  const str = String(input);

  if (DANGEROUS_CONTROL_CHARS.test(str)) {
    return {
      isSafe: false,
      error: `${fieldName} contains illegal control characters.`,
    };
  }

  if (SQL_INJECTION_KEYWORDS.test(str)) {
    return {
      isSafe: false,
      error: `${fieldName} contains restricted SQL syntax keywords.`,
    };
  }

  if (SQL_COMMENT_PATTERN.test(str)) {
    return {
      isSafe: false,
      error: `${fieldName} cannot contain SQL comment sequences.`,
    };
  }

  if (SQL_BOOLEAN_TAUTOLOGY.test(str)) {
    return {
      isSafe: false,
      error: `${fieldName} contains invalid logical expression syntax.`,
    };
  }

  if (SQL_UNION_SELECT.test(str)) {
    return {
      isSafe: false,
      error: `${fieldName} contains prohibited SQL command sequences.`,
    };
  }

  return { isSafe: true };
}

/**
 * Escapes characters with HTML entities to neutralize XSS rendering.
 */
export function escapeHtml(text: string): string {
  if (!text || typeof text !== "string") return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Sanitizes input text against Cross-Site Scripting (XSS).
 * Strips script tags, style tags, iframes, and inline event handlers (onerror, onload, onclick, etc.).
 */
export function sanitizeXss(input: unknown, maxLen = 4000): string {
  if (typeof input !== "string") return "";

  let cleaned = input
    .replace(DANGEROUS_CONTROL_CHARS, "")
    .replace(/\0/g, "")
    .replace(SCRIPT_TAG_REGEX, "")
    .replace(DANGEROUS_TAGS_REGEX, "")
    .replace(EVENT_HANDLER_REGEX, "")
    .replace(JAVASCRIPT_PROTOCOL_REGEX, "blocked:");

  return cleaned.trim().slice(0, maxLen);
}

/**
 * Validates and sanitizes a URL, blocking dangerous pseudo-protocols like javascript:, vbscript:,
 * or arbitrary data: URIs while preserving relative routes, https, http, and mailto.
 */
export function sanitizeUrl(url: unknown, defaultFallback = "/"): string {
  if (!url || typeof url !== "string") return defaultFallback;

  const trimmed = url.trim();

  // Relative URLs are safe (e.g. /shop, /track?order=123)
  if (trimmed.startsWith("/") && !trimmed.startsWith("//") && !trimmed.startsWith("/\\")) {
    return trimmed;
  }

  // Allow explicit safe protocols
  if (
    trimmed.startsWith("https://") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("mailto:") ||
    trimmed.startsWith("tel:")
  ) {
    // Disallow carriage returns, newlines, or null bytes inside URL
    return trimmed.replace(/[\r\n\0]/g, "");
  }

  // Any other scheme (javascript:, data:, vbscript:) is rejected
  return defaultFallback;
}

/**
 * Checks for common cyber attack signatures in raw query strings, path parameters, or headers.
 * Used for lightweight Edge WAF inspection.
 */
export function detectAttackPayload(input: unknown): { isSafe: boolean; threat?: string } {
  if (!input || typeof input !== "string") return { isSafe: true };

  const str = input.toLowerCase();

  // Null byte injection
  if (str.includes("%00") || str.includes("\0")) {
    return { isSafe: false, threat: "Null-byte injection attempt" };
  }

  // Directory traversal
  if (str.includes("../") || str.includes("..\\") || str.includes("%2e%2e%2f")) {
    return { isSafe: false, threat: "Path traversal attempt" };
  }

  // Script injection
  if (str.includes("<script") || str.includes("%3cscript") || str.includes("javascript:")) {
    return { isSafe: false, threat: "Cross-Site Scripting (XSS) attempt" };
  }

  // Critical SQLi keywords in query strings
  if (
    str.includes("union select") ||
    str.includes("union%20select") ||
    str.includes("waitfor delay") ||
    str.includes("sleep(") ||
    str.includes("benchmark(")
  ) {
    return { isSafe: false, threat: "SQL Injection probe" };
  }

  return { isSafe: true };
}

/**
 * Sanitizes input text, removing null bytes and dangerous control characters,
 * while safely preserving valid names (e.g. O'Connor, Chukwu-Emeka) and addresses.
 */
export function sanitizeSafeText(input: unknown, maxLen = 255): string {
  if (typeof input !== "string") return "";

  return sanitizeXss(input, maxLen);
}

/**
 * Sanitizes numeric PIN or phone inputs to strictly numeric digits.
 */
export function sanitizeDigitsOnly(input: unknown, maxLen = 20): string {
  if (typeof input !== "string" && typeof input !== "number") return "";
  return String(input).replace(/\D/g, "").slice(0, maxLen);
}
