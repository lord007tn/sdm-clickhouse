# Phase 3 - Guarded Data Manipulation + Basic DDL

## Objective

Add safe edit flows and limited schema manipulation in UI.

## Tasks

1. Implement guarded row operations:
   - insert row
   - update row(s) with preview
   - delete row(s) with preview
2. Require confirmation for destructive actions.
3. Implement basic schema operations:
   - create database
   - drop database
   - create table
   - drop table
4. Route advanced DDL to SQL editor flow.

## API Contracts

1. `data_insert(connectionId, target, rows)`
2. `data_update(connectionId, target, whereClause, setMap, dryRun)`
3. `data_delete(connectionId, target, whereClause, dryRun)`
4. `ddl_create_database(connectionId, name, ifNotExists)`
5. `ddl_drop_database(connectionId, name, ifExists, confirmToken)`
6. `ddl_create_table(connectionId, spec)`
7. `ddl_drop_table(connectionId, database, table, ifExists, confirmToken)`

## Guardrails

1. Dry-run preview required before update/delete execution.
2. Update/delete without WHERE blocked by default.
3. Drop actions require explicit typed confirmation.
4. Show affected row estimate and final SQL preview before execute.

## Validation Checklist

1. Insert/update/delete actions work with correct safety steps.
2. Dangerous operations are blocked without confirmation.
3. DDL create/drop DB and table flows behave correctly.

## Deliverables

- Safe data manipulation UX.
- Basic schema actions in UI.
- Audit-friendly action logs in local app log stream.

## Status

- Implemented with preview + confirm-token guardrails for destructive operations.
