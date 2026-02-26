# ClickHouse Desktop Client Execution Plan

## Goal

Build a cross-platform desktop app (Windows, macOS, Linux) using Tauri + React + TypeScript, with a Tiny RDM-inspired layout for managing multiple ClickHouse connections, schema browsing, querying, and guarded edits.

## Locked Stack

- Desktop shell: Tauri v2 (Rust backend commands)
- Frontend: React + TypeScript + Vite
- UI kit: shadcn/ui (with Tailwind CSS)
- Local storage: SQLite for profiles/history/snippets
- Secrets: OS keychain via Tauri plugin
- ClickHouse protocol: HTTP(S) for MVP

## Phase Map

1. [Phase 0 - Environment + Bootstrap](./01-phase-0-environment-bootstrap.md)
2. [Phase 1 - App Shell + Connection Manager](./02-phase-1-shell-and-connections.md)
3. [Phase 2 - Schema Explorer + Query Workspace](./03-phase-2-schema-and-query.md)
4. [Phase 3 - Guarded Data Manipulation + Basic DDL](./04-phase-3-edit-and-ddl.md)
5. [Phase 4 - Hardening + Packaging + Auto Update](./05-phase-4-release-and-hardening.md)
6. [Execution Audit (2026-02-26)](./06-execution-audit-2026-02-26.md)
7. [Phase 5 - Schema Explorer + Workspace v2](./07-phase-5-schema-and-workspace-v2.md)
8. [Phase 6 - Connection Security + Team Readiness](./08-phase-6-connection-security-and-team-readiness.md)
9. [Phase 7 - Observability, Performance, and Release Quality](./09-phase-7-observability-performance-and-release-quality.md)
10. [Phase 8 - Open Source and Release Automation](./10-phase-8-open-source-release-automation.md)

## Definition of Done (MVP)

- Multi-connection management with secure credentials.
- Schema explorer (databases, tables, columns).
- SQL editor with tabs, history, snippets, pagination.
- Guarded insert/update/delete with confirmation flow.
- Basic schema actions (create/drop database and table).
- Installers for Windows/macOS/Linux with updater configured.

## Current Status

- Phase 0: Complete
- Phase 1: Complete
- Phase 2: Complete
- Phase 3: Complete
- Phase 4: Complete (with cross-platform signing execution caveat on macOS/Linux CI targets)
- Phase 5: Complete
- Phase 6: Complete
- Phase 7: Complete (with platform-signing execution caveat on macOS/Linux CI targets)
- Phase 8: Complete
