import { expect, test } from "@playwright/test";

test("renders browser preview shell", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("Browser preview mode.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add Connection" }).first(),
  ).toBeVisible();
  await expect(page.getByText("Simple SDM")).toBeVisible();
});
