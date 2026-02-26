# Cross-Platform Release Checklist

## 1. Pre-Release Validation

1. `pnpm install`
2. `pnpm typecheck`
3. `pnpm build`
4. `pnpm knip`
5. `cargo check` (in `src-tauri`)
6. Smoke test: connection create/test/query/cancel
7. Verify audit/logs tabs capture expected operations

## 2. Repository Automation Setup

1. Ensure Actions are enabled.
2. Ensure workflow permissions allow `Read and write` for `GITHUB_TOKEN`.
3. Confirm the following workflows exist and are green on default branch:
   - `ci.yml`
   - `label-sync.yml`
   - `pr-labeler.yml`
   - `pr-title-lint.yml`
   - `stale.yml`
   - `release.yml`

## 3. Updater Configuration

1. Set non-empty updater endpoints in `src-tauri/tauri.conf.json`
2. Set updater `pubkey`
3. Produce signed release artifacts
4. Publish update manifest and artifacts to release host

## 4. Secrets Required for Automated Releases

1. `TAURI_SIGNING_PRIVATE_KEY` (optional for unsigned artifacts, required for updater signatures)
2. `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` (if key is password-protected)

## 5. Windows

1. Run `pnpm tauri build`
2. Sign MSI/NSIS artifacts
3. Install + upgrade test from previous version

## 6. macOS

1. Build on macOS runner
2. Sign app bundle with Apple Developer cert
3. Notarize and staple
4. Install + upgrade test

## 7. Linux

1. Build target packages (`AppImage`, `deb`, `rpm` as needed)
2. Sign package metadata/artifacts where applicable
3. Install + upgrade test on target distros

## 8. Rollback Readiness

1. Keep previous release artifacts and manifest
2. Validate downgrade/rollback path in staging
3. Publish rollback runbook with owner and contact path
