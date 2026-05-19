import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { listThemes, loadSavedTheme, saveTheme } from "./themes";
import { checkCjkFonts, Frame, FramePayload, TerminalCanvas } from "./terminal";

export interface TabInfo {
  id: number;
  title: string;
  isSsh: boolean;
}

const canvas = document.getElementById("terminal") as HTMLCanvasElement | null;
const tabBar = document.getElementById("tab-bar");
const btnNewLocal = document.getElementById("btn-new-local");
const btnNewSsh = document.getElementById("btn-new-ssh");
const fontBanner = document.getElementById("font-banner");
const themeSelect = document.getElementById(
  "theme-select",
) as HTMLSelectElement | null;

if (!canvas || !tabBar) throw new Error("missing DOM");

const term = new TerminalCanvas(canvas);
let activeTabId = 0;
const frameCache = new Map<number, Frame>();

function initThemePicker() {
  if (!themeSelect) return;
  const active = loadSavedTheme();
  themeSelect.innerHTML = "";
  for (const t of listThemes()) {
    const opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = `${t.nameZh} · ${t.name}`;
    if (t.id === active.id) opt.selected = true;
    themeSelect.appendChild(opt);
  }
  themeSelect.addEventListener("change", () => {
    if (!saveTheme(themeSelect.value)) return;
    term.applyMetricsFromTheme();
    const frame = frameCache.get(activeTabId);
    if (frame) term.render(frame);
    if (activeTabId) {
      const { cols, rows } = term.gridSize();
      void invoke("terminal_resize", { cols, rows, tabId: activeTabId });
    }
  });
}

initThemePicker();

async function refreshTabs() {
  const tabs = await invoke<TabInfo[]>("terminal_list_tabs");
  renderTabBar(tabs);
}

function renderTabBar(tabs: TabInfo[]) {
  if (!tabBar) return;
  tabBar.innerHTML = "";
  for (const tab of tabs) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = `tab${tab.id === activeTabId ? " active" : ""}`;
    el.dataset.tabId = String(tab.id);
    el.innerHTML = `<span class="tab-title">${escapeHtml(tab.title)}</span><span class="tab-close" data-close="${tab.id}">×</span>`;
    el.addEventListener("click", (ev) => {
      const target = ev.target as HTMLElement;
      if (target.dataset.close) {
        ev.stopPropagation();
        void closeTab(Number(target.dataset.close));
        return;
      }
      void switchTab(tab.id);
    });
    tabBar.appendChild(el);
  }
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
}

async function switchTab(id: number) {
  activeTabId = id;
  await invoke("terminal_tab_switch", { tabId: id });
  await refreshTabs();
  const frame = frameCache.get(id);
  if (frame) term.render(frame);
  term.focus();
}

async function closeTab(id: number) {
  await invoke("terminal_tab_close", { tabId: id });
  frameCache.delete(id);
  const tabs = await invoke<TabInfo[]>("terminal_list_tabs");
  if (tabs.length === 0) {
    const { cols, rows } = term.gridSize();
    activeTabId = await invoke<number>("terminal_tab_new_local", { cols, rows });
  } else if (!tabs.some((t) => t.id === activeTabId)) {
    activeTabId = tabs[tabs.length - 1].id;
    await invoke("terminal_tab_switch", { tabId: activeTabId });
  }
  await refreshTabs();
  const frame = frameCache.get(activeTabId);
  if (frame) term.render(frame);
}

async function newLocalTab() {
  const { cols, rows } = term.gridSize();
  activeTabId = await invoke<number>("terminal_tab_new_local", { cols, rows });
  await refreshTabs();
  term.focus();
}

async function newSshTab() {
  const host = prompt("SSH 主机 (host or IP):");
  if (!host) return;
  const user = prompt("用户名:", "root") ?? "root";
  const portStr = prompt("端口:", "22") ?? "22";
  const port = Number(portStr) || 22;
  const password = prompt("密码 (留空则使用 ssh-agent / ~/.ssh/id_ed25519):") ?? "";
  const { cols, rows } = term.gridSize();
  try {
    activeTabId = await invoke<number>("terminal_tab_new_ssh", {
      host,
      user,
      port,
      password: password || null,
      cols,
      rows,
    });
    await refreshTabs();
    term.focus();
  } catch (e) {
    alert(`SSH 连接失败: ${e}`);
  }
}

async function copySelection() {
  const text = await invoke<string>("terminal_copy_selection", {
    tabId: activeTabId,
  });
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
  if (mod && ev.key.toLowerCase() === "v") return null;
  if (mod && ev.key.toLowerCase() === "l") return "\x0c";
  if (mod && ev.key.toLowerCase() === "t") {
    void newLocalTab();
    return null;
  }
  if (mod && ev.shiftKey && ev.key.toLowerCase() === "n") {
    void newSshTab();
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

canvas.addEventListener("keydown", async (ev) => {
  if (!activeTabId) return;
  if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === "v") {
    ev.preventDefault();
    const text = await navigator.clipboard?.readText();
    if (text) {
      await invoke("terminal_write", { data: text, tabId: activeTabId });
    }
    return;
  }
  const data = encodeInput(ev);
  if (data === null) {
    if (ev.metaKey || ev.ctrlKey) ev.preventDefault();
    return;
  }
  ev.preventDefault();
  await invoke("terminal_write", { data, tabId: activeTabId });
});

canvas.addEventListener("mousedown", async (ev) => {
  if (!activeTabId || ev.button !== 0) return;
  const { col, row } = term.cellFromEvent(ev);
  await invoke("terminal_selection_start", { col, row, tabId: activeTabId });
});

canvas.addEventListener("mousemove", async (ev) => {
  if (!activeTabId || ev.buttons !== 1) return;
  const { col, row } = term.cellFromEvent(ev);
  await invoke("terminal_selection_update", { col, row, tabId: activeTabId });
});

canvas.addEventListener("dblclick", () => void copySelection());

btnNewLocal?.addEventListener("click", () => void newLocalTab());
btnNewSsh?.addEventListener("click", () => void newSshTab());

window.addEventListener("resize", () => {
  if (!activeTabId) return;
  const { cols, rows } = term.gridSize();
  void invoke("terminal_resize", { cols, rows, tabId: activeTabId });
});

if (fontBanner && !checkCjkFonts()) {
  fontBanner.hidden = false;
  fontBanner.textContent =
    "建议安装 CJK 等宽字体（如 Sarasa Mono SC）：brew install --cask font-sarasa-gothic";
}

await listen<FramePayload>("terminal-frame", (event) => {
  const { tabId, frame } = event.payload;
  frameCache.set(tabId, frame);
  if (tabId === activeTabId) term.render(frame);
});

await newLocalTab();
