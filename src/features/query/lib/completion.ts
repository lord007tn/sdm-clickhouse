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
  "CROSS JOIN",
  "ANTI JOIN",
  "SEMI JOIN",
  "ANY JOIN",
  "ALL JOIN",
  "GLOBAL JOIN",
  "ON",
  "USING",
  "AS",
  "DISTINCT",
  "WITH",
  "UNION ALL",
  "UNION",
  "EXCEPT",
  "INTERSECT",
  "INSERT INTO",
  "VALUES",
  "UPDATE",
  "DELETE",
  "CREATE",
  "ALTER",
  "DROP",
  "TABLE",
  "DATABASE",
  "VIEW",
  "MATERIALIZED VIEW",
  "IF EXISTS",
  "IF NOT EXISTS",
  "NULL",
  "NOT NULL",
  "DEFAULT",
  "AND",
  "OR",
  "NOT",
  "IN",
  "BETWEEN",
  "LIKE",
  "ILIKE",
  "IS NULL",
  "IS NOT NULL",
  "EXISTS",
  "CASE",
  "WHEN",
  "THEN",
  "ELSE",
  "END",
  "ASC",
  "DESC",
  "FORMAT",
  "SETTINGS",
  "FINAL",
  "SAMPLE",
  "ARRAY JOIN",
  "GLOBAL IN",
  "NOT IN",
  "RENAME",
  "TRUNCATE",
  "OPTIMIZE",
  "ATTACH",
  "DETACH",
  "ENGINE",
  "PARTITION BY",
  "PRIMARY KEY",
  "TTL",
  "SET",
] as const;

const CLICKHOUSE_FUNCTIONS = [
  "count",
  "countIf",
  "sum",
  "sumIf",
  "avg",
  "avgIf",
  "min",
  "minIf",
  "max",
  "maxIf",
  "any",
  "anyLast",
  "argMin",
  "argMax",
  "groupArray",
  "groupUniqArray",
  "groupArrayInsertAt",
  "now",
  "today",
  "yesterday",
  "toDate",
  "toDateTime",
  "toDateTime64",
  "toString",
  "toInt8",
  "toInt16",
  "toInt32",
  "toInt64",
  "toUInt8",
  "toUInt16",
  "toUInt32",
  "toUInt64",
  "toFloat32",
  "toFloat64",
  "toDecimal32",
  "toDecimal64",
  "toDecimal128",
  "toFixedString",
  "toTypeName",
  "ifNull",
  "nullIf",
  "coalesce",
  "assumeNotNull",
  "toNullable",
  "if",
  "multiIf",
  "concat",
  "substring",
  "substringUTF8",
  "length",
  "lengthUTF8",
  "lower",
  "upper",
  "trim",
  "trimLeft",
  "trimRight",
  "reverse",
  "replaceOne",
  "replaceAll",
  "replaceRegexpOne",
  "replaceRegexpAll",
  "match",
  "extract",
  "like",
  "notLike",
  "position",
  "positionUTF8",
  "startsWith",
  "endsWith",
  "splitByChar",
  "splitByString",
  "arrayJoin",
  "uniq",
  "uniqExact",
  "uniqCombined",
  "uniqHLL12",
  "quantile",
  "quantiles",
  "quantileExact",
  "median",
  "topK",
  "toYear",
  "toMonth",
  "toDayOfMonth",
  "toDayOfWeek",
  "toHour",
  "toMinute",
  "toSecond",
  "toStartOfDay",
  "toStartOfMonth",
  "toStartOfWeek",
  "toStartOfYear",
  "toStartOfHour",
  "toStartOfMinute",
  "toStartOfFiveMinutes",
  "toStartOfFifteenMinutes",
  "dateDiff",
  "dateAdd",
  "dateSub",
  "formatDateTime",
  "parseDateTimeBestEffort",
  "abs",
  "round",
  "floor",
  "ceil",
  "sqrt",
  "log",
  "log2",
  "log10",
  "exp",
  "pow",
  "rand",
  "rand64",
  "arrayElement",
  "arrayLength",
  "arrayConcat",
  "arrayPushBack",
  "arrayPushFront",
  "arrayFilter",
  "arrayMap",
  "arraySort",
  "arrayReverse",
  "arrayDistinct",
  "arrayExists",
  "arrayAll",
  "arrayFirst",
  "has",
  "hasAll",
  "hasAny",
  "indexOf",
  "empty",
  "notEmpty",
  "tuple",
  "tupleElement",
  "JSONExtract",
  "JSONExtractString",
  "JSONExtractInt",
  "JSONExtractFloat",
  "JSONExtractBool",
  "JSONExtractRaw",
  "JSONExtractKeys",
  "JSONLength",
  "JSONType",
  "visitParamExtractString",
  "cityHash64",
  "sipHash64",
  "murmurHash3_64",
  "xxHash64",
  "MD5",
  "SHA256",
  "hex",
  "unhex",
  "base64Encode",
  "base64Decode",
  "dictGet",
  "dictGetOrDefault",
  "dictHas",
  "generateUUIDv4",
  "toUUID",
  "IPv4NumToString",
  "IPv4StringToNum",
  "toIPv4",
  "toIPv6",
  "isNull",
  "isNotNull",
  "materialize",
  "ignore",
  "sleep",
  "rowNumberInAllBlocks",
  "rowNumberInBlock",
  "runningDifference",
  "neighbor",
  "windowFunnel",
  "retention",
  "bar",
  "formatReadableSize",
  "formatReadableQuantity",
] as const;

const CLICKHOUSE_TYPES = [
  "UInt8",
  "UInt16",
  "UInt32",
  "UInt64",
  "UInt128",
  "UInt256",
  "Int8",
  "Int16",
  "Int32",
  "Int64",
  "Int128",
  "Int256",
  "Float32",
  "Float64",
  "Decimal",
  "Decimal32",
  "Decimal64",
  "Decimal128",
  "Decimal256",
  "String",
  "FixedString",
  "UUID",
  "Date",
  "Date32",
  "DateTime",
  "DateTime64",
  "Enum8",
  "Enum16",
  "Array",
  "Tuple",
  "Map",
  "Nullable",
  "LowCardinality",
  "IPv4",
  "IPv6",
  "Bool",
  "Nothing",
  "SimpleAggregateFunction",
  "AggregateFunction",
] as const;

/** Match a word (including backtick-quoted identifiers). */
const WORD_PATTERN = /[\w`]*/;

/** Match a qualified name like `db.table` or `db`.`table`. */
const QUALIFIED_PATTERN = /[\w`.]+/;

type SqlContext = "from" | "select" | "where" | "dot-database" | "general";

/** Detect the SQL context near the cursor to offer better suggestions. */
function detectContext(
  text: string,
): { ctx: SqlContext; dotPrefix?: string } {
  // Check if the cursor is right after a dot (e.g. `default.`)
  // This means we should show table completions for that database
  const dotMatch = text.match(
    /(?:`([^`]+)`|(\w+))\.(?:`([^`]*)`?|(\w*))$/,
  );
  if (dotMatch) {
    const dbName = dotMatch[1] ?? dotMatch[2] ?? "";
    return { ctx: "dot-database", dotPrefix: dbName };
  }

  // Walk backwards to find the last relevant keyword
  const upper = text.toUpperCase();
  const fromIdx = upper.lastIndexOf("FROM");
  const selectIdx = upper.lastIndexOf("SELECT");
  const whereIdx = upper.lastIndexOf("WHERE");
  const joinIdx = Math.max(
    upper.lastIndexOf("JOIN"),
    upper.lastIndexOf("INTO"),
  );
  const setIdx = upper.lastIndexOf(" SET ");

  const candidates = [
    { ctx: "from" as const, idx: Math.max(fromIdx, joinIdx) },
    { ctx: "select" as const, idx: selectIdx },
    { ctx: "where" as const, idx: Math.max(whereIdx, setIdx) },
  ];

  const best = candidates.reduce((a, b) => (b.idx > a.idx ? b : a));
  if (best.idx < 0) return { ctx: "general" };
  return { ctx: best.ctx };
}

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

function buildKeywordCompletions(): Completion[] {
  return CLICKHOUSE_KEYWORDS.map((keyword) => ({
    label: keyword,
    type: "keyword",
    boost: -1,
  }));
}

function buildFunctionCompletions(): Completion[] {
  return CLICKHOUSE_FUNCTIONS.map((fn) => ({
    label: fn,
    type: "function",
    apply: `${fn}()`,
    boost: 0,
  }));
}

function buildTypeCompletions(): Completion[] {
  return CLICKHOUSE_TYPES.map((t) => ({
    label: t,
    type: "type",
    boost: -2,
  }));
}

export function createSqlCompletionSource(input: SqlCompletionInput) {
  const keywordItems = buildKeywordCompletions();
  const functionItems = buildFunctionCompletions();
  const typeItems = buildTypeCompletions();

  const databaseItems: Completion[] = input.databases
    .filter(Boolean)
    .map((database) => ({
      label: database,
      type: "constant",
      detail: "database",
      boost: 2,
    }));

  // Build a lookup: database → tables
  const tablesByDatabase = new Map<string, SqlCompletionTable[]>();
  for (const table of input.tables) {
    if (!table.name) continue;
    const existing = tablesByDatabase.get(table.database.toLowerCase()) ?? [];
    existing.push(table);
    tablesByDatabase.set(table.database.toLowerCase(), existing);
  }

  const tableItems: Completion[] = [];
  const seenTables = new Set<string>();
  for (const table of input.tables) {
    if (!table.name || seenTables.has(table.name.toLowerCase())) continue;
    seenTables.add(table.name.toLowerCase());
    tableItems.push({
      label: table.name,
      type: "variable",
      detail: `table · ${table.database}`,
      boost: 2,
    });
    const fq = `${table.database}.${table.name}`;
    if (!seenTables.has(fq.toLowerCase())) {
      seenTables.add(fq.toLowerCase());
      tableItems.push({
        label: fq,
        type: "variable",
        detail: "table",
        boost: 1,
      });
    }
  }

  const columnItems: Completion[] = input.selectedTableColumns
    .filter(Boolean)
    .map((column) => ({
      label: column,
      type: "property",
      detail: input.selectedTable
        ? `${input.selectedTable.database}.${input.selectedTable.name}`
        : "column",
      boost: 3,
    }));

  return (context: CompletionContext): CompletionResult | null => {
    const textBefore = context.state.doc.sliceString(0, context.pos);
    const { ctx, dotPrefix } = detectContext(textBefore);

    // After a dot (e.g. `default.`) → show only tables for that database
    if (ctx === "dot-database" && dotPrefix) {
      const qualifiedWord = context.matchBefore(QUALIFIED_PATTERN);
      const dbTables = tablesByDatabase.get(dotPrefix.toLowerCase()) ?? [];
      if (dbTables.length === 0 && !context.explicit) return null;

      const items: Completion[] = dbTables.map((table) => ({
        label: `${dotPrefix}.${table.name}`,
        type: "variable",
        detail: "table",
        boost: 10,
      }));

      return {
        from: qualifiedWord ? qualifiedWord.from : context.pos,
        options: items,
        validFor: QUALIFIED_PATTERN,
      };
    }

    // Standard completion: match a word before cursor
    const word = context.matchBefore(WORD_PATTERN);
    if (!context.explicit && (!word || word.from === word.to)) return null;

    const items: Completion[] = [];
    const seen = new Set<string>();

    // Always include keywords and functions
    for (const item of keywordItems) addUniqueCompletion(items, seen, item);
    for (const item of functionItems) addUniqueCompletion(items, seen, item);
    for (const item of typeItems) addUniqueCompletion(items, seen, item);
    for (const item of databaseItems) addUniqueCompletion(items, seen, item);

    // Boost tables/columns based on context
    if (ctx === "from") {
      // After FROM/JOIN → boost tables higher, columns lower
      for (const item of tableItems)
        addUniqueCompletion(items, seen, { ...item, boost: 10 });
      for (const item of columnItems)
        addUniqueCompletion(items, seen, { ...item, boost: 1 });
    } else if (ctx === "select" || ctx === "where") {
      // After SELECT/WHERE → boost columns higher, tables lower
      for (const item of columnItems)
        addUniqueCompletion(items, seen, { ...item, boost: 10 });
      for (const item of tableItems)
        addUniqueCompletion(items, seen, { ...item, boost: 1 });
    } else {
      for (const item of tableItems) addUniqueCompletion(items, seen, item);
      for (const item of columnItems) addUniqueCompletion(items, seen, item);
    }

    return {
      from: word ? word.from : context.pos,
      options: items,
      validFor: WORD_PATTERN,
    };
  };
}
