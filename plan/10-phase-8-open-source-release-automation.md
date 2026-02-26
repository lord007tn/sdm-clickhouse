# Phase 8 - Open Source and Release Automation

## Objective

Prepare v0.1.0 for public GitHub collaboration and automated cross-platform releases.

## Tasks

1. Add issue templates and PR template.
2. Add contribution guide.
3. Add CI workflow for app validation and Rust checks.
4. Add PR governance workflows:
   - PR labeler
   - PR title lint
   - stale management
5. Add label catalog and label sync workflow.
6. Add tag-based release workflow using:
   - `npx changelogithub@latest`
   - cross-platform Tauri bundle builds
   - artifact upload to GitHub release

## Validation Checklist

1. Workflows parse and are committed under `.github/workflows`.
2. Local validation remains green (`typecheck`, `knip`, `build`, `cargo check`).
3. Runtime smoke validation still passes (Tauri + ClickHouse flow).
4. Release docs and v0.1.0 deliverables are updated.

## Status

Complete.

Implemented files include:

- `.github/ISSUE_TEMPLATE/*`
- `.github/pull_request_template.md`
- `.github/labeler.yml`
- `.github/labels.yml`
- `.github/workflows/ci.yml`
- `.github/workflows/label-sync.yml`
- `.github/workflows/pr-labeler.yml`
- `.github/workflows/pr-title-lint.yml`
- `.github/workflows/stale.yml`
- `.github/workflows/release.yml`
- `CONTRIBUTING.md`
- `docs/release.md`, `docs/release-checklist.md`, `docs/v0.1.0-deliverables.md`
