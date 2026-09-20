import { expect, type Page } from "@playwright/test";

/** Signs in through the real login form. */
export async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Staff Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: /login to terminal/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30_000 });
}

export async function signOut(page: Page) {
  await page.getByRole("button", { name: /admin|cashier|staff|account/i }).first().click().catch(() => {});
  await page.getByRole("button", { name: /^sign out$/i }).click();
  await expect(page).toHaveURL(/\/login/);
}

/** The bearer token the app keeps after sign-in, for calling the API from a test. */
export async function tokenOf(page: Page): Promise<string> {
  const token = await page.evaluate(() => localStorage.getItem("gts_token"));
  if (!token) throw new Error("not signed in");
  return token;
}

/** A single-variant product with plenty of stock, found through the POS API. */
export async function pickStockedSku(page: Page): Promise<{ sku: string; name: string; unitPrice: number }> {
  const token = await tokenOf(page);
  const api = process.env.E2E_API_URL ?? "http://localhost:3002/api/v1";
  const res = await page.request.get(`${api}/pos/products/search?limit=60`, { headers: { Authorization: `Bearer ${token}` } });
  const { data } = (await res.json()) as { data: Array<{ name: string; base_price: number; variants: Array<{ sku: string | null; available: number; price_modifier: number }> }> };
  for (const p of data) {
    const v = p.variants.length === 1 ? p.variants[0]! : undefined;
    if (v?.sku && v.available >= 3) return { sku: v.sku, name: p.name, unitPrice: p.base_price + v.price_modifier };
  }
  throw new Error("no single-variant product with stock found for the test");
}
