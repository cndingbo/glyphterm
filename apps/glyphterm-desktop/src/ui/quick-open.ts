import { searchFiles, type FsSearchHit } from "../fs/client";
import { t } from "../i18n";
import { fileName } from "../fs/client";
import { listRecentFiles, listRecentWorkspaces } from "../workspace/recent-files";
import { iconFile } from "./icons";

type OpenHandler = (path: string) => void | Promise<void>;
type WorkspaceHandler = (root: string) => void | Promise<void>;

type QuickOpenRow =
  | { kind: "header"; label: string }
  | { kind: "file"; path: string; name: string; sub: string }
  | { kind: "workspace"; path: string; name: string; sub: string };

let overlay: HTMLElement | null = null;
let input: HTMLInputElement | null = null;
let listEl: HTMLElement | null = null;
let onOpen: OpenHandler | null = null;
let onOpenWorkspace: WorkspaceHandler | null = null;
let rows: QuickOpenRow[] = [];
let activeIndex = 0;
let visible = false;
let searchTimer: ReturnType<typeof setTimeout> | null = null;
let searchGen = 0;

function ensureDom() {
  if (overlay) return;
  overlay = document.createElement("div");
  overlay.className = "quick-open";
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="quick-open-backdrop" data-dismiss></div>
    <div class="quick-open-panel" role="dialog" aria-modal="true" aria-label="Quick Open">
      <div class="quick-open-header">
        <span class="quick-open-label">${escapeHtml(t("quickOpen.label"))}</span>
        <input type="text" class="quick-open-input" autocomplete="off" spellcheck="false" placeholder="" />
      </div>
      <ul class="quick-open-list"></ul>
      <p class="quick-open-hint"></p>
    </div>
  `;
  document.body.appendChild(overlay);
  input = overlay.querySelector(".quick-open-input");
  listEl = overlay.querySelector(".quick-open-list");
  const hint = overlay.querySelector(".quick-open-hint");
  if (hint) hint.textContent = t("quickOpen.hint");
  if (input) input.placeholder = t("quickOpen.placeholder");

  overlay.querySelector("[data-dismiss]")?.addEventListener("click", () => close());
  input?.addEventListener("input", () => {
    activeIndex = 0;
    scheduleSearch();
  });
  input?.addEventListener("keydown", (ev) => {
    const selectable = selectableRows();
    if (ev.key === "ArrowDown") {
      ev.preventDefault();
      if (!selectable.length) return;
      const idx = selectable.indexOf(activeIndex);
      activeIndex = selectable[Math.min(idx + 1, selectable.length - 1)] ?? activeIndex;
      renderList();
    } else if (ev.key === "ArrowUp") {
      ev.preventDefault();
      if (!selectable.length) return;
      const idx = selectable.indexOf(activeIndex);
      activeIndex = selectable[Math.max(idx - 1, 0)] ?? activeIndex;
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

function selectableRows(): number[] {
  return rows
    .map((r, i) => (r.kind === "file" ? i : -1))
    .filter((i) => i >= 0);
}

function scheduleSearch() {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => void runSearch(), 120);
}

function recentRows(): QuickOpenRow[] {
  const out: QuickOpenRow[] = [];
  const workspaces = listRecentWorkspaces();
  if (workspaces.length) {
    out.push({ kind: "header", label: t("quickOpen.recentWorkspaces") });
    for (const w of workspaces.slice(0, 6)) {
      out.push({
        kind: "workspace",
        path: w,
        name: fileName(w) || w,
        sub: w,
      });
    }
  }
  const recent = listRecentFiles();
  if (!recent.length) return out;
  out.push({ kind: "header", label: t("quickOpen.recent") });
  for (const e of recent.slice(0, 12)) {
    out.push({
      kind: "file",
      path: e.path,
      name: e.name,
      sub: e.path,
    });
  }
  return out;
}

function hitsToRows(hits: FsSearchHit[]): QuickOpenRow[] {
  const out: QuickOpenRow[] = [];
  if (hits.length) {
    out.push({ kind: "header", label: t("quickOpen.results") });
  }
  for (const hit of hits) {
    out.push({
      kind: "file",
      path: hit.path,
      name: hit.name,
      sub: hit.relative,
    });
  }
  return out;
}

async function runSearch() {
  if (!input) return;
  const q = input.value.trim();
  const gen = ++searchGen;
  if (q.length === 0) {
    rows = recentRows();
    const sel = selectableRows();
    activeIndex = sel[0] ?? 0;
    renderList();
    return;
  }
  try {
    const next = await searchFiles(q, 40);
    if (gen !== searchGen) return;
    rows = hitsToRows(next);
    const sel = selectableRows();
    activeIndex = sel[0] ?? 0;
    renderList();
  } catch {
    if (gen !== searchGen) return;
    rows = [];
    renderList();
  }
}

function renderList() {
  if (!listEl) return;
  listEl.innerHTML = "";
  if (rows.length === 0) {
    const empty = document.createElement("li");
    empty.className = "quick-open-empty";
    empty.textContent = input?.value.trim()
      ? t("quickOpen.empty")
      : t("quickOpen.noRecent");
    listEl.appendChild(empty);
    return;
  }
  rows.forEach((row, i) => {
    if (row.kind === "header") {
      const li = document.createElement("li");
      li.className = "quick-open-section";
      li.textContent = row.label;
      listEl!.appendChild(li);
      return;
    }
    const li = document.createElement("li");
    li.className = `quick-open-item${i === activeIndex ? " active" : ""}${row.kind === "workspace" ? " workspace-row" : ""}`;
    li.innerHTML = `
      <span class="quick-open-icon">${iconFile}</span>
      <span class="quick-open-meta">
        <span class="quick-open-name">${escapeHtml(row.name)}${row.kind === "workspace" ? ` · ${escapeHtml(t("quickOpen.workspaceTag"))}` : ""}</span>
        <span class="quick-open-path">${escapeHtml(row.sub)}</span>
      </span>`;
    li.addEventListener("mousedown", (ev) => {
      ev.preventDefault();
      activeIndex = i;
      void runActive();
    });
    listEl!.appendChild(li);
  });
}

async function runActive() {
  const row = rows[activeIndex];
  if (!row || row.kind === "header") return;
  close();
  if (row.kind === "workspace") {
    if (onOpenWorkspace) await onOpenWorkspace(row.path);
    return;
  }
  if (onOpen) await onOpen(row.path);
}

export function setQuickOpenHandler(handler: OpenHandler) {
  onOpen = handler;
}

export function setQuickOpenWorkspaceHandler(handler: WorkspaceHandler) {
  onOpenWorkspace = handler;
}

export function openQuickOpen() {
  ensureDom();
  if (!overlay || !input) return;
  visible = true;
  overlay.hidden = false;
  input.value = "";
  rows = recentRows();
  const sel = selectableRows();
  activeIndex = sel[0] ?? 0;
  renderList();
  requestAnimationFrame(() => input?.focus());
}

export function closeQuickOpen() {
  if (!overlay) return;
  visible = false;
  overlay.hidden = true;
  searchGen++;
}

export function refreshQuickOpenUi() {
  const hint = overlay?.querySelector(".quick-open-hint");
  if (hint) hint.textContent = t("quickOpen.hint");
  if (input) input.placeholder = t("quickOpen.placeholder");
  const label = overlay?.querySelector(".quick-open-label");
  if (label) label.textContent = t("quickOpen.label");
}

export function initQuickOpenShortcut() {
  document.addEventListener("keydown", (ev) => {
    if (!(ev.metaKey || ev.ctrlKey) || ev.key.toLowerCase() !== "p") return;
    if (ev.shiftKey) return;
    ev.preventDefault();
    if (visible) closeQuickOpen();
    else openQuickOpen();
  });
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
}
