import * as monaco from "monaco-editor";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import cssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
import htmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";
import { getTheme } from "../themes";
import { languageIdForPath } from "../fs/client";

self.MonacoEnvironment = {
  getWorker(_: unknown, label: string) {
    if (label === "json") return new jsonWorker();
    if (label === "css" || label === "scss" || label === "less")
      return new cssWorker();
    if (label === "html" || label === "handlebars" || label === "razor")
      return new htmlWorker();
    if (
      label === "typescript" ||
      label === "javascript" ||
      label === "typescriptreact" ||
      label === "javascriptreact"
    ) {
      return new tsWorker();
    }
    return new editorWorker();
  },
};

export interface MonacoPaneOptions {
  path: string | null;
  initialContent?: string;
  onSave?: (path: string, content: string) => void | Promise<void>;
}

/** VS Code–class editor surface (Monaco). */
export class MonacoPane {
  private editor: monaco.editor.IStandaloneCodeEditor | null = null;
  private path: string | null = null;
  private dirty = false;

  constructor(
    private container: HTMLElement,
    private opts: MonacoPaneOptions = { path: null },
  ) {}

  mount() {
    if (this.editor) return;
    const t = getTheme();
    const isLight = t.id === "paper";

    this.editor = monaco.editor.create(this.container, {
      value: this.opts.initialContent ?? "",
      language: this.opts.path
        ? languageIdForPath(this.opts.path)
        : "plaintext",
      theme: isLight ? "vs" : "vs-dark",
      fontFamily: t.font.family,
      fontSize: t.font.size,
      lineHeight: Math.round(t.font.size * t.font.lineHeight),
      minimap: { enabled: true },
      scrollBeyondLastLine: false,
      automaticLayout: true,
      wordWrap: "on",
      tabSize: 2,
      renderWhitespace: "selection",
      smoothScrolling: true,
      cursorBlinking: "smooth",
      padding: { top: 12, bottom: 12 },
    });

    this.path = this.opts.path;
    this.editor.onDidChangeModelContent(() => {
      this.dirty = true;
    });

    this.container.addEventListener("keydown", (ev) => {
      if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === "s") {
        ev.preventDefault();
        void this.save();
      }
    });
  }

  async openFile(path: string, content: string) {
    this.mount();
    if (!this.editor) return;
    this.path = path;
    this.dirty = false;
    const lang = languageIdForPath(path);
    const model = monaco.editor.createModel(content, lang);
    this.editor.setModel(model);
  }

  getValue(): string {
    return this.editor?.getValue() ?? "";
  }

  async save(): Promise<boolean> {
    if (!this.path || !this.editor) return false;
    const content = this.editor.getValue();
    if (this.opts.onSave) {
      await this.opts.onSave(this.path, content);
    }
    this.dirty = false;
    return true;
  }

  isDirty() {
    return this.dirty;
  }

  getPath() {
    return this.path;
  }

  layout() {
    this.editor?.layout();
  }

  dispose() {
    this.editor?.dispose();
    this.editor = null;
  }
}
