# Phase 6 - Connection Security + Team Readiness

## Objective

Strengthen connectivity options and make the client operationally safe for shared/team usage.

## Tasks

1. Expand connection options:
   - TLS verification mode
   - custom CA support
   - optional SSH tunnel profile model
2. Add import/export for connection profiles (without secrets).
3. Add connection diagnostics panel:
   - latency test
   - auth diagnostic details
4. Add audit log stream for destructive operations.
5. Add backup/restore for local app metadata DB.

## Validation Checklist

1. TLS and custom CA settings are validated before save.
2. Profile export never includes passwords/secrets.
3. Diagnostics clearly separate network/auth/query errors.
4. Destructive actions are traceable in local audit log.

## Status

Complete.

- Implemented: TLS skip-verify and custom CA path in connection profile + HTTP client setup.
- Implemented: optional SSH tunnel profile model persisted with connection metadata.
- Implemented: profile import/export commands (without secrets).
- Implemented: diagnostics command + dialog UX (latency/category/version).
- Implemented: audit log stream and UI tab.
- Implemented: metadata backup/restore commands and sidebar controls.
