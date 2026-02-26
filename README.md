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

## One-Line Installers

Unix-like (`curl`):

```bash
curl -fsSL https://raw.githubusercontent.com/lord007tn/simple-sdm/main/install.sh | bash
```

Windows PowerShell (`irm`):

```powershell
irm https://raw.githubusercontent.com/lord007tn/simple-sdm/main/install.ps1 | iex
```

Optional pinned version examples:

```bash
curl -fsSL https://raw.githubusercontent.com/lord007tn/simple-sdm/main/install.sh | SIMPLE_SDM_VERSION=0.1.3 bash
```

```powershell
$env:SIMPLE_SDM_VERSION="0.1.3"; irm https://raw.githubusercontent.com/lord007tn/simple-sdm/main/install.ps1 | iex
```

Both installers automatically:

1. Detect OS and CPU architecture.
2. Select the matching release artifact.
3. Resolve the SHA256 digest from GitHub release metadata.
4. Verify file integrity before launching installation.

Default behavior is user-space install without sudo/admin when possible:

1. Linux prefers AppImage in `~/.local/bin`.
2. Windows prefers setup `.exe` and per-user MSI flags.
3. macOS installs into `~/Applications`.

Use `--system` (or `-SystemInstall` in PowerShell) only when you want system-wide install paths.

If the repository is private, set `GITHUB_TOKEN` (or `GH_TOKEN`) before running installer commands.

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
- In-app updater flow checks for updates and uses OS/arch-specific release assets with SHA256 verification before installer launch.
- Built-in updater path requests app restart automatically after successful install.

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
