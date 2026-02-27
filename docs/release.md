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
- UI exposes a "Updates" action in the top toolbar.
- Fallback updater path resolves the latest GitHub release for the current OS/arch, verifies SHA256, and launches the installer.
- Built-in updater flow requests restart automatically after successful install.
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
   - no extra desktop package types are emitted
4. Generate and upload updater manifest `latest.json` via `tauri-action`.
5. Verify `latest.json` exists on the tagged release.

Detailed runbook:

- [Cross-Platform Release Checklist](./release-checklist.md)
- [v0.1.0 Deliverables](./v0.1.0-deliverables.md)
