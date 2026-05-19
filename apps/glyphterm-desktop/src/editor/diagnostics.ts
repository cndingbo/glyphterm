import * as monaco from "monaco-editor";
import { fileName } from "../fs/client";

export interface ProblemItem {
  id: string;
  path: string;
  fileName: string;
  line: number;
  column: number;
  message: string;
  severity: "error" | "warning" | "info" | "hint";
  source?: string;
}

const listeners = new Set<() => void>();

function severityLabel(
  s: monaco.MarkerSeverity,
): ProblemItem["severity"] {
  if (s === monaco.MarkerSeverity.Error) return "error";
  if (s === monaco.MarkerSeverity.Warning) return "warning";
  if (s === monaco.MarkerSeverity.Info) return "info";
  return "hint";
}

export function collectProblems(): ProblemItem[] {
  const markers = monaco.editor.getModelMarkers({});
  const items: ProblemItem[] = [];
  for (const m of markers) {
    const path =
      m.resource.scheme === "file"
        ? m.resource.fsPath || m.resource.path.replace(/^file:\/\//, "")
        : m.resource.path.replace(/^file:\/\//, "");
    if (!path || m.severity === monaco.MarkerSeverity.Hint) continue;
    items.push({
      id: `${path}:${m.startLineNumber}:${m.startColumn}:${m.message}`,
      path,
      fileName: fileName(path),
      line: m.startLineNumber,
      column: m.startColumn,
      message: m.message,
      severity: severityLabel(m.severity),
      source: m.source,
    });
  }
  items.sort((a, b) => {
    const sev =
      severityRank(b.severity) - severityRank(a.severity);
    if (sev !== 0) return sev;
    return a.path.localeCompare(b.path) || a.line - b.line;
  });
  return items;
}

function severityRank(s: ProblemItem["severity"]): number {
  if (s === "error") return 4;
  if (s === "warning") return 3;
  if (s === "info") return 2;
  return 1;
}

let subscribed = false;

export function subscribeDiagnostics(onChange: () => void): () => void {
  if (!subscribed) {
    subscribed = true;
    monaco.editor.onDidChangeMarkers(() => {
      listeners.forEach((fn) => fn());
    });
  }
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

export function problemCounts(): {
  errors: number;
  warnings: number;
} {
  const all = collectProblems();
  return {
    errors: all.filter((p) => p.severity === "error").length,
    warnings: all.filter((p) => p.severity === "warning").length,
  };
}
