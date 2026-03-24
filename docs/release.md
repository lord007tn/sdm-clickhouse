# Release Notes

## Current Release

- Version: `v0.1.0`
- Release page: https://github.com/lord007tn/sdm-clickhouse/releases/tag/v0.1.0
- Target branch: `main`

## Release Contents

`v0.1.0` packages the first feature release after the initial public tag, including:

- Connection management with secure password handling and diagnostics.
- Schema browsing for databases, tables, columns, and DDL.
- A multi-tab SQL workbench with result paging, cancellation, snippets, history, and explain support.
- Guarded data mutation and DDL workflows with audit logging.
- Metadata backup/restore, profile import/export, and in-app update support.
- Overview insights for server activity, engine mix, query pressure, and storage distribution.

## Published Artifacts

The release workflow publishes these assets when the `v0.1.0` tag is pushed:

- Linux: `.deb`, `.AppImage`, and signature files
- Windows: `.msi`, NSIS setup `.exe`, signature files, and `sdm-clickhouse_v0.1.0_x64_portable.zip`
- macOS: `.dmg`
- Updater manifest: `latest.json`

## Release Workflow

GitHub Actions release automation is defined in `.github/workflows/release.yml` and does the following:

1. Verifies manifest versions match the pushed tag.
2. Verifies the tagged commit is reachable from `main`.
3. Waits for required CI checks to pass.
4. Generates release notes with `changelogithub`.
5. Builds and publishes Tauri bundles for Linux, Windows, and macOS.
6. Uploads the Windows portable ZIP.
7. Verifies `latest.json` exists on the release.

## Installer Scripts

- `install.sh` supports Linux and macOS release installs.
- `install.ps1` supports Windows release installs.
- Both scripts resolve the correct asset from GitHub Releases and verify the SHA256 digest before installation.

## Related Docs

- [Cross-Platform Release Checklist](./release-checklist.md)
- [v0.1.0 Deliverables](./v0.1.0-deliverables.md)
