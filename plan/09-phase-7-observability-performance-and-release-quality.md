# Phase 7 - Observability, Performance, and Release Quality

## Objective

Finish hardening work for large datasets and reliable production release operations.

## Tasks

1. Implement result virtualization for large result sets.
2. Add backend query cancellation plumbing and UI controls.
3. Add structured local logging and error taxonomy mapping.
4. Add crash-safe recovery UX (failed startup, corrupt local DB).
5. Finalize cross-platform release checklist:
   - Windows signing/release
   - macOS notarization
   - Linux packaging/signing

## Validation Checklist

1. Large results remain responsive and memory stable.
2. Cancellation reliably stops in-flight queries.
3. Errors are grouped into actionable categories in UI.
4. Cross-platform release runbook is executable end-to-end.

## Status

Complete (code + runbook scope in this environment).

- Implemented: large-result row virtualization in the results table.
- Implemented: backend query cancellation + UI controls.
- Implemented: structured app logs table + categorized error mapping.
- Implemented: startup recovery fallback for corrupt local metadata DB + startup notice UI.
- Implemented: cross-platform release checklist/runbook in docs.

Notes:

- macOS notarization/signing and Linux signing still require execution on native CI/runtime targets.
