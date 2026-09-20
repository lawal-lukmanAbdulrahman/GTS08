import crypto from "crypto";

const TERMII_API_KEY =
  process.env.TERMII_API_KEY || "tlv_yAtpUWU2bBM37Tv_3dx99hzAkPaHtlx7f_7UxR_Vuvc";
const TERMII_BASE_URL = (
  process.env.TERMII_BASE_URL || "https://v4.api.termii.com"
).replace(/\/$/, "");
const TERMII_SENDER_ID = process.env.TERMII_SENDER_ID || "GTS";

/**
 * Normalizes a phone number to Termii international format (e.g., 2348012345678)
 */
export function normalizePhoneNumber(rawPhone: string): string {
  const digits = rawPhone.replace(/\D/g, "");
  if (digits.startsWith("234") && digits.length >= 13) {
    return digits;
  }
  if (digits.startsWith("0")) {
    return `234${digits.slice(1)}`;
  }
  if (digits.length === 10) {
    return `234${digits}`;
  }
  return digits;
}

/**
 * Validates whether a phone string represents a legitimate Nigerian mobile phone number
 * (Must match standard Nigerian mobile prefixes: 70, 80, 81, 90, 91 with 10 national digits)
 */
export function isValidNigerianPhone(phone: string): boolean {
  if (!phone || typeof phone !== "string") return false;
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("234")) {
    return /^234[789][01]\d{8}$/.test(digits);
  }
  if (digits.startsWith("0")) {
    return /^0[789][01]\d{8}$/.test(digits);
  }
  if (digits.length === 10) {
    return /^[789][01]\d{8}$/.test(digits);
  }
  return false;
}

/**
 * Generates a secure, unpredictable 4-digit numeric code (1000 - 9999)
 */
export function generateFourDigitOtp(): string {
  return crypto.randomInt(1000, 10000).toString();
}

/**
 * Computes an HMAC-SHA256 hash of the phone and OTP for tamper-proof verification
 */
export function hashOtp(phone: string, otp: string): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || "gts_default_otp_hmac_secret";
  return crypto
    .createHmac("sha256", secret)
    .update(`${normalizePhoneNumber(phone)}:${otp.trim()}`)
    .digest("hex");
}

/**
 * Safely verifies an OTP against an expected hash using constant-time comparison
 */
export function verifyOtpHash(phone: string, candidateOtp: string, expectedHash: string): boolean {
  if (!candidateOtp || candidateOtp.length !== 4) return false;
  const candidateHash = hashOtp(phone, candidateOtp);
  try {
    const a = Buffer.from(candidateHash, "hex");
    const b = Buffer.from(expectedHash, "hex");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export interface SendSmsResult {
  success: boolean;
  messageId?: string;
  error?: string;
  devCode?: string; // Provided in dev mode to make testing seamless
}

/**
 * Dispatches an SMS message using Termii's v4 API
 */
export async function sendTermiiSms(to: string, message: string): Promise<SendSmsResult> {
  const normalizedPhone = normalizePhoneNumber(to);

  // Payload for Termii SMS
  const payload = {
    to: normalizedPhone,
    from: TERMII_SENDER_ID,
    sms: message,
    type: "plain",
    channel: "generic", // 'generic' or 'dnd'
    api_key: TERMII_API_KEY,
  };

  try {
    const response = await fetch(`${TERMII_BASE_URL}/api/sms/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    // Termii success: returns { message_id: "...", message: "Successfully Sent", ... }
    if (response.ok && (data.message_id || data.code === "ok" || data.message === "Successfully Sent")) {
      return {
        success: true,
        messageId: data.message_id,
      };
    }

    console.warn("[TERMII SMS WARNING]", data);
    return {
      success: false,
      error: data.message || data.error || "Failed to deliver SMS via Termii",
    };
  } catch (err: any) {
    console.error("[TERMII SMS NETWORK ERROR]", err);
    return {
      success: false,
      error: err.message || "Network error connecting to Termii",
    };
  }
}

/**
 * Sends a 4-digit verification code to the recipient's phone number
 */
export async function sendPhoneVerificationCode(
  phone: string,
  code: string
): Promise<SendSmsResult> {
  const smsBody = `Your GTS verification code is ${code}. It expires in 5 minutes. Do not share this code.`;
  console.log(`\n========================================`);
  console.log(`[GTS SMS OTP] TO: ${phone} | CODE: ${code}`);
  console.log(`========================================\n`);

  const res = await sendTermiiSms(phone, smsBody);

  // In non-production or if Termii workspace sender ID is pending activation,
  // ensure testing is never blocked by attaching the dev code
  const isDev = process.env.NODE_ENV !== "production";
  if (!res.success && isDev) {
    console.log(`[DEV FALLBACK] Termii sender ID pending activation. Use code: ${code}`);
    return {
      success: true,
      devCode: code,
      error: res.error,
    };
  }

  return {
    ...res,
    devCode: isDev ? code : undefined,
  };
}
