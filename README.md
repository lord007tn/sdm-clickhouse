# SDM ClickHouse

<p>
  <img src="./public/sdm-clickhouse-logo.svg" alt="SDM ClickHouse" width="420" />
</p>

[![CI](https://github.com/lord007tn/sdm-clickhouse/actions/workflows/ci.yml/badge.svg)](https://github.com/lord007tn/sdm-clickhouse/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/lord007tn/sdm-clickhouse?display_name=tag)](https://github.com/lord007tn/sdm-clickhouse/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

Open-source desktop SQL workbench for ClickHouse, built with Tauri, React, TypeScript, and Rust.

SDM ClickHouse is designed around a connection-first workflow: save ClickHouse profiles, browse schemas, run and explain SQL, inspect results, keep reusable snippets, and guard destructive data operations from one native desktop app.

## Why Use It

- Native desktop app for Windows, macOS, and Linux.
- Saved ClickHouse connections with local metadata and passwords kept outside SQLite.
- Database, table, column, and DDL explorer.
- Multi-tab SQL workspace with execution, cancellation, paging, formatting, and explain flows.
- Query history, SQL snippets, audit logs, and app logs.
- Guarded insert, update, delete, create, and drop workflows.
- Connection diagnostics, metadata import/export, backup/restore, and release update checks.
- Connection overview insights for database, table, storage, and activity summaries.

## Install

Download the latest desktop bundles from [GitHub Releases](https://github.com/lord007tn/sdm-clickhouse/releases).

Linux/macOS:

```bash
curl -fsSL https://raw.githubusercontent.com/lord007tn/sdm-clickhouse/main/install.sh | bash
```

Windows PowerShell:

```powershell
irm https://raw.githubusercontent.com/lord007tn/sdm-clickhouse/main/install.ps1 | iex
```

## Quick Start for Contributors

### Prerequisites

- Node.js 20 or newer
- pnpm 10 or newer
- Rust toolchain from [rustup](https://rustup.rs/)
- Platform build tooling required by [Tauri v2](https://tauri.app/start/prerequisites/)

### Set Up

```powershell
pnpm install
```

If Rust was installed in the current PowerShell session and `cargo` is not available yet:

```powershell
$env:Path += ";$env:USERPROFILE\.cargo\bin"
```

### Run the Desktop App

```powershell
pnpm tauri dev
```

Browser-only Vite mode is useful for layout work:

```powershell
pnpm dev
```

The full product depends on Tauri commands, native dialogs, local SQLite metadata, and OS keychain integration, so use `pnpm tauri dev` for end-to-end work.

## Development Checks

Run the focused checks while iterating:

```powershell
pnpm typecheck
pnpm lint
pnpm format:check
pnpm knip
cargo check --manifest-path src-tauri/Cargo.toml
```

Run the project validation suite before opening a PR:

```powershell
pnpm validate
```

End-to-end tests are available with:

```powershell
pnpm test:e2e
```

## Project Layout

```text
src/                  React desktop UI
src/features/query/   SQL editor, completion, and tab model
src/lib/api.ts        Typed frontend wrapper around Tauri commands
src-tauri/src/        Rust command layer, ClickHouse transport, local SQLite store
src-tauri/tauri.conf.json
docs/                 Architecture and command reference
tests/                Playwright smoke and interaction tests
scripts/              Release and consistency checks
```

## Architecture

The app has five main layers:

1. Tauri v2 native shell and Rust command handlers.
2. React 19 + TypeScript frontend.
3. ClickHouse HTTP(S) transport.
4. SQLite local metadata for connections, history, snippets, logs, and audit data.
5. OS keychain storage for secrets, with a local fallback when platform keyring services are unavailable.

See [docs/architecture.md](./docs/architecture.md) and [docs/commands.md](./docs/commands.md) for deeper implementation notes.

## Contributing

Issues and pull requests are welcome. Good first contributions include documentation fixes, reproducible bug reports, focused UI polish, test coverage for existing flows, and small improvements to query/workbench ergonomics.

Before opening a PR, read [CONTRIBUTING.md](./CONTRIBUTING.md), run `pnpm validate` where practical, and include screenshots or short screen recordings for UI changes.

## Security

Please do not report vulnerabilities in public issues. Use GitHub Security Advisories for private reporting and include reproduction details, affected versions, and suggested mitigations when possible.

See [SECURITY.md](./SECURITY.md) for the full policy.

## Release Notes

See [CHANGELOG.md](./CHANGELOG.md). The current tracked release line is `v0.1.1`.

## License

SDM ClickHouse is released under the [MIT License](./LICENSE).
