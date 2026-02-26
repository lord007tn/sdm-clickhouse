# Tauri Command Surface

## Connection Management

- `connection_list()`
- `connection_save(payload)`
- `connection_delete(connectionId)`
- `connection_test(payload)`
- `connection_diagnostics(payload)`
- `connection_export_profiles(targetPath)`
- `connection_import_profiles(sourcePath, overwriteExisting?)`

## Schema Explorer

- `schema_list_databases(connectionId)`
- `schema_list_tables(connectionId, database)`
- `schema_get_columns(connectionId, database, table)`
- `schema_get_table_ddl(connectionId, database, table)`

## Query Workspace

- `query_execute(request)`
- `query_cancel(connectionId, queryId)`
- `history_list(connectionId, limit)`
- `snippet_list(connectionId?)`
- `snippet_save(payload)`
- `snippet_delete(snippetId)`
- `audit_list(limit?)`
- `logs_list(limit?)`

## Data Manipulation

- `insert_row(payload)`
- `update_rows_preview(payload)`
- `update_rows_execute(payload)`
- `delete_rows_preview(payload)`
- `delete_rows_execute(payload)`

## DDL

- `create_database(payload)`
- `drop_database(payload)`
- `create_table(payload)`
- `drop_table(payload)`

## App Metadata Maintenance

- `app_backup_metadata(targetPath)`
- `app_restore_metadata(sourcePath)`
- `app_startup_status()`
- `app_check_update()`
- `app_install_update(downloadUrl, sha256, assetName)`

## Notes

- Secrets are loaded from OS keychain per connection ID.
- Read queries are normalized to ClickHouse JSON format for stable grid rendering.
- Query history captures success/error status and execution duration.
- Audit log captures destructive operations (insert/update/delete/DDL/cancel).
- App logs provide structured local diagnostics with coarse error taxonomy.
