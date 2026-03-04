import { expect, test } from "@playwright/test";

test("connection dialog remains interactive and closable", async ({ page }) => {
  await page.goto("/");

  const addConnection = page
    .getByRole("main")
    .getByRole("button", { name: "Add Connection" });
  await expect(addConnection).toBeVisible();
  await addConnection.click();

  const dialog = page.getByRole("dialog", { name: "New Connection" });
  await expect(dialog).toBeVisible();

  const hostInput = dialog.getByRole("textbox", { name: "Host" });
  await expect(hostInput).toBeVisible();
  await hostInput.fill("example.internal");
  await expect(hostInput).toHaveValue("example.internal");

  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole("button", { name: "Check for updates" }).click();
  await expect(
    page.getByText("Updater is only available in Tauri runtime."),
  ).toBeVisible();
});
