import { expect, test } from "@playwright/test";

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

test("renders query workspace with mocked tauri bridge and codemirror editor", async ({
  page,
}) => {
  await page.addInitScript(() => {
    (
      window as Window & { __QUERY_EXECUTE_CALLS__?: number }
    ).__QUERY_EXECUTE_CALLS__ = 0;
    (
      window as Window & { __SNIPPET_SAVE_CALLS__?: number }
    ).__SNIPPET_SAVE_CALLS__ = 0;
    (window as Window & { __PROMPT_CALLED__?: boolean }).__PROMPT_CALLED__ =
      false;
    window.prompt = () => {
      (
        window as Window & {
          __PROMPT_CALLED__?: boolean;
        }
      ).__PROMPT_CALLED__ = true;
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
            totalRows: 42800,
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
            window as Window & {
              __QUERY_EXECUTE_CALLS__?: number;
            }
          ).__QUERY_EXECUTE_CALLS__ =
            (
              window as Window & {
                __QUERY_EXECUTE_CALLS__?: number;
              }
            ).__QUERY_EXECUTE_CALLS__ ?? 0;
          (
            window as Window & {
              __QUERY_EXECUTE_CALLS__?: number;
            }
          ).__QUERY_EXECUTE_CALLS__ += 1;
          return {
            queryId: "query-1",
            columns: ["value"],
            rows: [{ value: 1 }],
            rowCount: 1,
            page: 1,
            pageSize: 100,
            durationMs: 2,
          };
        case "snippet_save":
          (
            window as Window & {
              __SNIPPET_SAVE_CALLS__?: number;
            }
          ).__SNIPPET_SAVE_CALLS__ =
            (
              window as Window & {
                __SNIPPET_SAVE_CALLS__?: number;
              }
            ).__SNIPPET_SAVE_CALLS__ ?? 0;
          (
            window as Window & {
              __SNIPPET_SAVE_CALLS__?: number;
            }
          ).__SNIPPET_SAVE_CALLS__ += 1;
          return {
            id: "snippet-1",
            name: "Test snippet",
            sql: "SELECT 1",
            tags: ["manual"],
            updatedAt: new Date().toISOString(),
          };
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

  const sqlEditor = page.getByTestId("sql-editor");
  await expect(page.getByText("Cluster Pulse")).toBeVisible();
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
          (
            window as Window & {
              __QUERY_EXECUTE_CALLS__?: number;
            }
          ).__QUERY_EXECUTE_CALLS__ ?? 0,
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
          (
            window as Window & {
              __SNIPPET_SAVE_CALLS__?: number;
            }
          ).__SNIPPET_SAVE_CALLS__ ?? 0,
      );
    })
    .toBe(1);
  expect(
    await page.evaluate(
      () =>
        (
          window as Window & {
            __PROMPT_CALLED__?: boolean;
          }
        ).__PROMPT_CALLED__ ?? false,
    ),
  ).toBe(false);
});
