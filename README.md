# SDM ClickHouse

`SDM ClickHouse` is a Tauri desktop client for ClickHouse with a connection-first workflow inspired by Tiny RDM.

## What ships in `v0.1.0`

- Saved ClickHouse connections with local profile storage and password handling outside SQLite.
- Database and table explorer with column inspection and DDL viewing.
- Multi-tab SQL workspace with execution, cancellation, paging, formatting, and explain flows.
- Query history, reusable snippets, audit logs, and application logs.
- Guarded data operations for insert, update, delete, create, and drop actions.
- Connection diagnostics, profile import/export, metadata backup/restore, and in-app update checks.
- Connection overview insights for database, table, storage, and activity summaries.

## Stack

- Tauri v2
- React 19 + TypeScript + Vite
- shadcn/ui + Tailwind CSS
- SQLite for local metadata
- ClickHouse HTTP(S) for database communication

## Prerequisites

- Node.js 20+
- pnpm 10+
- Rust toolchain (`rustup`, `cargo`, `rustc`)
- Platform build tooling for Tauri bundles

## Setup

```powershell
pnpm install
```

If Rust is missing from the current PowerShell session:

```powershell
$env:Path += ";$env:USERPROFILE\\.cargo\\bin"
```

## Run

```powershell
pnpm tauri dev
```

Browser-only Vite preview is useful for layout work, but the product depends on the Tauri runtime for commands and native dialogs.

## Build

```powershell
pnpm build
pnpm tauri build
```

## Quality Checks

```powershell
pnpm typecheck
pnpm lint
pnpm format:check
pnpm knip
cargo check --manifest-path src-tauri/Cargo.toml
```

## Installers and Updates

One-line installers are included for GitHub Releases:

```bash
curl -fsSL https://raw.githubusercontent.com/lord007tn/sdm-clickhouse/main/install.sh | bash
```

```powershell
irm https://raw.githubusercontent.com/lord007tn/sdm-clickhouse/main/install.ps1 | iex
```

The release pipeline publishes cross-platform desktop bundles, a Windows portable ZIP, and `latest.json` for updater clients.

## Documentation

- [Changelog](./CHANGELOG.md)
- [Architecture](./docs/architecture.md)
- [Tauri Commands](./docs/commands.md)
- [Release Notes](./docs/release.md)
- [Release Checklist](./docs/release-checklist.md)
- [v0.1.0 Deliverables](./docs/v0.1.0-deliverables.md)
- [Contributing](./CONTRIBUTING.md)
- [Security Policy](./SECURITY.md)
- [Code of Conduct](./CODE_OF_CONDUCT.md)
