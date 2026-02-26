# Changelog

All notable changes to this project are documented in this file.

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
