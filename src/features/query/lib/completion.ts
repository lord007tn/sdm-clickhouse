import type {
  Completion,
  CompletionContext,
  CompletionResult,
} from "@codemirror/autocomplete";

export type SqlCompletionTable = {
  database: string;
  name: string;
};

export type SqlCompletionInput = {
  databases: string[];
  tables: SqlCompletionTable[];
  selectedTable?: SqlCompletionTable | null;
  selectedTableColumns: string[];
};

const CLICKHOUSE_KEYWORDS = [
  "SELECT",
  "FROM",
  "WHERE",
  "PREWHERE",
  "GROUP BY",
  "ORDER BY",
  "LIMIT",
  "OFFSET",
  "HAVING",
  "JOIN",
  "LEFT JOIN",
  "RIGHT JOIN",
  "INNER JOIN",
  "FULL JOIN",
  "ON",
  "AS",
  "DISTINCT",
  "WITH",
  "UNION ALL",
  "INSERT INTO",
  "VALUES",
  "UPDATE",
  "DELETE",
  "CREATE",
  "ALTER",
  "DROP",
  "TABLE",
  "DATABASE",
  "IF EXISTS",
  "IF NOT EXISTS",
  "NULL",
  "AND",
  "OR",
  "NOT",
  "IN",
  "BETWEEN",
  "LIKE",
  "FORMAT",
  "SETTINGS",
] as const;

const CLICKHOUSE_FUNCTIONS = [
  "count",
  "sum",
  "avg",
  "min",
  "max",
  "now",
  "today",
  "toDate",
  "toDateTime",
  "toString",
  "toInt64",
  "toUInt64",
  "toFloat64",
  "ifNull",
  "coalesce",
  "concat",
  "substring",
  "length",
  "lower",
  "upper",
  "match",
  "position",
  "uniq",
  "uniqExact",
  "quantile",
] as const;

const VALID_IDENTIFIER = /[\w.`]*/;

function addUniqueCompletion(
  target: Completion[],
  seen: Set<string>,
  completion: Completion,
) {
  const key = completion.label.toLowerCase();
  if (seen.has(key)) return;
  seen.add(key);
  target.push(completion);
}

function buildSqlCompletionItems(input: SqlCompletionInput): Completion[] {
  const items: Completion[] = [];
  const seen = new Set<string>();

  CLICKHOUSE_KEYWORDS.forEach((keyword) => {
    addUniqueCompletion(items, seen, {
      label: keyword,
      type: "keyword",
    });
  });

  CLICKHOUSE_FUNCTIONS.forEach((fn) => {
    addUniqueCompletion(items, seen, {
      label: fn,
      type: "function",
      apply: `${fn}()`,
    });
  });

  input.databases.forEach((database) => {
    if (!database) return;
    addUniqueCompletion(items, seen, {
      label: database,
      type: "constant",
      detail: "database",
    });
  });

  input.tables.forEach((table) => {
    if (!table.name) return;
    addUniqueCompletion(items, seen, {
      label: table.name,
      type: "variable",
      detail: "table",
    });
    if (table.database) {
      addUniqueCompletion(items, seen, {
        label: `${table.database}.${table.name}`,
        type: "variable",
        detail: "table",
      });
    }
  });

  input.selectedTableColumns.forEach((column) => {
    if (!column) return;
    addUniqueCompletion(items, seen, {
      label: column,
      type: "property",
      detail: input.selectedTable
        ? `${input.selectedTable.database}.${input.selectedTable.name}`
        : "column",
    });
  });

  return items;
}

export function createSqlCompletionSource(input: SqlCompletionInput) {
  const options = buildSqlCompletionItems(input);

  return (context: CompletionContext): CompletionResult | null => {
    const word = context.matchBefore(VALID_IDENTIFIER);
    if (!context.explicit && (!word || word.from === word.to)) return null;

    return {
      from: word ? word.from : context.pos,
      options,
      validFor: VALID_IDENTIFIER,
    };
  };
}
