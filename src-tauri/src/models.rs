use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SshTunnelProfile {
    pub enabled: bool,
    pub host: Option<String>,
    pub port: Option<u16>,
    pub username: Option<String>,
    pub local_port: Option<u16>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionProfile {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub database: String,
    pub username: String,
    pub secure: bool,
    pub tls_insecure_skip_verify: bool,
    pub ca_cert_path: Option<String>,
    pub ssh_tunnel: Option<SshTunnelProfile>,
    pub timeout_ms: u64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionInput {
    pub id: Option<String>,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub database: String,
    pub username: String,
    pub secure: bool,
    pub tls_insecure_skip_verify: Option<bool>,
    pub ca_cert_path: Option<String>,
    pub ssh_tunnel: Option<SshTunnelProfile>,
    pub timeout_ms: Option<u64>,
    pub password: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QueryRequest {
    pub connection_id: String,
    pub sql: String,
    pub client_query_id: Option<String>,
    pub page: Option<u32>,
    pub page_size: Option<u32>,
    pub timeout_ms: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QueryStats {
    pub elapsed_seconds: Option<f64>,
    pub rows_read: Option<u64>,
    pub bytes_read: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QueryResult {
    pub query_id: String,
    pub columns: Vec<String>,
    pub rows: Vec<Value>,
    pub row_count: u64,
    pub page: u32,
    pub page_size: u32,
    pub duration_ms: u64,
    pub message: Option<String>,
    pub stats: Option<QueryStats>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryItem {
    pub id: i64,
    pub connection_id: String,
    pub sql: String,
    pub status: String,
    pub duration_ms: Option<u64>,
    pub error_message: Option<String>,
    pub executed_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SnippetItem {
    pub id: String,
    pub name: String,
    pub sql: String,
    pub connection_id: Option<String>,
    pub tags: Vec<String>,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SnippetInput {
    pub id: Option<String>,
    pub name: String,
    pub sql: String,
    pub connection_id: Option<String>,
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MutationRequest {
    pub connection_id: String,
    pub database: String,
    pub table: String,
    pub where_clause: String,
    pub set_values: Option<Value>,
    pub row: Option<Value>,
    pub confirm_token: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DdlRequest {
    pub connection_id: String,
    pub database: String,
    pub table: Option<String>,
    pub if_exists: Option<bool>,
    pub if_not_exists: Option<bool>,
    pub columns_ddl: Option<String>,
    pub engine: Option<String>,
    pub confirm_token: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CountPreview {
    pub affected_rows: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandMessage {
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionDiagnostics {
    pub ok: bool,
    pub category: String,
    pub latency_ms: u64,
    pub server_version: Option<String>,
    pub detail: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionExport {
    pub version: u32,
    pub exported_at: String,
    pub connections: Vec<ConnectionProfile>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuditItem {
    pub id: i64,
    pub connection_id: Option<String>,
    pub action: String,
    pub target: String,
    pub payload_json: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppLogItem {
    pub id: i64,
    pub level: String,
    pub category: String,
    pub message: String,
    pub context_json: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCheckResult {
    pub available: bool,
    pub current_version: String,
    pub latest_version: Option<String>,
    pub asset_name: Option<String>,
    pub download_url: Option<String>,
    pub sha256: Option<String>,
    pub target: String,
    pub downloaded: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateDownloadResult {
    pub message: String,
    pub version: String,
    pub asset_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateDownloadProgress {
    pub status: String,
    pub version: Option<String>,
    pub asset_name: Option<String>,
    pub downloaded_bytes: u64,
    pub total_bytes: Option<u64>,
    pub progress_percent: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OverviewDatum {
    pub name: String,
    pub value: f64,
    pub secondary_value: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClickHouseOverview {
    pub generated_at: String,
    pub server_version: String,
    pub database_count: u64,
    pub table_count: u64,
    pub active_part_count: u64,
    pub active_query_count: u64,
    pub pending_mutation_count: u64,
    pub total_rows: f64,
    pub total_bytes: f64,
    pub storage_by_database: Vec<OverviewDatum>,
    pub tables_by_engine: Vec<OverviewDatum>,
    pub hottest_tables_by_parts: Vec<OverviewDatum>,
    pub active_queries_by_user: Vec<OverviewDatum>,
}
