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
- To enable production updates, configure:
  - release artifact hosting
  - updater endpoint manifest
  - signing key/public key in Tauri updater config

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
3. Build bundles on:
   - `ubuntu-latest` (`deb`, `AppImage`)
   - `windows-latest` (`msi`, `nsis`)
   - `macos-latest` (`dmg`)
4. Upload per-platform artifacts.
5. Publish all generated artifacts into the GitHub release in a final aggregation job.

Detailed runbook:

- [Cross-Platform Release Checklist](./release-checklist.md)
- [v0.1.0 Deliverables](./v0.1.0-deliverables.md)
