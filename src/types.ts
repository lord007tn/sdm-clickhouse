export type SshTunnelProfile = {
  enabled: boolean;
  host?: string;
  port?: number;
  username?: string;
  localPort?: number;
};

export type ConnectionProfile = {
  id: string;
  name: string;
  host: string;
  port: number;
  database: string;
  username: string;
  secure: boolean;
  tlsInsecureSkipVerify: boolean;
  caCertPath?: string;
  sshTunnel?: SshTunnelProfile;
  timeoutMs: number;
  createdAt: string;
  updatedAt: string;
};

export type ConnectionInput = {
  id?: string;
  name: string;
  host: string;
  port: number;
  database: string;
  username: string;
  secure: boolean;
  tlsInsecureSkipVerify?: boolean;
  caCertPath?: string;
  sshTunnel?: SshTunnelProfile;
  timeoutMs?: number;
  password?: string;
};

export type QueryRequest = {
  connectionId: string;
  sql: string;
  clientQueryId?: string;
  page?: number;
  pageSize?: number;
  timeoutMs?: number;
};

export type QueryStats = {
  elapsedSeconds?: number;
  rowsRead?: number;
  bytesRead?: number;
};

export type QueryResult = {
  queryId: string;
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  page: number;
  pageSize: number;
  durationMs: number;
  message?: string;
  stats?: QueryStats;
};

export type HistoryItem = {
  id: number;
  connectionId: string;
  sql: string;
  status: string;
  durationMs?: number;
  errorMessage?: string;
  executedAt: string;
};

export type SnippetItem = {
  id: string;
  name: string;
  sql: string;
  connectionId?: string;
  tags: string[];
  updatedAt: string;
};

export type SnippetInput = {
  id?: string;
  name: string;
  sql: string;
  connectionId?: string;
  tags?: string[];
};

export type CountPreview = {
  affectedRows: number;
};

export type CommandMessage = {
  message: string;
};

export type ConnectionDiagnostics = {
  ok: boolean;
  category: string;
  latencyMs: number;
  serverVersion?: string;
  detail: string;
};

export type AuditItem = {
  id: number;
  connectionId?: string;
  action: string;
  target: string;
  payloadJson?: string;
  createdAt: string;
};

export type AppLogItem = {
  id: number;
  level: string;
  category: string;
  message: string;
  contextJson?: string;
  createdAt: string;
};

export type MutationRequest = {
  connectionId: string;
  database: string;
  table: string;
  whereClause: string;
  setValues?: Record<string, unknown>;
  row?: Record<string, unknown>;
  confirmToken?: string;
};

export type DdlRequest = {
  connectionId: string;
  database: string;
  table?: string;
  ifExists?: boolean;
  ifNotExists?: boolean;
  columnsDdl?: string;
  engine?: string;
  confirmToken?: string;
};
