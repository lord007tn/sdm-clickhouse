# Phase 2 - Schema Explorer + Query Workspace

## Objective

Deliver the core browsing and querying experience for ClickHouse.

## Tasks

1. Implement schema metadata commands:
   - list databases
   - list tables in database
   - list columns in table
2. Build left tree UI with lazy loading.
3. Build tabbed SQL editor workspace:
   - open/close/reorder tabs
   - execute selected SQL or full editor
   - cancel running query
4. Build results grid with pagination and row cap defaults.
5. Add query history and snippet management.

## API Contracts

1. `schema_list_databases(connectionId)`
2. `schema_list_tables(connectionId, database)`
3. `schema_get_columns(connectionId, database, table)`
4. `query_execute(connectionId, sql, page, pageSize, timeoutMs)`
5. `history_list/add`
6. `snippet_list/create/update/delete`

## Validation Checklist

1. Schema tree loads correctly for large schemas.
2. Query tabs are isolated per tab state.
3. Pagination and default caps prevent huge memory loads.
4. History/snippets persist across app restart.

## Deliverables

- Full schema browser.
- SQL workspace with tabbed execution.
- Persistent history + snippets UX.

## Status

Complete.

- Implemented schema metadata APIs and lazy schema tree loading.
- Implemented tabbed SQL workspace with open/close/reorder/duplicate.
- Implemented query execution, cancellation, pagination, and timeout controls.
- Implemented persistent query history and snippets.
