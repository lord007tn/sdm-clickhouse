import type { QueryResult } from "@/types";

export type QueryTab = {
  id: string;
  title: string;
  sql: string;
  page: number;
  pageSize: number;
  timeoutMs: number;
  running: boolean;
  runningQueryId?: string;
  result?: QueryResult;
  error?: string;
};

export const TAB_STORAGE_KEY = "simple-sdm.tabs.v1";

export function createTab(index = 1): QueryTab {
  return {
    id: crypto.randomUUID(),
    title: `Query ${index}`,
    sql: "SELECT now() AS ts, version() AS clickhouse_version",
    page: 1,
    pageSize: 100,
    timeoutMs: 30000,
    running: false,
  };
}
