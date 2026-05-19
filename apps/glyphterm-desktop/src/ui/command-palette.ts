import { t } from "../i18n";

export interface PaletteCommand {
  id: string;
  title: string;
  subtitle?: string;
  /** Extra search tokens */
  keywords?: string;
  run: () => void | Promise<void>;
}

let overlay: HTMLElement | null = null;
let input: HTMLInputElement | null = null;
let listEl: HTMLElement | null = null;
let commands: PaletteCommand[] = [];
let filtered: PaletteCommand[] = [];
let activeIndex = 0;
let visible = false;

function ensureDom() {
  if (overlay) return;
  overlay = document.createElement("div");
  overlay.className = "command-palette";
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="command-palette-backdrop" data-dismiss></div>
    <div class="command-palette-panel" role="dialog" aria-modal="true" aria-label="Command palette">
      <input type="text" class="command-palette-input" autocomplete="off" spellcheck="false" />
      <ul class="command-palette-list"></ul>
      <p class="command-palette-hint"></p>
    </div>
  `;
  document.body.appendChild(overlay);
  input = overlay.querySelector(".command-palette-input");
  listEl = overlay.querySelector(".command-palette-list");
  const hint = overlay.querySelector(".command-palette-hint");
  if (hint) hint.textContent = t("palette.hint");

  overlay.querySelector("[data-dismiss]")?.addEventListener("click", () => close());
  input?.addEventListener("input", () => {
    activeIndex = 0;
    renderList();
  });
  input?.addEventListener("keydown", (ev) => {
    if (ev.key === "ArrowDown") {
      ev.preventDefault();
      activeIndex = Math.min(activeIndex + 1, filtered.length - 1);
      renderList();
    } else if (ev.key === "ArrowUp") {
      ev.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      renderList();
    } else if (ev.key === "Enter") {
      ev.preventDefault();
      void runActive();
    } else if (ev.key === "Escape") {
      ev.preventDefault();
      close();
    }
  });
}

function score(cmd: PaletteCommand, q: string): number {
  if (!q) return 1;
  const hay = `${cmd.title} ${cmd.subtitle ?? ""} ${cmd.keywords ?? ""}`.toLowerCase();
  const query = q.toLowerCase();
  if (hay.includes(query)) return 10;
  let si = 0;
  for (const ch of query) {
    const idx = hay.indexOf(ch, si);
    if (idx < 0) return 0;
    si = idx + 1;
  }
  return 5;
}

function renderList() {
  if (!listEl || !input) return;
  const q = input.value.trim();
  filtered = commands
    .map((c) => ({ c, s: score(c, q) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.c);
  if (activeIndex >= filtered.length) activeIndex = Math.max(0, filtered.length - 1);

  listEl.innerHTML = "";
  filtered.forEach((cmd, i) => {
    const li = document.createElement("li");
    li.className = `command-item${i === activeIndex ? " active" : ""}`;
    li.innerHTML = `<span class="command-title">${escapeHtml(cmd.title)}</span>${
      cmd.subtitle
        ? `<span class="command-sub">${escapeHtml(cmd.subtitle)}</span>`
        : ""
    }`;
    li.addEventListener("mousedown", (ev) => {
      ev.preventDefault();
      activeIndex = i;
      void runActive();
    });
    listEl!.appendChild(li);
  });

  if (filtered.length === 0) {
    const empty = document.createElement("li");
    empty.className = "command-empty";
    empty.textContent = t("palette.empty");
    listEl.appendChild(empty);
  }
}

async function runActive() {
  const cmd = filtered[activeIndex];
  if (!cmd) return;
  close();
  await cmd.run();
}

export function registerPaletteCommands(cmds: PaletteCommand[]) {
  commands = cmds;
}

export function openCommandPalette() {
  ensureDom();
  if (!overlay || !input) return;
  visible = true;
  overlay.hidden = false;
  input.value = "";
  activeIndex = 0;
  renderList();
  requestAnimationFrame(() => input?.focus());
}

export function closeCommandPalette() {
  if (!overlay) return;
  visible = false;
  overlay.hidden = true;
}

export function toggleCommandPalette() {
  if (visible) closeCommandPalette();
  else openCommandPalette();
}

export function isCommandPaletteOpen() {
  return visible;
}

export function refreshPaletteHint() {
  const hint = overlay?.querySelector(".command-palette-hint");
  if (hint) hint.textContent = t("palette.hint");
}

export function initCommandPaletteShortcut() {
  document.addEventListener("keydown", (ev) => {
    if (!(ev.metaKey || ev.ctrlKey) || ev.key.toLowerCase() !== "k") return;
    if (ev.shiftKey) return;
    ev.preventDefault();
    toggleCommandPalette();
  });
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
}
