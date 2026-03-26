import { expect, test, type Page } from "@playwright/test";

async function installMockTauriPreview(page: Page) {
  await page.addInitScript(() => {
    (
      window as Window & { __QUERY_EXECUTE_CALLS__?: number }
    ).__QUERY_EXECUTE_CALLS__ = 0;
    (
      window as Window & { __SNIPPET_SAVE_CALLS__?: number }
    ).__SNIPPET_SAVE_CALLS__ = 0;
    (
      window as Window & { __APP_DOWNLOAD_UPDATE_CALLS__?: number }
    ).__APP_DOWNLOAD_UPDATE_CALLS__ = 0;
    (
      window as Window & { __APP_INSTALL_UPDATE_CALLS__?: number }
    ).__APP_INSTALL_UPDATE_CALLS__ = 0;
    (
      window as Window & { __APP_DOWNLOAD_UPDATE_DELAY_MS__?: number }
    ).__APP_DOWNLOAD_UPDATE_DELAY_MS__ = 300;
    (
      window as Window & { __APP_CHECK_UPDATE_CALLS__?: number }
    ).__APP_CHECK_UPDATE_CALLS__ = 0;
    (window as Window & { __PROMPT_CALLED__?: boolean }).__PROMPT_CALLED__ =
      false;
    window.prompt = () => {
      (window as Window & { __PROMPT_CALLED__?: boolean }).__PROMPT_CALLED__ =
        true;
      return "legacy-prompt";
    };

    const fakeConnection = {
      id: "conn-1",
      name: "Local ClickHouse",
      host: "localhost",
      port: 8123,
      database: "default",
      username: "default",
      secure: false,
      tlsInsecureSkipVerify: false,
      caCertPath: "",
      sshTunnel: {
        enabled: false,
        host: "",
        port: 22,
        username: "",
        localPort: 8123,
      },
      timeoutMs: 30_000,
    };

    const invoke = async (cmd: string) => {
      switch (cmd) {
        case "connection_list":
          return [fakeConnection];
        case "connection_diagnostics":
          return { ok: true, category: "network", detail: "ok", latencyMs: 1 };
        case "schema_list_databases":
          return [{ name: "default" }];
        case "clickhouse_overview":
          return {
            generatedAt: new Date().toISOString(),
            serverVersion: "25.3.1.5",
            databaseCount: 1,
            tableCount: 4,
            activePartCount: 18,
            activeQueryCount: 2,
            pendingMutationCount: 1,
            totalRows: 42_800,
            totalBytes: 268435456,
            storageByDatabase: [
              { name: "default", value: 201326592, secondaryValue: 32500 },
              { name: "analytics", value: 67108864, secondaryValue: 10300 },
            ],
            tablesByEngine: [
              { name: "MergeTree", value: 3 },
              { name: "ReplacingMergeTree", value: 1 },
            ],
            hottestTablesByParts: [
              { name: "default.events", value: 12, secondaryValue: 28000 },
              { name: "analytics.sessions", value: 6, secondaryValue: 14800 },
            ],
            activeQueriesByUser: [
              { name: "default", value: 1 },
              { name: "etl", value: 1 },
            ],
          };
        case "history_list":
        case "snippet_list":
        case "audit_list":
        case "logs_list":
          return [];
        case "query_execute":
          (
            window as Window & { __QUERY_EXECUTE_CALLS__?: number }
          ).__QUERY_EXECUTE_CALLS__ =
            ((window as Window & { __QUERY_EXECUTE_CALLS__?: number })
              .__QUERY_EXECUTE_CALLS__ ?? 0) + 1;
          return {
            queryId: "query-1",
            columns: ["service", "latency_ms", "status"],
            rows: [
              { service: "alpha", latency_ms: 32, status: "ok" },
              { service: "beta", latency_ms: 4, status: "retrying" },
              { service: "gamma", latency_ms: 18, status: "ok" },
            ],
            rowCount: 3,
            page: 1,
            pageSize: 100,
            durationMs: 2,
          };
        case "snippet_save":
          (
            window as Window & { __SNIPPET_SAVE_CALLS__?: number }
          ).__SNIPPET_SAVE_CALLS__ =
            ((window as Window & { __SNIPPET_SAVE_CALLS__?: number })
              .__SNIPPET_SAVE_CALLS__ ?? 0) + 1;
          return {
            id: "snippet-1",
            name: "Test snippet",
            sql: "SELECT 1",
            tags: ["manual"],
            updatedAt: new Date().toISOString(),
          };
        case "app_startup_status":
          return null;
        case "trigger_update_check":
          return null;
        case "app_check_update":
          (
            window as Window & { __APP_CHECK_UPDATE_CALLS__?: number }
          ).__APP_CHECK_UPDATE_CALLS__ =
            ((window as Window & { __APP_CHECK_UPDATE_CALLS__?: number })
              .__APP_CHECK_UPDATE_CALLS__ ?? 0) + 1;
          return {
            available: true,
            currentVersion: "0.1.0",
            latestVersion: "0.1.1",
            assetName: "SDM.ClickHouse_0.1.1_x64_en-US.msi",
            downloadUrl:
              "https://github.com/lord007tn/sdm-clickhouse/releases/download/v0.1.1/SDM.ClickHouse_0.1.1_x64_en-US.msi",
            sha256:
              "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
            target: "windows/x64",
          };
        case "app_install_update":
          (
            window as Window & { __APP_INSTALL_UPDATE_CALLS__?: number }
          ).__APP_INSTALL_UPDATE_CALLS__ =
            ((window as Window & { __APP_INSTALL_UPDATE_CALLS__?: number })
              .__APP_INSTALL_UPDATE_CALLS__ ?? 0) + 1;
          return {
            message:
              "Update installer launched (SHA256 verified): C:/Temp/sdm-clickhouse-update.msi",
          };
        case "app_download_update":
          (
            window as Window & { __APP_DOWNLOAD_UPDATE_CALLS__?: number }
          ).__APP_DOWNLOAD_UPDATE_CALLS__ =
            ((window as Window & { __APP_DOWNLOAD_UPDATE_CALLS__?: number })
              .__APP_DOWNLOAD_UPDATE_CALLS__ ?? 0) + 1;
          await new Promise((resolve) =>
            window.setTimeout(
              resolve,
              (window as Window & { __APP_DOWNLOAD_UPDATE_DELAY_MS__?: number })
                .__APP_DOWNLOAD_UPDATE_DELAY_MS__ ?? 300,
            ),
          );
          return {
            message:
              "Update downloaded and verified: C:/Temp/sdm-clickhouse-update.msi",
            version: "0.1.1",
            assetName: "SDM.ClickHouse_0.1.1_x64_en-US.msi",
          };
        default:
          return null;
      }
    };

    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      value: { invoke },
      configurable: true,
    });
  });
}

test("renders browser preview shell", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("Browser preview mode.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add Connection" }).first(),
  ).toBeVisible();
  await expect(page.getByText("SDM ClickHouse")).toBeVisible();
});

test("browser preview guardrails stay interactive", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Check for updates" }).click();
  await expect(
    page.getByText("Updater is only available in Tauri runtime."),
  ).toBeVisible();

  const addConnectionButton = page
    .locator("main")
    .getByRole("button", { name: "Add Connection" });
  await expect(addConnectionButton).toBeVisible();
  await expect(addConnectionButton).toBeEnabled();

  await expect(
    page.getByRole("heading", { name: "No Connections" }),
  ).toBeVisible();
});

test("browser preview updater downloads then launches installer", async ({
  page,
}) => {
  await installMockTauriPreview(page);
  await page.goto("/");

  const checkButton = page.getByRole("button", { name: "Check for updates" });
  await expect(checkButton).toBeEnabled();
  await checkButton.click();

  await expect
    .poll(async () => {
      return await page.evaluate(
        () =>
          (window as Window & { __APP_CHECK_UPDATE_CALLS__?: number })
            .__APP_CHECK_UPDATE_CALLS__ ?? 0,
      );
    })
    .toBe(1);

  const downloadButton = page.getByTestId("download-update-button");
  await expect(downloadButton).toBeVisible();
  await expect(downloadButton).toHaveText(/Update v0.1.1/);
  await downloadButton.click();

  await expect(page.getByTestId("update-download-progress")).toBeVisible();

  await expect
    .poll(async () => {
      return await page.evaluate(
        () =>
          (window as Window & { __APP_DOWNLOAD_UPDATE_CALLS__?: number })
            .__APP_DOWNLOAD_UPDATE_CALLS__ ?? 0,
      );
    })
    .toBe(1);

  const installButton = page.getByTestId("install-update-button");
  await expect(installButton).toBeVisible();
  await expect(installButton).toHaveText(/Install v0.1.1/);
  await expect(page.getByTestId("update-download-progress")).toHaveCount(0);
  await installButton.click();

  await expect
    .poll(async () => {
      return await page.evaluate(
        () =>
          (window as Window & { __APP_INSTALL_UPDATE_CALLS__?: number })
            .__APP_INSTALL_UPDATE_CALLS__ ?? 0,
      );
    })
    .toBe(1);

  await expect(
    page.getByText("Installer launched", { exact: true }),
  ).toBeVisible();
});

test("renders query workspace with mocked tauri bridge and codemirror editor", async ({
  page,
}) => {
  await installMockTauriPreview(page);
  await page.goto("/");

  const sqlEditor = page.getByTestId("sql-editor");
  await expect(
    page.getByRole("button", { name: "Insights" }),
  ).toBeVisible();
  await expect(sqlEditor).toBeVisible();
  await expect(
    sqlEditor.locator('[contenteditable="true"][role="textbox"]'),
  ).toBeVisible();
  await expect(
    page.locator('textarea[placeholder="Write your SQL query here..."]'),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Run" }).click();
  await expect
    .poll(async () => {
      return await page.evaluate(
        () =>
          (window as Window & { __QUERY_EXECUTE_CALLS__?: number })
            .__QUERY_EXECUTE_CALLS__ ?? 0,
      );
    })
    .toBe(1);

  await page.getByTestId("save-snippet-button").click();
  const snippetDialog = page.getByTestId("snippet-save-dialog");
  await expect(snippetDialog).toBeVisible();
  const snippetNameInput = snippetDialog.getByLabel("Snippet name");
  await expect(snippetNameInput).toBeVisible();
  await snippetNameInput.fill("Recent failed jobs");
  await snippetDialog.getByRole("button", { name: "Save" }).click();
  await expect(snippetDialog).toBeHidden();
  await expect
    .poll(async () => {
      return await page.evaluate(
        () =>
          (window as Window & { __SNIPPET_SAVE_CALLS__?: number })
            .__SNIPPET_SAVE_CALLS__ ?? 0,
      );
    })
    .toBe(1);
  expect(
    await page.evaluate(
      () =>
        (window as Window & { __PROMPT_CALLED__?: boolean })
          .__PROMPT_CALLED__ ?? false,
    ),
  ).toBe(false);
});

test("insights tray opens on demand and keeps query execution accessible", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await installMockTauriPreview(page);
  await page.goto("/");

  const sqlEditor = page.getByTestId("sql-editor");
  await expect(sqlEditor).toBeVisible();

  // Open the insights dialog
  await page.getByRole("button", { name: "Insights" }).click();

  // The dialog should contain the ConnectionOverview content
  await expect(
    page.getByText("Signals without stealing the editor"),
  ).toBeVisible();

  // Close the dialog and verify the workspace is restored
  await page.getByRole("button", { name: "Close" }).click();
  await expect(
    page.getByText("Signals without stealing the editor"),
  ).toBeHidden();
  await expect(sqlEditor).toBeVisible();
  await expect(page.getByRole("button", { name: "Run" })).toBeVisible();
});

test("filters and sorts result rows in browser preview", async ({ page }) => {
  await installMockTauriPreview(page);
  await page.goto("/");

  await page.getByRole("button", { name: "Run" }).click();
  await expect(page.getByTestId("results-filter-input")).toBeVisible();
  await expect(page.getByTestId("results-count-badge")).toHaveText(
    /3 \/ 3 rows/,
  );

  const rows = page
    .locator("tbody tr")
    .filter({ has: page.locator('[data-slot="table-cell"]') });
  await expect(rows).toHaveCount(3);
  await expect(rows.first()).toContainText("alpha");

  await page.getByTestId("results-filter-input").fill("ga");
  await expect(page.getByTestId("results-count-badge")).toHaveText(
    /1 \/ 3 rows/,
  );
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("gamma");

  await page.getByTestId("results-filter-input").fill("");
  await expect(page.getByTestId("results-count-badge")).toHaveText(
    /3 \/ 3 rows/,
  );
  await expect(rows).toHaveCount(3);

  const latencySortButton = page.getByRole("button", {
    name: "Sort by latency_ms",
  });
  await latencySortButton.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("results-sort-summary")).toHaveText(
    "latency_ms asc",
  );
  await expect(rows.first()).toContainText("beta");

  await latencySortButton.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("results-sort-summary")).toHaveText(
    "latency_ms desc",
  );
  await expect(rows.first()).toContainText("alpha");
});
