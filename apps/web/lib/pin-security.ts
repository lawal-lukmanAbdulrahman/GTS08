import crypto from "crypto";

const PIN_SECRET =
  process.env.SUPABASE_SERVICE_ROLE_KEY || "gts_secure_pin_salt_v1_2026";

/**
 * Computes a cryptographic HMAC-SHA256 hash of the 6-digit PIN.
 * Ensures the user's PIN is never stored or transmitted in plaintext.
 */
export function hashPin(pin: string): string {
  return crypto.createHmac("sha256", PIN_SECRET).update(pin).digest("hex");
}

/**
 * Generates a tamper-proof, short-lived (5-minute) authorization ticket
 * after the user verifies their existing PIN or password.
 */
export function generatePinTicket(userId: string): string {
  const timestamp = Date.now();
  const payload = `${userId}:${timestamp}`;
  const signature = crypto
    .createHmac("sha256", PIN_SECRET)
    .update(payload)
    .digest("hex");
  return `${payload}:${signature}`;
}

/**
 * Validates the authorization ticket before allowing a PIN update.
 */
export function verifyPinTicket(
  ticket: string,
  userId: string,
  maxAgeMs = 5 * 60 * 1000 // 5 minutes
): boolean {
  if (!ticket || typeof ticket !== "string") return false;
  const parts = ticket.split(":");
  if (parts.length !== 3) return false;

  const [ticketUserId, timestampStr, signature] = parts;
  if (!ticketUserId || !timestampStr || !signature) return false;

  if (ticketUserId !== userId) return false;

  const timestamp = Number(timestampStr);
  if (isNaN(timestamp) || Date.now() - timestamp > maxAgeMs || timestamp > Date.now() + 5000) {
    return false; // Expired or future timestamp
  }

  const expectedSignature = crypto
    .createHmac("sha256", PIN_SECRET)
    .update(`${ticketUserId}:${timestampStr}`)
    .digest("hex");

  // Constant-time buffer comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(expectedSignature, "hex")
    );
  } catch {
    return false;
  }
}
