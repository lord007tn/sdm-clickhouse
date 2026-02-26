# Phase 5 - Schema Explorer + Workspace v2

## Objective

Improve daily query ergonomics and schema navigation speed for medium/large ClickHouse clusters.

## Tasks

1. Add schema filter/search (database + table matching).
2. Add table metadata panel (engine, columns count, quick DDL view).
3. Add SQL quality actions:
   - format SQL
   - explain query
4. Add tab lifecycle improvements:
   - duplicate tab
   - preserve tab state across restarts
5. Add query controls:
   - cancel running query
   - safer timeout controls per tab

## Validation Checklist

1. Schema filter narrows databases/tables in <100ms for typical trees.
2. DDL/metadata for selected table is visible without raw SQL typing.
3. Users can cancel long-running queries from UI.
4. Tab state is restored on app restart.

## Status

Complete.

- Implemented: schema filter in sidebar (database/table match).
- Implemented: selected-table quick metadata strip (engine + column count).
- Implemented: table DDL fetch + DDL quick actions.
- Implemented: SQL format and explain actions in toolbar.
- Implemented: tab duplication and local tab state persistence.
- Implemented: query cancellation plumbing and per-tab timeout controls.
