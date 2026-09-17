import { describe, it, expect } from "vitest";
import { validateSqlSafe, sanitizeSafeText, sanitizeDigitsOnly } from "@gts/utils";
import { hashPin, generatePinTicket, verifyPinTicket } from "../lib/pin-security";

describe("SQL Injection & Security Guards", () => {
  describe("validateSqlSafe", () => {
    it("detects and blocks dangerous SQL statement keywords", () => {
      const malicious1 = "John; DROP TABLE users;";
      const res1 = validateSqlSafe(malicious1, "Name");
      expect(res1.isSafe).toBe(false);
      expect(res1.error).toContain("restricted SQL syntax keywords");

      const malicious2 = "admin'; DELETE FROM customers WHERE 1=1;--";
      const res2 = validateSqlSafe(malicious2, "Name");
      expect(res2.isSafe).toBe(false);
    });

    it("detects and blocks SQL comment sequences", () => {
      const malicious = "test@example.com'--";
      const res = validateSqlSafe(malicious, "Email");
      expect(res.isSafe).toBe(false);
      expect(res.error).toContain("SQL comment sequences");
    });

    it("detects and blocks boolean tautology injections", () => {
      const malicious = "' OR '1'='1";
      const res = validateSqlSafe(malicious, "Password");
      expect(res.isSafe).toBe(false);
      expect(res.error).toContain("invalid logical expression syntax");
    });

    it("detects and blocks UNION SELECT attempts", () => {
      const malicious = "1 UNION SELECT * FROM users";
      const res = validateSqlSafe(malicious, "Search");
      expect(res.isSafe).toBe(false);
      expect(res.error).toContain("prohibited SQL command sequences");
    });

    it("detects and blocks null byte control character attacks", () => {
      const malicious = "admin\0.jpg";
      const res = validateSqlSafe(malicious, "Filename");
      expect(res.isSafe).toBe(false);
      expect(res.error).toContain("illegal control characters");
    });

    it("allows valid realistic human names with hyphens and apostrophes", () => {
      expect(validateSqlSafe("Chukwu-Emeka O'Connor", "Full Name").isSafe).toBe(true);
      expect(validateSqlSafe("Amina Bello", "Full Name").isSafe).toBe(true);
      expect(validateSqlSafe("D'Angelo Russell", "Full Name").isSafe).toBe(true);
    });

    it("allows valid Nigerian street addresses with commas and numbers", () => {
      const addr = "Plot 4, Admiralty Way, Lekki Phase 1, Lagos";
      expect(validateSqlSafe(addr, "Address").isSafe).toBe(true);
    });
  });

  describe("sanitizeSafeText & sanitizeDigitsOnly", () => {
    it("strips control characters without mangling legitimate names", () => {
      const sanitized = sanitizeSafeText("John\x00 Doe\x07", 50);
      expect(sanitized).toBe("John Doe");
    });

    it("enforces strict numeric digits for PIN and phone numbers", () => {
      expect(sanitizeDigitsOnly("080-123-4567")).toBe("0801234567");
      expect(sanitizeDigitsOnly("PIN: 492014")).toBe("492014");
    });
  });

  describe("Cryptographic PIN Security & Signed Tickets", () => {
    it("hashes PIN deterministically with HMAC-SHA256 without plaintext exposure", () => {
      const pin = "123456";
      const hash1 = hashPin(pin);
      const hash2 = hashPin(pin);
      const hashOther = hashPin("654321");

      expect(hash1).toBeTruthy();
      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(hashOther);
      expect(hash1).not.toContain(pin); // Plaintext is not exposed
      expect(hash1).toMatch(/^[a-f0-9]{64}$/); // 256-bit hex hash
    });

    it("generates and verifies 5-minute tamper-proof PIN tickets", () => {
      const userId = "usr_test_12345";
      const ticket = generatePinTicket(userId);

      expect(ticket).toBeTruthy();
      expect(verifyPinTicket(ticket, userId)).toBe(true);
      // Fails if wrong user ID
      expect(verifyPinTicket(ticket, "usr_hacker_9999")).toBe(false);
      // Fails if ticket is malformed or tampered with
      expect(verifyPinTicket(ticket + "fake", userId)).toBe(false);
    });

    it("rejects expired PIN tickets", () => {
      const userId = "usr_test_12345";
      const ticket = generatePinTicket(userId);

      // Verify with maxAgeMs = -1 (already expired)
      expect(verifyPinTicket(ticket, userId, -1)).toBe(false);
    });
  });
});
