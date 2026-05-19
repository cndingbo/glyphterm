import * as monaco from "monaco-editor";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { appendOutput } from "../ui/output-log";
import { t } from "../i18n";

const MARKER_OWNER = "rust-analyzer";

interface LspDiagnostic {
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  severity?: number;
  message: string;
  source?: string;
}

interface PublishDiagnosticsParams {
  uri: string;
  diagnostics: LspDiagnostic[];
}

function pathToFileUri(path: string): string {
  if (path.startsWith("file://")) return path;
  const normalized = path.replace(/\\/g, "/");
  return normalized.startsWith("/")
    ? `file://${normalized}`
    : `file:///${normalized}`;
}

function lspSeverityToMonaco(s?: number): monaco.MarkerSeverity {
  if (s === 1) return monaco.MarkerSeverity.Error;
  if (s === 2) return monaco.MarkerSeverity.Warning;
  if (s === 3) return monaco.MarkerSeverity.Info;
  return monaco.MarkerSeverity.Hint;
}

/** Minimal JSON-RPC over WebSocket → rust-analyzer (diagnostics-first). */
export class RustLspClient {
  private ws: WebSocket | null = null;
  private nextId = 1;
  private pending = new Map<
    number,
    { resolve: (v: unknown) => void; reject: (err: Error) => void }
  >();
  private ready = false;
  private rootUri = "";
  private workspaceRoot = "";
  private versionByUri = new Map<string, number>();
  private stopListen: (() => void) | null = null;

  async ensureStarted(workspaceRoot: string): Promise<boolean> {
    if (this.ready && this.workspaceRoot === workspaceRoot && this.ws) {
      return true;
    }
    await this.stop();
    this.workspaceRoot = workspaceRoot;

    try {
      const result = await invoke<{ port: number; server: string }>(
        "lsp_rust_start",
        { workspaceRoot },
      );
      await this.connect(result.port);
      appendOutput(
        "GlyphTerm",
        t("lsp.rustStarted", { server: result.server, port: String(result.port) }),
      );
      return true;
    } catch (e) {
      appendOutput("GlyphTerm", t("lsp.rustFailed", { error: String(e) }));
      return false;
    }
  }

  private connect(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}`);
      this.ws = ws;
      const timeout = window.setTimeout(() => {
        reject(new Error("LSP WebSocket timeout"));
      }, 12_000);

      ws.onopen = () => {
        void this.initialize()
          .then(() => {
            window.clearTimeout(timeout);
            this.ready = true;
            resolve();
          })
          .catch((err) => {
            window.clearTimeout(timeout);
            reject(err);
          });
      };
      ws.onerror = () => {
        window.clearTimeout(timeout);
        reject(new Error("LSP WebSocket error"));
      };
      ws.onmessage = (ev) => this.onMessage(String(ev.data));
      ws.onclose = () => {
        this.ready = false;
      };
    });
  }

  private async initialize(): Promise<void> {
    this.rootUri = pathToFileUri(this.workspaceRoot);
    const caps = {
      textDocument: {
        synchronization: { dynamicRegistration: false },
        completion: { dynamicRegistration: false },
        hover: { dynamicRegistration: false },
      },
    };
    const result = await this.sendRequest("initialize", {
      processId: null,
      rootUri: this.rootUri,
      capabilities: caps,
      workspaceFolders: [
        { uri: this.rootUri, name: this.workspaceRoot.split(/[/\\]/).pop() ?? "workspace" },
      ],
    });
    void result;
    this.sendNotification("initialized", {});
    this.stopListen = await listen("lsp-rust-stopped", () => {
      this.ready = false;
      appendOutput("GlyphTerm", t("lsp.rustStopped"));
    });
  }

  openDocument(path: string, text: string) {
    if (!this.ready) return;
    const uri = pathToFileUri(path);
    this.versionByUri.set(uri, 1);
    this.sendNotification("textDocument/didOpen", {
      textDocument: {
        uri,
        languageId: "rust",
        version: 1,
        text,
      },
    });
  }

  changeDocument(path: string, text: string) {
    if (!this.ready) return;
    const uri = pathToFileUri(path);
    const version = (this.versionByUri.get(uri) ?? 1) + 1;
    this.versionByUri.set(uri, version);
    this.sendNotification("textDocument/didChange", {
      textDocument: { uri, version },
      contentChanges: [{ text }],
    });
  }

  closeDocument(path: string) {
    if (!this.ready) return;
    const uri = pathToFileUri(path);
    this.versionByUri.delete(uri);
    this.sendNotification("textDocument/didClose", {
      textDocument: { uri },
    });
    const model = monaco.editor.getModel(monaco.Uri.parse(uri));
    if (model) monaco.editor.setModelMarkers(model, MARKER_OWNER, []);
  }

  private onMessage(raw: string) {
    let msg: {
      id?: number;
      method?: string;
      params?: PublishDiagnosticsParams;
      result?: unknown;
      error?: { message: string };
    };
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (msg.method === "textDocument/publishDiagnostics" && msg.params) {
      this.applyDiagnostics(msg.params);
      return;
    }
    if (msg.id !== undefined) {
      const pending = this.pending.get(msg.id);
      if (!pending) return;
      this.pending.delete(msg.id);
      if (msg.error) pending.reject(new Error(msg.error.message));
      else pending.resolve(msg.result);
    }
  }

  private applyDiagnostics(params: PublishDiagnosticsParams) {
    const uri = monaco.Uri.parse(params.uri);
    const model = monaco.editor.getModel(uri);
    if (!model) return;
    const markers: monaco.editor.IMarkerData[] = params.diagnostics.map((d) => ({
      severity: lspSeverityToMonaco(d.severity),
      message: d.message,
      startLineNumber: d.range.start.line + 1,
      startColumn: d.range.start.character + 1,
      endLineNumber: d.range.end.line + 1,
      endColumn: d.range.end.character + 1,
      source: d.source ?? "rust-analyzer",
    }));
    monaco.editor.setModelMarkers(model, MARKER_OWNER, markers);
  }

  private sendNotification(method: string, params: unknown) {
    this.ws?.send(JSON.stringify({ jsonrpc: "2.0", method, params }));
  }

  private sendRequest(method: string, params: unknown): Promise<unknown> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws?.send(
        JSON.stringify({ jsonrpc: "2.0", id, method, params }),
      );
    });
  }

  async stop() {
    this.stopListen?.();
    this.stopListen = null;
    this.ready = false;
    this.ws?.close();
    this.ws = null;
    this.pending.clear();
    this.versionByUri.clear();
    try {
      await invoke("lsp_rust_stop");
    } catch {
      /* ignore */
    }
  }
}

let shared: RustLspClient | null = null;

export function getRustLspClient(): RustLspClient {
  if (!shared) shared = new RustLspClient();
  return shared;
}
