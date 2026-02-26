# Architecture

## Product Goal

`Simple SDM` is a desktop ClickHouse client inspired by Tiny RDM's connection-first workflow:

- Inspiration: https://redis.tinycraft.cc/
- Tooling reference: https://knip.dev/

## Runtime Layers

1. `Tauri (Rust)` command layer and native packaging.
2. `React + TypeScript` desktop UI.
3. `ClickHouse HTTP(S)` transport for all DB interactions.
4. `SQLite` local metadata store for connections, history, snippets.
5. `OS keychain` for secrets (passwords are never persisted in SQLite).

## Backend Design

- Modules:
  - `src-tauri/src/clickhouse.rs`: query kind detection, SQL helpers, HTTP execution.
  - `src-tauri/src/db.rs`: local SQLite schema + CRUD for app metadata.
  - `src-tauri/src/commands.rs`: Tauri command handlers.
  - `src-tauri/src/models.rs`: shared backend DTOs.
- Extended local stores:
  - `audit_log`: destructive operation audit stream.
  - `app_logs`: structured operational logs and categorized errors.
- Concurrency model:
  - Stateless command handlers + `reqwest::Client` in managed app state.
  - SQLite opened per operation for simpler correctness and isolation.

## Frontend Design

- Shell layout:
  - Left sidebar: connection list + schema tree.
  - Main workspace: SQL tabs, virtualized result grid, history/snippets/audit/logs.
  - Action toolbar: query execution, snippets, guarded operations.
- Visual direction:
  - Dark atmospheric shell with cyan/amber accents.
  - IBM Plex Sans + JetBrains Mono typography.
  - Tiny RDM-inspired density and hierarchy adapted for ClickHouse workflow.

## Safety and Guardrails

- DDL destructive operations require explicit confirm token (`DROP`).
- DML updates/deletes support preview count and require confirm tokens.
- Query history is persisted for auditability.
- SQL execution is scoped per selected connection.
- Query cancellation is supported using ClickHouse `query_id`.
- Startup includes metadata DB recovery fallback with user-visible notice.

## Scalability and Maintainability Notes

- Backend command boundaries are explicit and testable.
- UI uses typed API wrappers (`src/lib/api.ts`) and shared domain types (`src/types.ts`).
- Static dead-code check is integrated with `knip`.
- Project can evolve toward richer editors/autocomplete without changing command contracts.
