import * as monaco from "monaco-editor";
import { getRustLspClient, type RustLspClient } from "./rust-lsp-client";

let registered = false;

function lspPosition(position: monaco.Position) {
  return {
    line: position.lineNumber - 1,
    character: position.column - 1,
  };
}

/** Wire Monaco hover / completion / go-to-definition to rust-analyzer. */
export function registerRustLspProviders(client: RustLspClient = getRustLspClient()) {
  if (registered) return;
  registered = true;

  monaco.languages.registerHoverProvider("rust", {
    provideHover: async (model, position) => {
      const uri = model.uri.toString();
      const result = (await client.request("textDocument/hover", {
        textDocument: { uri },
        position: lspPosition(position),
      })) as {
        contents?: { value: string } | { value: string }[] | string;
      } | null;
      if (!result?.contents) return null;
      const value = Array.isArray(result.contents)
        ? result.contents.map((c) => (typeof c === "string" ? c : c.value)).join("\n\n")
        : typeof result.contents === "string"
          ? result.contents
          : result.contents.value;
      return { range: new monaco.Range(position.lineNumber, 1, position.lineNumber, 1), contents: [{ value }] };
    },
  });

  monaco.languages.registerCompletionItemProvider("rust", {
    triggerCharacters: [".", ":", ">", "(", "@"],
    provideCompletionItems: async (model, position) => {
      const uri = model.uri.toString();
      const result = (await client.request("textDocument/completion", {
        textDocument: { uri },
        position: lspPosition(position),
      })) as {
        items?: LspCompletionItem[];
        isIncomplete?: boolean;
      } | LspCompletionItem[] | null;
      const items = Array.isArray(result) ? result : result?.items ?? [];
      const suggestions: monaco.languages.CompletionItem[] = items.map((item) => ({
        label: item.label,
        kind: mapCompletionKind(item.kind),
        detail: item.detail,
        documentation: item.documentation,
        insertText: item.insertText ?? item.label,
        insertTextRules: item.insertTextFormat === 2
          ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
          : undefined,
        range: {
          startLineNumber: position.lineNumber,
          startColumn: position.column,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        },
      }));
      return { suggestions, incomplete: !Array.isArray(result) && Boolean(result?.isIncomplete) };
    },
  });

  monaco.languages.registerDefinitionProvider("rust", {
    provideDefinition: async (model, position) => {
      const uri = model.uri.toString();
      const result = await client.request("textDocument/definition", {
        textDocument: { uri },
        position: lspPosition(position),
      });
      return mapLocations(result, model.uri);
    },
  });
}

interface LspCompletionItem {
  label: string;
  kind?: number;
  detail?: string;
  documentation?: string;
  insertText?: string;
  insertTextFormat?: number;
}

function mapCompletionKind(kind?: number): monaco.languages.CompletionItemKind {
  const table: monaco.languages.CompletionItemKind[] = [
    monaco.languages.CompletionItemKind.Text,
    monaco.languages.CompletionItemKind.Method,
    monaco.languages.CompletionItemKind.Function,
    monaco.languages.CompletionItemKind.Constructor,
    monaco.languages.CompletionItemKind.Field,
    monaco.languages.CompletionItemKind.Variable,
    monaco.languages.CompletionItemKind.Class,
    monaco.languages.CompletionItemKind.Interface,
    monaco.languages.CompletionItemKind.Module,
    monaco.languages.CompletionItemKind.Property,
    monaco.languages.CompletionItemKind.Unit,
    monaco.languages.CompletionItemKind.Value,
    monaco.languages.CompletionItemKind.Enum,
    monaco.languages.CompletionItemKind.Keyword,
    monaco.languages.CompletionItemKind.Snippet,
    monaco.languages.CompletionItemKind.Color,
    monaco.languages.CompletionItemKind.File,
    monaco.languages.CompletionItemKind.Reference,
    monaco.languages.CompletionItemKind.Folder,
    monaco.languages.CompletionItemKind.EnumMember,
    monaco.languages.CompletionItemKind.Constant,
    monaco.languages.CompletionItemKind.Struct,
    monaco.languages.CompletionItemKind.Event,
    monaco.languages.CompletionItemKind.Operator,
    monaco.languages.CompletionItemKind.TypeParameter,
  ];
  if (kind === undefined || kind < 0 || kind >= table.length) {
    return monaco.languages.CompletionItemKind.Text;
  }
  return table[kind]!;
}

function mapLocations(
  result: unknown,
  fallbackUri: monaco.Uri,
): monaco.languages.Location[] | null {
  if (!result) return null;
  const list = Array.isArray(result) ? result : [result];
  const out: monaco.languages.Location[] = [];
  for (const loc of list) {
    const item = loc as {
      uri?: string;
      range?: {
        start: { line: number; character: number };
        end: { line: number; character: number };
      };
    };
    if (!item.range) continue;
    const uri = item.uri ? monaco.Uri.parse(item.uri) : fallbackUri;
    out.push({
      uri,
      range: new monaco.Range(
        item.range.start.line + 1,
        item.range.start.character + 1,
        item.range.end.line + 1,
        item.range.end.character + 1,
      ),
    });
  }
  return out.length ? out : null;
}
