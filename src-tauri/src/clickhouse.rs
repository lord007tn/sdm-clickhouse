use std::fs;
use std::time::Duration;

use anyhow::{anyhow, Context};
use serde::Deserialize;
use serde_json::Value;

use crate::models::{ConnectionProfile, QueryStats};

#[derive(Debug, Clone)]
pub enum QueryKind {
    Select,
    ShowLike,
    Mutation,
    Ddl,
    Other,
}

#[derive(Debug, Clone)]
pub struct QueryFrame {
    pub columns: Vec<String>,
    pub rows: Vec<Value>,
    pub total_rows: u64,
    pub message: Option<String>,
    pub stats: Option<QueryStats>,
}

#[derive(Debug, Deserialize)]
struct ClickHouseMetaColumn {
    name: String,
}

#[derive(Debug, Deserialize)]
struct ClickHouseStatistics {
    elapsed: Option<f64>,
    rows_read: Option<u64>,
    bytes_read: Option<u64>,
}

#[derive(Debug, Deserialize)]
struct ClickHouseJsonResponse {
    meta: Option<Vec<ClickHouseMetaColumn>>,
    data: Option<Vec<Value>>,
    rows: Option<u64>,
    statistics: Option<ClickHouseStatistics>,
}

pub fn identify_query_kind(sql: &str) -> QueryKind {
    let first = sql
        .trim_start()
        .split_whitespace()
        .next()
        .unwrap_or_default()
        .to_ascii_lowercase();

    match first.as_str() {
        "select" | "with" => QueryKind::Select,
        "show" | "describe" | "desc" | "explain" => QueryKind::ShowLike,
        "insert" | "update" | "delete" | "alter" => QueryKind::Mutation,
        "create" | "drop" | "truncate" | "rename" => QueryKind::Ddl,
        _ => QueryKind::Other,
    }
}

pub fn quote_ident(input: &str) -> String {
    format!("`{}`", input.replace('`', "``"))
}

pub fn validate_identifier(input: &str) -> bool {
    let mut chars = input.chars();
    match chars.next() {
        Some(ch) if ch.is_ascii_alphabetic() || ch == '_' => {}
        _ => return false,
    }
    chars.all(|ch| ch.is_ascii_alphanumeric() || ch == '_')
}

pub fn value_to_sql(value: &Value) -> String {
    match value {
        Value::Null => "NULL".to_string(),
        Value::Bool(v) => {
            if *v {
                "1".to_string()
            } else {
                "0".to_string()
            }
        }
        Value::Number(v) => v.to_string(),
        Value::String(v) => format!("'{}'", v.replace('\'', "''")),
        Value::Array(_) | Value::Object(_) => {
            format!("'{}'", value.to_string().replace('\'', "''"))
        }
    }
}

pub fn strip_trailing_semicolon(sql: &str) -> &str {
    sql.trim().trim_end_matches(';').trim()
}

pub fn ensure_json_format(sql: &str) -> String {
    let lowered = sql.to_ascii_lowercase();
    if lowered.contains(" format json") {
        sql.to_string()
    } else {
        format!("{} FORMAT JSON", strip_trailing_semicolon(sql))
    }
}

pub fn paginate_select_sql(sql: &str, page: u32, page_size: u32) -> String {
    let safe_page = page.max(1);
    let safe_size = page_size.clamp(1, 5000);
    let offset = (safe_page - 1) * safe_size;
    format!(
        "SELECT * FROM ({}) AS _sdm_clickhouse_q LIMIT {} OFFSET {}",
        strip_trailing_semicolon(sql),
        safe_size,
        offset
    )
}

fn build_clickhouse_url(profile: &ConnectionProfile) -> anyhow::Result<reqwest::Url> {
    let scheme = if profile.secure { "https" } else { "http" };
    let mut url = reqwest::Url::parse(&format!("{scheme}://localhost/"))
        .context("failed to build clickhouse URL")?;

    url.set_host(Some(&profile.host))
        .map_err(|_| anyhow!("invalid clickhouse host '{}'", profile.host))?;
    url.set_port(Some(profile.port))
        .map_err(|_| anyhow!("invalid clickhouse port '{}'", profile.port))?;
    url.set_path("/");

    Ok(url)
}

fn build_clickhouse_client(profile: &ConnectionProfile) -> anyhow::Result<reqwest::Client> {
    let mut builder = reqwest::Client::builder();
    if profile.tls_insecure_skip_verify {
        builder = builder.danger_accept_invalid_certs(true);
    }
    if let Some(ca_path) = profile
        .ca_cert_path
        .as_ref()
        .map(|v| v.trim())
        .filter(|v| !v.is_empty())
    {
        let pem = fs::read(ca_path)
            .with_context(|| format!("failed to read CA certificate file: {}", ca_path))?;
        let cert =
            reqwest::Certificate::from_pem(&pem).context("invalid PEM in CA certificate file")?;
        builder = builder.add_root_certificate(cert);
    }
    builder
        .build()
        .context("failed to build ClickHouse HTTP client")
}

pub async fn execute_sql_text(
    profile: &ConnectionProfile,
    password: &str,
    sql: &str,
    timeout_ms: u64,
    query_id: Option<&str>,
) -> anyhow::Result<String> {
    let client = build_clickhouse_client(profile)?;
    let url = build_clickhouse_url(profile)?;
    let timeout = Duration::from_millis(timeout_ms.max(1000));
    let mut query_params: Vec<(&str, String)> = Vec::with_capacity(2);
    query_params.push(("database", profile.database.clone()));
    if let Some(id) = query_id {
        query_params.push(("query_id", id.to_string()));
    }

    let response = client
        .post(url)
        .basic_auth(&profile.username, Some(password))
        .query(&query_params)
        .timeout(timeout)
        .body(sql.to_string())
        .send()
        .await
        .context("failed to call clickhouse endpoint")?;

    let status = response.status();
    let payload = response
        .text()
        .await
        .context("failed to read clickhouse response body")?;
    if !status.is_success() {
        anyhow::bail!("ClickHouse error {}: {}", status.as_u16(), payload);
    }
    Ok(payload)
}

pub async fn execute_sql_json(
    profile: &ConnectionProfile,
    password: &str,
    sql: &str,
    timeout_ms: u64,
    query_id: Option<&str>,
) -> anyhow::Result<QueryFrame> {
    let payload = execute_sql_text(profile, password, sql, timeout_ms, query_id).await?;
    let parsed: ClickHouseJsonResponse =
        serde_json::from_str(&payload).context("failed to parse clickhouse JSON format payload")?;

    let columns = parsed
        .meta
        .unwrap_or_default()
        .into_iter()
        .map(|m| m.name)
        .collect::<Vec<_>>();
    let rows = parsed.data.unwrap_or_default();
    let total_rows = parsed.rows.unwrap_or(rows.len() as u64);
    let stats = parsed.statistics.map(|s| QueryStats {
        elapsed_seconds: s.elapsed,
        rows_read: s.rows_read,
        bytes_read: s.bytes_read,
    });

    Ok(QueryFrame {
        columns,
        rows,
        total_rows,
        message: None,
        stats,
    })
}
