import { test, expect } from "@playwright/test";
import { createAccount, deleteAccount, type TestAccount } from "./support/accounts";
import { signIn } from "./support/ui";

/** Flow 3: the super admin adds a cashier; the cashier must replace the one-time password, then reaches the till. */
test.describe("staff onboarding", () => {
  let boss: TestAccount;
  const newEmail = `e2e.onboard.${Date.now()}@gts.ng`;
  test.beforeAll(async () => {
    boss = await createAccount({ role: "admin", superAdmin: true, label: "boss" });
  });
  test.afterAll(async () => {
    await deleteAccount({ email: newEmail });
    await deleteAccount({ id: boss.id });
  });

  test("create account, forced password change, then the till", async ({ browser }) => {
    const admin = await browser.newPage();
    await signIn(admin, boss.email, boss.password);
    await admin.goto("/admin/staff");
    await admin.getByRole("button", { name: /add staff member/i }).click();
    await admin.getByLabel("Full name").fill("E2E New Cashier");
    await admin.getByLabel("Email").fill(newEmail);
    await admin.getByRole("button", { name: /create account/i }).click();
    const oneTime = (await admin.locator("code").first().textContent())!.trim();
    await expect(admin.getByText(/won.t be shown again/i)).toBeVisible();

    // the new cashier signs in with the one-time password and is sent to set a new one
    const cashier = await browser.newPage();
    await signIn(cashier, newEmail, oneTime);
    await expect(cashier).toHaveURL(/\/profile/);
    await expect(cashier.getByText(/set a new password/i)).toBeVisible();

    const fresh = `N3w-${Date.now()}-pw!`;
    await cashier.getByLabel("Current password").fill(oneTime);
    await cashier.getByLabel("New password", { exact: true }).fill(fresh);
    await cashier.getByLabel("Confirm new password").fill(fresh);
    await cashier.getByRole("button", { name: /change password|update password|save/i }).click();

    // ...and can now reach the point of sale
    await cashier.goto("/pos");
    await expect(cashier.getByPlaceholder(/search by product name or sku/i)).toBeVisible();
  });
});
