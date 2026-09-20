import { test, expect } from "@playwright/test";
import { createAccount, deleteAccount, type TestAccount } from "./support/accounts";
import { pickStockedSku, signIn } from "./support/ui";

/** Flow 1: a cashier rings up a walk-in sale, sees the receipt, and voids it. */
test.describe("walk-in sale", () => {
  let cashier: TestAccount;
  test.beforeAll(async () => {
    cashier = await createAccount({ role: "cashier", grants: { can_void_orders: true }, label: "sale" });
  });
  test.afterAll(async () => {
    await deleteAccount({ id: cashier.id });
  });

  test("scan, pay in cash, get a receipt, then void", async ({ page }) => {
    await signIn(page, cashier.email, cashier.password);
    await page.goto("/pos");

    // scan a SKU (Enter in the search box)
    const { sku, name } = await pickStockedSku(page);
    const search = page.getByPlaceholder(/search by product name or sku/i);
    await search.fill(sku);
    await search.press("Enter");
    await expect(page.getByText(`Added ${name}`)).toBeVisible();

    // pay
    await page.getByRole("button", { name: "Cash", exact: true }).click();
    await page.getByRole("button", { name: /confirm payment/i }).click();
    await page.getByRole("button", { name: /confirm sale/i }).click();

    // receipt
    await expect(page.getByText(/Order #GTS-\d{6}-\d{6}/)).toBeVisible();
    const orderNumber = (await page.getByText(/Order #GTS-\d{6}-\d{6}/).first().textContent())!.match(/GTS-\d{6}-\d{6}/)![0];
    await page.getByRole("button", { name: /new transaction/i }).click();

    // void it from today's orders
    await page.getByRole("button", { name: /today.s orders/i }).click();
    await page.getByText(orderNumber).click();
    await page.getByRole("button", { name: /void order/i }).click();
    await page.getByPlaceholder(/reason for void/i).fill("e2e test");
    await page.getByRole("button", { name: /confirm void/i }).click();
    await expect(page.getByText("Voided")).toBeVisible();
  });

  test("an underpaid cash sale can't be completed", async ({ page }) => {
    await signIn(page, cashier.email, cashier.password);
    await page.goto("/pos");
    const { sku } = await pickStockedSku(page);
    const search = page.getByPlaceholder(/search by product name or sku/i);
    await search.fill(sku);
    await search.press("Enter");
    await page.getByRole("button", { name: "Cash", exact: true }).click();
    await page.getByPlaceholder(/cash received/i).fill("1");
    await expect(page.getByText(/short by/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /confirm payment/i })).toBeDisabled();
  });
});
