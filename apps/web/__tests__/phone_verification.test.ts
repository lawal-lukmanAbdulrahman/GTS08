import { describe, it, expect } from "vitest";
import {
  normalizePhoneNumber,
  isValidNigerianPhone,
  generateFourDigitOtp,
  hashOtp,
  verifyOtpHash,
} from "../lib/termii";
import { saveOtpForPhone, verifyOtpForPhone } from "../lib/phone-otp-store";

describe("Phone Verification & Termii OTP Suite", () => {
  describe("Phone Number Normalization", () => {
    it("converts leading zero local Nigerian numbers to 234 format", () => {
      expect(normalizePhoneNumber("08012345678")).toBe("2348012345678");
      expect(normalizePhoneNumber("09126433601")).toBe("2349126433601");
    });

    it("strips plus signs and spaces correctly", () => {
      expect(normalizePhoneNumber("+234 801 234 5678")).toBe("2348012345678");
      expect(normalizePhoneNumber("+2349126433601")).toBe("2349126433601");
    });

    it("prepends 234 to 10-digit numbers without leading zero", () => {
      expect(normalizePhoneNumber("9126433601")).toBe("2349126433601");
    });
  });

  describe("Legit Nigerian Mobile Phone Validation (isValidNigerianPhone)", () => {
    it("accepts valid Nigerian mobile numbers with various prefixes", () => {
      // MTN, Airtel, Glo, 9mobile prefixes: 70, 80, 81, 90, 91
      expect(isValidNigerianPhone("09126433601")).toBe(true);
      expect(isValidNigerianPhone("+2349126433601")).toBe(true);
      expect(isValidNigerianPhone("2348031234567")).toBe(true);
      expect(isValidNigerianPhone("08031234567")).toBe(true);
      expect(isValidNigerianPhone("8031234567")).toBe(true);
      expect(isValidNigerianPhone("07012345678")).toBe(true);
      expect(isValidNigerianPhone("08123456789")).toBe(true);
      expect(isValidNigerianPhone("09012345678")).toBe(true);
    });

    it("rejects invalid, malformed, or foreign numbers", () => {
      expect(isValidNigerianPhone("1234567890")).toBe(false);
      expect(isValidNigerianPhone("0000000000")).toBe(false);
      expect(isValidNigerianPhone("080312345")).toBe(false); // only 9 digits
      expect(isValidNigerianPhone("0803123456789")).toBe(false); // 13 digits
      expect(isValidNigerianPhone("abcdefghij")).toBe(false);
      expect(isValidNigerianPhone("")).toBe(false);
    });
  });

  describe("4-Digit OTP Generation & HMAC Hashing", () => {
    it("generates a numeric code of exactly 4 digits", () => {
      for (let i = 0; i < 20; i++) {
        const code = generateFourDigitOtp();
        expect(code).toMatch(/^\d{4}$/);
        const num = parseInt(code, 10);
        expect(num).toBeGreaterThanOrEqual(1000);
        expect(num).toBeLessThan(10000);
      }
    });

    it("hashes and validates correctly using constant-time comparison", () => {
      const phone = "2349126433601";
      const code = "4829";
      const hash = hashOtp(phone, code);

      expect(verifyOtpHash(phone, code, hash)).toBe(true);
      expect(verifyOtpHash(phone, "4828", hash)).toBe(false);
      expect(verifyOtpHash(phone, "0000", hash)).toBe(false);
      expect(verifyOtpHash("2348000000000", code, hash)).toBe(false);
    });
  });

  describe("OTP Store Security: Rate Limiting & Brute-Force Protection", () => {
    const userId = "usr_test_verification_01";
    const phone = "2349126433601";

    it("saves and verifies a valid OTP", () => {
      const code = "7182";
      const saveRes = saveOtpForPhone(userId, phone, code);
      expect(saveRes.success).toBe(true);

      const verifyRes = verifyOtpForPhone(userId, phone, code);
      expect(verifyRes.success).toBe(true);
    });

    it("rejects duplicate send requests within 60 seconds (rate limiting)", () => {
      const id = "usr_rate_limit_01";
      const save1 = saveOtpForPhone(id, phone, "1111");
      expect(save1.success).toBe(true);

      const save2 = saveOtpForPhone(id, phone, "2222");
      expect(save2.success).toBe(false);
      expect(save2.error).toContain("seconds before requesting a new code");
      expect(save2.retryAfterSeconds).toBeGreaterThan(0);
    });

    it("locks out after 3 consecutive wrong attempts (brute-force guard)", () => {
      const id = "usr_brute_force_01";
      const testPhone = "2348099887766";
      const correctCode = "9351";

      saveOtpForPhone(id, testPhone, correctCode);

      // Attempt 1: wrong
      const res1 = verifyOtpForPhone(id, testPhone, "0001");
      expect(res1.success).toBe(false);
      expect(res1.error).toContain("2 attempts remaining");

      // Attempt 2: wrong
      const res2 = verifyOtpForPhone(id, testPhone, "0002");
      expect(res2.success).toBe(false);
      expect(res2.error).toContain("1 attempt remaining");

      // Attempt 3: wrong -> should lock
      const res3 = verifyOtpForPhone(id, testPhone, "0003");
      expect(res3.success).toBe(false);
      expect(res3.locked).toBe(true);
      expect(res3.error).toContain("Too many incorrect attempts");

      // Even if subsequent attempt is the correct code, it is now locked and evicted
      const res4 = verifyOtpForPhone(id, testPhone, correctCode);
      expect(res4.success).toBe(false);
    });
  });
});
