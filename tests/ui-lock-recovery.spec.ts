import { expect, test } from "@playwright/test";

test("recovers from stale global UI lock", async ({ page }) => {
  await page.goto("/");

  await page.evaluate(() => {
    document.body.style.pointerEvents = "none";
    document.body.setAttribute("inert", "");
    document.documentElement.style.pointerEvents = "none";
    document.documentElement.setAttribute("inert", "");
  });

  await expect
    .poll(async () => {
      return await page.evaluate(() => {
        return (
          document.body.style.pointerEvents === "" &&
          !document.body.hasAttribute("inert") &&
          document.documentElement.style.pointerEvents === "" &&
          !document.documentElement.hasAttribute("inert")
        );
      });
    })
    .toBe(true);

  const addConnection = page
    .locator("main")
    .getByRole("button", { name: "Add Connection" });
  await addConnection.click();
  await expect(
    page.getByRole("dialog", { name: "New Connection" }),
  ).toBeVisible();
});
