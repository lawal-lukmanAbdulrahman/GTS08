import { test, expect } from "@playwright/test";
import { createAccount, deleteAccount, type TestAccount } from "./support/accounts";
import { signIn } from "./support/ui";

/** Flow 4: an admin removes a cashier's POS access and the till closes on their very next request. */
test.describe("revoking access", () => {
  let boss: TestAccount;
  let cashier: TestAccount;
  test.beforeAll(async () => {
    boss = await createAccount({ role: "admin", superAdmin: true, label: "boss2" });
    cashier = await createAccount({ role: "cashier", label: "revoked" });
  });
  test.afterAll(async () => {
    await deleteAccount({ id: cashier.id });
    await deleteAccount({ id: boss.id });
  });

  test("POS access removed by an admin closes the terminal", async ({ browser }) => {
    const c = await browser.newPage();
    await signIn(c, cashier.email, cashier.password);
    await c.goto("/pos");
    await expect(c.getByPlaceholder(/search by product name or sku/i)).toBeVisible();

    const a = await browser.newPage();
    await signIn(a, boss.email, boss.password);
    await a.goto(`/admin/staff/${cashier.id}`);
    await a.getByRole("checkbox", { name: /use the point of sale/i }).uncheck();
    await a.getByRole("button", { name: /save permissions/i }).click();
    await expect(a.getByText(/permissions saved/i)).toBeVisible();

    await c.reload();
    await expect(c.getByRole("heading", { name: /don.t have access to the point of sale/i })).toBeVisible();
  });
});
