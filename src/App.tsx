import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { check } from "@tauri-apps/plugin-updater";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Code2,
  Copy,
  Database,
  Download,
  Loader2,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Save,
  Search,
  Server,
  Sparkles,
  Table2,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { format as formatSql } from "sql-formatter";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type {
  AppLogItem,
  AuditItem,
  ConnectionDiagnostics,
  ConnectionInput,
  ConnectionProfile,
  QueryResult,
} from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

/* ────────────────────────────── Types ────────────────────────────── */

type QueryTab = {
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

type SchemaTable = { database: string; name: string; engine: string };
type SchemaColumn = { name: string; type: string };

type EditingCell = {
  rowIdx: number;
  col: string;
  value: string;
  saving: boolean;
};

type PendingEdit = {
  rowIdx: number;
  col: string;
  originalValue: unknown;
  newValue: unknown;
};

type GithubUpdateInfo = {
  version: string;
  assetName: string;
  downloadUrl: string;
  sha256: string;
  targetLabel: string;
};

/* ────────────────────────────── Helpers ──────────────────────────── */

function parseTableFromSql(
  sql: string,
  fallbackDatabase?: string,
): { database: string; table: string } | null {
  const withDb = sql.match(/\bFROM\s+`?(\w+)`?\s*\.\s*`?(\w+)`?/i);
  if (withDb) return { database: withDb[1], table: withDb[2] };
  if (fallbackDatabase) {
    const withoutDb = sql.match(/\bFROM\s+`?(\w+)`?(?:\s|$|;)/i);
    if (withoutDb) return { database: fallbackDatabase, table: withoutDb[1] };
  }
  return null;
}

function valueToSql(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "boolean") return value ? "1" : "0";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return `'${value.replace(/'/g, "''")}'`;
  return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
}

function buildWhereClause(
  row: Record<string, unknown>,
  columns: string[],
): string {
  return columns
    .map((col) => {
      const val = row[col];
      if (val === null || val === undefined) return `\`${col}\` IS NULL`;
      return `\`${col}\` = ${valueToSql(val)}`;
    })
    .join(" AND ");
}

function coerceEditedValue(newText: string, originalValue: unknown): unknown {
  const trimmed = newText.trim();
  if (trimmed === "" || trimmed.toLowerCase() === "null") return null;
  if (typeof originalValue === "number") {
    const num = Number(trimmed);
    if (!isNaN(num) && isFinite(num)) return num;
  }
  if (typeof originalValue === "boolean") {
    if (trimmed === "true" || trimmed === "1") return true;
    if (trimmed === "false" || trimmed === "0") return false;
  }
  return newText;
}

function Skeleton({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted/40", className)}
      style={style}
    />
  );
}

const APP_VERSION = "0.1.0";
const TAB_STORAGE_KEY = "simple-sdm.tabs.v1";

const baseConnection: ConnectionInput = {
  name: "",
  host: "",
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
  timeoutMs: 30000,
  password: "",
};

function createTab(index = 1): QueryTab {
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

/* ─────────────────────────────── App ─────────────────────────────── */

function App() {
  const isTauriRuntime =
    typeof window !== "undefined" &&
    Boolean(
      (
        window as typeof window & {
          __TAURI_INTERNALS__?: { invoke?: unknown };
        }
      ).__TAURI_INTERNALS__?.invoke,
    );

  /* ── Core state ── */
  const [connections, setConnections] = useState<ConnectionProfile[]>([]);
  const [connectionsLoading, setConnectionsLoading] = useState(true);
  const [activeConnectionId, setActiveConnectionId] = useState<string>();
  const [databases, setDatabases] = useState<string[]>([]);
  const [expandedDb, setExpandedDb] = useState<Record<string, boolean>>({});
  const [tablesByDb, setTablesByDb] = useState<Record<string, SchemaTable[]>>(
    {},
  );
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [schemaFilter, setSchemaFilter] = useState("");
  const [dbLoading, setDbLoading] = useState<Record<string, boolean>>({});
  const [selectedTable, setSelectedTable] = useState<SchemaTable | null>(null);
  const [selectedTableColumns, setSelectedTableColumns] = useState<
    SchemaColumn[]
  >([]);
  const [selectedTableDdl, setSelectedTableDdl] = useState("");
  const [selectedTableLoading, setSelectedTableLoading] = useState(false);
  const [tabs, setTabs] = useState<QueryTab[]>(() => {
    if (typeof window === "undefined") return [createTab()];
    try {
      const raw = window.localStorage.getItem(TAB_STORAGE_KEY);
      if (!raw) return [createTab()];
      const parsed = JSON.parse(raw) as {
        tabs?: Array<
          Pick<
            QueryTab,
            "id" | "title" | "sql" | "page" | "pageSize" | "timeoutMs"
          >
        >;
      };
      const restored =
        parsed.tabs
          ?.filter((tab) => tab.id && tab.title)
          .map((tab) => ({
            ...tab,
            timeoutMs: tab.timeoutMs ?? 30000,
            running: false,
            result: undefined,
            error: undefined,
          })) ?? [];
      return restored.length > 0 ? restored : [createTab()];
    } catch {
      return [createTab()];
    }
  });
  const [activeTabId, setActiveTabId] = useState<string | undefined>(() => {
    if (typeof window === "undefined") return undefined;
    try {
      const raw = window.localStorage.getItem(TAB_STORAGE_KEY);
      if (!raw) return undefined;
      const parsed = JSON.parse(raw) as { activeTabId?: string };
      return parsed.activeTabId;
    } catch {
      return undefined;
    }
  });
  const [historySql, setHistorySql] = useState<string[]>([]);
  const [snippets, setSnippets] = useState<
    { id: string; name: string; sql: string }[]
  >([]);
  const [auditItems, setAuditItems] = useState<AuditItem[]>([]);
  const [appLogs, setAppLogs] = useState<AppLogItem[]>([]);
  const [connectionDialogOpen, setConnectionDialogOpen] = useState(false);
  const [connectionDraft, setConnectionDraft] =
    useState<ConnectionInput>(baseConnection);
  const [savingConnection, setSavingConnection] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [diagnostics, setDiagnostics] = useState<ConnectionDiagnostics | null>(
    null,
  );
  const [runningDiagnostics, setRunningDiagnostics] = useState(false);
  const [startupNotice, setStartupNotice] = useState<string | null>(null);

  /* ── Inline editing state ── */
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [selectedRowIdx, setSelectedRowIdx] = useState<number | null>(null);
  const savePendingRef = useRef(false);
  const resultContainerRef = useRef<HTMLDivElement | null>(null);
  const [resultScrollTop, setResultScrollTop] = useState(0);
  const [resultViewportHeight, setResultViewportHeight] = useState(600);

  /* ── Pending changes (confirmation layer) ── */
  const [pendingDeletes, setPendingDeletes] = useState<Set<number>>(
    () => new Set(),
  );
  const [pendingEdits, setPendingEdits] = useState<Map<string, PendingEdit>>(
    () => new Map(),
  );
  const [applyingChanges, setApplyingChanges] = useState(false);

  /* ── Updater state ── */
  const [updater, setUpdater] = useState<{
    checking: boolean;
    available: boolean;
    downloading: boolean;
    progress: number;
    version?: string;
    source?: "tauri" | "github";
    assetName?: string;
    downloadUrl?: string;
    sha256?: string;
    targetLabel?: string;
    done: boolean;
  }>({
    checking: false,
    available: false,
    downloading: false,
    progress: 0,
    done: false,
  });

  /* ── Derived ── */
  const activeConnection = useMemo(
    () => connections.find((item) => item.id === activeConnectionId),
    [connections, activeConnectionId],
  );
  const activeTab = useMemo(
    () => tabs.find((tab) => tab.id === activeTabId) ?? tabs[0],
    [tabs, activeTabId],
  );
  const hasPendingChanges = pendingEdits.size > 0 || pendingDeletes.size > 0;
  const normalizedSchemaFilter = schemaFilter.trim().toLowerCase();
  const filteredDatabases = useMemo(() => {
    if (!normalizedSchemaFilter) return databases;
    return databases.filter((database) => {
      if (database.toLowerCase().includes(normalizedSchemaFilter)) return true;
      const tables = tablesByDb[database] ?? [];
      return tables.some((table) =>
        table.name.toLowerCase().includes(normalizedSchemaFilter),
      );
    });
  }, [databases, tablesByDb, normalizedSchemaFilter]);
  const resultRows = activeTab?.result?.rows ?? [];
  const rowHeightPx = 30;
  const shouldVirtualize = resultRows.length > 300;
  const visibleWindow = Math.max(1, Math.ceil(resultViewportHeight / rowHeightPx));
  const overscan = 10;
  const virtualStart = shouldVirtualize
    ? Math.max(0, Math.floor(resultScrollTop / rowHeightPx) - overscan)
    : 0;
  const virtualEnd = shouldVirtualize
    ? Math.min(resultRows.length, virtualStart + visibleWindow + overscan * 2)
    : resultRows.length;
  const visibleRows = shouldVirtualize
    ? resultRows.slice(virtualStart, virtualEnd)
    : resultRows;

  /* ── Data loading ── */
  const loadConnections = useCallback(async () => {
    setConnectionsLoading(true);
    try {
      const rows = await api.connectionList();
      setConnections(rows);
      setActiveConnectionId((current) => current ?? rows[0]?.id);
    } finally {
      setConnectionsLoading(false);
    }
  }, []);

  const loadWorkspace = useCallback(async () => {
    if (!activeConnectionId) return;
    setSchemaLoading(true);
    try {
      const [dbRows, historyRows, snippetRows, auditRows, logRows] =
        await Promise.all([
        api.schemaListDatabases(activeConnectionId),
        api.historyList(activeConnectionId, 50),
        api.snippetList(activeConnectionId),
        api.auditList(150),
        api.logsList(200),
      ]);
      setDatabases(
        dbRows.map((row) => String(row.name ?? "")).filter(Boolean),
      );
      setHistorySql(historyRows.map((item) => item.sql));
      setSnippets(
        snippetRows.map((item) => ({
          id: item.id,
          name: item.name,
          sql: item.sql,
        })),
      );
      setAuditItems(auditRows);
      setAppLogs(logRows);
      setTablesByDb({});
      setExpandedDb({});
      setSelectedTableDdl("");
    } finally {
      setSchemaLoading(false);
    }
  }, [activeConnectionId]);

  /* ── Effects ── */
  useEffect(() => {
    if (!isTauriRuntime) {
      setConnectionsLoading(false);
      return;
    }
    void loadConnections().catch((error) => toast.error(String(error)));
    void api
      .appStartupStatus()
      .then((value) => setStartupNotice(value))
      .catch(() => setStartupNotice(null));
  }, [isTauriRuntime, loadConnections]);

  useEffect(() => {
    if (connections.length > 0 && !activeTabId) setActiveTabId(tabs[0].id);
  }, [connections, tabs, activeTabId]);

  useEffect(() => {
    if (!activeConnectionId) return;
    void loadWorkspace().catch((error) => toast.error(String(error)));
  }, [activeConnectionId, loadWorkspace]);

  useEffect(() => {
    setSelectedTable(null);
    setSelectedTableColumns([]);
    setSelectedTableDdl("");
    setSelectedTableLoading(false);
  }, [activeConnectionId]);

  // Clear pending changes on tab switch or connection change
  useEffect(() => {
    setPendingDeletes(new Set());
    setPendingEdits(new Map());
    setSelectedRowIdx(null);
    setEditingCell(null);
  }, [activeTabId, activeConnectionId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const minimalTabs = tabs.map((tab) => ({
      id: tab.id,
      title: tab.title,
      sql: tab.sql,
      page: tab.page,
      pageSize: tab.pageSize,
      timeoutMs: tab.timeoutMs,
    }));
    window.localStorage.setItem(
      TAB_STORAGE_KEY,
      JSON.stringify({
        tabs: minimalTabs,
        activeTabId,
      }),
    );
  }, [tabs, activeTabId]);

  useEffect(() => {
    const el = resultContainerRef.current;
    if (!el) return;
    const measure = () => setResultViewportHeight(el.clientHeight || 600);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [activeTabId, activeConnectionId]);

  useEffect(() => {
    setResultScrollTop(0);
    if (resultContainerRef.current) {
      resultContainerRef.current.scrollTop = 0;
    }
  }, [activeTab?.result?.queryId, activeTabId]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (editingCell) setEditingCell(null);
        else if (selectedRowIdx !== null) setSelectedRowIdx(null);
      }
      // Ctrl+S / Cmd+S → apply pending changes
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (hasPendingChanges && !applyingChanges) {
          void applyChanges();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingCell, selectedRowIdx, hasPendingChanges, applyingChanges]);

  /* ── Tab / query helpers ── */
  const updateTab = (id: string, patch: Partial<QueryTab>) =>
    setTabs((prev) =>
      prev.map((tab) => (tab.id === id ? { ...tab, ...patch } : tab)),
    );

  const openDb = async (database: string) => {
    if (!activeConnectionId) return;
    setExpandedDb((prev) => ({ ...prev, [database]: !prev[database] }));
    if (tablesByDb[database]) return;
    setDbLoading((prev) => ({ ...prev, [database]: true }));
    try {
      const rows = await api.schemaListTables(activeConnectionId, database);
      setTablesByDb((prev) => ({
        ...prev,
        [database]: rows.map((row) => ({
          database: String(row.database ?? database),
          name: String(row.name ?? ""),
          engine: String(row.engine ?? ""),
        })),
      }));
    } finally {
      setDbLoading((prev) => ({ ...prev, [database]: false }));
    }
  };

  const selectTable = async (table: SchemaTable) => {
    if (!activeConnectionId) return;
    setSelectedTable(table);
    setSelectedTableLoading(true);
    try {
      const [rows, ddl] = await Promise.all([
        api.schemaGetColumns(activeConnectionId, table.database, table.name),
        api.schemaGetTableDdl(activeConnectionId, table.database, table.name),
      ]);
      setSelectedTableColumns(
        rows.map((row) => ({
          name: String(row.name ?? ""),
          type: String(row.type ?? ""),
        })),
      );
      setSelectedTableDdl(ddl.message);
    } catch (error) {
      toast.error(String(error));
      setSelectedTableColumns([]);
      setSelectedTableDdl("");
    } finally {
      setSelectedTableLoading(false);
    }
  };

  const clearPendingState = () => {
    setPendingDeletes(new Set());
    setPendingEdits(new Map());
    setSelectedRowIdx(null);
    setEditingCell(null);
  };

  const runQuery = async (page = activeTab?.page ?? 1) => {
    if (!activeConnectionId || !activeTab) return;
    const clientQueryId = crypto.randomUUID();
    clearPendingState();
    updateTab(activeTab.id, {
      running: true,
      runningQueryId: clientQueryId,
      error: undefined,
      page,
    });
    try {
      const result = await api.queryExecute({
        connectionId: activeConnectionId,
        sql: activeTab.sql,
        clientQueryId,
        page,
        pageSize: activeTab.pageSize,
        timeoutMs: activeTab.timeoutMs || activeConnection?.timeoutMs,
      });
      updateTab(activeTab.id, {
        running: false,
        runningQueryId: undefined,
        result,
        error: undefined,
      });
      void loadWorkspace();
    } catch (error) {
      updateTab(activeTab.id, {
        running: false,
        runningQueryId: undefined,
        error: String(error),
      });
      toast.error(String(error));
    }
  };

  const cancelQuery = async () => {
    if (!activeConnectionId || !activeTab?.runningQueryId) return;
    try {
      const msg = await api.queryCancel(activeConnectionId, activeTab.runningQueryId);
      toast.success(msg.message);
    } catch (error) {
      toast.error(String(error));
    } finally {
      updateTab(activeTab.id, { running: false, runningQueryId: undefined });
    }
  };

  const formatCurrentSql = () => {
    if (!activeTab) return;
    try {
      const formatted = formatSql(activeTab.sql, { language: "sql" });
      updateTab(activeTab.id, { sql: formatted });
    } catch (error) {
      toast.error(`Format failed: ${String(error)}`);
    }
  };

  const explainCurrentSql = () => {
    if (!activeTab) return;
    const sql = activeTab.sql.trim();
    if (!sql) return;
    if (/^explain\b/i.test(sql)) {
      toast("Query already starts with EXPLAIN.");
      return;
    }
    updateTab(activeTab.id, { sql: `EXPLAIN ${sql}` });
  };

  const duplicateCurrentTab = () => {
    if (!activeTab) return;
    const tab: QueryTab = {
      ...activeTab,
      id: crypto.randomUUID(),
      title: `${activeTab.title} Copy`,
      running: false,
      runningQueryId: undefined,
      result: undefined,
      error: undefined,
    };
    setTabs((prev) => [...prev, tab]);
    setActiveTabId(tab.id);
  };

  const moveTab = (tabId: string, direction: -1 | 1) => {
    setTabs((prev) => {
      const index = prev.findIndex((tab) => tab.id === tabId);
      if (index < 0) return prev;
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
    setActiveTabId(tabId);
  };

  const exportProfiles = async () => {
    const targetPath = window.prompt(
      "Export profiles to file path",
      "C:\\\\temp\\\\simple-sdm-connections.json",
    );
    if (!targetPath) return;
    try {
      const out = await api.connectionExportProfiles(targetPath);
      toast.success(out.message);
    } catch (error) {
      toast.error(String(error));
    }
  };

  const importProfiles = async () => {
    const sourcePath = window.prompt(
      "Import profiles from file path",
      "C:\\\\temp\\\\simple-sdm-connections.json",
    );
    if (!sourcePath) return;
    const overwrite = window.confirm(
      "Overwrite existing profiles with matching IDs?",
    );
    try {
      const out = await api.connectionImportProfiles(sourcePath, overwrite);
      toast.success(out.message);
      await loadConnections();
    } catch (error) {
      toast.error(String(error));
    }
  };

  const backupMetadata = async () => {
    const targetPath = window.prompt(
      "Backup metadata SQLite to file path",
      "C:\\\\temp\\\\simple-sdm-backup.sqlite3",
    );
    if (!targetPath) return;
    try {
      const out = await api.appBackupMetadata(targetPath);
      toast.success(out.message);
    } catch (error) {
      toast.error(String(error));
    }
  };

  const restoreMetadata = async () => {
    const sourcePath = window.prompt(
      "Restore metadata SQLite from file path",
      "C:\\\\temp\\\\simple-sdm-backup.sqlite3",
    );
    if (!sourcePath) return;
    if (
      !window.confirm(
        "Restore will replace current local metadata. Continue?",
      )
    ) {
      return;
    }
    try {
      const out = await api.appRestoreMetadata(sourcePath);
      toast.success(out.message);
      await loadConnections();
      if (activeConnectionId) {
        await loadWorkspace();
      }
    } catch (error) {
      toast.error(String(error));
    }
  };

  const runOperation = async () => {
    if (!activeConnectionId) return;
    const action = window.prompt(
      "Operation: create-db | drop-db | create-table | drop-table | insert | update | delete",
    );
    if (!action) return;
    try {
      if (action === "create-db") {
        const database = window.prompt("Database name");
        if (!database) return;
        toast.success(
          (
            await api.createDatabase({
              connectionId: activeConnectionId,
              database,
              ifNotExists: true,
            })
          ).message,
        );
      } else if (action === "drop-db") {
        const database = window.prompt("Database name");
        if (!database) return;
        const token = window.prompt("Confirm token (DROP)");
        toast.success(
          (
            await api.dropDatabase({
              connectionId: activeConnectionId,
              database,
              ifExists: true,
              confirmToken: token ?? "",
            })
          ).message,
        );
      } else if (action === "create-table") {
        const database = window.prompt("Database", "default");
        const table = window.prompt("Table");
        const columnsDdl = window.prompt(
          "Columns DDL",
          "id UInt64, ts DateTime",
        );
        const engine = window.prompt("Engine", "MergeTree() ORDER BY tuple()");
        if (!database || !table || !columnsDdl || !engine) return;
        toast.success(
          (
            await api.createTable({
              connectionId: activeConnectionId,
              database,
              table,
              columnsDdl,
              engine,
              ifNotExists: true,
            })
          ).message,
        );
      } else if (action === "drop-table") {
        const database = window.prompt("Database", "default");
        const table = window.prompt("Table");
        const token = window.prompt("Confirm token (DROP)");
        if (!database || !table) return;
        toast.success(
          (
            await api.dropTable({
              connectionId: activeConnectionId,
              database,
              table,
              ifExists: true,
              confirmToken: token ?? "",
            })
          ).message,
        );
      } else if (action === "insert") {
        const database = window.prompt("Database", "default");
        const table = window.prompt("Table");
        const row = window.prompt("Row JSON", '{"id":1}');
        if (!database || !table || !row) return;
        toast.success(
          (
            await api.insertRow({
              connectionId: activeConnectionId,
              database,
              table,
              whereClause: "",
              row: JSON.parse(row),
            })
          ).message,
        );
      } else if (action === "update") {
        const database = window.prompt("Database", "default");
        const table = window.prompt("Table");
        const whereClause = window.prompt("WHERE", "id = 1");
        const setValues = window.prompt("SET JSON", '{"id":2}');
        const preview = await api.updateRowsPreview({
          connectionId: activeConnectionId,
          database: database ?? "",
          table: table ?? "",
          whereClause: whereClause ?? "",
        });
        if (
          !window.confirm(
            `Affected rows preview: ${preview.affectedRows}. Continue?`,
          )
        )
          return;
        const token = window.prompt("Confirm token (UPDATE)");
        if (!database || !table || !whereClause || !setValues) return;
        toast.success(
          (
            await api.updateRowsExecute({
              connectionId: activeConnectionId,
              database,
              table,
              whereClause,
              setValues: JSON.parse(setValues),
              confirmToken: token ?? "",
            })
          ).message,
        );
      } else if (action === "delete") {
        const database = window.prompt("Database", "default");
        const table = window.prompt("Table");
        const whereClause = window.prompt("WHERE", "id = 1");
        const preview = await api.deleteRowsPreview({
          connectionId: activeConnectionId,
          database: database ?? "",
          table: table ?? "",
          whereClause: whereClause ?? "",
        });
        if (
          !window.confirm(
            `Affected rows preview: ${preview.affectedRows}. Continue?`,
          )
        )
          return;
        const token = window.prompt("Confirm token (DELETE)");
        if (!database || !table || !whereClause) return;
        toast.success(
          (
            await api.deleteRowsExecute({
              connectionId: activeConnectionId,
              database,
              table,
              whereClause,
              confirmToken: token ?? "",
            })
          ).message,
        );
      } else {
        toast.error("Unknown action.");
      }
      await loadWorkspace();
    } catch (error) {
      toast.error(String(error));
    }
  };

  /* ── Connection management ── */
  const deleteConnection = async (id: string) => {
    try {
      await api.connectionDelete(id);
      toast.success("Connection deleted.");
      if (activeConnectionId === id) {
        setActiveConnectionId(undefined);
        setDatabases([]);
        setTablesByDb({});
        setExpandedDb({});
      }
      await loadConnections();
    } catch (error) {
      toast.error(String(error));
    }
  };

  const openAddDialog = () => {
    setConnectionDraft({ ...baseConnection });
    setDiagnostics(null);
    setConnectionDialogOpen(true);
  };

  const openEditDialog = (connection: ConnectionProfile) => {
    setConnectionDraft({
      id: connection.id,
      name: connection.name,
      host: connection.host,
      port: connection.port,
      database: connection.database,
      username: connection.username,
      secure: connection.secure,
      tlsInsecureSkipVerify: connection.tlsInsecureSkipVerify ?? false,
      caCertPath: connection.caCertPath ?? "",
      sshTunnel: connection.sshTunnel ?? {
        enabled: false,
        host: "",
        port: 22,
        username: "",
        localPort: 8123,
      },
      timeoutMs: connection.timeoutMs,
      password: "",
    });
    setDiagnostics(null);
    setConnectionDialogOpen(true);
  };

  /* ── Pending changes system ── */

  /** Store a cell edit as pending instead of saving immediately. */
  const storePendingEdit = (cell: EditingCell) => {
    if (savePendingRef.current) return;
    if (!activeTab?.result) {
      setEditingCell(null);
      return;
    }
    const originalRow = activeTab.result.rows[cell.rowIdx];
    if (!originalRow) {
      setEditingCell(null);
      return;
    }
    const originalDisplayValue =
      typeof originalRow[cell.col] === "object"
        ? JSON.stringify(originalRow[cell.col])
        : String(originalRow[cell.col] ?? "");

    // If value unchanged, remove any pending edit for this cell
    if (cell.value === originalDisplayValue) {
      setPendingEdits((prev) => {
        const next = new Map(prev);
        next.delete(`${cell.rowIdx}:${cell.col}`);
        return next;
      });
      setEditingCell(null);
      return;
    }

    const newValue = coerceEditedValue(cell.value, originalRow[cell.col]);
    setPendingEdits((prev) => {
      const next = new Map(prev);
      next.set(`${cell.rowIdx}:${cell.col}`, {
        rowIdx: cell.rowIdx,
        col: cell.col,
        originalValue: originalRow[cell.col],
        newValue,
      });
      return next;
    });
    setEditingCell(null);
  };

  /** Toggle a row as pending delete. */
  const togglePendingDelete = (rowIdx: number) => {
    setPendingDeletes((prev) => {
      const next = new Set(prev);
      if (next.has(rowIdx)) {
        next.delete(rowIdx);
      } else {
        next.add(rowIdx);
      }
      return next;
    });
  };

  /** Apply all pending edits and deletes to the server. */
  const applyChanges = async () => {
    if (!activeConnectionId || !activeTab?.result) return;
    const parsed = parseTableFromSql(activeTab.sql, activeConnection?.database);
    if (!parsed) {
      toast.error(
        "Cannot determine table. Use SELECT ... FROM `db`.`table` format.",
      );
      return;
    }

    setApplyingChanges(true);
    let editCount = 0;
    let deleteCount = 0;
    let errorCount = 0;

    // Group edits by row (skip rows that will be deleted)
    const editsByRow = new Map<number, Record<string, unknown>>();
    for (const [, edit] of pendingEdits) {
      if (pendingDeletes.has(edit.rowIdx)) continue;
      if (!editsByRow.has(edit.rowIdx)) editsByRow.set(edit.rowIdx, {});
      editsByRow.get(edit.rowIdx)![edit.col] = edit.newValue;
    }

    // Apply edits
    for (const [rowIdx, setValues] of editsByRow) {
      const row = activeTab.result.rows[rowIdx];
      if (!row) continue;
      try {
        const whereClause = buildWhereClause(
          row as Record<string, unknown>,
          activeTab.result.columns,
        );
        await api.updateRowsExecute({
          connectionId: activeConnectionId,
          database: parsed.database,
          table: parsed.table,
          whereClause,
          setValues,
          confirmToken: "UPDATE",
        });
        editCount++;
      } catch (error) {
        toast.error(`Row ${rowIdx + 1} edit failed: ${String(error)}`);
        errorCount++;
      }
    }

    // Apply deletes
    for (const rowIdx of pendingDeletes) {
      const row = activeTab.result.rows[rowIdx];
      if (!row) continue;
      try {
        const whereClause = buildWhereClause(
          row as Record<string, unknown>,
          activeTab.result.columns,
        );
        await api.deleteRowsExecute({
          connectionId: activeConnectionId,
          database: parsed.database,
          table: parsed.table,
          whereClause,
          confirmToken: "DELETE",
        });
        deleteCount++;
      } catch (error) {
        toast.error(`Row ${rowIdx + 1} delete failed: ${String(error)}`);
        errorCount++;
      }
    }

    // Summary
    const parts: string[] = [];
    if (editCount > 0)
      parts.push(`${editCount} edit${editCount > 1 ? "s" : ""}`);
    if (deleteCount > 0)
      parts.push(`${deleteCount} deletion${deleteCount > 1 ? "s" : ""}`);
    if (errorCount > 0)
      parts.push(`${errorCount} error${errorCount > 1 ? "s" : ""}`);

    if (errorCount > 0) {
      toast.error(`Applied with errors: ${parts.join(", ")}`);
    } else if (parts.length > 0) {
      toast.success(`Applied: ${parts.join(", ")}`);
    }

    clearPendingState();
    setApplyingChanges(false);
    void runQuery(activeTab.page);
  };

  const discardChanges = () => {
    clearPendingState();
    toast("Changes discarded");
  };

  /* ── Updater ── */
  const checkGithubReleaseUpdate = async (): Promise<GithubUpdateInfo | null> => {
    const result = await api.appCheckUpdate();
    if (
      !result.available ||
      !result.latestVersion ||
      !result.assetName ||
      !result.downloadUrl ||
      !result.sha256
    ) {
      return null;
    }
    return {
      version: result.latestVersion,
      assetName: result.assetName,
      downloadUrl: result.downloadUrl,
      sha256: result.sha256,
      targetLabel: result.target,
    };
  };

  const checkForUpdates = async () => {
    if (!isTauriRuntime) {
      toast.error("Updater is only available in Tauri runtime.");
      return;
    }
    setUpdater((s) => ({ ...s, checking: true, done: false }));
    try {
      const update = await check();
      if (!update) {
        toast.success("You're on the latest version!");
        setUpdater((s) => ({
          ...s,
          checking: false,
          available: false,
          source: undefined,
          assetName: undefined,
          downloadUrl: undefined,
          sha256: undefined,
          targetLabel: undefined,
        }));
        return;
      }
      setUpdater((s) => ({
        ...s,
        checking: false,
        available: true,
        version: update.version,
        source: "tauri",
        assetName: undefined,
        downloadUrl: undefined,
        sha256: undefined,
        targetLabel: undefined,
      }));
      toast.success(`Update v${update.version} available.`);
    } catch (error) {
      try {
        const githubUpdate = await checkGithubReleaseUpdate();
        if (!githubUpdate) {
          setUpdater((s) => ({
            ...s,
            checking: false,
            available: false,
            source: undefined,
            assetName: undefined,
            downloadUrl: undefined,
            sha256: undefined,
            targetLabel: undefined,
          }));
          toast.success("You're on the latest version!");
          return;
        }
        setUpdater((s) => ({
          ...s,
          checking: false,
          available: true,
          version: githubUpdate.version,
          source: "github",
          assetName: githubUpdate.assetName,
          downloadUrl: githubUpdate.downloadUrl,
          sha256: githubUpdate.sha256,
          targetLabel: githubUpdate.targetLabel,
        }));
        toast.success(
          `Update v${githubUpdate.version} available for ${githubUpdate.targetLabel}.`,
        );
      } catch (fallbackError) {
        setUpdater((s) => ({ ...s, checking: false }));
        toast.error(
          `Update check failed: ${String(error)} | ${String(fallbackError)}`,
        );
      }
    }
  };

  const downloadUpdate = async () => {
    if (!isTauriRuntime) return;
    setUpdater((s) => ({ ...s, downloading: true, progress: 0 }));
    try {
      if (
        updater.source === "github" &&
        updater.downloadUrl &&
        updater.sha256 &&
        updater.assetName
      ) {
        const response = await api.appInstallUpdate(
          updater.downloadUrl,
          updater.sha256,
          updater.assetName,
        );
        setUpdater((s) => ({
          ...s,
          downloading: false,
          done: true,
          progress: 100,
          available: false,
        }));
        toast.success(response.message);
        return;
      }

      const update = await check();
      if (!update) {
        setUpdater((s) => ({ ...s, downloading: false, progress: 0 }));
        return;
      }
      let totalSize = 0;
      let downloaded = 0;
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") {
          totalSize = (event.data as { contentLength?: number }).contentLength ?? 0;
        } else if (event.event === "Progress") {
          downloaded += (event.data as { chunkLength?: number }).chunkLength ?? 0;
          const pct =
            totalSize > 0 ? Math.round((downloaded / totalSize) * 100) : 0;
          setUpdater((s) => ({ ...s, progress: pct }));
        } else if (event.event === "Finished") {
          setUpdater((s) => ({
            ...s,
            downloading: false,
            done: true,
            progress: 100,
          }));
        }
      });
    } catch (error) {
      setUpdater((s) => ({ ...s, downloading: false }));
      toast.error(`Update failed: ${String(error)}`);
    }
  };

  /* ════════════════════════════ RENDER ════════════════════════════ */

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* ── Sidebar ── */}
      <aside className="flex w-[280px] flex-shrink-0 flex-col border-r border-border/50">
        {/* Header */}
        <div className="flex h-12 items-center justify-between border-b border-border/50 px-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15">
              <Database className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="text-sm font-semibold tracking-tight">
              Simple SDM
            </span>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={openAddDialog}
            title="Add Connection"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Connections */}
        <div
          className="flex flex-col overflow-hidden"
          style={{
            flex:
              activeConnectionId && databases.length > 0 ? "0 0 auto" : "1",
            maxHeight:
              activeConnectionId && databases.length > 0 ? "45%" : undefined,
          }}
        >
          <div className="flex items-center px-4 pt-3 pb-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Connections
            </span>
          </div>
          <ScrollArea className="flex-1">
            <div className="space-y-0.5 px-2 pb-2">
              {connectionsLoading ? (
                <div className="space-y-2 px-2 py-3">
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-4/5" />
                  <Skeleton className="h-9 w-3/5" />
                </div>
              ) : connections.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-10 text-center">
                  <Server className="h-8 w-8 text-muted-foreground/20" />
                  <p className="text-xs text-muted-foreground/50">
                    No connections yet
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={openAddDialog}
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    Add Connection
                  </Button>
                </div>
              ) : (
                connections.map((connection) => (
                  <div
                    key={connection.id}
                    className={cn(
                      "group flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors",
                      activeConnectionId === connection.id
                        ? "bg-primary/10"
                        : "hover:bg-muted/50",
                    )}
                    onClick={() => setActiveConnectionId(connection.id)}
                  >
                    <div
                      className={cn(
                        "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md",
                        activeConnectionId === connection.id
                          ? "bg-primary/20"
                          : "bg-muted/50",
                      )}
                    >
                      <Server
                        className={cn(
                          "h-3.5 w-3.5",
                          activeConnectionId === connection.id
                            ? "text-primary"
                            : "text-muted-foreground",
                        )}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div
                        className={cn(
                          "truncate text-xs font-medium",
                          activeConnectionId === connection.id
                            ? "text-primary"
                            : "text-foreground/90",
                        )}
                      >
                        {connection.name}
                      </div>
                      <div className="truncate text-[10px] text-muted-foreground">
                        {connection.host}:{connection.port}
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        className="rounded-md p-1 hover:bg-background/80"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditDialog(connection);
                        }}
                        title="Edit"
                      >
                        <Pencil className="h-3 w-3 text-muted-foreground" />
                      </button>
                      <button
                        className="rounded-md p-1 hover:bg-destructive/20"
                        onClick={(e) => {
                          e.stopPropagation();
                          void deleteConnection(connection.id);
                        }}
                        title="Delete"
                      >
                        <Trash2 className="h-3 w-3 text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Schema browser */}
        {activeConnectionId && (
          <div className="flex flex-1 flex-col overflow-hidden border-t border-border/50">
            <div className="flex items-center justify-between px-4 pt-3 pb-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Schema
              </span>
              <button
                className="rounded-md p-1 hover:bg-muted/60"
                onClick={() => void loadWorkspace()}
                title="Refresh"
              >
                <RefreshCw
                  className={cn(
                    "h-3 w-3 text-muted-foreground",
                    schemaLoading && "animate-spin",
                  )}
                />
              </button>
            </div>
            <ScrollArea className="flex-1">
              <div className="px-2 pb-2">
                <div className="relative px-2 pb-2">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
                  <Input
                    value={schemaFilter}
                    onChange={(e) => setSchemaFilter(e.currentTarget.value)}
                    placeholder="Filter databases/tables"
                    className="h-7 border-border/50 pl-8 text-xs"
                  />
                </div>
                {schemaLoading && databases.length === 0 ? (
                  <div className="space-y-1.5 px-2 py-2">
                    <Skeleton className="h-6 w-full" />
                    <Skeleton className="h-6 w-4/5" />
                    <Skeleton className="h-6 w-3/5" />
                    <Skeleton className="h-6 w-4/5" />
                  </div>
                ) : (
                  filteredDatabases.map((database) => (
                    <div key={database}>
                      <button
                        className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-xs text-foreground/80 hover:bg-muted/50"
                        onClick={() => void openDb(database)}
                      >
                        {expandedDb[database] ? (
                          <ChevronDown className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                        )}
                        <Database className="h-3 w-3 flex-shrink-0 text-amber-500/80" />
                        <span className="truncate">{database}</span>
                      </button>
                      {expandedDb[database] && (
                        <div className="ml-3 border-l border-border/40 pl-1.5">
                          {dbLoading[database] ? (
                            <div className="space-y-1 py-1 pl-2">
                              <Skeleton className="h-4 w-24" />
                              <Skeleton className="h-4 w-20" />
                              <Skeleton className="h-4 w-28" />
                            </div>
                          ) : (
                            (tablesByDb[database] ?? [])
                              .filter((table) => {
                                if (!normalizedSchemaFilter) return true;
                                return table.name
                                  .toLowerCase()
                                  .includes(normalizedSchemaFilter);
                              })
                              .map((table) => (
                              <button
                                key={`${table.database}.${table.name}`}
                                className="flex w-full items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                                onClick={() =>
                                  void (async () => {
                                    await selectTable(table);
                                    if (!activeTab) return;
                                    updateTab(activeTab.id, {
                                      sql: `SELECT * FROM \`${table.database}\`.\`${table.name}\``,
                                      page: 1,
                                    });
                                  })()
                                }
                                title={`${table.name} (${table.engine})`}
                              >
                                <Table2 className="h-3 w-3 flex-shrink-0" />
                                <span className="truncate">{table.name}</span>
                                <span className="ml-auto flex-shrink-0 text-[9px] text-muted-foreground/40">
                                  {table.engine}
                                </span>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
                {!schemaLoading &&
                  normalizedSchemaFilter &&
                  filteredDatabases.length === 0 && (
                    <p className="px-2 py-6 text-center text-[11px] text-muted-foreground/40">
                      No schema matches "{schemaFilter.trim()}"
                    </p>
                  )}
                {!schemaLoading && databases.length === 0 && (
                  <p className="px-2 py-6 text-center text-[11px] text-muted-foreground/40">
                    No databases loaded
                  </p>
                )}
              </div>
            </ScrollArea>
            {selectedTable && (
              <div className="border-t border-border/50 px-3 py-2">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Selection
                </div>
                <div className="mt-1.5 rounded-md bg-muted/30 px-2 py-1.5">
                  <div className="truncate text-xs font-medium">
                    {selectedTable.database}.{selectedTable.name}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>{selectedTable.engine}</span>
                    <span>•</span>
                    <span>
                      {selectedTableLoading
                        ? "Loading columns..."
                        : `${selectedTableColumns.length} columns`}
                    </span>
                  </div>
                  {selectedTableColumns.length > 0 ? (
                    <div className="mt-1 line-clamp-2 text-[10px] text-muted-foreground/80">
                      {selectedTableColumns
                        .slice(0, 4)
                        .map((c) => `${c.name} ${c.type}`)
                        .join(", ")}
                    </div>
                  ) : null}
                  <div className="mt-1.5 flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 px-2 text-[10px]"
                      onClick={() => {
                        if (!activeTab || !selectedTableDdl) return;
                        updateTab(activeTab.id, { sql: selectedTableDdl });
                      }}
                    >
                      Use DDL
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 px-2 text-[10px]"
                      onClick={() => {
                        if (!selectedTableDdl) return;
                        navigator.clipboard
                          .writeText(selectedTableDdl)
                          .then(() => toast.success("DDL copied"))
                          .catch(() => toast.error("Failed to copy DDL"));
                      }}
                    >
                      Copy DDL
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Sidebar footer: version & updates */}
        <div className="border-t border-border/50 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground/50">
              v{APP_VERSION}
            </span>
            {updater.done ? (
              <span className="text-[10px] font-medium text-emerald-400">
                Update ready — restart app
              </span>
            ) : updater.downloading ? (
              <div className="flex flex-1 items-center gap-2">
                <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted/40">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-primary transition-all duration-300"
                    style={{ width: `${updater.progress}%` }}
                  />
                </div>
                <span className="text-[10px] tabular-nums text-muted-foreground">
                  {updater.progress}%
                </span>
              </div>
            ) : updater.available ? (
              <button
                className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/10"
                onClick={() => void downloadUpdate()}
                title={
                  updater.source === "github"
                    ? `Install ${updater.assetName ?? "release asset"} (${updater.targetLabel ?? "runtime"})`
                    : "Download and install update"
                }
              >
                <Download className="h-3 w-3" />
                v{updater.version}
              </button>
            ) : (
              <button
                className="rounded-md p-0.5 text-muted-foreground/40 hover:text-muted-foreground"
                onClick={() => void checkForUpdates()}
                disabled={updater.checking}
                title="Check for updates"
              >
                {updater.checking ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
              </button>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2 text-[10px]"
              onClick={() => void exportProfiles()}
              disabled={!isTauriRuntime}
            >
              Export
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2 text-[10px]"
              onClick={() => void importProfiles()}
              disabled={!isTauriRuntime}
            >
              Import
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2 text-[10px]"
              onClick={() => void backupMetadata()}
              disabled={!isTauriRuntime}
            >
              Backup
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2 text-[10px]"
              onClick={() => void restoreMetadata()}
              disabled={!isTauriRuntime}
            >
              Restore
            </Button>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {!isTauriRuntime && (
          <div className="border-b border-amber-400/20 bg-amber-500/5 px-4 py-2 text-xs text-amber-200/80">
            Browser preview mode. Run with{" "}
            <code className="mono rounded bg-amber-500/10 px-1 py-0.5">
              pnpm tauri dev
            </code>{" "}
            for full functionality.
          </div>
        )}
        {startupNotice ? (
          <div className="border-b border-amber-400/20 bg-amber-500/5 px-4 py-2 text-xs text-amber-200/90">
            {startupNotice}
          </div>
        ) : null}

        {connections.length === 0 || !activeConnection ? (
          connectionsLoading ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
              <p className="text-sm text-muted-foreground/50">
                Loading connections...
              </p>
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-5">
              <Card className="border-border/50 bg-muted/10">
                <CardContent className="flex flex-col items-center gap-5 p-8 text-center">
                  <div className="rounded-2xl bg-muted/20 p-7">
                    {connections.length === 0 ? (
                      <Database className="h-14 w-14 text-muted-foreground/20" />
                    ) : (
                      <Server className="h-14 w-14 text-muted-foreground/20" />
                    )}
                  </div>
                  <div className="text-center">
                    <h2 className="text-lg font-medium text-foreground/70">
                      {connections.length === 0
                        ? "No Connections"
                        : "Select a Connection"}
                    </h2>
                    <p className="mt-1 max-w-[280px] text-sm text-muted-foreground/50">
                      {connections.length === 0
                        ? "Add a ClickHouse connection to get started"
                        : "Choose a connection from the sidebar to start querying"}
                    </p>
                  </div>
                </CardContent>
              </Card>
              {connections.length === 0 && (
                <Button onClick={openAddDialog}>
                  <Plus className="mr-1.5 h-4 w-4" />
                  Add Connection
                </Button>
              )}
            </div>
          )
        ) : (
          <>
            {/* Toolbar */}
            <div className="flex items-center gap-1 border-b border-border/50 px-3 py-1.5">
              <Badge
                variant="secondary"
                className="mr-1.5 h-6 text-[10px] font-medium"
              >
                {activeConnection.name}
              </Badge>
              <div className="h-4 w-px bg-border/40" />
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1.5 px-2.5 text-xs"
                onClick={() => void runQuery()}
                disabled={!isTauriRuntime || activeTab?.running}
              >
                {activeTab?.running ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="h-3.5 w-3.5 text-emerald-400" />
                )}
                Run
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1.5 px-2.5 text-xs"
                onClick={() => void cancelQuery()}
                disabled={!isTauriRuntime || !activeTab?.runningQueryId}
              >
                <X className="h-3.5 w-3.5 text-amber-300" />
                Cancel
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1.5 px-2.5 text-xs"
                onClick={formatCurrentSql}
                disabled={!activeTab}
              >
                <Code2 className="h-3.5 w-3.5" />
                Format
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1.5 px-2.5 text-xs"
                onClick={explainCurrentSql}
                disabled={!activeTab}
              >
                <Search className="h-3.5 w-3.5" />
                Explain
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1.5 px-2.5 text-xs"
                onClick={duplicateCurrentTab}
                disabled={!activeTab}
              >
                <Copy className="h-3.5 w-3.5" />
                Duplicate
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1.5 px-2.5 text-xs"
                onClick={async () => {
                  if (!isTauriRuntime) {
                    toast.error("Run this app with `pnpm tauri dev`.");
                    return;
                  }
                  if (!activeTab || !activeConnectionId) return;
                  const name = window.prompt("Snippet name");
                  if (!name) return;
                  await api.snippetSave({
                    name,
                    sql: activeTab.sql,
                    connectionId: activeConnectionId,
                    tags: ["manual"],
                  });
                  toast.success("Snippet saved.");
                  void loadWorkspace();
                }}
              >
                <Save className="h-3.5 w-3.5" />
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1.5 px-2.5 text-xs"
                onClick={() => void runOperation()}
                disabled={!isTauriRuntime}
              >
                <Sparkles className="h-3.5 w-3.5" />
                Ops
              </Button>
            </div>

            {/* Tab bar */}
            <div className="flex items-center border-b border-border/50 bg-muted/20">
              <div className="flex items-center overflow-x-auto">
                {tabs.map((tab, tabIndex) => (
                  <div
                    key={tab.id}
                    className={cn(
                      "group relative flex cursor-pointer select-none items-center gap-1 border-r border-border/30 px-3 py-1.5 text-xs",
                      tab.id === activeTab?.id
                        ? "bg-background text-foreground"
                        : "text-muted-foreground hover:bg-background/50 hover:text-foreground/80",
                    )}
                    onClick={() => setActiveTabId(tab.id)}
                  >
                    {tab.id === activeTab?.id && (
                      <div className="absolute inset-x-0 top-0 h-0.5 bg-primary" />
                    )}
                    <span className="max-w-[120px] truncate">{tab.title}</span>
                    {tabs.length > 1 && (
                      <div className="ml-1 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          className="rounded-sm p-0.5 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-30"
                          disabled={tabIndex === 0}
                          title="Move tab left"
                          onClick={(e) => {
                            e.stopPropagation();
                            moveTab(tab.id, -1);
                          }}
                        >
                          <ChevronRight className="h-3 w-3 rotate-180" />
                        </button>
                        <button
                          className="rounded-sm p-0.5 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-30"
                          disabled={tabIndex === tabs.length - 1}
                          title="Move tab right"
                          onClick={(e) => {
                            e.stopPropagation();
                            moveTab(tab.id, 1);
                          }}
                        >
                          <ChevronRight className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                    {tabs.length > 1 && (
                      <button
                        className="ml-0.5 rounded-sm p-0.5 opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          setTabs((prev) => {
                            const filtered = prev.filter(
                              (t) => t.id !== tab.id,
                            );
                            if (
                              tab.id === activeTabId &&
                              filtered.length > 0
                            ) {
                              setActiveTabId(filtered[0].id);
                            }
                            return filtered;
                          });
                        }}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                className="flex items-center px-2.5 py-1.5 text-muted-foreground hover:text-foreground"
                onClick={() => {
                  const tab = createTab(tabs.length + 1);
                  setTabs((prev) => [...prev, tab]);
                  setActiveTabId(tab.id);
                }}
                title="New tab"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Content: editor + results + history */}
            <div className="flex flex-1 flex-col overflow-hidden">
              {/* SQL editor */}
              <div className="flex-shrink-0 border-b border-border/50 p-3">
                <Textarea
                  className="mono min-h-[100px] resize-y border-border/40 bg-background/50 text-sm leading-relaxed"
                  value={activeTab?.sql ?? ""}
                  onChange={(e) => {
                    const value = e.currentTarget.value;
                    activeTab && updateTab(activeTab.id, { sql: value });
                  }}
                  placeholder="Write your SQL query here..."
                />
                <div className="mt-1.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span>Page {activeTab?.page ?? 1}</span>
                  <span>Timeout</span>
                  <Input
                    className="h-5 w-24 border-border/50 text-[10px]"
                    type="number"
                    value={activeTab?.timeoutMs ?? 30000}
                    onChange={(e) => {
                      const value = Number(e.currentTarget.value) || 30000;
                      activeTab && updateTab(activeTab.id, { timeoutMs: value });
                    }}
                  />
                  <button
                    className="rounded px-1.5 py-0.5 hover:bg-muted/60 hover:text-foreground"
                    onClick={() =>
                      void runQuery(Math.max(1, (activeTab?.page ?? 1) - 1))
                    }
                  >
                    &larr; Prev
                  </button>
                  <button
                    className="rounded px-1.5 py-0.5 hover:bg-muted/60 hover:text-foreground"
                    onClick={() => void runQuery((activeTab?.page ?? 1) + 1)}
                  >
                    Next &rarr;
                  </button>
                  {activeTab?.result && (
                    <span className="ml-auto">
                      {activeTab.result.rowCount} rows &middot;{" "}
                      {activeTab.result.durationMs}ms
                    </span>
                  )}
                  {activeTab?.error && (
                    <span
                      className="ml-auto max-w-[400px] truncate text-destructive"
                      title={activeTab.error}
                    >
                      {activeTab.error}
                    </span>
                  )}
                </div>
              </div>

              {/* Pending changes bar */}
              {(hasPendingChanges ||
                selectedRowIdx !== null) && (
                <div className="flex items-center gap-2 border-b border-border/40 bg-card/80 px-3 py-1.5">
                  {/* Left: selection info */}
                  {selectedRowIdx !== null &&
                    activeTab?.result?.rows?.[selectedRowIdx] && (
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-muted-foreground">
                          Row {selectedRowIdx + 1}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 gap-1 px-2 text-[11px]"
                          onClick={() => {
                            const row =
                              activeTab.result!.rows[selectedRowIdx];
                            navigator.clipboard.writeText(
                              JSON.stringify(row, null, 2),
                            );
                            toast.success("Row copied as JSON");
                          }}
                        >
                          <Copy className="h-3 w-3" />
                          Copy
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={cn(
                            "h-6 gap-1 px-2 text-[11px]",
                            pendingDeletes.has(selectedRowIdx)
                              ? "text-muted-foreground"
                              : "text-destructive hover:bg-destructive/10 hover:text-destructive",
                          )}
                          onClick={() => togglePendingDelete(selectedRowIdx)}
                        >
                          {pendingDeletes.has(selectedRowIdx) ? (
                            <>
                              <Undo2 className="h-3 w-3" />
                              Unmark
                            </>
                          ) : (
                            <>
                              <Trash2 className="h-3 w-3" />
                              Delete
                            </>
                          )}
                        </Button>
                        <div className="h-4 w-px bg-border/40" />
                      </div>
                    )}

                  {/* Center: pending changes summary */}
                  {hasPendingChanges && (
                    <div className="flex items-center gap-1.5">
                      {pendingEdits.size > 0 && (
                        <Badge
                          variant="secondary"
                          className="h-5 gap-1 bg-amber-500/10 px-1.5 text-[10px] text-amber-400"
                        >
                          <Pencil className="h-2.5 w-2.5" />
                          {pendingEdits.size} edit
                          {pendingEdits.size > 1 ? "s" : ""}
                        </Badge>
                      )}
                      {pendingDeletes.size > 0 && (
                        <Badge
                          variant="secondary"
                          className="h-5 gap-1 bg-destructive/10 px-1.5 text-[10px] text-destructive"
                        >
                          <Trash2 className="h-2.5 w-2.5" />
                          {pendingDeletes.size} deletion
                          {pendingDeletes.size > 1 ? "s" : ""}
                        </Badge>
                      )}
                    </div>
                  )}

                  {/* Right: apply / discard / dismiss */}
                  <div className="ml-auto flex items-center gap-1">
                    {hasPendingChanges && (
                      <>
                        <Button
                          size="sm"
                          className="h-6 gap-1 bg-emerald-600 px-2.5 text-[11px] text-white hover:bg-emerald-500"
                          onClick={() => void applyChanges()}
                          disabled={applyingChanges}
                        >
                          {applyingChanges ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Check className="h-3 w-3" />
                          )}
                          Apply
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 gap-1 px-2 text-[11px] text-muted-foreground"
                          onClick={discardChanges}
                          disabled={applyingChanges}
                        >
                          <Undo2 className="h-3 w-3" />
                          Discard
                        </Button>
                      </>
                    )}
                    {!hasPendingChanges && selectedRowIdx !== null && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-1.5 text-muted-foreground"
                        onClick={() => setSelectedRowIdx(null)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Results table */}
              <div
                ref={resultContainerRef}
                className="flex-1 overflow-auto"
                onScroll={(e) => {
                  setResultScrollTop(e.currentTarget.scrollTop);
                }}
              >
                {activeTab?.running ? (
                  <div className="p-3">
                    <div className="space-y-1">
                      {Array.from({ length: 8 }).map((_, i) => (
                        <Skeleton
                          key={i}
                          className="h-7 w-full"
                          style={{ opacity: 1 - i * 0.1 }}
                        />
                      ))}
                    </div>
                  </div>
                ) : activeTab?.result?.columns?.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {activeTab.result.columns.map((col) => (
                          <TableHead
                            key={col}
                            className="sticky top-0 z-10 whitespace-nowrap bg-muted/40 text-xs font-medium backdrop-blur-sm"
                          >
                            {col}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {shouldVirtualize && virtualStart > 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={activeTab.result.columns.length}
                            style={{ height: virtualStart * rowHeightPx }}
                          />
                        </TableRow>
                      ) : null}
                      {visibleRows.map((row, localIdx) => {
                        const idx = shouldVirtualize
                          ? virtualStart + localIdx
                          : localIdx;
                        const isPendingDelete = pendingDeletes.has(idx);
                        return (
                          <TableRow
                            key={idx}
                            className={cn(
                              "cursor-pointer transition-colors",
                              isPendingDelete
                                ? "bg-destructive/5 hover:bg-destructive/10"
                                : selectedRowIdx === idx
                                  ? "bg-primary/10 hover:bg-primary/15"
                                  : "hover:bg-muted/30",
                            )}
                            onClick={() =>
                              setSelectedRowIdx(
                                selectedRowIdx === idx ? null : idx,
                              )
                            }
                          >
                            {activeTab.result!.columns.map((col) => {
                              const cellKey = `${idx}:${col}`;
                              const pendingEdit = pendingEdits.get(cellKey);
                              const isEditing =
                                editingCell?.rowIdx === idx &&
                                editingCell?.col === col;

                              // Show pending value if it exists, otherwise original
                              const displayValue =
                                pendingEdit !== undefined
                                  ? pendingEdit.newValue === null
                                    ? "NULL"
                                    : typeof pendingEdit.newValue === "object"
                                      ? JSON.stringify(pendingEdit.newValue)
                                      : String(pendingEdit.newValue)
                                  : typeof row[col] === "object"
                                    ? JSON.stringify(row[col])
                                    : String(row[col] ?? "");

                              return (
                                <TableCell
                                  key={cellKey}
                                  className="mono max-w-[300px] whitespace-nowrap p-0 text-xs"
                                >
                                  {isEditing ? (
                                    <input
                                      className="mono h-full w-full min-w-[80px] border-2 border-primary bg-primary/5 px-2 py-1.5 text-xs outline-none"
                                      value={editingCell.value}
                                      disabled={editingCell.saving}
                                      autoFocus
                                      onClick={(e) => e.stopPropagation()}
                                      onChange={(e) =>
                                        setEditingCell({
                                          ...editingCell,
                                          value: e.currentTarget.value,
                                        })
                                      }
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          e.preventDefault();
                                          storePendingEdit(editingCell);
                                        }
                                        if (e.key === "Escape") {
                                          setEditingCell(null);
                                        }
                                      }}
                                      onBlur={() => {
                                        if (!savePendingRef.current) {
                                          storePendingEdit(editingCell);
                                        }
                                      }}
                                    />
                                  ) : (
                                    <div
                                      className={cn(
                                        "truncate px-2 py-1.5",
                                        isPendingDelete &&
                                          "line-through text-muted-foreground/40 decoration-destructive/60",
                                        !isPendingDelete &&
                                          pendingEdit !== undefined &&
                                          "bg-amber-500/8 text-amber-200",
                                      )}
                                      onDoubleClick={(e) => {
                                        if (isPendingDelete) return;
                                        e.stopPropagation();
                                        // Edit the pending value if it exists
                                        const editValue =
                                          pendingEdit !== undefined
                                            ? String(
                                                pendingEdit.newValue ?? "",
                                              )
                                            : displayValue;
                                        setEditingCell({
                                          rowIdx: idx,
                                          col,
                                          value: editValue,
                                          saving: false,
                                        });
                                      }}
                                      title={
                                        isPendingDelete
                                          ? "Marked for deletion"
                                          : "Double-click to edit"
                                      }
                                    >
                                      {displayValue}
                                    </div>
                                  )}
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        );
                      })}
                      {shouldVirtualize && virtualEnd < resultRows.length ? (
                        <TableRow>
                          <TableCell
                            colSpan={activeTab.result.columns.length}
                            style={{ height: (resultRows.length - virtualEnd) * rowHeightPx }}
                          />
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <div className="text-center">
                      <Table2 className="mx-auto h-10 w-10 text-muted-foreground/15" />
                      <p className="mt-2 text-xs text-muted-foreground/40">
                        {activeTab?.result?.message ??
                          "Run a query to see results"}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* History / Snippets */}
              <div className="h-[180px] flex-shrink-0 border-t border-border/50">
                <Tabs defaultValue="history" className="flex h-full flex-col">
                  <div className="flex items-center border-b border-border/30 px-3">
                    <TabsList className="h-8 gap-1 bg-transparent p-0">
                      <TabsTrigger
                        value="history"
                        className="h-7 gap-1.5 rounded-md px-2.5 text-[11px] data-[state=active]:bg-muted/60"
                      >
                        <Clock className="h-3 w-3" />
                        History
                      </TabsTrigger>
                      <TabsTrigger
                        value="snippets"
                        className="h-7 gap-1.5 rounded-md px-2.5 text-[11px] data-[state=active]:bg-muted/60"
                      >
                        <Code2 className="h-3 w-3" />
                        Snippets
                      </TabsTrigger>
                      <TabsTrigger
                        value="audit"
                        className="h-7 gap-1.5 rounded-md px-2.5 text-[11px] data-[state=active]:bg-muted/60"
                      >
                        <Check className="h-3 w-3" />
                        Audit
                      </TabsTrigger>
                      <TabsTrigger
                        value="logs"
                        className="h-7 gap-1.5 rounded-md px-2.5 text-[11px] data-[state=active]:bg-muted/60"
                      >
                        <Clock className="h-3 w-3" />
                        Logs
                      </TabsTrigger>
                    </TabsList>
                  </div>
                  <TabsContent
                    value="history"
                    className="mt-0 flex-1 overflow-hidden p-0"
                  >
                    <ScrollArea className="h-full">
                      <div className="p-1.5">
                        {historySql.length > 0 ? (
                          historySql.map((sql, idx) => (
                            <button
                              key={`${idx}-${sql}`}
                              className="mono mb-0.5 block w-full truncate rounded-md px-2 py-1 text-left text-[11px] text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                              onClick={() =>
                                activeTab &&
                                updateTab(activeTab.id, { sql })
                              }
                              title={sql}
                            >
                              {sql}
                            </button>
                          ))
                        ) : (
                          <p className="py-4 text-center text-[11px] text-muted-foreground/40">
                            No query history
                          </p>
                        )}
                      </div>
                    </ScrollArea>
                  </TabsContent>
                  <TabsContent
                    value="snippets"
                    className="mt-0 flex-1 overflow-hidden p-0"
                  >
                    <ScrollArea className="h-full">
                      <div className="p-1.5">
                        {snippets.length > 0 ? (
                          snippets.map((snippet) => (
                            <div
                              key={snippet.id}
                              className="group mb-0.5 flex items-center gap-2 rounded-md px-2 py-1 hover:bg-muted/50"
                            >
                              <button
                                className="mono min-w-0 flex-1 truncate text-left text-[11px] text-muted-foreground hover:text-foreground"
                                onClick={() =>
                                  activeTab &&
                                  updateTab(activeTab.id, {
                                    sql: snippet.sql,
                                  })
                                }
                                title={snippet.sql}
                              >
                                {snippet.name}
                              </button>
                              <button
                                className="rounded-md p-0.5 opacity-0 transition-opacity hover:bg-destructive/20 group-hover:opacity-100"
                                onClick={async () => {
                                  await api.snippetDelete(snippet.id);
                                  void loadWorkspace();
                                }}
                              >
                                <Trash2 className="h-3 w-3 text-muted-foreground" />
                              </button>
                            </div>
                          ))
                        ) : (
                          <p className="py-4 text-center text-[11px] text-muted-foreground/40">
                            No saved snippets
                          </p>
                        )}
                      </div>
                    </ScrollArea>
                  </TabsContent>
                  <TabsContent
                    value="audit"
                    className="mt-0 flex-1 overflow-hidden p-0"
                  >
                    <ScrollArea className="h-full">
                      <div className="p-1.5">
                        {auditItems.length > 0 ? (
                          auditItems.map((item) => (
                            <div
                              key={item.id}
                              className="mb-0.5 rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted/40"
                              title={item.payloadJson ?? ""}
                            >
                              <div className="truncate font-medium text-foreground/80">
                                {item.action} · {item.target}
                              </div>
                              <div className="truncate text-[10px]">
                                {item.createdAt}
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="py-4 text-center text-[11px] text-muted-foreground/40">
                            No audit records
                          </p>
                        )}
                      </div>
                    </ScrollArea>
                  </TabsContent>
                  <TabsContent
                    value="logs"
                    className="mt-0 flex-1 overflow-hidden p-0"
                  >
                    <ScrollArea className="h-full">
                      <div className="p-1.5">
                        {appLogs.length > 0 ? (
                          appLogs.map((item) => (
                            <div
                              key={item.id}
                              className="mb-0.5 rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted/40"
                              title={item.contextJson ?? ""}
                            >
                              <div className="truncate font-medium text-foreground/80">
                                [{item.level}] {item.category}
                              </div>
                              <div className="truncate text-[10px]">
                                {item.message}
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="py-4 text-center text-[11px] text-muted-foreground/40">
                            No app logs
                          </p>
                        )}
                      </div>
                    </ScrollArea>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </>
        )}
      </main>

      {/* ── Connection Dialog ── */}
      <Dialog
        open={connectionDialogOpen}
        onOpenChange={setConnectionDialogOpen}
      >
        <DialogContent className="border-border/60 sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>
              {connectionDraft.id ? "Edit" : "New"} Connection
            </DialogTitle>
            <DialogDescription>
              Password is stored securely in your OS keychain.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Name
              </label>
              <Input
                placeholder="My ClickHouse Server"
                value={connectionDraft.name}
                onChange={(e) => {
                  const value = e.currentTarget.value;
                  setConnectionDraft((v) => ({ ...v, name: value }));
                }}
              />
            </div>
            <div className="grid grid-cols-[1fr_100px] gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Host
                </label>
                <Input
                  placeholder="localhost"
                  value={connectionDraft.host}
                  onChange={(e) => {
                    const value = e.currentTarget.value;
                    setConnectionDraft((v) => ({ ...v, host: value }));
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Port
                </label>
                <Input
                  type="number"
                  value={connectionDraft.port}
                  onChange={(e) => {
                    const value = Number(e.currentTarget.value) || 8123;
                    setConnectionDraft((v) => ({ ...v, port: value }));
                  }}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Database
              </label>
              <Input
                placeholder="default"
                value={connectionDraft.database}
                onChange={(e) => {
                  const value = e.currentTarget.value;
                  setConnectionDraft((v) => ({ ...v, database: value }));
                }}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Username
                </label>
                <Input
                  placeholder="default"
                  value={connectionDraft.username}
                  onChange={(e) => {
                    const value = e.currentTarget.value;
                    setConnectionDraft((v) => ({ ...v, username: value }));
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Password
                </label>
                <Input
                  type="password"
                  placeholder="••••••"
                  value={connectionDraft.password ?? ""}
                  onChange={(e) => {
                    const value = e.currentTarget.value;
                    setConnectionDraft((v) => ({ ...v, password: value }));
                  }}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2.5 rounded-md border border-border/60 px-3 py-2">
                <input
                  id="secure-checkbox"
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded border-border accent-primary"
                  checked={connectionDraft.secure}
                  onChange={(e) => {
                    const checked = e.currentTarget.checked;
                    setConnectionDraft((v) => ({ ...v, secure: checked }));
                  }}
                />
                <label
                  htmlFor="secure-checkbox"
                  className="text-xs text-foreground/80"
                >
                  Use HTTPS
                </label>
              </div>
              <div className="flex items-center gap-2.5 rounded-md border border-border/60 px-3 py-2">
                <input
                  id="tls-insecure-checkbox"
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded border-border accent-primary"
                  checked={Boolean(connectionDraft.tlsInsecureSkipVerify)}
                  onChange={(e) => {
                    const checked = e.currentTarget.checked;
                    setConnectionDraft((v) => ({
                      ...v,
                      tlsInsecureSkipVerify: checked,
                    }));
                  }}
                />
                <label
                  htmlFor="tls-insecure-checkbox"
                  className="text-xs text-foreground/80"
                >
                  Skip TLS Verify
                </label>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  CA Cert Path (optional)
                </label>
                <Input
                  placeholder="C:\\certs\\clickhouse-ca.pem"
                  value={connectionDraft.caCertPath ?? ""}
                  onChange={(e) => {
                    const value = e.currentTarget.value;
                    setConnectionDraft((v) => ({ ...v, caCertPath: value }));
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Timeout (ms)
                </label>
                <Input
                  type="number"
                  value={connectionDraft.timeoutMs ?? 30000}
                  onChange={(e) => {
                    const value = Number(e.currentTarget.value) || 30000;
                    setConnectionDraft((v) => ({ ...v, timeoutMs: value }));
                  }}
                />
              </div>
            </div>
            <div className="rounded-md border border-border/60 p-2">
              <div className="mb-2 text-[11px] font-medium text-muted-foreground">
                SSH Tunnel Profile (optional metadata)
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="SSH Host"
                  value={connectionDraft.sshTunnel?.host ?? ""}
                  onChange={(e) => {
                    const host = e.currentTarget.value;
                    setConnectionDraft((v) => ({
                      ...v,
                      sshTunnel: { ...(v.sshTunnel ?? {}), enabled: true, host },
                    }));
                  }}
                />
                <Input
                  placeholder="SSH Port"
                  type="number"
                  value={connectionDraft.sshTunnel?.port ?? 22}
                  onChange={(e) => {
                    const port = Number(e.currentTarget.value) || 22;
                    setConnectionDraft((v) => ({
                      ...v,
                      sshTunnel: { ...(v.sshTunnel ?? {}), enabled: true, port },
                    }));
                  }}
                />
                <Input
                  placeholder="SSH Username"
                  value={connectionDraft.sshTunnel?.username ?? ""}
                  onChange={(e) => {
                    const username = e.currentTarget.value;
                    setConnectionDraft((v) => ({
                      ...v,
                      sshTunnel: {
                        ...(v.sshTunnel ?? {}),
                        enabled: true,
                        username,
                      },
                    }));
                  }}
                />
                <Input
                  placeholder="Local Port"
                  type="number"
                  value={connectionDraft.sshTunnel?.localPort ?? 8123}
                  onChange={(e) => {
                    const localPort = Number(e.currentTarget.value) || 8123;
                    setConnectionDraft((v) => ({
                      ...v,
                      sshTunnel: {
                        ...(v.sshTunnel ?? {}),
                        enabled: true,
                        localPort,
                      },
                    }));
                  }}
                />
              </div>
            </div>
            {diagnostics ? (
              <div
                className={cn(
                  "rounded-md border px-2 py-1.5 text-[11px]",
                  diagnostics.ok
                    ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-200"
                    : "border-amber-500/30 bg-amber-500/5 text-amber-200",
                )}
              >
                <div className="font-medium">
                  {diagnostics.ok ? "Diagnostics OK" : "Diagnostics failed"} (
                  {diagnostics.category}) · {diagnostics.latencyMs}ms
                </div>
                <div className="truncate text-[10px]">
                  {diagnostics.serverVersion
                    ? `version=${diagnostics.serverVersion}`
                    : diagnostics.detail}
                </div>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              disabled={!isTauriRuntime || runningDiagnostics}
              onClick={async () => {
                setRunningDiagnostics(true);
                try {
                  const result = await api.connectionDiagnostics(connectionDraft);
                  setDiagnostics(result);
                  if (result.ok) {
                    toast.success("Diagnostics passed.");
                  } else {
                    toast.error(`Diagnostics failed (${result.category}).`);
                  }
                } catch (error) {
                  toast.error(String(error));
                } finally {
                  setRunningDiagnostics(false);
                }
              }}
            >
              {runningDiagnostics && (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              )}
              Diagnose
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!isTauriRuntime || testingConnection}
              onClick={async () => {
                setTestingConnection(true);
                try {
                  toast.success(
                    (await api.connectionTest(connectionDraft)).message,
                  );
                } catch (error) {
                  toast.error(String(error));
                } finally {
                  setTestingConnection(false);
                }
              }}
            >
              {testingConnection && (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              )}
              Test Connection
            </Button>
            <Button
              size="sm"
              disabled={!isTauriRuntime || savingConnection}
              onClick={async () => {
                const isDuplicate = connections.some(
                  (c) =>
                    c.id !== connectionDraft.id &&
                    c.host.toLowerCase() ===
                      connectionDraft.host.trim().toLowerCase() &&
                    c.port === connectionDraft.port &&
                    c.database.toLowerCase() ===
                      connectionDraft.database.trim().toLowerCase() &&
                    c.username.toLowerCase() ===
                      connectionDraft.username.trim().toLowerCase(),
                );
                if (isDuplicate) {
                  toast.error(
                    "A connection with the same host, port, database, and username already exists.",
                  );
                  return;
                }
                setSavingConnection(true);
                try {
                  await api.connectionSave(connectionDraft);
                  setConnectionDialogOpen(false);
                  toast.success("Connection saved.");
                  await loadConnections();
                } catch (error) {
                  toast.error(String(error));
                } finally {
                  setSavingConnection(false);
                }
              }}
            >
              {savingConnection && (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              )}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default App;
