# ClickHouse Desktop Client (Simple SDM)

Tauri + React + TypeScript desktop ClickHouse client inspired by Tiny RDM interaction patterns.

References:

- Tiny RDM inspiration: https://redis.tinycraft.cc/
- Knip docs: https://knip.dev/
- ClickHouse HTTP interface: https://clickhouse.com/docs/interfaces/http

## Stack

- Tauri v2 (Rust backend)
- React + TypeScript + Vite
- shadcn/ui + Tailwind CSS
- pnpm

## Prerequisites

- Node.js 20+
- Rust toolchain (`rustup`, `cargo`, `rustc`)
- Windows build tools (or equivalent for macOS/Linux)

## Setup

```powershell
pnpm install
```

If Rust commands are not found in your current terminal session, refresh PATH once:

```powershell
$env:Path += ";$env:USERPROFILE\.cargo\bin"
```

## Run (Desktop Dev)

```powershell
pnpm tauri dev
```

## Build

```powershell
pnpm build
pnpm tauri build --debug
```

## Quality

```powershell
pnpm typecheck
pnpm knip
cargo check --manifest-path src-tauri/Cargo.toml
```

## Open Source Automation

- Issue templates and PR template are under `.github/`.
- Label catalog and sync are managed by `.github/labels.yml` + `.github/workflows/label-sync.yml`.
- Release pipeline (`.github/workflows/release.yml`) runs on `v*` tags:
1. Generate release notes with `npx changelogithub@latest`
2. Build desktop bundles on Linux/Windows/macOS
3. Upload artifacts to the GitHub release

## Documentation

- [Architecture](./docs/architecture.md)
- [Tauri Commands](./docs/commands.md)
- [Release Notes](./docs/release.md)
- [Release Checklist](./docs/release-checklist.md)
- [v0.1.0 Deliverables](./docs/v0.1.0-deliverables.md)
- [Contributing](./CONTRIBUTING.md)
- [Security Policy](./SECURITY.md)
- [Code of Conduct](./CODE_OF_CONDUCT.md)

## Execution Plan

Execution plan is split into phases under:

- `plan/00-overview.md`
- `plan/01-phase-0-environment-bootstrap.md`
- `plan/02-phase-1-shell-and-connections.md`
- `plan/03-phase-2-schema-and-query.md`
- `plan/04-phase-3-edit-and-ddl.md`
- `plan/05-phase-4-release-and-hardening.md`
- `plan/06-execution-audit-2026-02-26.md`
- `plan/07-phase-5-schema-and-workspace-v2.md`
- `plan/08-phase-6-connection-security-and-team-readiness.md`
- `plan/09-phase-7-observability-performance-and-release-quality.md`
- `plan/10-phase-8-open-source-release-automation.md`
