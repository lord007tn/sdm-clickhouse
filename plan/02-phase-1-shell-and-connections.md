# Phase 1 - App Shell + Connection Manager

## Objective

Implement secure multi-connection management and wire shell placeholders to real data.

## Tasks

1. Define Tauri command contracts for connection CRUD + test.
2. Build SQLite schema for connection profiles (without passwords).
3. Integrate OS keychain storage for credentials.
4. Build connection manager UI:
   - list connections
   - add/edit/delete dialog
   - test connection action
   - active connection switch behavior
5. Replace placeholder schema tree with connected state.

## API Contracts

1. `connection_list() -> ConnectionSummary[]`
2. `connection_save(profile, credentials) -> ConnectionId`
3. `connection_test(profile, credentials) -> TestResult`
4. `connection_delete(connectionId) -> void`

## Validation Checklist

1. Save and test two connections successfully.
2. Switch active connection and persist selection.
3. Confirm passwords are not stored in plaintext files.
4. Error states show actionable messages (auth, network, TLS).

## Deliverables

- Working connection manager UX.
- Rust command handlers and typed TS bindings.
- Persistent local connection profile store.

## Status

- Implemented with SQLite + keyring-backed secret storage and connection test flow.
