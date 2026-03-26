import {
  autocompletion,
  completionKeymap,
  startCompletion,
} from "@codemirror/autocomplete";
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
      boxShadow: "0 8px 32px -12px rgba(0,0,0,0.4)",
      maxHeight: "260px",
    },
    ".cm-tooltip-autocomplete > ul": {
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: "0.8rem",
    },
    ".cm-tooltip-autocomplete > ul > li": {
      padding: "3px 10px",
      lineHeight: "1.4",
    },
    ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
      backgroundColor: "var(--color-muted)",
    },
    ".cm-completionIcon": {
      opacity: "0.6",
    },
    ".cm-completionDetail": {
      opacity: "0.5",
      fontStyle: "normal",
      fontSize: "0.72rem",
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
        activateOnCompletion: () => true,
        maxRenderedOptions: 40,
        icons: true,
        closeOnBlur: true,
        interactionDelay: 75,
      }),
      keymap.of([
        ...completionKeymap,
        {
          key: "Mod-Enter",
          run: () => {
            onRunQueryRef.current();
            return true;
          },
        },
      ]),
      placeholder(placeholderText),
      // Trigger autocomplete after typing a dot (for database.table completion)
      EditorView.inputHandler.of((view, _from, _to, text) => {
        if (text === ".") {
          // Insert the dot first, then trigger autocomplete
          window.setTimeout(() => {
            startCompletion(view);
          }, 10);
        }
        return false;
      }),
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
          autocompletion: false,
        }}
      />
    </div>
  );
}
