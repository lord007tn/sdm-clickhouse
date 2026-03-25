# Changelog

All notable changes to this project are documented in this file.

## [0.1.3] - 2026-03-25

### Changed

- Reframed observability as a compact summary rail with an on-demand insights tray, so the editor and results stay primary instead of sharing the screen with a permanent metrics dock.
- Restyled the insights surface into a calmer inspection panel with softer cards, neutral contrast, and bounded scrolling that reads like a tool tray rather than a second app shell.

### Fixed

- Kept the SQL editor visible and runnable while opening, scrolling, and closing observability content.
- Added a browser-preview regression test for the hidden-by-default insights tray and hardened chart mounting in the shared chart container.

## [0.1.2] - 2026-03-25

### Changed

- Refactored observability into an independently scrolling insights dock so the SQL editor, results, and history remain visible while browsing cluster metrics.
- Tightened the workbench layout to keep the query workspace primary on smaller screens instead of letting overview cards push execution controls out of reach.

### Fixed

- Restored query visibility and execution flow when the observability panel is populated with deeper ClickHouse overview content.
- Added a browser-preview regression test covering observability scrolling without hiding the query workspace.

## [0.1.0] - 2026-03-24

### Added

- Connection overview observability dashboard with storage, engine mix, live query pressure, and hot-table insights.
- Dedicated backend overview command and typed frontend API for ClickHouse system-table metrics.
- Result-table filter toolbar with live row counts and sortable column headers in the workbench preview and Tauri runtime.

### Changed

- Release manifests, docs, and deliverables moved to the `v0.1.0` line for the first feature release after the initial `v0.0.0` public tag.
- Small paged result sets now render without virtualization fallback issues, while larger result sets still keep virtual scrolling available.
- Result sorting now toggles ascending first for a more predictable analyst workflow across text and numeric columns.

## [0.0.0] - 2026-03-24

### Added

- Initial public release of the SDM ClickHouse desktop client on Tauri v2, React, and TypeScript.
- Saved ClickHouse connections with secure secret handling, diagnostics, and import/export support.
- Schema explorer for databases, tables, columns, and table DDL inspection.
- Multi-tab SQL workspace with execution, cancellation, formatting, explain support, paging, and timeout controls.
- Query history, SQL snippets, audit logs, app logs, and metadata backup/restore flows.
- Guarded insert, update, delete, create, and drop operations for safer data changes.
- Cross-platform release automation for Linux, Windows, and macOS bundles, plus updater artifacts and a Windows portable ZIP.

### Fixed

- Result table editing and related interactions were stabilized before the public `v0.0.0` tag.

[0.0.0]: https://github.com/lord007tn/sdm-clickhouse/releases/tag/v0.0.0
[0.1.0]: https://github.com/lord007tn/sdm-clickhouse/releases/tag/v0.1.0
[0.1.2]: https://github.com/lord007tn/sdm-clickhouse/releases/tag/v0.1.2
[0.1.3]: https://github.com/lord007tn/sdm-clickhouse/releases/tag/v0.1.3
