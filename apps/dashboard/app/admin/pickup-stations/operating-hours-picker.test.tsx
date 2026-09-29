import { describe, it, expect } from "vitest";
import {
  parseTimeTo24h,
  formatTime12h,
  normalizeDay,
  parseOperatingHours,
  buildOperatingHoursString,
} from "./operating-hours-picker";

describe("OperatingHoursPicker helpers", () => {
  describe("normalizeDay", () => {
    it("normalizes short and full day names", () => {
      expect(normalizeDay("Mon")).toBe("Mon");
      expect(normalizeDay("monday")).toBe("Mon");
      expect(normalizeDay("tue")).toBe("Tue");
      expect(normalizeDay("Wednesday")).toBe("Wed");
      expect(normalizeDay("Thurs")).toBe("Thu");
      expect(normalizeDay("friday")).toBe("Fri");
      expect(normalizeDay("Saturday")).toBe("Sat");
      expect(normalizeDay("Sun")).toBe("Sun");
      expect(normalizeDay("unknown")).toBe("Mon");
    });
  });

  describe("parseTimeTo24h", () => {
    it("parses 12h AM/PM format to 24h string", () => {
      expect(parseTimeTo24h("9:00 AM")).toBe("09:00");
      expect(parseTimeTo24h("9:00am")).toBe("09:00");
      expect(parseTimeTo24h("9am")).toBe("09:00");
      expect(parseTimeTo24h("12:00 PM")).toBe("12:00");
      expect(parseTimeTo24h("12:00 AM")).toBe("00:00");
      expect(parseTimeTo24h("6:00 PM")).toBe("18:00");
      expect(parseTimeTo24h("6pm")).toBe("18:00");
      expect(parseTimeTo24h("18:00")).toBe("18:00");
      expect(parseTimeTo24h("08:30")).toBe("08:30");
    });

    it("falls back to 09:00 on empty or invalid input", () => {
      expect(parseTimeTo24h("")).toBe("09:00");
      expect(parseTimeTo24h(null)).toBe("09:00");
      expect(parseTimeTo24h("invalid")).toBe("09:00");
    });
  });

  describe("formatTime12h", () => {
    it("formats 24h time strings to standard 12h AM/PM", () => {
      expect(formatTime12h("09:00")).toBe("9:00 AM");
      expect(formatTime12h("18:00")).toBe("6:00 PM");
      expect(formatTime12h("12:00")).toBe("12:00 PM");
      expect(formatTime12h("00:00")).toBe("12:00 AM");
      expect(formatTime12h("17:30")).toBe("5:30 PM");
      expect(formatTime12h("08:15")).toBe("8:15 AM");
    });
  });

  describe("parseOperatingHours & buildOperatingHoursString", () => {
    it("parses standard Mon - Sat format", () => {
      const parsed = parseOperatingHours("Mon - Sat: 9:00 AM - 6:00 PM");
      expect(parsed.fromDay).toBe("Mon");
      expect(parsed.toDay).toBe("Sat");
      expect(parsed.openTime).toBe("09:00");
      expect(parsed.closeTime).toBe("18:00");
      expect(parsed.hasSunday).toBe(false);

      const rebuilt = buildOperatingHoursString(parsed);
      expect(rebuilt).toBe("Mon - Sat: 9:00 AM - 6:00 PM");
    });

    it("parses Mon - Fri format", () => {
      const parsed = parseOperatingHours("Mon - Fri: 8:30 AM - 5:00 PM");
      expect(parsed.fromDay).toBe("Mon");
      expect(parsed.toDay).toBe("Fri");
      expect(parsed.openTime).toBe("08:30");
      expect(parsed.closeTime).toBe("17:00");

      const rebuilt = buildOperatingHoursString(parsed);
      expect(rebuilt).toBe("Mon - Fri: 8:30 AM - 5:00 PM");
    });

    it("parses schedule with Sunday hours", () => {
      const parsed = parseOperatingHours("Mon - Sat: 9:00 AM - 6:00 PM, Sun: 12:00 PM - 5:00 PM");
      expect(parsed.fromDay).toBe("Mon");
      expect(parsed.toDay).toBe("Sat");
      expect(parsed.openTime).toBe("09:00");
      expect(parsed.closeTime).toBe("18:00");
      expect(parsed.hasSunday).toBe(true);
      expect(parsed.sunOpenTime).toBe("12:00");
      expect(parsed.sunCloseTime).toBe("17:00");

      const rebuilt = buildOperatingHoursString(parsed);
      expect(rebuilt).toBe("Mon - Sat: 9:00 AM - 6:00 PM, Sun: 12:00 PM - 5:00 PM");
    });

    it("returns default fallback for empty or null strings", () => {
      const parsed = parseOperatingHours(null);
      expect(parsed.fromDay).toBe("Mon");
      expect(parsed.toDay).toBe("Sat");
      expect(parsed.openTime).toBe("09:00");
      expect(parsed.closeTime).toBe("18:00");
      expect(parsed.hasSunday).toBe(false);

      expect(buildOperatingHoursString(parsed)).toBe("Mon - Sat: 9:00 AM - 6:00 PM");
    });
  });

  describe("OperatingHoursPicker component", () => {
    it("renders presets and calls onChange when preset clicked", async () => {
      const { render, screen, fireEvent } = await import("@testing-library/react");
      const { OperatingHoursPicker } = await import("./operating-hours-picker");
      let latestValue = "";

      render(
        <OperatingHoursPicker
          value="Mon - Sat: 9:00 AM - 6:00 PM"
          onChange={(v) => {
            latestValue = v;
          }}
        />
      );

      expect(screen.getByText("Mon - Sat")).toBeDefined();
      expect(screen.getByText("Mon - Fri")).toBeDefined();

      const monFriBtn = screen.getByText("Mon - Fri");
      fireEvent.click(monFriBtn);

      expect(latestValue).toBe("Mon - Fri: 9:00 AM - 6:00 PM");
    });
  });
});

