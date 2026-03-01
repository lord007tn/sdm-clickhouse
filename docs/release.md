# Release and Update Notes

## Local Packaging

Windows (PowerShell):

```powershell
pnpm tauri build --debug
```

Artifacts are generated under:

- `src-tauri/target/debug/bundle/msi`
- `src-tauri/target/debug/bundle/nsis`

Linux (WSL/native Linux):

```bash
pnpm tauri build --bundles deb,appimage
```

Artifacts are generated under:

- `src-tauri/target/release/bundle/deb`
- `src-tauri/target/release/bundle/appimage`

## Auto Update Integration

- The app includes `tauri-plugin-updater` (Rust + JS).
- `UpdateChecker` runs on startup, checks for updates automatically, and listens to backend `check-for-updates` events.
- The sidebar footer shows update state (`checking`, `available`, `downloading`, `installed`) with a live progress bar during download.
- Built-in updater flow uses `downloadAndInstall()` and relaunches automatically after successful install.
- To enable production updates, configure:
  - release artifact hosting
  - updater endpoint manifest
  - signing key/public key in Tauri updater config

## Installer Scripts

- `install.sh` supports `curl ... | bash` flow on Linux/macOS.
- `install.ps1` supports `irm ... | iex` flow on Windows.
- Both scripts:
  1. Detect OS and architecture
  2. Pick the matching release artifact
  3. Verify SHA256 from GitHub release metadata
  4. Run installation
- Portable mode is available via `--portable` / `-Portable` or `SDM_CLICKHOUSE_PORTABLE=1`.
- Portable asset preference:
  1. Windows: `*portable*.zip`
  2. macOS: `*.app.tar.gz`
  3. Linux: AppImage (already portable)

## Cross-Platform Release

GitHub Actions automation is configured for:

- CI checks (`.github/workflows/ci.yml`)
- Label sync (`.github/workflows/label-sync.yml`)
- PR labeler (`.github/workflows/pr-labeler.yml`)
- PR title lint (`.github/workflows/pr-title-lint.yml`)
- Stale management (`.github/workflows/stale.yml`)
- Tag release with changelog and cross-platform bundles (`.github/workflows/release.yml`)

Release workflow behavior:

1. Trigger on `v*` tag push.
2. Run `npx changelogithub@latest` to generate release notes.
3. Build and publish bundles on:
   - `ubuntu-latest` (`deb`, `AppImage`)
   - `windows-latest` (`msi`, `nsis`)
   - `macos-latest` (`dmg`)
4. Package and upload Windows portable ZIP (`sdm-clickhouse_<tag>_<arch>_portable.zip`) to the same tag.
5. Generate and upload updater manifest `latest.json` via `tauri-action`.
6. Verify `latest.json` exists on the tagged release.

Portable release outputs:

- Windows portable ZIP from release workflow upload step
- macOS `*.app.tar.gz` updater bundle (portable app bundle artifact)
- Linux AppImage

Detailed runbook:

- [Cross-Platform Release Checklist](./release-checklist.md)
- [v0.1.0 Deliverables](./v0.1.0-deliverables.md)
