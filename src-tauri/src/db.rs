use std::fs;
use std::path::Path;

use anyhow::Context;
use chrono::Utc;
use rusqlite::{params, Connection};
use uuid::Uuid;

use crate::models::{
    AppLogItem, AuditItem, ConnectionExport, ConnectionInput, ConnectionProfile, HistoryItem,
    SnippetInput, SnippetItem, SshTunnelProfile,
};

fn open_db(path: &Path) -> anyhow::Result<Connection> {
    Connection::open(path).context("failed to open local sqlite database")
}

pub fn init_database(path: &Path) -> anyhow::Result<()> {
    let conn = open_db(path)?;
    conn.execute_batch(
        r#"
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS connections (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          host TEXT NOT NULL,
          port INTEGER NOT NULL,
          database_name TEXT NOT NULL,
          username TEXT NOT NULL,
          secure INTEGER NOT NULL DEFAULT 0,
          tls_insecure_skip_verify INTEGER NOT NULL DEFAULT 0,
          ca_cert_path TEXT,
          ssh_tunnel_json TEXT,
          timeout_ms INTEGER NOT NULL DEFAULT 30000,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS query_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          connection_id TEXT NOT NULL,
          sql TEXT NOT NULL,
          status TEXT NOT NULL,
          duration_ms INTEGER,
          error_message TEXT,
          executed_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_query_history_connection_time
          ON query_history(connection_id, executed_at DESC);
        CREATE TABLE IF NOT EXISTS snippets (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          sql TEXT NOT NULL,
          connection_id TEXT,
          tags_json TEXT NOT NULL DEFAULT '[]',
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_snippets_connection
          ON snippets(connection_id);
        CREATE TABLE IF NOT EXISTS audit_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          connection_id TEXT,
          action TEXT NOT NULL,
          target TEXT NOT NULL,
          payload_json TEXT,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_audit_log_created_at
          ON audit_log(created_at DESC);
        CREATE TABLE IF NOT EXISTS app_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          level TEXT NOT NULL,
          category TEXT NOT NULL,
          message TEXT NOT NULL,
          context_json TEXT,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_app_logs_created_at
          ON app_logs(created_at DESC);
        "#,
    )
    .context("failed to initialize sqlite schema")?;
    migrate_database(&conn)?;
    Ok(())
}

fn has_column(conn: &Connection, table: &str, column: &str) -> anyhow::Result<bool> {
    let sql = format!("PRAGMA table_info({})", table);
    let mut stmt = conn.prepare(&sql)?;
    let mut rows = stmt.query([])?;
    while let Some(row) = rows.next()? {
        let name: String = row.get(1)?;
        if name == column {
            return Ok(true);
        }
    }
    Ok(false)
}

fn migrate_database(conn: &Connection) -> anyhow::Result<()> {
    if !has_column(conn, "connections", "tls_insecure_skip_verify")? {
        conn.execute(
            "ALTER TABLE connections ADD COLUMN tls_insecure_skip_verify INTEGER NOT NULL DEFAULT 0",
            [],
        )?;
    }
    if !has_column(conn, "connections", "ca_cert_path")? {
        conn.execute("ALTER TABLE connections ADD COLUMN ca_cert_path TEXT", [])?;
    }
    if !has_column(conn, "connections", "ssh_tunnel_json")? {
        conn.execute(
            "ALTER TABLE connections ADD COLUMN ssh_tunnel_json TEXT",
            [],
        )?;
    }
    Ok(())
}

pub fn list_connections(path: &Path) -> anyhow::Result<Vec<ConnectionProfile>> {
    let conn = open_db(path)?;
    let mut stmt = conn.prepare(
        r#"
        SELECT id, name, host, port, database_name, username, secure, tls_insecure_skip_verify, ca_cert_path, ssh_tunnel_json, timeout_ms, created_at, updated_at
        FROM connections
        ORDER BY lower(name) ASC
        "#,
    )?;
    let mapped = stmt.query_map([], |row| {
        let ssh_tunnel_json: Option<String> = row.get(9)?;
        let ssh_tunnel = ssh_tunnel_json
            .as_deref()
            .and_then(|json| serde_json::from_str::<SshTunnelProfile>(json).ok());
        Ok(ConnectionProfile {
            id: row.get(0)?,
            name: row.get(1)?,
            host: row.get(2)?,
            port: row.get::<_, u16>(3)?,
            database: row.get(4)?,
            username: row.get(5)?,
            secure: row.get::<_, i64>(6)? == 1,
            tls_insecure_skip_verify: row.get::<_, i64>(7)? == 1,
            ca_cert_path: row.get(8)?,
            ssh_tunnel,
            timeout_ms: row.get::<_, u64>(10)?,
            created_at: row.get(11)?,
            updated_at: row.get(12)?,
        })
    })?;
    let mut out = Vec::new();
    for row in mapped {
        out.push(row?);
    }
    Ok(out)
}

pub fn get_connection(path: &Path, id: &str) -> anyhow::Result<ConnectionProfile> {
    let conn = open_db(path)?;
    let mut stmt = conn.prepare(
        r#"
        SELECT id, name, host, port, database_name, username, secure, tls_insecure_skip_verify, ca_cert_path, ssh_tunnel_json, timeout_ms, created_at, updated_at
        FROM connections
        WHERE id = ?1
        "#,
    )?;
    let profile = stmt.query_row([id], |row| {
        let ssh_tunnel_json: Option<String> = row.get(9)?;
        let ssh_tunnel = ssh_tunnel_json
            .as_deref()
            .and_then(|json| serde_json::from_str::<SshTunnelProfile>(json).ok());
        Ok(ConnectionProfile {
            id: row.get(0)?,
            name: row.get(1)?,
            host: row.get(2)?,
            port: row.get::<_, u16>(3)?,
            database: row.get(4)?,
            username: row.get(5)?,
            secure: row.get::<_, i64>(6)? == 1,
            tls_insecure_skip_verify: row.get::<_, i64>(7)? == 1,
            ca_cert_path: row.get(8)?,
            ssh_tunnel,
            timeout_ms: row.get::<_, u64>(10)?,
            created_at: row.get(11)?,
            updated_at: row.get(12)?,
        })
    })?;
    Ok(profile)
}

pub fn upsert_connection(
    path: &Path,
    payload: &ConnectionInput,
) -> anyhow::Result<ConnectionProfile> {
    let conn = open_db(path)?;
    let now = Utc::now().to_rfc3339();
    let id = payload
        .id
        .clone()
        .unwrap_or_else(|| Uuid::new_v4().to_string());
    let timeout = payload.timeout_ms.unwrap_or(30_000);
    let tls_insecure_skip_verify = payload.tls_insecure_skip_verify.unwrap_or(false);
    let ca_cert_path = payload
        .ca_cert_path
        .as_ref()
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty());
    let ssh_tunnel_json = payload
        .ssh_tunnel
        .as_ref()
        .map(serde_json::to_string)
        .transpose()?;

    let exists: i64 = conn.query_row(
        "SELECT COUNT(1) FROM connections WHERE id = ?1",
        [id.as_str()],
        |r| r.get(0),
    )?;

    if exists > 0 {
        conn.execute(
            r#"
            UPDATE connections
            SET name = ?2,
                host = ?3,
                port = ?4,
                database_name = ?5,
                username = ?6,
                secure = ?7,
                tls_insecure_skip_verify = ?8,
                ca_cert_path = ?9,
                ssh_tunnel_json = ?10,
                timeout_ms = ?11,
                updated_at = ?12
            WHERE id = ?1
            "#,
            params![
                id,
                payload.name.trim(),
                payload.host.trim(),
                payload.port,
                payload.database.trim(),
                payload.username.trim(),
                if payload.secure { 1 } else { 0 },
                if tls_insecure_skip_verify { 1 } else { 0 },
                ca_cert_path,
                ssh_tunnel_json,
                timeout,
                now
            ],
        )?;
    } else {
        conn.execute(
            r#"
            INSERT INTO connections (
              id, name, host, port, database_name, username, secure, tls_insecure_skip_verify, ca_cert_path, ssh_tunnel_json, timeout_ms, created_at, updated_at
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?12)
            "#,
            params![
                id,
                payload.name.trim(),
                payload.host.trim(),
                payload.port,
                payload.database.trim(),
                payload.username.trim(),
                if payload.secure { 1 } else { 0 },
                if tls_insecure_skip_verify { 1 } else { 0 },
                ca_cert_path,
                ssh_tunnel_json,
                timeout,
                now
            ],
        )?;
    }

    get_connection(path, &id)
}

pub fn delete_connection(path: &Path, id: &str) -> anyhow::Result<()> {
    let conn = open_db(path)?;
    conn.execute("DELETE FROM connections WHERE id = ?1", [id])?;
    conn.execute("DELETE FROM query_history WHERE connection_id = ?1", [id])?;
    conn.execute("DELETE FROM snippets WHERE connection_id = ?1", [id])?;
    Ok(())
}

pub fn insert_history(
    path: &Path,
    connection_id: &str,
    sql: &str,
    status: &str,
    duration_ms: Option<u64>,
    error_message: Option<&str>,
) -> anyhow::Result<()> {
    let conn = open_db(path)?;
    conn.execute(
        r#"
        INSERT INTO query_history (connection_id, sql, status, duration_ms, error_message, executed_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6)
        "#,
        params![
            connection_id,
            sql,
            status,
            duration_ms.map(|v| v as i64),
            error_message,
            Utc::now().to_rfc3339()
        ],
    )?;
    Ok(())
}

pub fn list_history(
    path: &Path,
    connection_id: &str,
    limit: u32,
) -> anyhow::Result<Vec<HistoryItem>> {
    let conn = open_db(path)?;
    let mut stmt = conn.prepare(
        r#"
        SELECT id, connection_id, sql, status, duration_ms, error_message, executed_at
        FROM query_history
        WHERE connection_id = ?1
        ORDER BY id DESC
        LIMIT ?2
        "#,
    )?;

    let mapped = stmt.query_map(params![connection_id, limit], |row| {
        Ok(HistoryItem {
            id: row.get(0)?,
            connection_id: row.get(1)?,
            sql: row.get(2)?,
            status: row.get(3)?,
            duration_ms: row.get::<_, Option<i64>>(4)?.map(|v| v as u64),
            error_message: row.get(5)?,
            executed_at: row.get(6)?,
        })
    })?;

    let mut out = Vec::new();
    for row in mapped {
        out.push(row?);
    }
    Ok(out)
}

pub fn upsert_snippet(path: &Path, payload: &SnippetInput) -> anyhow::Result<SnippetItem> {
    let conn = open_db(path)?;
    let id = payload
        .id
        .clone()
        .unwrap_or_else(|| Uuid::new_v4().to_string());
    let tags = payload.tags.clone().unwrap_or_default();
    let tags_json = serde_json::to_string(&tags)?;
    let now = Utc::now().to_rfc3339();

    let exists: i64 = conn.query_row(
        "SELECT COUNT(1) FROM snippets WHERE id = ?1",
        [id.as_str()],
        |r| r.get(0),
    )?;
    if exists > 0 {
        conn.execute(
            r#"
            UPDATE snippets
            SET name = ?2, sql = ?3, connection_id = ?4, tags_json = ?5, updated_at = ?6
            WHERE id = ?1
            "#,
            params![
                id,
                payload.name.trim(),
                payload.sql,
                payload.connection_id,
                tags_json,
                now
            ],
        )?;
    } else {
        conn.execute(
            r#"
            INSERT INTO snippets (id, name, sql, connection_id, tags_json, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6)
            "#,
            params![
                id,
                payload.name.trim(),
                payload.sql,
                payload.connection_id,
                tags_json,
                now
            ],
        )?;
    }

    get_snippet(path, &id)
}

pub fn get_snippet(path: &Path, id: &str) -> anyhow::Result<SnippetItem> {
    let conn = open_db(path)?;
    let mut stmt = conn.prepare(
        "SELECT id, name, sql, connection_id, tags_json, updated_at FROM snippets WHERE id = ?1",
    )?;
    let out = stmt.query_row([id], |row| {
        let tags_json: String = row.get(4)?;
        let tags: Vec<String> = serde_json::from_str(&tags_json).unwrap_or_default();
        Ok(SnippetItem {
            id: row.get(0)?,
            name: row.get(1)?,
            sql: row.get(2)?,
            connection_id: row.get(3)?,
            tags,
            updated_at: row.get(5)?,
        })
    })?;
    Ok(out)
}

pub fn list_snippets(path: &Path, connection_id: Option<&str>) -> anyhow::Result<Vec<SnippetItem>> {
    let conn = open_db(path)?;
    let sql = r#"
      SELECT id, name, sql, connection_id, tags_json, updated_at
      FROM snippets
      WHERE (?1 IS NULL OR connection_id = ?1 OR connection_id IS NULL)
      ORDER BY updated_at DESC
    "#;
    let mut stmt = conn.prepare(sql)?;
    let mapped = stmt.query_map([connection_id], |row| {
        let tags_json: String = row.get(4)?;
        let tags: Vec<String> = serde_json::from_str(&tags_json).unwrap_or_default();
        Ok(SnippetItem {
            id: row.get(0)?,
            name: row.get(1)?,
            sql: row.get(2)?,
            connection_id: row.get(3)?,
            tags,
            updated_at: row.get(5)?,
        })
    })?;
    let mut out = Vec::new();
    for row in mapped {
        out.push(row?);
    }
    Ok(out)
}

pub fn delete_snippet(path: &Path, id: &str) -> anyhow::Result<()> {
    let conn = open_db(path)?;
    conn.execute("DELETE FROM snippets WHERE id = ?1", [id])?;
    Ok(())
}

pub fn insert_audit_log(
    path: &Path,
    connection_id: Option<&str>,
    action: &str,
    target: &str,
    payload_json: Option<&str>,
) -> anyhow::Result<()> {
    let conn = open_db(path)?;
    conn.execute(
        r#"
        INSERT INTO audit_log (connection_id, action, target, payload_json, created_at)
        VALUES (?1, ?2, ?3, ?4, ?5)
        "#,
        params![
            connection_id,
            action,
            target,
            payload_json,
            Utc::now().to_rfc3339()
        ],
    )?;
    Ok(())
}

pub fn list_audit_log(path: &Path, limit: u32) -> anyhow::Result<Vec<AuditItem>> {
    let conn = open_db(path)?;
    let mut stmt = conn.prepare(
        r#"
        SELECT id, connection_id, action, target, payload_json, created_at
        FROM audit_log
        ORDER BY id DESC
        LIMIT ?1
        "#,
    )?;
    let mapped = stmt.query_map([limit], |row| {
        Ok(AuditItem {
            id: row.get(0)?,
            connection_id: row.get(1)?,
            action: row.get(2)?,
            target: row.get(3)?,
            payload_json: row.get(4)?,
            created_at: row.get(5)?,
        })
    })?;
    let mut out = Vec::new();
    for row in mapped {
        out.push(row?);
    }
    Ok(out)
}

pub fn insert_app_log(
    path: &Path,
    level: &str,
    category: &str,
    message: &str,
    context_json: Option<&str>,
) -> anyhow::Result<()> {
    let conn = open_db(path)?;
    conn.execute(
        r#"
        INSERT INTO app_logs (level, category, message, context_json, created_at)
        VALUES (?1, ?2, ?3, ?4, ?5)
        "#,
        params![
            level,
            category,
            message,
            context_json,
            Utc::now().to_rfc3339()
        ],
    )?;
    Ok(())
}

pub fn list_app_logs(path: &Path, limit: u32) -> anyhow::Result<Vec<AppLogItem>> {
    let conn = open_db(path)?;
    let mut stmt = conn.prepare(
        r#"
        SELECT id, level, category, message, context_json, created_at
        FROM app_logs
        ORDER BY id DESC
        LIMIT ?1
        "#,
    )?;
    let mapped = stmt.query_map([limit], |row| {
        Ok(AppLogItem {
            id: row.get(0)?,
            level: row.get(1)?,
            category: row.get(2)?,
            message: row.get(3)?,
            context_json: row.get(4)?,
            created_at: row.get(5)?,
        })
    })?;
    let mut out = Vec::new();
    for row in mapped {
        out.push(row?);
    }
    Ok(out)
}

pub fn export_connections(path: &Path) -> anyhow::Result<ConnectionExport> {
    let mut connections = list_connections(path)?;
    connections.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(ConnectionExport {
        version: 1,
        exported_at: Utc::now().to_rfc3339(),
        connections,
    })
}

pub fn import_connections(
    path: &Path,
    export: &ConnectionExport,
    overwrite: bool,
) -> anyhow::Result<u32> {
    let conn = open_db(path)?;
    let now = Utc::now().to_rfc3339();
    let mut imported = 0_u32;
    for item in &export.connections {
        let exists: i64 = conn.query_row(
            "SELECT COUNT(1) FROM connections WHERE id = ?1",
            [item.id.as_str()],
            |r| r.get(0),
        )?;
        if exists > 0 && !overwrite {
            continue;
        }
        let ssh_tunnel_json = item
            .ssh_tunnel
            .as_ref()
            .map(serde_json::to_string)
            .transpose()?;
        if exists > 0 {
            conn.execute(
                r#"
                UPDATE connections
                SET name = ?2,
                    host = ?3,
                    port = ?4,
                    database_name = ?5,
                    username = ?6,
                    secure = ?7,
                    tls_insecure_skip_verify = ?8,
                    ca_cert_path = ?9,
                    ssh_tunnel_json = ?10,
                    timeout_ms = ?11,
                    updated_at = ?12
                WHERE id = ?1
                "#,
                params![
                    item.id,
                    item.name,
                    item.host,
                    item.port,
                    item.database,
                    item.username,
                    if item.secure { 1 } else { 0 },
                    if item.tls_insecure_skip_verify { 1 } else { 0 },
                    item.ca_cert_path,
                    ssh_tunnel_json,
                    item.timeout_ms,
                    now
                ],
            )?;
        } else {
            conn.execute(
                r#"
                INSERT INTO connections (
                  id, name, host, port, database_name, username, secure, tls_insecure_skip_verify, ca_cert_path, ssh_tunnel_json, timeout_ms, created_at, updated_at
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?12)
                "#,
                params![
                    item.id,
                    item.name,
                    item.host,
                    item.port,
                    item.database,
                    item.username,
                    if item.secure { 1 } else { 0 },
                    if item.tls_insecure_skip_verify { 1 } else { 0 },
                    item.ca_cert_path,
                    ssh_tunnel_json,
                    item.timeout_ms,
                    now
                ],
            )?;
        }
        imported += 1;
    }
    Ok(imported)
}

pub fn backup_database(path: &Path, target_path: &Path) -> anyhow::Result<()> {
    if target_path.exists() {
        fs::remove_file(target_path)?;
    }
    let conn = open_db(path)?;
    conn.execute(
        "VACUUM INTO ?1",
        [target_path.to_string_lossy().to_string()],
    )?;
    Ok(())
}

pub fn restore_database(path: &Path, source_path: &Path) -> anyhow::Result<()> {
    if !source_path.exists() {
        anyhow::bail!("Backup file not found: {}", source_path.display());
    }
    let timestamp = Utc::now().timestamp();
    if path.exists() {
        let backup_existing = path.with_extension(format!("sqlite3.pre-restore.{}", timestamp));
        fs::copy(path, &backup_existing).with_context(|| {
            format!(
                "failed to create safety backup before restore: {}",
                backup_existing.display()
            )
        })?;
    }
    fs::copy(source_path, path).with_context(|| {
        format!(
            "failed to restore database from {} to {}",
            source_path.display(),
            path.display()
        )
    })?;
    Ok(())
}
