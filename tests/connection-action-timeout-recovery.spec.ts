import { expect, test } from "@playwright/test";

test("connection dialog recovers when test/save commands never resolve", async ({
  page,
}) => {
  await page.addInitScript(() => {
    (
      window as Window & {
        __SDM_TEST_TAURI_TIMEOUT_MS__?: number;
      }
    ).__SDM_TEST_TAURI_TIMEOUT_MS__ = 50;

    const never = () => new Promise(() => undefined);

    const invoke = async (cmd: string) => {
      switch (cmd) {
        case "connection_list":
          return [];
        case "connection_test":
        case "connection_save":
          return never();
        case "history_list":
        case "snippet_list":
        case "audit_list":
        case "logs_list":
          return [];
        case "app_startup_status":
          return null;
        default:
          return null;
      }
    };

    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      value: { invoke },
      configurable: true,
    });
  });

  await page.goto("/");

  const addConnection = page
    .locator("main")
    .getByRole("button", { name: "Add Connection" });
  await addConnection.click();

  const dialog = page.getByRole("dialog", { name: "New Connection" });
  await expect(dialog).toBeVisible();

  await dialog.getByLabel("Name", { exact: true }).fill("Timeout Local");
  await dialog.getByLabel("Password", { exact: true }).fill("secret123");

  await dialog.getByRole("button", { name: "Test Connection" }).click();
  await expect(
    page.getByText("Testing the connection took too long."),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Test Connection" }),
  ).toBeEnabled();

  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(
    page.getByText("Saving the connection took too long."),
  ).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Save" })).toBeEnabled();

  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();

  await addConnection.click();
  await expect(
    page.getByRole("dialog", { name: "New Connection" }),
  ).toBeVisible();
});
