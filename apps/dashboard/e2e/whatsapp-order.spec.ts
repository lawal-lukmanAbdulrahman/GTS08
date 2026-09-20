import { test, expect } from "@playwright/test";
import { createAccount, deleteAccount, type TestAccount } from "./support/accounts";
import { pickStockedSku, signIn } from "./support/ui";

/** Flow 2: staff records a WhatsApp order; a different cashier finds it in the pending list and takes payment. */
test.describe("WhatsApp order", () => {
  let recorder: TestAccount;
  let taker: TestAccount;
  test.beforeAll(async () => {
    recorder = await createAccount({ role: "cashier", label: "wa-record" });
    taker = await createAccount({ role: "cashier", label: "wa-take" });
  });
  test.afterAll(async () => {
    await deleteAccount({ id: recorder.id });
    await deleteAccount({ id: taker.id });
  });

  test("record, then confirm from the pending list", async ({ browser }) => {
    // 1. one person records the order from the chat
    const a = await browser.newPage();
    await signIn(a, recorder.email, recorder.password);
    await a.goto("/pos");
    const { sku } = await pickStockedSku(a);
    await a.getByRole("button", { name: "WhatsApp", exact: true }).click();
    const search = a.getByPlaceholder(/search by product name or sku/i);
    await search.fill(sku);
    await search.press("Enter");
    await a.getByPlaceholder("Customer name").fill("E2E Customer");
    await a.getByPlaceholder("Customer WhatsApp number").fill("08031234567");
    await expect(a.getByText(/order total/i)).toBeVisible();
    await a.getByRole("button", { name: /create order/i }).click();
    const created = await a.getByText(/Order created:/).textContent();
    const orderNumber = created!.match(/GTS-\d{6}-\d{6}/)![0];

    // 2. another cashier finds it in the waiting list and takes payment
    const b = await browser.newPage();
    await signIn(b, taker.email, taker.password);
    await b.goto("/pos");
    await b.getByRole("button", { name: "WhatsApp", exact: true }).click();
    await b.getByRole("button", { name: /confirm by order number/i }).click();
    await b.getByText(orderNumber).click();
    await b.getByRole("button", { name: "Cash", exact: true }).click();
    await b.getByRole("button", { name: /confirm payment/i }).click();
    await expect(b.getByText(`Order #${orderNumber}`)).toBeVisible();
  });
});
