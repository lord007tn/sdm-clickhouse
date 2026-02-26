# Phase 4 - Hardening + Packaging + Auto Update

## Objective

Prepare a reliable, secure MVP release for Windows/macOS/Linux with updater support.

## Tasks

1. Add robust error taxonomy and user-facing error mapping.
2. Add telemetry/logging hooks (local-first, privacy-safe).
3. Tune performance:
   - result virtualization
   - cancellation handling
   - schema caching
4. Configure signing and packaging pipelines.
5. Configure Tauri auto-update channels and verification.
6. Execute cross-platform QA matrix and fix blockers.

## Validation Checklist

1. Installers build on all target OS.
2. Auto-update works from staging to production channel.
3. Crash and error scenarios do not expose credentials.
4. App remains responsive under large query results.

## Deliverables

- Signed installers for all target platforms.
- Release checklist and rollback process.
- Post-MVP backlog for advanced features (SSH tunnel, SSO, autocomplete, profiling).

## Status

Complete (with CI signing caveat).

- Error taxonomy, local audit/app logging, query cancellation, and result virtualization are implemented.
- Updater surface is integrated for release configuration.
- Release checklist and backup/restore safeguards are in place.
- Cross-platform signing/publishing execution still needs macOS/Linux CI runners.
