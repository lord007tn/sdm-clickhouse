import { expect, test } from "@playwright/test";

test("dogfood flow keeps UI interactive on test/save", async ({ page }) => {
  await page.goto("/?dogfood=1");

  const addConnection = page
    .locator("main")
    .getByRole("button", { name: "Add Connection" });
  await expect(addConnection).toBeVisible();
  await addConnection.click();

  const dialog = page.getByRole("dialog", { name: "New Connection" });
  await expect(dialog).toBeVisible();

  await dialog.getByLabel("Name", { exact: true }).fill("Dogfood Local");
  await dialog.getByLabel("Password", { exact: true }).fill("secret123");

  await dialog.getByRole("button", { name: "Test Connection" }).click();
  await expect(page.getByText("Connection successful.")).toBeVisible();

  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();

  await expect(
    page.getByRole("button", { name: "Open connection Dogfood Local" }),
  ).toBeVisible();

  // If the app is still interactive, opening the dialog again should work.
  await page.getByRole("button", { name: "Add Connection" }).first().click();
  await expect(
    page.getByRole("dialog", { name: "New Connection" }),
  ).toBeVisible();
});
