import { describe, it, expect } from "vitest";
import { validateStoreSettings } from "@gts/utils";

function ok(input: unknown) {
  const r = validateStoreSettings(input);
  if (!r.ok) throw new Error("expected ok, got " + JSON.stringify(r.errors));
  return r.value;
}
function errors(input: unknown) {
  const r = validateStoreSettings(input);
  if (r.ok) throw new Error("expected errors");
  return r.errors;
}

describe("validateStoreSettings", () => {
  it("accepts a complete, valid set of store details", () => {
    expect(
      ok({
        store_name: "GTS Home & Living",
        store_address: "12 Allen Avenue, Ikeja, Lagos",
        support_phone: "0803 123 4567",
        whatsapp_number: "+234 803 123 4567",
        support_email: "hello@gts.ng",
      })
    ).toEqual({
      store_name: "GTS Home & Living",
      store_address: "12 Allen Avenue, Ikeja, Lagos",
      support_phone: "0803 123 4567",
      whatsapp_number: "+234 803 123 4567",
      support_email: "hello@gts.ng",
    });
  });

  it("requires a store name", () => {
    expect(errors({ store_name: "   " }).store_name).toBeDefined();
    expect(errors({ store_name: "" }).store_name).toBeDefined();
  });

  it("trims values and collapses inner whitespace, including newlines that would break the receipt layout", () => {
    const v = ok({ store_name: "  GTS  ", store_address: "12 Allen Avenue,\n  Ikeja,\tLagos " });
    expect(v.store_name).toBe("GTS");
    expect(v.store_address).toBe("12 Allen Avenue, Ikeja, Lagos");
  });

  it("turns blank optional fields into null so they can be cleared", () => {
    const v = ok({ store_name: "GTS", store_address: "  ", support_phone: "", whatsapp_number: null });
    expect(v.store_address).toBeNull();
    expect(v.support_phone).toBeNull();
    expect(v.whatsapp_number).toBeNull();
  });

  it("only returns fields that were sent, so a partial update can't wipe the others", () => {
    expect(ok({ store_address: "New address" })).toEqual({ store_address: "New address" });
    expect(Object.keys(ok({ support_phone: "0803 123 4567" }))).toEqual(["support_phone"]);
  });

  it("enforces the column length limits", () => {
    expect(errors({ store_name: "x".repeat(101) }).store_name).toBeDefined();
    expect(errors({ store_address: "x".repeat(256) }).store_address).toBeDefined();
    expect(errors({ support_phone: "0".repeat(21) }).support_phone).toBeDefined();
    expect(errors({ whatsapp_number: "0".repeat(21) }).whatsapp_number).toBeDefined();
  });

  it("rejects phone numbers containing anything but digits, spaces, +, - and brackets", () => {
    expect(errors({ support_phone: "call me maybe" }).support_phone).toBeDefined();
    expect(errors({ whatsapp_number: "0803<script>" }).whatsapp_number).toBeDefined();
    expect(ok({ support_phone: "(0803) 123-4567" }).support_phone).toBe("(0803) 123-4567");
  });

  it("rejects an invalid support email", () => {
    expect(errors({ support_email: "not-an-email" }).support_email).toBeDefined();
    expect(ok({ support_email: "help@gts.ng" }).support_email).toBe("help@gts.ng");
  });

  it("does not allow the email to be cleared (the column is NOT NULL)", () => {
    expect(errors({ support_email: "" }).support_email).toBeDefined();
  });

  it("ignores fields it doesn't own, so nothing else in the settings row can be changed through it", () => {
    const v = ok({ store_name: "GTS", tax_rate: 0, currency: "USD", id: "x", free_shipping_threshold: 1 });
    expect(v).toEqual({ store_name: "GTS" });
  });

  it("rejects a body that isn't an object", () => {
    expect(errors("hello")._body).toBeDefined();
    expect(errors(null)._body).toBeDefined();
    expect(errors([1, 2])._body).toBeDefined();
  });

  it("rejects an update that changes nothing", () => {
    expect(errors({})._body).toBeDefined();
    expect(errors({ tax_rate: 3 })._body).toBeDefined();
  });

  it("rejects non-string values for text fields", () => {
    expect(errors({ store_name: 42 }).store_name).toBeDefined();
    expect(errors({ store_address: { a: 1 } }).store_address).toBeDefined();
  });

  it("reports every problem at once, not just the first", () => {
    const e = errors({ store_name: "", support_phone: "abc", support_email: "nope" });
    expect(Object.keys(e).sort()).toEqual(["store_name", "support_email", "support_phone"]);
  });

  describe("store_website", () => {
    it("accepts a domain or a full address, trimmed", () => {
      expect(ok({ store_website: " www.gtswears.com " }).store_website).toBe("www.gtswears.com");
      expect(ok({ store_website: "https://gtswears.com/shop" }).store_website).toBe("https://gtswears.com/shop");
    });
    it("clears when blank or null", () => {
      expect(ok({ store_website: "" }).store_website).toBeNull();
      expect(ok({ store_website: null }).store_website).toBeNull();
    });
    it("rejects text that isn't a web address", () => {
      for (const bad of ["not a site", "javascript:alert(1)", "www", "a".repeat(300) + ".com", 5]) {
        expect(validateStoreSettings({ store_website: bad }).ok, String(bad)).toBe(false);
      }
    });
  });
});
