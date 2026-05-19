import { searchFiles, type FsSearchHit } from "../fs/client";
import { t } from "../i18n";
import { iconFile } from "./icons";

type OpenHandler = (path: string) => void | Promise<void>;

let overlay: HTMLElement | null = null;
let input: HTMLInputElement | null = null;
let listEl: HTMLElement | null = null;
let onOpen: OpenHandler | null = null;
let hits: FsSearchHit[] = [];
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
    if (ev.key === "ArrowDown") {
      ev.preventDefault();
      activeIndex = Math.min(activeIndex + 1, hits.length - 1);
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

function scheduleSearch() {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => void runSearch(), 120);
}

async function runSearch() {
  if (!input) return;
  const q = input.value.trim();
  const gen = ++searchGen;
  if (q.length === 0) {
    hits = [];
    renderList();
    return;
  }
  try {
    const next = await searchFiles(q, 40);
    if (gen !== searchGen) return;
    hits = next;
    activeIndex = 0;
    renderList();
  } catch {
    if (gen !== searchGen) return;
    hits = [];
    renderList();
  }
}

function renderList() {
  if (!listEl) return;
  listEl.innerHTML = "";
  if (!input?.value.trim()) {
    const empty = document.createElement("li");
    empty.className = "quick-open-empty";
    empty.textContent = t("quickOpen.typeToSearch");
    listEl.appendChild(empty);
    return;
  }
  if (hits.length === 0) {
    const empty = document.createElement("li");
    empty.className = "quick-open-empty";
    empty.textContent = t("quickOpen.empty");
    listEl.appendChild(empty);
    return;
  }
  hits.forEach((hit, i) => {
    const li = document.createElement("li");
    li.className = `quick-open-item${i === activeIndex ? " active" : ""}`;
    li.innerHTML = `
      <span class="quick-open-icon">${iconFile}</span>
      <span class="quick-open-meta">
        <span class="quick-open-name">${escapeHtml(hit.name)}</span>
        <span class="quick-open-path">${escapeHtml(hit.relative)}</span>
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
  const hit = hits[activeIndex];
  if (!hit || !onOpen) return;
  close();
  await onOpen(hit.path);
}

export function setQuickOpenHandler(handler: OpenHandler) {
  onOpen = handler;
}

export function openQuickOpen() {
  ensureDom();
  if (!overlay || !input) return;
  visible = true;
  overlay.hidden = false;
  input.value = "";
  hits = [];
  activeIndex = 0;
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
