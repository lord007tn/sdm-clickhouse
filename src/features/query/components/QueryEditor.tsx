import { autocompletion } from "@codemirror/autocomplete";
import { sql, StandardSQL } from "@codemirror/lang-sql";
import { keymap, EditorView, placeholder } from "@codemirror/view";
import CodeMirror, { type Extension } from "@uiw/react-codemirror";
import { useEffect, useMemo, useRef } from "react";
import {
  createSqlCompletionSource,
  type SqlCompletionTable,
} from "@/features/query/lib/completion";

type QueryEditorProps = {
  value: string;
  onChange: (value: string) => void;
  onRunQuery: () => void;
  databases: string[];
  tables: SqlCompletionTable[];
  selectedTable?: SqlCompletionTable | null;
  selectedTableColumns: string[];
  placeholderText?: string;
};

const queryEditorTheme = EditorView.theme(
  {
    "&": {
      backgroundColor: "hsl(var(--card) / 0.92)",
      color: "hsl(var(--foreground))",
      fontSize: "0.875rem",
    },
    ".cm-scroller": {
      fontFamily: '"JetBrains Mono", monospace',
      lineHeight: "1.6",
      minHeight: "100px",
    },
    ".cm-content": {
      padding: "0.5rem 0.625rem",
      caretColor: "hsl(var(--primary))",
    },
    ".cm-gutters": {
      display: "none",
    },
    ".cm-focused": {
      outline: "none",
    },
    ".cm-activeLine": {
      backgroundColor: "hsl(var(--muted) / 0.32)",
    },
    ".cm-selectionBackground, .cm-content ::selection": {
      backgroundColor: "hsl(var(--primary) / 0.24)",
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "hsl(var(--primary))",
    },
    ".cm-placeholder": {
      color: "hsl(var(--muted-foreground))",
    },
    ".cm-tooltip-autocomplete": {
      borderRadius: "0.5rem",
      border: "1px solid hsl(var(--border))",
      backgroundColor: "hsl(var(--card))",
    },
    ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
      backgroundColor: "hsl(var(--muted))",
    },
  },
  { dark: true },
);

export function QueryEditor({
  value,
  onChange,
  onRunQuery,
  databases,
  tables,
  selectedTable = null,
  selectedTableColumns,
  placeholderText = "Write your SQL query here...",
}: QueryEditorProps) {
  const onRunQueryRef = useRef(onRunQuery);

  useEffect(() => {
    onRunQueryRef.current = onRunQuery;
  }, [onRunQuery]);

  const completionSource = useMemo(
    () =>
      createSqlCompletionSource({
        databases,
        tables,
        selectedTable,
        selectedTableColumns,
      }),
    [databases, tables, selectedTable, selectedTableColumns],
  );

  const extensions = useMemo<Extension[]>(
    () => [
      sql({ dialect: StandardSQL }),
      EditorView.lineWrapping,
      queryEditorTheme,
      autocompletion({
        override: [completionSource],
        activateOnTyping: true,
      }),
      keymap.of([
        {
          key: "Mod-Enter",
          run: () => {
            onRunQueryRef.current();
            return true;
          },
        },
      ]),
      placeholder(placeholderText),
    ],
    [completionSource, placeholderText],
  );

  return (
    <div
      data-testid="sql-editor"
      className="overflow-hidden rounded-md border border-border/40 bg-card/90"
    >
      <CodeMirror
        value={value}
        onChange={onChange}
        theme="dark"
        extensions={extensions}
        className="mono text-sm"
        basicSetup={{
          lineNumbers: false,
          foldGutter: false,
          highlightActiveLineGutter: false,
        }}
      />
    </div>
  );
}
