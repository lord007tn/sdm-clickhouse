# Changelog

All notable changes to this project are documented in this file.

## [0.1.2] - 2026-02-26

### Changed

- Built-in updater now requests app restart automatically after successful install.
- Windows fallback installer now uses per-user setup arguments by default.

### Fixed

- Reduced manual steps during update flow (no manual app close/reopen for built-in update path).

## [0.1.1] - 2026-02-26

### Changed

- Update flow now selects assets by runtime OS/arch with user-space-first strategy.
- Linux update/install now prefers AppImage to avoid requiring sudo by default.
- Windows update/install now prefers setup `.exe`; MSI uses per-user install flags.
- macOS script install defaults to `~/Applications` for non-admin installs.
- One-line install scripts (`install.sh`, `install.ps1`) now support optional system-level mode (`--system` / `-SystemInstall`).

### Fixed

- Connection defaults are auto-applied when host/port/database/username/timeouts are omitted.
- Connection dialog now hides advanced CA cert and SSH tunnel fields behind toggles.
- Linux keyring/DBus secure storage failures now fall back to local secret file storage.

## [0.1.0] - 2026-02-26

### Added

- Desktop ClickHouse client built with Tauri v2, React, TypeScript, and shadcn/ui.
- Multi-connection workspace with local profile storage and OS keychain-backed password handling.
- Schema browser for databases, tables, columns, and table DDL inspection.
- SQL editor workspace with multi-tab execution, duplicate/reorder support, explain support, cancellation, and timeout controls.
- Result grid views and local persistence for query history and SQL snippets.
- Guarded data operations for destructive SQL paths (confirmation tokens for risky actions).
- Connection diagnostics and profile import/export helpers.
- Local audit log and app log views for query and app-level tracing.
- Open source project standards:
  - MIT license
  - Contribution, security, and code-of-conduct policies
  - Issue templates and pull request template
- GitHub automation:
  - CI checks (TypeScript, knip, web build, Rust check)
  - Label sync and PR labeler
  - PR title lint
  - stale issue/PR management
  - tag-based cross-platform release pipeline with `npx changelogithub`

### Distribution

- Linux: `.deb`, `.AppImage`
- Windows: `.msi`, `NSIS setup.exe`
- macOS: `.dmg`

[0.1.0]: https://github.com/lord007tn/simple-sdm/releases/tag/v0.1.0
[0.1.1]: https://github.com/lord007tn/simple-sdm/releases/tag/v0.1.1
[0.1.2]: https://github.com/lord007tn/simple-sdm/releases/tag/v0.1.2
