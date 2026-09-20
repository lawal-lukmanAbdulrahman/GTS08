import { hashOtp, verifyOtpHash, normalizePhoneNumber } from "./termii";

interface StoredOtpRecord {
  phone: string;
  codeHash: string;
  expiresAt: number;
  attempts: number;
  lastSentAt: number;
}

// In-memory cache for OTP verification with automatic TTL eviction
const otpStore = new Map<string, StoredOtpRecord>();

// Clean up expired OTP records every 2 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of otpStore.entries()) {
    if (record.expiresAt < now) {
      otpStore.delete(key);
    }
  }
}, 2 * 60 * 1000);

/**
 * Saves a new OTP for a phone number with rate-limiting checks
 */
export function saveOtpForPhone(
  userId: string,
  phone: string,
  code: string
): { success: boolean; error?: string; retryAfterSeconds?: number } {
  const normalized = normalizePhoneNumber(phone);
  const key = `${userId}:${normalized}`;
  const now = Date.now();

  const existing = otpStore.get(key);
  if (existing) {
    // Enforce 60-second cooldown between sends
    const elapsedSeconds = Math.floor((now - existing.lastSentAt) / 1000);
    if (elapsedSeconds < 60) {
      const remaining = 60 - elapsedSeconds;
      return {
        success: false,
        error: `Please wait ${remaining} seconds before requesting a new code.`,
        retryAfterSeconds: remaining,
      };
    }
  }

  // 5 minutes expiry
  const expiresAt = now + 5 * 60 * 1000;
  const codeHash = hashOtp(normalized, code);

  otpStore.set(key, {
    phone: normalized,
    codeHash,
    expiresAt,
    attempts: 0,
    lastSentAt: now,
  });

  return { success: true };
}

/**
 * Verifies the candidate 4-digit code
 */
export function verifyOtpForPhone(
  userId: string,
  phone: string,
  candidateCode: string
): { success: boolean; error?: string; locked?: boolean } {
  const normalized = normalizePhoneNumber(phone);
  const key = `${userId}:${normalized}`;
  const now = Date.now();

  const record = otpStore.get(key);
  if (!record) {
    return {
      success: false,
      error: "No verification code requested or code has expired. Please request a new code.",
    };
  }

  if (record.expiresAt < now) {
    otpStore.delete(key);
    return {
      success: false,
      error: "Verification code has expired. Please request a new one.",
    };
  }

  if (record.attempts >= 3) {
    otpStore.delete(key);
    return {
      success: false,
      locked: true,
      error: "Too many incorrect attempts. Please request a new code.",
    };
  }

  // Validate the 4-digit OTP using constant-time comparison
  const isValid = verifyOtpHash(normalized, candidateCode, record.codeHash);
  if (!isValid) {
    record.attempts += 1;
    const remaining = 3 - record.attempts;
    return {
      success: false,
      error:
        remaining > 0
          ? `Incorrect verification code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`
          : "Too many incorrect attempts. Please request a new code.",
      locked: remaining === 0,
    };
  }

  // Verification succeeded: delete OTP record to prevent replays
  otpStore.delete(key);
  return { success: true };
}
