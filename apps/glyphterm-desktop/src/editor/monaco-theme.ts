import * as monaco from "monaco-editor";
import type { TerminalTheme } from "../themes/types";

const registered = new Set<string>();

function ruleColor(hex: string) {
  return hex.replace("#", "");
}

function buildMonacoTheme(t: TerminalTheme): monaco.editor.IStandaloneThemeData {
  const bg = t.terminal.background;
  const fg = t.terminal.foreground;
  const isLight = t.id === "paper";

  return {
    base: isLight ? "vs" : "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "6a737d", fontStyle: "italic" },
      { token: "keyword", foreground: ruleColor(t.terminal.ansi[5] ?? "#c792ea") },
      { token: "string", foreground: ruleColor(t.terminal.ansi[2] ?? "#98c379") },
      { token: "number", foreground: ruleColor(t.terminal.ansi[3] ?? "#e5c07b") },
    ],
    colors: {
      "editor.background": bg,
      "editor.foreground": fg,
      "editor.lineHighlightBackground": isLight
        ? "#00000008"
        : "#ffffff06",
      "editor.selectionBackground": t.terminal.selection,
      "editor.inactiveSelectionBackground": t.terminal.selection,
      "editorCursor.foreground": t.terminal.cursor,
      "editorLineNumber.foreground": isLight ? "#b0b0b0" : "#4a4f5a",
      "editorLineNumber.activeForeground": ruleColor(t.ui.accent),
      "editorWidget.background": t.ui.titlebar,
      "editorWidget.border": t.ui.border,
      "minimap.background": bg,
      "scrollbarSlider.background": isLight
        ? "#00000018"
        : "#ffffff14",
      "scrollbarSlider.hoverBackground": isLight
        ? "#00000028"
        : "#ffffff22",
    },
  };
}

export function applyMonacoThemeFromApp(theme: TerminalTheme) {
  const id = `glyphterm-${theme.id}`;
  if (!registered.has(id)) {
    monaco.editor.defineTheme(id, buildMonacoTheme(theme));
    registered.add(id);
  }
  monaco.editor.setTheme(id);
}

export function refreshAllMonacoEditors() {
  for (const ed of monaco.editor.getEditors()) {
    ed.layout();
  }
}
