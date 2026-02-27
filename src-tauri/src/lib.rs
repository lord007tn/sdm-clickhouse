mod clickhouse;
mod commands;
mod db;
mod models;

use std::fs;
use std::path::PathBuf;

use chrono::Utc;
use directories::ProjectDirs;
use tauri::Manager;

#[cfg(unix)]
fn set_unix_private_dir(path: &std::path::Path) -> anyhow::Result<()> {
    use std::os::unix::fs::PermissionsExt;
    fs::set_permissions(path, fs::Permissions::from_mode(0o700))?;
    Ok(())
}

#[cfg(not(unix))]
fn set_unix_private_dir(_path: &std::path::Path) -> anyhow::Result<()> {
    Ok(())
}

#[cfg(unix)]
fn set_unix_private_file(path: &std::path::Path) -> anyhow::Result<()> {
    use std::os::unix::fs::PermissionsExt;
    fs::set_permissions(path, fs::Permissions::from_mode(0o600))?;
    Ok(())
}

#[cfg(not(unix))]
fn set_unix_private_file(_path: &std::path::Path) -> anyhow::Result<()> {
    Ok(())
}

#[derive(Clone)]
pub struct AppState {
    pub db_path: PathBuf,
    pub secrets_path: PathBuf,
    pub startup_notice: Option<String>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let dirs = ProjectDirs::from("cc", "SdmClickHouse", "SdmClickHouse")
                .ok_or_else(|| anyhow::anyhow!("failed to resolve app data directory"))?;
            let data_dir = dirs.data_local_dir().to_path_buf();
            fs::create_dir_all(&data_dir)?;
            set_unix_private_dir(&data_dir)?;
            let db_path = data_dir.join("sdm_clickhouse.sqlite3");
            let secrets_path = data_dir.join("secrets_fallback.json");
            if secrets_path.exists() {
                let _ = set_unix_private_file(&secrets_path);
            }
            let startup_notice = match db::init_database(&db_path) {
                Ok(_) => None,
                Err(err) => {
                    let backup_path = data_dir.join(format!(
                        "sdm_clickhouse.sqlite3.corrupt.{}.bak",
                        Utc::now().timestamp()
                    ));
                    let _ = fs::rename(&db_path, &backup_path);
                    db::init_database(&db_path)?;
                    Some(format!(
                        "Recovered from metadata DB corruption ({err}). Backup moved to {}",
                        backup_path.display()
                    ))
                }
            };

            app.manage(AppState {
                db_path,
                secrets_path,
                startup_notice,
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::connection_list,
            commands::connection_delete,
            commands::connection_save,
            commands::connection_test,
            commands::schema_list_databases,
            commands::schema_list_tables,
            commands::schema_get_columns,
            commands::schema_get_table_ddl,
            commands::query_execute,
            commands::query_cancel,
            commands::history_list,
            commands::snippet_list,
            commands::snippet_save,
            commands::snippet_delete,
            commands::connection_diagnostics,
            commands::connection_export_profiles,
            commands::connection_import_profiles,
            commands::audit_list,
            commands::logs_list,
            commands::app_backup_metadata,
            commands::app_restore_metadata,
            commands::app_startup_status,
            commands::app_request_restart,
            commands::app_check_update,
            commands::app_install_update,
            commands::insert_row,
            commands::update_rows_preview,
            commands::update_rows_execute,
            commands::delete_rows_preview,
            commands::delete_rows_execute,
            commands::create_database,
            commands::drop_database,
            commands::create_table,
            commands::drop_table
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
