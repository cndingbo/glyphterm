import { invoke } from "@tauri-apps/api/core";
import { Frame, TerminalCanvas } from "../terminal";

/** One terminal block bound to a PTY tab. */
export class TerminalBlockView {
  readonly canvas: HTMLCanvasElement;
  readonly term: TerminalCanvas;
  tabId = 0;

  constructor(private host: HTMLElement) {
    this.canvas = document.createElement("canvas");
    this.canvas.className = "block-terminal-canvas";
    this.canvas.tabIndex = 0;
    this.host.appendChild(this.canvas);
    this.term = new TerminalCanvas(this.canvas);
    this.wireInput();
  }

  private wireInput() {
    this.canvas.addEventListener("keydown", async (ev) => {
      if (!this.tabId) return;
      if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === "v") {
        ev.preventDefault();
        const text = await navigator.clipboard?.readText();
        if (text) {
          await invoke("terminal_write", { data: text, tabId: this.tabId });
        }
        return;
      }
      if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === "c") {
        const text = await invoke<string>("terminal_copy_selection", {
          tabId: this.tabId,
        });
        if (text && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
        }
        ev.preventDefault();
        return;
      }
      const data = encodeKey(ev);
      if (data === null) return;
      ev.preventDefault();
      await invoke("terminal_write", { data, tabId: this.tabId });
    });

    this.canvas.addEventListener("mousedown", async (ev) => {
      if (!this.tabId || ev.button !== 0) return;
      const { col, row } = this.term.cellFromEvent(ev);
      await invoke("terminal_selection_start", {
        col,
        row,
        tabId: this.tabId,
      });
    });

    this.canvas.addEventListener("mousemove", async (ev) => {
      if (!this.tabId || ev.buttons !== 1) return;
      const { col, row } = this.term.cellFromEvent(ev);
      await invoke("terminal_selection_update", {
        col,
        row,
        tabId: this.tabId,
      });
    });
  }

  async attachNewLocalTab(): Promise<number> {
    const { cols, rows } = this.term.gridSize();
    this.tabId = await invoke<number>("terminal_tab_new_local", { cols, rows });
    return this.tabId;
  }

  render(frame: Frame) {
    this.term.render(frame);
  }

  async resize() {
    if (!this.tabId) return;
    const { cols, rows } = this.term.gridSize();
    await invoke("terminal_resize", { cols, rows, tabId: this.tabId });
  }

  focus() {
    this.term.focus();
  }

  destroy() {
    if (this.tabId) {
      void invoke("terminal_tab_close", { tabId: this.tabId });
    }
    this.canvas.remove();
  }
}

function encodeKey(ev: KeyboardEvent): string | null {
  if (ev.metaKey || ev.ctrlKey) {
    if (ev.key.toLowerCase() === "l") return "\x0c";
    return null;
  }
  if (ev.key === "Enter") return "\r";
  if (ev.key === "Backspace") return "\x7f";
  if (ev.key === "Delete") return "\x1b[3~";
  if (ev.key === "Tab") return "\t";
  if (ev.key === "Escape") return "\x1b";
  if (ev.key === "ArrowUp") return "\x1b[A";
  if (ev.key === "ArrowDown") return "\x1b[B";
  if (ev.key === "ArrowRight") return "\x1b[C";
  if (ev.key === "ArrowLeft") return "\x1b[D";
  if (ev.key.length === 1 && !ev.altKey) return ev.key;
  return null;
}
