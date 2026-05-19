import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { MonacoPane } from "../editor/monaco";
import {
  fileName,
  getWorkspaceRoot,
  listDir,
  readText,
  setWorkspaceRoot,
  writeText,
} from "../fs/client";
import { applyMonacoThemeFromApp } from "../editor/monaco-theme";
import {
  getTheme,
  loadSavedTheme,
  saveTheme,
  listThemes,
  onThemeChange,
} from "../themes";
import { Frame, FramePayload } from "../terminal";
import { TerminalBlockView } from "../terminal/block";
import {
  ACTIVITY_ICONS,
  iconFile,
  iconFolder,
  iconGear,
  iconSplit,
} from "../ui/icons";
import { createWelcomePanel, type WelcomePanel } from "../ui/welcome";
import type { ActivityId, Block, Pane, WorkspaceState } from "../workspace/types";
import {
  activeTab,
  createWorkspaceTab,
  loadWorkspaceState,
  saveWorkspaceState,
} from "../workspace/store";

const ACTIVITIES: { id: ActivityId; label: string }[] = [
  { id: "terminal", label: "terminal" },
  { id: "files", label: "files" },
  { id: "sysinfo", label: "sysinfo" },
  { id: "process", label: "process" },
];

interface PaneRuntime {
  pane: Pane;
  el: HTMLElement;
  terminal?: TerminalBlockView;
  editor?: MonacoPane;
  welcome?: WelcomePanel;
}

/** Wave-style workspace: split blocks + Monaco IDE + activity rail. */
export async function bootWorkspace() {
  const shell = document.getElementById("workspace-shell");
  if (shell) shell.hidden = false;
  const classic = document.getElementById("classic-shell");
  if (classic) classic.hidden = true;
  const wsActions = document.getElementById("workspace-titlebar-actions");
  if (wsActions) wsActions.hidden = false;

  let state = loadWorkspaceState();
  const frameCache = new Map<number, Frame>();
  const terminals = new Map<number, TerminalBlockView>();
  const paneRuntimes = new Map<string, PaneRuntime>();

  const stage = document.getElementById("workspace-stage")!;
  const wsTabBar = document.getElementById("ws-tab-bar")!;
  const sidePanel = document.getElementById("side-panel")!;
  const sideContent = document.getElementById("side-panel-content")!;
  const rail = document.getElementById("activity-rail")!;
  const workspacePathEl = document.getElementById("workspace-path")!;
  const themeSelect = document.getElementById(
    "theme-select-ws",
  ) as HTMLSelectElement | null;

  initThemePicker(themeSelect);
  renderActivityRail();
  await initWorkspaceRoot();

  document.getElementById("btn-ws-tab-add")?.addEventListener("click", () => {
    const n = state.tabs.length + 1;
    const tab = createWorkspaceTab(`T${n}`);
    state.tabs.push(tab);
    state.activeTabId = tab.id;
    persistAndRender();
  });

  const splitBtn = document.getElementById("btn-split-h");
  if (splitBtn) {
    splitBtn.innerHTML = iconSplit;
    splitBtn.addEventListener("click", () => {
      alert("下一版支持动态分屏；当前默认左右双块布局。");
    });
  }

  document
    .getElementById("btn-ws-new-local")
    ?.addEventListener("click", () => void wsNewLocal());
  document
    .getElementById("btn-ws-new-ssh")
    ?.addEventListener("click", () => void wsNewSsh());

  onThemeChange(() => {
    applyMonacoThemeFromApp(getTheme());
    for (const rt of paneRuntimes.values()) {
      rt.terminal?.term.applyMetricsFromTheme();
      void rt.terminal?.resize();
      rt.editor?.reapplyTheme();
    }
  });

  window.addEventListener("resize", () => {
    for (const rt of paneRuntimes.values()) {
      void rt.terminal?.resize();
      rt.editor?.layout();
    }
  });

  await listen<FramePayload>("terminal-frame", (event) => {
    const { tabId, frame } = event.payload;
    frameCache.set(tabId, frame);
    terminals.get(tabId)?.render(frame);
  });

  persistAndRender();

  function persistAndRender() {
    saveWorkspaceState(state);
    renderWorkspaceTabs();
    renderStage();
    renderSidePanel();
  }

  function initThemePicker(sel: HTMLSelectElement | null) {
    if (!sel) return;
    const active = loadSavedTheme();
    sel.innerHTML = "";
    for (const t of listThemes()) {
      const opt = document.createElement("option");
      opt.value = t.id;
      opt.textContent = `${t.nameZh}`;
      if (t.id === active.id) opt.selected = true;
      sel.appendChild(opt);
    }
    sel.addEventListener("change", () => {
      saveTheme(sel.value);
    });
  }

  async function initWorkspaceRoot() {
    try {
      let root = await getWorkspaceRoot();
      const guess = `${root}/projects/glyphterm`;
      try {
        root = await setWorkspaceRoot(guess);
      } catch {
        /* keep home */
      }
      workspacePathEl.textContent = root;
      workspacePathEl.title = root;
    } catch {
      workspacePathEl.textContent = "—";
    }
  }

  function renderActivityRail() {
    rail.innerHTML = "";
    for (const a of ACTIVITIES) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `rail-btn${state.activity === a.id ? " active" : ""}`;
      btn.title = a.label;
      btn.innerHTML = `<span class="rail-icon">${ACTIVITY_ICONS[a.id] ?? ""}</span><span class="rail-label">${a.label}</span>`;
      btn.addEventListener("click", () => {
        state.activity = a.id;
        state.sidePanelOpen = a.id === "files" || a.id === "sysinfo";
        persistAndRender();
      });
      rail.appendChild(btn);
    }
  }

  function renderWorkspaceTabs() {
    wsTabBar.innerHTML = "";
    for (const tab of state.tabs) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `ws-tab${tab.id === state.activeTabId ? " active" : ""}`;
      btn.textContent = tab.name;
      btn.addEventListener("click", () => {
        state.activeTabId = tab.id;
        persistAndRender();
      });
      wsTabBar.appendChild(btn);
    }
  }

  function renderStage() {
    for (const rt of paneRuntimes.values()) {
      rt.terminal?.destroy();
      rt.editor?.dispose();
    }
    paneRuntimes.clear();
    stage.innerHTML = "";

    const tab = activeTab(state);
    const split = document.createElement("div");
    split.className = `ws-split ws-split-${tab.layout.direction}`;
    split.style.setProperty("--split", `${tab.layout.split}%`);

    for (const pane of tab.layout.panes) {
      const paneEl = document.createElement("section");
      paneEl.className = `ws-pane${pane.id === tab.activePaneId ? " active" : ""}`;
      paneEl.dataset.paneId = pane.id;

      const isTerm = pane.block.kind === "terminal";
      const chrome = document.createElement("header");
      chrome.className = "pane-chrome";
      chrome.innerHTML = `
        <div class="pane-chrome-left">
          <span class="pane-dots" aria-hidden="true"><i></i><i></i><i></i></span>
          <span class="pane-badge${isTerm ? "" : " editor"}">${isTerm ? "TERM" : "EDIT"}</span>
          <span class="pane-title">${escapeHtml(blockTitle(pane.block))}</span>
        </div>
        <span class="pane-actions">
          <button type="button" class="pane-btn" data-action="focus" title="聚焦">${iconGear}</button>
        </span>`;
      chrome.querySelector("[data-action=focus]")?.addEventListener("click", () => {
        tab.activePaneId = pane.id;
        stage.querySelectorAll(".ws-pane").forEach((p) => {
          p.classList.toggle("active", (p as HTMLElement).dataset.paneId === pane.id);
        });
        paneRuntimes.get(pane.id)?.terminal?.focus();
        paneRuntimes.get(pane.id)?.editor?.layout();
      });

      const body = document.createElement("div");
      body.className = "pane-body";

      paneEl.append(chrome, body);
      paneEl.addEventListener("mousedown", () => {
        if (tab.activePaneId !== pane.id) {
          tab.activePaneId = pane.id;
          stage.querySelectorAll(".ws-pane").forEach((p) => {
            p.classList.toggle("active", p === paneEl);
          });
        }
      });

      split.appendChild(paneEl);

      const rt: PaneRuntime = { pane, el: body };
      paneRuntimes.set(pane.id, rt);
      void mountBlock(rt, pane.block);
    }

    stage.appendChild(split);
    sidePanel.hidden = !state.sidePanelOpen;
  }

  async function mountBlock(rt: PaneRuntime, block: Block) {
    if (block.kind === "terminal") {
      const tv = new TerminalBlockView(rt.el);
      rt.terminal = tv;
      let tabId = block.tabId;
      if (!tabId) {
        tabId = await tv.attachNewLocalTab();
        block.tabId = tabId;
      } else {
        tv.tabId = tabId;
        await tv.resize();
      }
      block.title = "local";
      terminals.set(tabId, tv);
      const cached = frameCache.get(tabId);
      if (cached) tv.render(cached);
      if (activeTab(state).activePaneId === rt.pane.id) tv.focus();
    } else {
      const host = document.createElement("div");
      host.className = "editor-host";
      const monacoEl = document.createElement("div");
      monacoEl.className = "monaco-mount";
      const welcome = createWelcomePanel();
      host.append(monacoEl, welcome.el);
      rt.el.appendChild(host);
      rt.welcome = welcome;

      const ed = new MonacoPane(monacoEl, {
        path: block.filePath,
        onSave: async (path, content) => {
          await writeText(path, content);
        },
      });
      rt.editor = ed;
      ed.mount();
      if (block.filePath) {
        welcome.hide();
        try {
          const text = await readText(block.filePath);
          await ed.openFile(block.filePath, text);
        } catch (e) {
          await ed.openFile(block.filePath, `// 无法读取: ${e}`);
        }
      } else {
        welcome.show();
      }
    }
  }

  function renderSidePanel() {
    sideContent.innerHTML = "";
    if (!state.sidePanelOpen) return;

    if (state.activity === "files") {
      void renderFileTree(sideContent);
    } else if (state.activity === "sysinfo") {
      sideContent.innerHTML = `<div class="side-placeholder"><h3>系统信息</h3><p>下一版接入 CPU / 内存 / 磁盘指标。</p></div>`;
    } else {
      sideContent.innerHTML = `<div class="side-placeholder"><p>即将推出</p></div>`;
    }
  }

  async function renderFileTree(container: HTMLElement) {
    const root = await getWorkspaceRoot();
    const header = document.createElement("div");
    header.className = "files-header";
    header.textContent = "资源管理器";
    const sub = document.createElement("div");
    sub.className = "files-root";
    sub.title = root;
    sub.textContent = fileName(root) || root;
    header.appendChild(sub);
    container.appendChild(header);

    const tree = document.createElement("div");
    tree.className = "file-tree";
    container.appendChild(tree);

    async function loadDir(dirPath: string, indent: number) {
      let entries;
      try {
        entries = await listDir(dirPath);
      } catch {
        return;
      }
      for (const ent of entries) {
        const row = document.createElement("button");
        row.type = "button";
        row.className = `file-row${ent.is_dir ? " dir" : " file"}`;
        row.style.paddingLeft = `${8 + indent * 14}px`;
        row.innerHTML = `<span class="file-icon">${ent.is_dir ? iconFolder : iconFile}</span><span class="file-name">${escapeHtml(ent.name)}</span>`;
        row.addEventListener("click", async () => {
          if (ent.is_dir) {
            const child = document.createElement("div");
            child.className = "file-children";
            row.after(child);
            await loadDir(ent.path, indent + 1);
            row.remove();
          } else {
            await openFileInEditor(ent.path);
          }
        });
        tree.appendChild(row);
      }
    }

    await loadDir(root, 0);
  }

  async function openFileInEditor(path: string) {
    const tab = activeTab(state);
    const pane =
      tab.layout.panes.find((p) => p.block.kind === "editor") ??
      tab.layout.panes[1];
    if (pane.block.kind !== "editor") return;

    pane.block = {
      kind: "editor",
      filePath: path,
      title: fileName(path),
    };
    tab.activePaneId = pane.id;

    const rt = paneRuntimes.get(pane.id);
    if (rt?.editor) {
      rt.welcome?.hide();
      try {
        const text = await readText(path);
        await rt.editor.openFile(path, text);
      } catch (e) {
        await rt.editor.openFile(path, `// 无法读取: ${e}`);
      }
      stage.querySelectorAll(".ws-pane").forEach((el) => {
        el.classList.toggle(
          "active",
          (el as HTMLElement).dataset.paneId === pane.id,
        );
      });
      saveWorkspaceState(state);
      return;
    }
    persistAndRender();
  }

  function blockTitle(block: Block): string {
    if (block.kind === "terminal") return block.title || "terminal";
    return block.title || block.filePath || "editor";
  }

  async function wsNewLocal() {
    const tab = activeTab(state);
    const pane = tab.layout.panes.find((p) => p.block.kind === "terminal");
    if (!pane || pane.block.kind !== "terminal") return;
    tab.activePaneId = pane.id;
    const rt = paneRuntimes.get(pane.id);
    if (rt?.terminal) {
      const id = await rt.terminal.attachNewLocalTab();
      pane.block.tabId = id;
      terminals.set(id, rt.terminal);
      rt.terminal.focus();
    } else {
      persistAndRender();
    }
  }

  async function wsNewSsh() {
    const host = prompt("SSH 主机:");
    if (!host) return;
    const user = prompt("用户名:", "root") ?? "root";
    const port = Number(prompt("端口:", "22") ?? "22") || 22;
    const password = prompt("密码:") ?? "";
    const tab = activeTab(state);
    const pane = tab.layout.panes.find((p) => p.block.kind === "terminal");
    if (!pane || pane.block.kind !== "terminal") return;
    const rt = paneRuntimes.get(pane.id);
    if (!rt?.terminal) return;
    const { cols, rows } = rt.terminal.term.gridSize();
    try {
      const id = await invoke<number>("terminal_tab_new_ssh", {
        host,
        user,
        port,
        password: password || null,
        cols,
        rows,
      });
      pane.block.tabId = id;
      pane.block.title = host;
      terminals.set(id, rt.terminal);
      rt.terminal.tabId = id;
      rt.terminal.focus();
      updatePaneTitle(pane.id, host);
    } catch (e) {
      alert(`SSH 失败: ${e}`);
    }
  }

  function updatePaneTitle(paneId: string, title: string) {
    const paneEl = stage.querySelector(`[data-pane-id="${paneId}"]`);
    paneEl?.querySelector(".pane-title")?.replaceChildren(title);
  }
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
}
