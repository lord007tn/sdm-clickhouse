export function parseTableFromSql(
  sql: string,
  fallbackDatabase?: string,
): { database: string; table: string } | null {
  const withDb = sql.match(/\bFROM\s+`?(\w+)`?\s*\.\s*`?(\w+)`?/i);
  if (withDb) return { database: withDb[1], table: withDb[2] };
  if (fallbackDatabase) {
    const withoutDb = sql.match(/\bFROM\s+`?(\w+)`?(?:\s|$|;)/i);
    if (withoutDb) return { database: fallbackDatabase, table: withoutDb[1] };
  }
  return null;
}

export function valueToSql(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "boolean") return value ? "1" : "0";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return `'${value.replace(/'/g, "''")}'`;
  return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
}

export function buildWhereClause(
  row: Record<string, unknown>,
  columns: string[],
): string {
  return columns
    .map((col) => {
      const val = row[col];
      if (val === null || val === undefined) return `\`${col}\` IS NULL`;
      if (typeof val === "object") {
        // Complex ClickHouse types (Map/Array/Tuple/JSON-like payloads) are
        // compared via JSON text to avoid parser/type coercion errors.
        return `toJSONString(\`${col}\`) = ${valueToSql(JSON.stringify(val))}`;
      }
      return `\`${col}\` = ${valueToSql(val)}`;
    })
    .join(" AND ");
}

export function coerceEditedValue(
  newText: string,
  originalValue: unknown,
): unknown {
  const trimmed = newText.trim();
  if (trimmed === "" || trimmed.toLowerCase() === "null") return null;
  if (typeof originalValue === "number") {
    const num = Number(trimmed);
    if (!isNaN(num) && isFinite(num)) return num;
  }
  if (typeof originalValue === "boolean") {
    if (trimmed === "true" || trimmed === "1") return true;
    if (trimmed === "false" || trimmed === "0") return false;
  }
  return newText;
}
