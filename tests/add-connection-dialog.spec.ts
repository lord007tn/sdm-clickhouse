import { expect, test } from "@playwright/test";

test("opens add connection dialog from empty-state action", async ({
  page,
}) => {
  await page.goto("/");

  const emptyStateAddButton = page
    .getByRole("button", {
      name: "Add Connection",
    })
    .first();
  await expect(emptyStateAddButton).toBeVisible();
  await expect(emptyStateAddButton).toBeEnabled();
  await emptyStateAddButton.click({ timeout: 4000 });
  await expect(page.getByRole("dialog")).toBeVisible();
});
