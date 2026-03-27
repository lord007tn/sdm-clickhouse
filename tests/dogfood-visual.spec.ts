import { test, type Page } from "@playwright/test";

async function installMock(page: Page) {
  await page.addInitScript(() => {
    const fakeConn = { id:"c1", name:"Local ClickHouse", host:"localhost", port:8123, database:"default", username:"default", secure:false, tlsInsecureSkipVerify:false, caCertPath:"", sshTunnel:{enabled:false,host:"",port:22,username:"",localPort:8123}, timeoutMs:30000 };
    const invoke = async (cmd: string) => {
      switch(cmd) {
        case "connection_list": return [fakeConn];
        case "connection_diagnostics": return {ok:true,category:"network",detail:"ok",latencyMs:1};
        case "schema_list_databases": return [{name:"default"},{name:"analytics"}];
        case "clickhouse_overview": return {generatedAt:new Date().toISOString(),serverVersion:"25.3.1.5",databaseCount:3,tableCount:14,activePartCount:52,activeQueryCount:2,pendingMutationCount:1,totalRows:1428000,totalBytes:2684354560,storageByDatabase:[{name:"default",value:1610612736,secondaryValue:820000},{name:"analytics",value:671088640,secondaryValue:450000},{name:"logs",value:402653184,secondaryValue:158000}],tablesByEngine:[{name:"MergeTree",value:8},{name:"ReplacingMergeTree",value:3},{name:"SummingMergeTree",value:2},{name:"Log",value:1}],hottestTablesByParts:[{name:"default.events",value:24,secondaryValue:580000},{name:"analytics.sessions",value:16,secondaryValue:320000},{name:"logs.app_logs",value:8,secondaryValue:158000},{name:"default.users",value:4,secondaryValue:42000}],activeQueriesByUser:[{name:"default",value:1},{name:"etl_worker",value:1}]};
        case "history_list": return [{sql:"SELECT * FROM default.events LIMIT 100"},{sql:"SELECT count() FROM analytics.sessions"},{sql:"SELECT service, avg(latency_ms) FROM default.events GROUP BY service"}];
        case "snippet_list": return [{id:"s1",name:"Recent events",sql:"SELECT * FROM events LIMIT 50"},{id:"s2",name:"Active sessions",sql:"SELECT * FROM analytics.sessions WHERE active = 1"}];
        case "audit_list": return [{id:"a1",action:"CREATE TABLE",target:"default.events",createdAt:"2025-03-26 14:32:01",payloadJson:"{}"},{id:"a2",action:"INSERT",target:"default.users",createdAt:"2025-03-26 14:30:15",payloadJson:"{}"}];
        case "logs_list": return [{id:"l1",level:"INFO",category:"query",message:"Query executed in 2ms",contextJson:"{}"},{id:"l2",level:"WARN",category:"connection",message:"Reconnection attempt",contextJson:"{}"}];
        case "query_execute": return {queryId:"q1",columns:["service","latency_ms","status"],rows:[{service:"alpha",latency_ms:32,status:"ok"},{service:"beta",latency_ms:4,status:"retrying"},{service:"gamma",latency_ms:18,status:"ok"}],rowCount:3,page:1,pageSize:100,durationMs:2};
        case "app_startup_status": return null;
        case "trigger_update_check": return null;
        case "app_check_update": return null;
        default: return null;
      }
    };
    Object.defineProperty(window, "__TAURI_INTERNALS__", { value: { invoke }, writable: false, configurable: false });
  });
}

const SS = "dogfood-output/screenshots";

test("dogfood visual screenshots", async ({ page }) => {
  await installMock(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.waitForSelector("[data-testid='sql-editor']", { timeout: 10000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SS}/01-workbench.png` });

  await page.getByTestId("toggle-insights-button").click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${SS}/02-insights-overview.png` });

  await page.mouse.wheel(0, 600);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${SS}/03-insights-scrolled.png` });

  await page.getByRole("tab", { name: "History" }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SS}/04-history.png` });

  await page.getByRole("tab", { name: "Query 1" }).click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Run" }).click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SS}/05-query-results.png` });

  await page.setViewportSize({ width: 900, height: 700 });
  await page.getByTestId("toggle-insights-button").click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${SS}/06-insights-900w.png` });
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${SS}/07-insights-900w-scrolled.png` });

  const errors: string[] = [];
  page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
  await page.reload();
  await page.waitForTimeout(2000);
  if (errors.length > 0) console.log("Console errors:", errors);
  else console.log("No console errors");
});
