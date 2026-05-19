import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { checkCjkFonts, TerminalCanvas } from "./terminal";
import type { Frame } from "./terminal";

const canvas = document.getElementById("terminal") as HTMLCanvasElement | null;
const fontBanner = document.getElementById("font-banner");
if (!canvas) throw new Error("#terminal missing");

const term = new TerminalCanvas(canvas);
let started = false;
let selecting = false;

async function startSession() {
  const { cols, rows } = term.gridSize();
  await invoke("terminal_start", { cols, rows });
  started = true;
}

async function resizeSession() {
  if (!started) return;
  const { cols, rows } = term.gridSize();
  await invoke("terminal_resize", { cols, rows });
}

async function copySelection() {
  const text = await invoke<string>("terminal_copy_selection");
  if (text && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
  }
}

function encodeInput(ev: KeyboardEvent): string | null {
  const mod = ev.metaKey || ev.ctrlKey;

  if (mod && ev.key.toLowerCase() === "c") {
    void copySelection();
    return null;
  }
  if (mod && ev.key.toLowerCase() === "v") {
    return null; // paste handled separately
  }
  if (mod && ev.key.toLowerCase() === "l") {
    return "\x0c";
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
  if (ev.key === "Home") return "\x1b[H";
  if (ev.key === "End") return "\x1b[F";
  if (ev.key.length === 1 && !ev.altKey) {
    return ev.key;
  }
  return null;
}

canvas.addEventListener("keydown", async (ev) => {
  if (!started) return;

  if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === "v") {
    ev.preventDefault();
    const text = await navigator.clipboard?.readText();
    if (text) await invoke("terminal_write", { data: text });
    return;
  }

  const data = encodeInput(ev);
  if (data === null) {
    if (ev.metaKey || ev.ctrlKey) ev.preventDefault();
    return;
  }
  ev.preventDefault();
  await invoke("terminal_write", { data });
});

canvas.addEventListener("mousedown", async (ev) => {
  if (!started || ev.button !== 0) return;
  selecting = true;
  const { col, row } = term.cellFromEvent(ev);
  await invoke("terminal_selection_start", { col, row });
});

canvas.addEventListener("mousemove", async (ev) => {
  if (!started || !selecting) return;
  const { col, row } = term.cellFromEvent(ev);
  await invoke("terminal_selection_update", { col, row });
});

window.addEventListener("mouseup", async () => {
  selecting = false;
});

canvas.addEventListener("dblclick", async () => {
  if (!started) return;
  await copySelection();
});

window.addEventListener("resize", () => {
  void resizeSession();
});

if (fontBanner && !checkCjkFonts()) {
  fontBanner.hidden = false;
  fontBanner.textContent =
    "建议安装 CJK 等宽字体（如 Sarasa Mono SC）以获得最佳中文显示：brew install --cask font-sarasa-gothic";
}

await listen<Frame>("terminal-frame", (event) => {
  term.render(event.payload);
});

await startSession();
term.focus();
