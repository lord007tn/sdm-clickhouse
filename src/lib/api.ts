import { invoke } from "@tauri-apps/api/core";
import type {
  AppLogItem,
  AuditItem,
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
} from "@/types";

function isTauriRuntime() {
  if (typeof window === "undefined") return false;
  return Boolean(
    (window as typeof window & { __TAURI_INTERNALS__?: { invoke?: unknown } })
      .__TAURI_INTERNALS__?.invoke,
  );
}

async function tauriInvoke<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  if (!isTauriRuntime()) {
    throw new Error(
      "Tauri runtime is unavailable in browser preview. Run this app with `pnpm tauri dev`.",
    );
  }
  return invoke<T>(command, args);
}

export const api = {
  connectionList: () => tauriInvoke<ConnectionProfile[]>("connection_list"),

  connectionSave: (payload: ConnectionInput) =>
    tauriInvoke<ConnectionProfile>("connection_save", { payload }),

  connectionDelete: (connectionId: string) =>
    tauriInvoke<CommandMessage>("connection_delete", { connectionId }),

  connectionTest: (payload: ConnectionInput) =>
    tauriInvoke<CommandMessage>("connection_test", { payload }),

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
    tauriInvoke<ConnectionDiagnostics>("connection_diagnostics", { payload }),

  connectionExportProfiles: (targetPath: string) =>
    tauriInvoke<CommandMessage>("connection_export_profiles", { targetPath }),

  connectionImportProfiles: (sourcePath: string, overwriteExisting = false) =>
    tauriInvoke<CommandMessage>("connection_import_profiles", {
      sourcePath,
      overwriteExisting,
    }),

  auditList: (limit = 200) =>
    tauriInvoke<AuditItem[]>("audit_list", { limit }),

  logsList: (limit = 300) =>
    tauriInvoke<AppLogItem[]>("logs_list", { limit }),

  appBackupMetadata: (targetPath: string) =>
    tauriInvoke<CommandMessage>("app_backup_metadata", { targetPath }),

  appRestoreMetadata: (sourcePath: string) =>
    tauriInvoke<CommandMessage>("app_restore_metadata", { sourcePath }),

  appStartupStatus: () =>
    tauriInvoke<string | null>("app_startup_status"),
};
