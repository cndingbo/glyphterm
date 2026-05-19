import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  onLocaleChange,
  setLocale,
  t,
  themeDisplayName,
  type Locale,
} from "../i18n";
import {
  registerPaletteCommands,
  refreshPaletteHint,
  type PaletteCommand,
} from "../ui/command-palette";
import { listThemes, loadSavedTheme, saveTheme } from "../themes";
import { checkCjkFonts, Frame, FramePayload, TerminalCanvas } from "../terminal";

export interface TabInfo {
  id: number;
  title: string;
  isSsh: boolean;
}

/** Legacy single-canvas terminal UI. */
export async function bootClassic() {
  const shell = document.getElementById("classic-shell");
  if (shell) shell.hidden = false;
  const ws = document.getElementById("workspace-shell");
  if (ws) ws.hidden = true;
  const classicActions = document.getElementById("classic-titlebar-actions");
  if (classicActions) classicActions.hidden = false;
  const wsActions = document.getElementById("workspace-titlebar-actions");
  if (wsActions) wsActions.hidden = true;

  const canvas = document.getElementById(
    "terminal",
  ) as HTMLCanvasElement | null;
  const tabBar = document.getElementById("tab-bar");
  const btnNewLocal = document.getElementById("btn-new-local");
  const btnNewSsh = document.getElementById("btn-new-ssh");
  const fontBanner = document.getElementById("font-banner");
  const themeSelect = document.getElementById(
    "theme-select",
  ) as HTMLSelectElement | null;

  if (!canvas || !tabBar) throw new Error("missing classic DOM");

  const term = new TerminalCanvas(canvas);
  let activeTabId = 0;
  const frameCache = new Map<number, Frame>();

  function initThemePicker() {
    if (!themeSelect) return;
    const active = loadSavedTheme();
    themeSelect.innerHTML = "";
    for (const theme of listThemes()) {
      const opt = document.createElement("option");
      opt.value = theme.id;
      opt.textContent = themeDisplayName(theme);
      if (theme.id === active.id) opt.selected = true;
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

  onLocaleChange(() => {
    initThemePicker();
    if (fontBanner && !fontBanner.hidden) {
      fontBanner.textContent = t("font.banner");
    }
  });

  async function refreshTabs() {
    const tabs = await invoke<TabInfo[]>("terminal_list_tabs");
    renderTabBar(tabs);
  }

  function renderTabBar(tabs: TabInfo[]) {
    tabBar!.innerHTML = "";
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
      tabBar!.appendChild(el);
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
      activeTabId = await invoke<number>("terminal_tab_new_local", {
        cols,
        rows,
      });
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

  btnNewLocal?.addEventListener("click", () => void newLocalTab());
  btnNewSsh?.addEventListener("click", () => {
    void (async () => {
      const host = prompt(t("ssh.host"));
      if (!host) return;
      const user = prompt(t("ssh.user"), "root") ?? "root";
      const port = Number(prompt(t("ssh.port"), "22") ?? "22") || 22;
      const password = prompt(t("ssh.password")) ?? "";
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
        alert(t("ssh.failed", { error: String(e) }));
      }
    })();
  });

  canvas.addEventListener("keydown", async (ev) => {
    if (!activeTabId) return;
    if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === "v") {
      ev.preventDefault();
      const text = await navigator.clipboard?.readText();
      if (text) {
        await invoke("terminal_write", { data: text, tabId: activeTabId });
      }
    }
  });

  window.addEventListener("resize", () => {
    if (!activeTabId) return;
    const { cols, rows } = term.gridSize();
    void invoke("terminal_resize", { cols, rows, tabId: activeTabId });
  });

  if (fontBanner && !checkCjkFonts()) {
    fontBanner.hidden = false;
    fontBanner.textContent = t("font.banner");
  }

  await listen<FramePayload>("terminal-frame", (event) => {
    const { tabId, frame } = event.payload;
    frameCache.set(tabId, frame);
    if (tabId === activeTabId) term.render(frame);
  });

  function syncClassicPalette() {
    const themeCmds: PaletteCommand[] = listThemes().map((theme) => ({
      id: `theme-${theme.id}`,
      title: `${t("palette.themePrefix")}${themeDisplayName(theme)}`,
      keywords: theme.id,
      run: () => {
        saveTheme(theme.id);
      },
    }));
    const localeCmds: PaletteCommand[] = (
      [
        ["en", "English"],
        ["zh-Hans", "简体中文"],
      ] as [Locale, string][]
    ).map(([locale, label]) => ({
      id: `locale-${locale}`,
      title: `${t("palette.languagePrefix")}${label}`,
      keywords: locale,
      run: () => setLocale(locale),
    }));

    registerPaletteCommands([
      {
        id: "new-local",
        title: t("palette.newLocal"),
        keywords: "terminal local",
        run: () => void newLocalTab(),
      },
      {
        id: "new-ssh",
        title: t("palette.newSsh"),
        keywords: "ssh",
        run: () => btnNewSsh?.click(),
      },
      {
        id: "workspace",
        title: t("palette.openWorkspace"),
        keywords: "mode layout workspace wave",
        run: () => {
          localStorage.setItem("glyphterm-ui-mode", "workspace");
          location.reload();
        },
      },
      ...themeCmds,
      ...localeCmds,
    ]);
  }

  syncClassicPalette();
  onLocaleChange(() => {
    syncClassicPalette();
    refreshPaletteHint();
  });

  await newLocalTab();
}
