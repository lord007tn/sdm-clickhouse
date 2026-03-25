import { invoke } from "@tauri-apps/api/core";
import type {
  AppLogItem,
  AuditItem,
  ClickHouseOverview,
  CommandMessage,
  ConnectionDiagnostics,
  ConnectionInput,
  ConnectionProfile,
  CountPreview,
  DdlRequest,
  HistoryItem,
  MutationRequest,
  QueryRequest,
  QueryResult,
  SnippetInput,
  SnippetItem,
  UpdateCheckResult,
  UpdateDownloadResult,
} from "@/types";

function isTauriRuntime() {
  if (typeof window === "undefined") return false;
  return Boolean(
    (window as typeof window & { __TAURI_INTERNALS__?: { invoke?: unknown } })
      .__TAURI_INTERNALS__?.invoke,
  );
}

type TauriInvokeOptions = {
  timeoutMs?: number;
  timeoutMessage?: string;
};

function resolveTimeoutMs(timeoutMs: number) {
  if (typeof window === "undefined") return timeoutMs;
  const override = (
    window as typeof window & {
      __SDM_TEST_TAURI_TIMEOUT_MS__?: number;
    }
  ).__SDM_TEST_TAURI_TIMEOUT_MS__;
  if (
    typeof override === "number" &&
    Number.isFinite(override) &&
    override > 0
  ) {
    return override;
  }
  return timeoutMs;
}

async function tauriInvoke<T>(
  command: string,
  args?: Record<string, unknown>,
  options?: TauriInvokeOptions,
): Promise<T> {
  if (!isTauriRuntime()) {
    throw new Error(
      "Tauri runtime is unavailable in browser preview. Run this app with `pnpm tauri dev`.",
    );
  }

  const request = invoke<T>(command, args);
  const timeoutMs = options?.timeoutMs
    ? resolveTimeoutMs(options.timeoutMs)
    : 0;
  if (timeoutMs <= 0) {
    return request;
  }

  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(
        new Error(
          options?.timeoutMessage ??
            `${command} is taking too long. The UI recovered, but the app may still be busy.`,
        ),
      );
    }, timeoutMs);

    request.then(
      (result) => {
        window.clearTimeout(timer);
        resolve(result);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export const api = {
  connectionList: () => tauriInvoke<ConnectionProfile[]>("connection_list"),

  connectionSave: (payload: ConnectionInput) =>
    tauriInvoke<ConnectionProfile>(
      "connection_save",
      { payload },
      {
        timeoutMs: 8_000,
        timeoutMessage:
          "Saving the connection took too long. The UI recovered, but the backend may still be busy.",
      },
    ),

  connectionDelete: (connectionId: string) =>
    tauriInvoke<CommandMessage>("connection_delete", { connectionId }),

  connectionTest: (payload: ConnectionInput) =>
    tauriInvoke<CommandMessage>(
      "connection_test",
      { payload },
      {
        timeoutMs: 12_000,
        timeoutMessage:
          "Testing the connection took too long. The UI recovered, but the backend may still be busy.",
      },
    ),

  schemaListDatabases: (connectionId: string) =>
    tauriInvoke<Record<string, string>[]>("schema_list_databases", {
      connectionId,
    }),

  schemaListTables: (connectionId: string, database: string) =>
    tauriInvoke<Record<string, string>[]>("schema_list_tables", {
      connectionId,
      database,
    }),

  schemaGetColumns: (connectionId: string, database: string, table: string) =>
    tauriInvoke<Record<string, string>[]>("schema_get_columns", {
      connectionId,
      database,
      table,
    }),

  schemaGetTableDdl: (connectionId: string, database: string, table: string) =>
    tauriInvoke<CommandMessage>("schema_get_table_ddl", {
      connectionId,
      database,
      table,
    }),

  clickhouseOverview: (connectionId: string) =>
    tauriInvoke<ClickHouseOverview>("clickhouse_overview", {
      connectionId,
    }),

  queryExecute: (request: QueryRequest) =>
    tauriInvoke<QueryResult>("query_execute", { request }),

  queryCancel: (connectionId: string, queryId: string) =>
    tauriInvoke<CommandMessage>("query_cancel", { connectionId, queryId }),

  historyList: (connectionId: string, limit = 100) =>
    tauriInvoke<HistoryItem[]>("history_list", { connectionId, limit }),

  snippetList: (connectionId?: string) =>
    tauriInvoke<SnippetItem[]>("snippet_list", { connectionId }),

  snippetSave: (payload: SnippetInput) =>
    tauriInvoke<SnippetItem>("snippet_save", { payload }),

  snippetDelete: (snippetId: string) =>
    tauriInvoke<CommandMessage>("snippet_delete", { snippetId }),

  insertRow: (payload: MutationRequest) =>
    tauriInvoke<CommandMessage>("insert_row", { payload }),

  updateRowsPreview: (payload: MutationRequest) =>
    tauriInvoke<CountPreview>("update_rows_preview", { payload }),

  updateRowsExecute: (payload: MutationRequest) =>
    tauriInvoke<CommandMessage>("update_rows_execute", { payload }),

  deleteRowsPreview: (payload: MutationRequest) =>
    tauriInvoke<CountPreview>("delete_rows_preview", { payload }),

  deleteRowsExecute: (payload: MutationRequest) =>
    tauriInvoke<CommandMessage>("delete_rows_execute", { payload }),

  createDatabase: (payload: DdlRequest) =>
    tauriInvoke<CommandMessage>("create_database", { payload }),

  dropDatabase: (payload: DdlRequest) =>
    tauriInvoke<CommandMessage>("drop_database", { payload }),

  createTable: (payload: DdlRequest) =>
    tauriInvoke<CommandMessage>("create_table", { payload }),

  dropTable: (payload: DdlRequest) =>
    tauriInvoke<CommandMessage>("drop_table", { payload }),

  connectionDiagnostics: (payload: ConnectionInput) =>
    tauriInvoke<ConnectionDiagnostics>(
      "connection_diagnostics",
      { payload },
      {
        timeoutMs: 12_000,
        timeoutMessage:
          "Diagnostics took too long. The UI recovered, but the backend may still be busy.",
      },
    ),

  connectionExportProfiles: (targetPath: string) =>
    tauriInvoke<CommandMessage>("connection_export_profiles", { targetPath }),

  connectionImportProfiles: (sourcePath: string, overwriteExisting = false) =>
    tauriInvoke<CommandMessage>("connection_import_profiles", {
      sourcePath,
      overwriteExisting,
    }),

  auditList: (limit = 200) => tauriInvoke<AuditItem[]>("audit_list", { limit }),

  logsList: (limit = 300) => tauriInvoke<AppLogItem[]>("logs_list", { limit }),

  appBackupMetadata: (targetPath: string) =>
    tauriInvoke<CommandMessage>("app_backup_metadata", { targetPath }),

  appRestoreMetadata: (sourcePath: string) =>
    tauriInvoke<CommandMessage>("app_restore_metadata", { sourcePath }),

  appStartupStatus: () => tauriInvoke<string | null>("app_startup_status"),

  triggerUpdateCheck: () => tauriInvoke<void>("trigger_update_check"),

  appRequestRestart: () => tauriInvoke<CommandMessage>("app_request_restart"),

  appCheckUpdate: () =>
    tauriInvoke<UpdateCheckResult>(
      "app_check_update",
      {},
      {
        timeoutMs: 12_000,
        timeoutMessage:
          "Checking for updates took too long. The UI recovered, but the updater may still be busy.",
      },
    ),

  appDownloadUpdate: () =>
    tauriInvoke<UpdateDownloadResult>(
      "app_download_update",
      {},
      {
        timeoutMs: 300_000,
        timeoutMessage:
          "Downloading the update took too long. The UI recovered, but the updater may still be working in the background.",
      },
    ),

  appInstallUpdate: () =>
    tauriInvoke<CommandMessage>(
      "app_install_update",
      {},
      {
        timeoutMs: 120_000,
        timeoutMessage:
          "Launching the update installer took too long. The UI recovered, but the updater may still be working in the background.",
      },
    ),
};
