use std::time::Instant;
use std::{fs, path::PathBuf};

use keyring::Entry;
use serde_json::Value;
use tauri::State;
use uuid::Uuid;

use crate::clickhouse::{
    ensure_json_format, execute_sql_json, execute_sql_text, identify_query_kind,
    paginate_select_sql, quote_ident, strip_trailing_semicolon, validate_identifier, value_to_sql,
    QueryKind,
};
use crate::db;
use crate::models::{
    AppLogItem, AuditItem, CommandMessage, ConnectionDiagnostics, ConnectionExport, ConnectionInput,
    ConnectionProfile, CountPreview, DdlRequest, HistoryItem, MutationRequest, QueryRequest,
    QueryResult, SnippetInput, SnippetItem,
};
use crate::AppState;

const KEYRING_SERVICE: &str = "simple-sdm-clickhouse";

fn into_message(err: anyhow::Error) -> String {
    err.to_string()
}

fn classify_error(message: &str) -> &'static str {
    let lowered = message.to_ascii_lowercase();
    if lowered.contains("401")
        || lowered.contains("403")
        || lowered.contains("authentication")
        || lowered.contains("password")
        || lowered.contains("unauthorized")
    {
        "auth"
    } else if lowered.contains("timeout")
        || lowered.contains("connection")
        || lowered.contains("dns")
        || lowered.contains("failed to call clickhouse endpoint")
    {
        "network"
    } else if lowered.contains("parse")
        || lowered.contains("syntax")
        || lowered.contains("exception")
    {
        "query"
    } else {
        "unknown"
    }
}

fn format_categorized_error(err: anyhow::Error) -> String {
    let msg = err.to_string();
    let category = classify_error(&msg);
    format!("[{}] {}", category, msg)
}

fn write_app_log(
    state: &State<'_, AppState>,
    level: &str,
    category: &str,
    message: &str,
    context_json: Option<&str>,
) {
    let _ = db::insert_app_log(&state.db_path, level, category, message, context_json);
}

fn write_audit(
    state: &State<'_, AppState>,
    connection_id: Option<&str>,
    action: &str,
    target: &str,
    payload_json: Option<&str>,
) {
    let _ = db::insert_audit_log(&state.db_path, connection_id, action, target, payload_json);
}

fn keyring_entry(connection_id: &str) -> anyhow::Result<Entry> {
    let entry = Entry::new(KEYRING_SERVICE, connection_id)?;
    Ok(entry)
}

fn read_secret(connection_id: &str) -> anyhow::Result<String> {
    let entry = keyring_entry(connection_id)?;
    let secret = entry
        .get_password()
        .map_err(|_| anyhow::anyhow!("missing secret for connection {}", connection_id))?;
    Ok(secret)
}

fn write_secret(connection_id: &str, password: &str) -> anyhow::Result<()> {
    let entry = keyring_entry(connection_id)?;
    entry.set_password(password)?;
    Ok(())
}

fn delete_secret(connection_id: &str) {
    if let Ok(entry) = keyring_entry(connection_id) {
        let _ = entry.delete_credential();
    }
}

fn normalize_connection_endpoint(
    raw_host: &str,
    fallback_port: u16,
    fallback_secure: bool,
) -> anyhow::Result<(String, u16, bool)> {
    let trimmed = raw_host.trim();
    if trimmed.is_empty() {
        anyhow::bail!("Host is required.");
    }

    let (parsed, secure) = if trimmed.contains("://") {
        let parsed = reqwest::Url::parse(trimmed)
            .map_err(|_| anyhow::anyhow!("Host URL is invalid. Use http:// or https://."))?;
        let secure = match parsed.scheme() {
            "http" => false,
            "https" => true,
            _ => anyhow::bail!("Host URL must use http:// or https://."),
        };
        (parsed, secure)
    } else {
        let with_scheme = format!("http://{}", trimmed);
        let parsed =
            reqwest::Url::parse(&with_scheme).map_err(|_| anyhow::anyhow!("Host is invalid."))?;
        (parsed, fallback_secure)
    };

    let host = parsed
        .host_str()
        .ok_or_else(|| anyhow::anyhow!("Host is invalid."))?
        .to_string();
    let port = parsed.port().unwrap_or(fallback_port);

    Ok((host, port, secure))
}

fn get_connection_with_secret(
    state: &State<'_, AppState>,
    connection_id: &str,
) -> anyhow::Result<(ConnectionProfile, String)> {
    let profile = db::get_connection(&state.db_path, connection_id)?;
    let password = read_secret(connection_id)?;
    Ok((profile, password))
}

#[tauri::command]
pub fn connection_list(state: State<'_, AppState>) -> Result<Vec<ConnectionProfile>, String> {
    db::list_connections(&state.db_path).map_err(into_message)
}

#[tauri::command]
pub fn connection_delete(
    state: State<'_, AppState>,
    connection_id: String,
) -> Result<CommandMessage, String> {
    db::delete_connection(&state.db_path, &connection_id)
        .map_err(into_message)
        .map(|_| {
            delete_secret(&connection_id);
            CommandMessage {
                message: "Connection deleted.".to_string(),
            }
        })
}

#[tauri::command]
pub fn connection_save(
    state: State<'_, AppState>,
    payload: ConnectionInput,
) -> Result<ConnectionProfile, String> {
    if payload.name.trim().is_empty()
        || payload.host.trim().is_empty()
        || payload.database.trim().is_empty()
        || payload.username.trim().is_empty()
    {
        return Err("Name, host, database and username are required.".to_string());
    }
    let password = payload.password.clone().unwrap_or_default();
    let has_password = !password.trim().is_empty();
    if payload.id.is_none() && !has_password {
        return Err("Password is required when creating a new connection.".to_string());
    }

    let (host, port, secure) =
        normalize_connection_endpoint(&payload.host, payload.port, payload.secure)
            .map_err(into_message)?;
    let mut normalized = payload.clone();
    normalized.host = host;
    normalized.port = port;
    normalized.secure = secure;

    let profile = db::upsert_connection(&state.db_path, &normalized).map_err(into_message)?;
    if has_password {
        write_secret(&profile.id, &password).map_err(into_message)?;
    }
    Ok(profile)
}

#[tauri::command]
pub async fn connection_test(
    state: State<'_, AppState>,
    payload: ConnectionInput,
) -> Result<CommandMessage, String> {
    if payload.host.trim().is_empty()
        || payload.database.trim().is_empty()
        || payload.username.trim().is_empty()
    {
        return Err("Host, database and username are required to test a connection.".to_string());
    }
    let (host, port, secure) =
        normalize_connection_endpoint(&payload.host, payload.port, payload.secure)
            .map_err(into_message)?;
    let timeout_ms = payload.timeout_ms.unwrap_or(10_000);
    let profile = ConnectionProfile {
        id: payload.id.clone().unwrap_or_else(|| "ad-hoc".to_string()),
        name: payload.name,
        host,
        port,
        database: payload.database,
        username: payload.username,
        secure,
        tls_insecure_skip_verify: payload.tls_insecure_skip_verify.unwrap_or(false),
        ca_cert_path: payload
            .ca_cert_path
            .as_ref()
            .map(|v| v.trim().to_string())
            .filter(|v| !v.is_empty()),
        ssh_tunnel: payload.ssh_tunnel,
        timeout_ms,
        created_at: String::new(),
        updated_at: String::new(),
    };

    let password = if let Some(candidate) = payload.password {
        if candidate.trim().is_empty() {
            if let Some(id) = payload.id {
                read_secret(&id).map_err(into_message)?
            } else {
                return Err("Password is required.".to_string());
            }
        } else {
            candidate
        }
    } else if let Some(id) = payload.id {
        read_secret(&id).map_err(into_message)?
    } else {
        return Err("Password is required.".to_string());
    };

    let started = Instant::now();
    let outcome = execute_sql_json(
        &profile,
        &password,
        "SELECT 1 AS ok FORMAT JSON",
        timeout_ms,
        None,
    )
    .await;

    if let Err(err) = outcome {
        let formatted = format_categorized_error(err);
        write_app_log(
            &state,
            "error",
            "connection_test",
            &formatted,
            Some(&format!(
                "{{\"host\":\"{}\",\"port\":{},\"db\":\"{}\",\"latencyMs\":{}}}",
                profile.host,
                profile.port,
                profile.database,
                started.elapsed().as_millis()
            )),
        );
        return Err(formatted);
    }

    Ok(CommandMessage {
        message: "Connection successful.".to_string(),
    })
}

#[tauri::command]
pub async fn schema_list_databases(
    state: State<'_, AppState>,
    connection_id: String,
) -> Result<Vec<Value>, String> {
    let (profile, password) =
        get_connection_with_secret(&state, &connection_id).map_err(into_message)?;
    let frame = execute_sql_json(
        &profile,
        &password,
        "SELECT name FROM system.databases ORDER BY name FORMAT JSON",
        profile.timeout_ms,
        None,
    )
    .await
    .map_err(into_message)?;
    Ok(frame.rows)
}

#[tauri::command]
pub async fn schema_list_tables(
    state: State<'_, AppState>,
    connection_id: String,
    database: String,
) -> Result<Vec<Value>, String> {
    let (profile, password) =
        get_connection_with_secret(&state, &connection_id).map_err(into_message)?;
    let escaped = database.replace('\'', "''");
    let sql = format!(
        "SELECT database, name, engine FROM system.tables WHERE database = '{}' ORDER BY name FORMAT JSON",
        escaped
    );
    let frame = execute_sql_json(&profile, &password, &sql, profile.timeout_ms, None)
    .await
    .map_err(into_message)?;
    Ok(frame.rows)
}

#[tauri::command]
pub async fn schema_get_columns(
    state: State<'_, AppState>,
    connection_id: String,
    database: String,
    table: String,
) -> Result<Vec<Value>, String> {
    let (profile, password) =
        get_connection_with_secret(&state, &connection_id).map_err(into_message)?;
    let sql = format!(
        "SELECT database, table, name, type, default_kind, default_expression FROM system.columns WHERE database = '{}' AND table = '{}' ORDER BY position FORMAT JSON",
        database.replace('\'', "''"),
        table.replace('\'', "''")
    );
    let frame = execute_sql_json(&profile, &password, &sql, profile.timeout_ms, None)
    .await
    .map_err(into_message)?;
    Ok(frame.rows)
}

#[tauri::command]
pub async fn query_execute(
    state: State<'_, AppState>,
    request: QueryRequest,
) -> Result<QueryResult, String> {
    let (profile, password) =
        get_connection_with_secret(&state, &request.connection_id).map_err(into_message)?;
    let page = request.page.unwrap_or(1).max(1);
    let page_size = request.page_size.unwrap_or(100).clamp(1, 5000);
    let timeout_ms = request.timeout_ms.unwrap_or(profile.timeout_ms);
    let sql_clean = strip_trailing_semicolon(&request.sql);
    if sql_clean.is_empty() {
        return Err("SQL cannot be empty.".to_string());
    }

    let kind = identify_query_kind(sql_clean);
    let start = Instant::now();
    let query_id = request
        .client_query_id
        .clone()
        .unwrap_or_else(|| Uuid::new_v4().to_string());

    let result = match kind {
        QueryKind::Select => {
            let paged = paginate_select_sql(sql_clean, page, page_size);
            let query_sql = ensure_json_format(&paged);
            execute_sql_json(
                &profile,
                &password,
                &query_sql,
                timeout_ms,
                Some(&query_id),
            )
            .await
            .map(|frame| QueryResult {
                query_id: query_id.clone(),
                columns: frame.columns,
                rows: frame.rows,
                row_count: frame.total_rows,
                page,
                page_size,
                duration_ms: start.elapsed().as_millis() as u64,
                message: frame.message,
                stats: frame.stats,
            })
        }
        QueryKind::ShowLike => {
            let query_sql = ensure_json_format(sql_clean);
            execute_sql_json(
                &profile,
                &password,
                &query_sql,
                timeout_ms,
                Some(&query_id),
            )
            .await
            .map(|frame| QueryResult {
                query_id: query_id.clone(),
                columns: frame.columns,
                rows: frame.rows,
                row_count: frame.total_rows,
                page,
                page_size,
                duration_ms: start.elapsed().as_millis() as u64,
                message: frame.message,
                stats: frame.stats,
            })
        }
        _ => execute_sql_text(&profile, &password, sql_clean, timeout_ms, Some(&query_id))
        .await
        .map(|text| QueryResult {
            query_id: query_id.clone(),
            columns: Vec::new(),
            rows: Vec::new(),
            row_count: 0,
            page,
            page_size,
            duration_ms: start.elapsed().as_millis() as u64,
            message: Some(text.trim().to_string()),
            stats: None,
        }),
    };

    match result {
        Ok(data) => {
            let _ = db::insert_history(
                &state.db_path,
                &request.connection_id,
                &request.sql,
                "success",
                Some(data.duration_ms),
                None,
            );
            write_app_log(
                &state,
                "info",
                "query",
                "Query executed successfully",
                Some(&format!(
                    "{{\"connectionId\":\"{}\",\"queryId\":\"{}\",\"durationMs\":{},\"rowCount\":{}}}",
                    request.connection_id, data.query_id, data.duration_ms, data.row_count
                )),
            );
            Ok(data)
        }
        Err(err) => {
            let message = format_categorized_error(err);
            let _ = db::insert_history(
                &state.db_path,
                &request.connection_id,
                &request.sql,
                "error",
                Some(start.elapsed().as_millis() as u64),
                Some(&message),
            );
            write_app_log(
                &state,
                "error",
                "query",
                &message,
                Some(&format!(
                    "{{\"connectionId\":\"{}\",\"queryId\":\"{}\"}}",
                    request.connection_id, query_id
                )),
            );
            Err(message)
        }
    }
}

#[tauri::command]
pub fn history_list(
    state: State<'_, AppState>,
    connection_id: String,
    limit: Option<u32>,
) -> Result<Vec<HistoryItem>, String> {
    db::list_history(
        &state.db_path,
        &connection_id,
        limit.unwrap_or(100).clamp(1, 500),
    )
    .map_err(into_message)
}

#[tauri::command]
pub fn snippet_list(
    state: State<'_, AppState>,
    connection_id: Option<String>,
) -> Result<Vec<SnippetItem>, String> {
    db::list_snippets(&state.db_path, connection_id.as_deref()).map_err(into_message)
}

#[tauri::command]
pub fn snippet_save(
    state: State<'_, AppState>,
    payload: SnippetInput,
) -> Result<SnippetItem, String> {
    if payload.name.trim().is_empty() || payload.sql.trim().is_empty() {
        return Err("Snippet name and sql are required.".to_string());
    }
    db::upsert_snippet(&state.db_path, &payload).map_err(into_message)
}

#[tauri::command]
pub fn snippet_delete(
    state: State<'_, AppState>,
    snippet_id: String,
) -> Result<CommandMessage, String> {
    db::delete_snippet(&state.db_path, &snippet_id)
        .map_err(into_message)
        .map(|_| CommandMessage {
            message: "Snippet deleted.".to_string(),
        })
}

#[tauri::command]
pub async fn insert_row(
    state: State<'_, AppState>,
    payload: MutationRequest,
) -> Result<CommandMessage, String> {
    let (profile, password) =
        get_connection_with_secret(&state, &payload.connection_id).map_err(into_message)?;
    let row = payload
        .row
        .ok_or_else(|| "Row payload is required.".to_string())?;
    if !row.is_object() {
        return Err("Row payload must be a JSON object.".to_string());
    }
    let sql = format!(
        "INSERT INTO {}.{} FORMAT JSONEachRow\n{}",
        quote_ident(&payload.database),
        quote_ident(&payload.table),
        row
    );
    execute_sql_text(&profile, &password, &sql, profile.timeout_ms, None)
    .await
    .map_err(into_message)?;
    write_audit(
        &state,
        Some(&payload.connection_id),
        "insert_row",
        &format!("{}.{}", payload.database, payload.table),
        Some(&row.to_string()),
    );
    Ok(CommandMessage {
        message: "Row inserted.".to_string(),
    })
}

#[tauri::command]
pub async fn update_rows_preview(
    state: State<'_, AppState>,
    payload: MutationRequest,
) -> Result<CountPreview, String> {
    let (profile, password) =
        get_connection_with_secret(&state, &payload.connection_id).map_err(into_message)?;
    if payload.where_clause.trim().is_empty() {
        return Err("WHERE clause is required.".to_string());
    }
    let sql = format!(
        "SELECT count() AS affected FROM {}.{} WHERE {} FORMAT JSON",
        quote_ident(&payload.database),
        quote_ident(&payload.table),
        payload.where_clause
    );
    let frame = execute_sql_json(&profile, &password, &sql, profile.timeout_ms, None)
    .await
    .map_err(into_message)?;
    let affected = frame
        .rows
        .first()
        .and_then(|v| v.get("affected"))
        .and_then(|v| v.as_u64())
        .unwrap_or(0);
    Ok(CountPreview {
        affected_rows: affected,
    })
}

#[tauri::command]
pub async fn update_rows_execute(
    state: State<'_, AppState>,
    payload: MutationRequest,
) -> Result<CommandMessage, String> {
    if payload.confirm_token.as_deref() != Some("UPDATE") {
        return Err("Confirm token must be UPDATE.".to_string());
    }
    let (profile, password) =
        get_connection_with_secret(&state, &payload.connection_id).map_err(into_message)?;
    if payload.where_clause.trim().is_empty() {
        return Err("WHERE clause is required.".to_string());
    }
    let set_values = payload
        .set_values
        .ok_or_else(|| "setValues is required.".to_string())?;
    let set_obj = set_values
        .as_object()
        .ok_or_else(|| "setValues must be a JSON object.".to_string())?;
    if set_obj.is_empty() {
        return Err("setValues cannot be empty.".to_string());
    }
    let assignments = set_obj
        .iter()
        .map(|(key, value)| format!("{} = {}", quote_ident(key), value_to_sql(value)))
        .collect::<Vec<_>>()
        .join(", ");
    let sql = format!(
        "ALTER TABLE {}.{} UPDATE {} WHERE {}",
        quote_ident(&payload.database),
        quote_ident(&payload.table),
        assignments,
        payload.where_clause
    );
    execute_sql_text(&profile, &password, &sql, profile.timeout_ms, None)
    .await
    .map_err(into_message)?;
    write_audit(
        &state,
        Some(&payload.connection_id),
        "update_rows",
        &format!("{}.{}", payload.database, payload.table),
        Some(&sql),
    );
    Ok(CommandMessage {
        message: "Update submitted.".to_string(),
    })
}

#[tauri::command]
pub async fn delete_rows_preview(
    state: State<'_, AppState>,
    payload: MutationRequest,
) -> Result<CountPreview, String> {
    update_rows_preview(state, payload).await
}

#[tauri::command]
pub async fn delete_rows_execute(
    state: State<'_, AppState>,
    payload: MutationRequest,
) -> Result<CommandMessage, String> {
    if payload.confirm_token.as_deref() != Some("DELETE") {
        return Err("Confirm token must be DELETE.".to_string());
    }
    let (profile, password) =
        get_connection_with_secret(&state, &payload.connection_id).map_err(into_message)?;
    if payload.where_clause.trim().is_empty() {
        return Err("WHERE clause is required.".to_string());
    }
    let sql = format!(
        "ALTER TABLE {}.{} DELETE WHERE {}",
        quote_ident(&payload.database),
        quote_ident(&payload.table),
        payload.where_clause
    );
    execute_sql_text(&profile, &password, &sql, profile.timeout_ms, None)
    .await
    .map_err(into_message)?;
    write_audit(
        &state,
        Some(&payload.connection_id),
        "delete_rows",
        &format!("{}.{}", payload.database, payload.table),
        Some(&sql),
    );
    Ok(CommandMessage {
        message: "Delete submitted.".to_string(),
    })
}

#[tauri::command]
pub async fn create_database(
    state: State<'_, AppState>,
    payload: DdlRequest,
) -> Result<CommandMessage, String> {
    if !validate_identifier(&payload.database) {
        return Err("Database name must be a valid identifier.".to_string());
    }
    let (profile, password) =
        get_connection_with_secret(&state, &payload.connection_id).map_err(into_message)?;
    let sql = format!(
        "CREATE DATABASE {} {}",
        if payload.if_not_exists.unwrap_or(true) {
            "IF NOT EXISTS"
        } else {
            ""
        },
        quote_ident(&payload.database)
    );
    execute_sql_text(&profile, &password, &sql, profile.timeout_ms, None)
    .await
    .map_err(into_message)?;
    write_audit(
        &state,
        Some(&payload.connection_id),
        "create_database",
        &payload.database,
        Some(&sql),
    );
    Ok(CommandMessage {
        message: "Database created.".to_string(),
    })
}

#[tauri::command]
pub async fn drop_database(
    state: State<'_, AppState>,
    payload: DdlRequest,
) -> Result<CommandMessage, String> {
    if payload.confirm_token.as_deref() != Some("DROP") {
        return Err("Confirm token must be DROP.".to_string());
    }
    if !validate_identifier(&payload.database) {
        return Err("Database name must be a valid identifier.".to_string());
    }
    let (profile, password) =
        get_connection_with_secret(&state, &payload.connection_id).map_err(into_message)?;
    let sql = format!(
        "DROP DATABASE {} {}",
        if payload.if_exists.unwrap_or(true) {
            "IF EXISTS"
        } else {
            ""
        },
        quote_ident(&payload.database)
    );
    execute_sql_text(&profile, &password, &sql, profile.timeout_ms, None)
    .await
    .map_err(into_message)?;
    write_audit(
        &state,
        Some(&payload.connection_id),
        "drop_database",
        &payload.database,
        Some(&sql),
    );
    Ok(CommandMessage {
        message: "Database dropped.".to_string(),
    })
}

#[tauri::command]
pub async fn create_table(
    state: State<'_, AppState>,
    payload: DdlRequest,
) -> Result<CommandMessage, String> {
    let table = payload
        .table
        .clone()
        .ok_or_else(|| "Table name is required.".to_string())?;
    let columns_ddl = payload
        .columns_ddl
        .clone()
        .ok_or_else(|| "columnsDdl is required.".to_string())?;
    let engine = payload
        .engine
        .clone()
        .unwrap_or_else(|| "MergeTree() ORDER BY tuple()".to_string());
    if !validate_identifier(&payload.database) || !validate_identifier(&table) {
        return Err("Database and table names must be valid identifiers.".to_string());
    }
    let (profile, password) =
        get_connection_with_secret(&state, &payload.connection_id).map_err(into_message)?;
    let sql = format!(
        "CREATE TABLE {} {}.{} ({}) ENGINE = {}",
        if payload.if_not_exists.unwrap_or(true) {
            "IF NOT EXISTS"
        } else {
            ""
        },
        quote_ident(&payload.database),
        quote_ident(&table),
        columns_ddl,
        engine
    );
    execute_sql_text(&profile, &password, &sql, profile.timeout_ms, None)
    .await
    .map_err(into_message)?;
    write_audit(
        &state,
        Some(&payload.connection_id),
        "create_table",
        &format!("{}.{}", payload.database, table),
        Some(&sql),
    );
    Ok(CommandMessage {
        message: "Table created.".to_string(),
    })
}

#[tauri::command]
pub async fn drop_table(
    state: State<'_, AppState>,
    payload: DdlRequest,
) -> Result<CommandMessage, String> {
    if payload.confirm_token.as_deref() != Some("DROP") {
        return Err("Confirm token must be DROP.".to_string());
    }
    let table = payload
        .table
        .clone()
        .ok_or_else(|| "Table name is required.".to_string())?;
    if !validate_identifier(&payload.database) || !validate_identifier(&table) {
        return Err("Database and table names must be valid identifiers.".to_string());
    }
    let (profile, password) =
        get_connection_with_secret(&state, &payload.connection_id).map_err(into_message)?;
    let sql = format!(
        "DROP TABLE {} {}.{}",
        if payload.if_exists.unwrap_or(true) {
            "IF EXISTS"
        } else {
            ""
        },
        quote_ident(&payload.database),
        quote_ident(&table)
    );
    execute_sql_text(&profile, &password, &sql, profile.timeout_ms, None)
    .await
    .map_err(into_message)?;
    write_audit(
        &state,
        Some(&payload.connection_id),
        "drop_table",
        &format!("{}.{}", payload.database, table),
        Some(&sql),
    );
    Ok(CommandMessage {
        message: "Table dropped.".to_string(),
    })
}

#[tauri::command]
pub async fn schema_get_table_ddl(
    state: State<'_, AppState>,
    connection_id: String,
    database: String,
    table: String,
) -> Result<CommandMessage, String> {
    let (profile, password) =
        get_connection_with_secret(&state, &connection_id).map_err(into_message)?;
    let sql = format!(
        "SHOW CREATE TABLE {}.{}",
        quote_ident(&database),
        quote_ident(&table)
    );
    let ddl = execute_sql_text(&profile, &password, &sql, profile.timeout_ms, None)
        .await
        .map_err(format_categorized_error)?;
    Ok(CommandMessage {
        message: ddl.trim().to_string(),
    })
}

#[tauri::command]
pub async fn query_cancel(
    state: State<'_, AppState>,
    connection_id: String,
    query_id: String,
) -> Result<CommandMessage, String> {
    if query_id.trim().is_empty() {
        return Err("queryId is required.".to_string());
    }
    let (profile, password) =
        get_connection_with_secret(&state, &connection_id).map_err(into_message)?;
    let escaped = query_id.replace('\'', "''");
    let sql = format!("KILL QUERY WHERE query_id = '{}' SYNC", escaped);
    execute_sql_text(&profile, &password, &sql, profile.timeout_ms, None)
        .await
        .map_err(format_categorized_error)?;
    write_audit(
        &state,
        Some(&connection_id),
        "query_cancel",
        &query_id,
        Some(&sql),
    );
    Ok(CommandMessage {
        message: format!("Cancel requested for query {}.", query_id),
    })
}

#[tauri::command]
pub async fn connection_diagnostics(
    state: State<'_, AppState>,
    payload: ConnectionInput,
) -> Result<ConnectionDiagnostics, String> {
    if payload.host.trim().is_empty()
        || payload.database.trim().is_empty()
        || payload.username.trim().is_empty()
    {
        return Err("Host, database and username are required.".to_string());
    }
    let (host, port, secure) =
        normalize_connection_endpoint(&payload.host, payload.port, payload.secure)
            .map_err(into_message)?;
    let timeout_ms = payload.timeout_ms.unwrap_or(10_000);
    let profile = ConnectionProfile {
        id: payload.id.clone().unwrap_or_else(|| "diagnostics".to_string()),
        name: payload.name,
        host,
        port,
        database: payload.database,
        username: payload.username,
        secure,
        tls_insecure_skip_verify: payload.tls_insecure_skip_verify.unwrap_or(false),
        ca_cert_path: payload.ca_cert_path,
        ssh_tunnel: payload.ssh_tunnel,
        timeout_ms,
        created_at: String::new(),
        updated_at: String::new(),
    };
    let password = if let Some(candidate) = payload.password {
        if candidate.trim().is_empty() {
            if let Some(id) = payload.id {
                read_secret(&id).map_err(into_message)?
            } else {
                return Err("Password is required.".to_string());
            }
        } else {
            candidate
        }
    } else if let Some(id) = payload.id {
        read_secret(&id).map_err(into_message)?
    } else {
        return Err("Password is required.".to_string());
    };

    let started = Instant::now();
    match execute_sql_json(
        &profile,
        &password,
        "SELECT version() AS version, now() AS now FORMAT JSON",
        timeout_ms,
        None,
    )
    .await
    {
        Ok(frame) => {
            let latency_ms = started.elapsed().as_millis() as u64;
            let version = frame
                .rows
                .first()
                .and_then(|row| row.get("version"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            Ok(ConnectionDiagnostics {
                ok: true,
                category: "ok".to_string(),
                latency_ms,
                server_version: version,
                detail: "Connection diagnostics passed.".to_string(),
            })
        }
        Err(err) => {
            let detail = err.to_string();
            let category = classify_error(&detail).to_string();
            write_app_log(
                &state,
                "warn",
                "connection_diagnostics",
                &detail,
                Some(&format!(
                    "{{\"host\":\"{}\",\"port\":{},\"db\":\"{}\"}}",
                    profile.host, profile.port, profile.database
                )),
            );
            Ok(ConnectionDiagnostics {
                ok: false,
                category,
                latency_ms: started.elapsed().as_millis() as u64,
                server_version: None,
                detail,
            })
        }
    }
}

#[tauri::command]
pub fn connection_export_profiles(
    state: State<'_, AppState>,
    target_path: String,
) -> Result<CommandMessage, String> {
    if target_path.trim().is_empty() {
        return Err("Target path is required.".to_string());
    }
    let export = db::export_connections(&state.db_path).map_err(into_message)?;
    let json = serde_json::to_string_pretty(&export).map_err(|e| e.to_string())?;
    fs::write(&target_path, json).map_err(|e| e.to_string())?;
    Ok(CommandMessage {
        message: format!("Exported {} profile(s).", export.connections.len()),
    })
}

#[tauri::command]
pub fn connection_import_profiles(
    state: State<'_, AppState>,
    source_path: String,
    overwrite_existing: Option<bool>,
) -> Result<CommandMessage, String> {
    if source_path.trim().is_empty() {
        return Err("Source path is required.".to_string());
    }
    let raw = fs::read_to_string(&source_path).map_err(|e| e.to_string())?;
    let parsed: ConnectionExport = serde_json::from_str(&raw).map_err(|e| e.to_string())?;
    let imported = db::import_connections(
        &state.db_path,
        &parsed,
        overwrite_existing.unwrap_or(false),
    )
    .map_err(into_message)?;
    Ok(CommandMessage {
        message: format!("Imported {} profile(s).", imported),
    })
}

#[tauri::command]
pub fn audit_list(state: State<'_, AppState>, limit: Option<u32>) -> Result<Vec<AuditItem>, String> {
    db::list_audit_log(&state.db_path, limit.unwrap_or(200).clamp(1, 2000)).map_err(into_message)
}

#[tauri::command]
pub fn logs_list(state: State<'_, AppState>, limit: Option<u32>) -> Result<Vec<AppLogItem>, String> {
    db::list_app_logs(&state.db_path, limit.unwrap_or(300).clamp(1, 3000)).map_err(into_message)
}

#[tauri::command]
pub fn app_backup_metadata(
    state: State<'_, AppState>,
    target_path: String,
) -> Result<CommandMessage, String> {
    let target = PathBuf::from(target_path.trim());
    if target.as_os_str().is_empty() {
        return Err("Target path is required.".to_string());
    }
    db::backup_database(&state.db_path, &target).map_err(into_message)?;
    Ok(CommandMessage {
        message: format!("Backup created at {}.", target.display()),
    })
}

#[tauri::command]
pub fn app_restore_metadata(
    state: State<'_, AppState>,
    source_path: String,
) -> Result<CommandMessage, String> {
    let source = PathBuf::from(source_path.trim());
    if source.as_os_str().is_empty() {
        return Err("Source path is required.".to_string());
    }
    db::restore_database(&state.db_path, &source).map_err(into_message)?;
    Ok(CommandMessage {
        message: "Metadata restored. Restart app for clean state.".to_string(),
    })
}

#[tauri::command]
pub fn app_startup_status(state: State<'_, AppState>) -> Result<Option<String>, String> {
    Ok(state.startup_notice.clone())
}
