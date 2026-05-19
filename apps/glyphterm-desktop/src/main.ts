import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Frame, TerminalCanvas } from "./terminal";

const canvas = document.getElementById("terminal") as HTMLCanvasElement | null;
if (!canvas) throw new Error("#terminal missing");

const term = new TerminalCanvas(canvas);
let started = false;

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

function encodeInput(ev: KeyboardEvent): string | null {
  if (ev.ctrlKey && ev.key === "c") return null;
  if (ev.key === "Enter") return "\r";
  if (ev.key === "Backspace") return "\x7f";
  if (ev.key === "Tab") return "\t";
  if (ev.key === "Escape") return "\x1b";
  if (ev.key === "ArrowUp") return "\x1b[A";
  if (ev.key === "ArrowDown") return "\x1b[B";
  if (ev.key === "ArrowRight") return "\x1b[C";
  if (ev.key === "ArrowLeft") return "\x1b[D";
  if (ev.key.length === 1 && !ev.metaKey && !ev.altKey) {
    return ev.key;
  }
  return null;
}

canvas.addEventListener("keydown", async (ev) => {
  if (!started) return;
  const data = encodeInput(ev);
  if (data === null) return;
  ev.preventDefault();
  await invoke("terminal_write", { data });
});

window.addEventListener("resize", () => {
  void resizeSession();
});

await listen<Frame>("terminal-frame", (event) => {
  term.render(event.payload);
});

await startSession();
term.focus();
