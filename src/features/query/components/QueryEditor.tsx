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
      backgroundColor: "color-mix(in srgb, var(--color-card) 92%, transparent)",
      color: "var(--color-foreground)",
      fontSize: "0.875rem",
    },
    ".cm-scroller": {
      fontFamily: '"JetBrains Mono", monospace',
      lineHeight: "1.6",
      minHeight: "100px",
    },
    ".cm-content": {
      padding: "0.5rem 0.625rem",
      caretColor: "var(--color-primary)",
    },
    ".cm-gutters": {
      display: "none",
    },
    ".cm-focused": {
      outline: "none",
    },
    ".cm-activeLine": {
      backgroundColor:
        "color-mix(in srgb, var(--color-muted) 32%, transparent)",
    },
    ".cm-selectionBackground, .cm-content ::selection": {
      backgroundColor:
        "color-mix(in srgb, var(--color-primary) 24%, transparent)",
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "var(--color-primary)",
    },
    ".cm-placeholder": {
      color: "var(--color-muted-foreground)",
    },
    ".cm-tooltip-autocomplete": {
      borderRadius: "0.5rem",
      border: "1px solid var(--color-border)",
      backgroundColor: "var(--color-card)",
    },
    ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
      backgroundColor: "var(--color-muted)",
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
