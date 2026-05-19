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
import { loadSavedTheme, saveTheme, listThemes } from "../themes";
import { Frame, FramePayload } from "../terminal";
import { TerminalBlockView } from "../terminal/block";
import type { ActivityId, Block, Pane, WorkspaceState } from "../workspace/types";
import {
  activeTab,
  createWorkspaceTab,
  loadWorkspaceState,
  saveWorkspaceState,
} from "../workspace/store";

const ACTIVITIES: { id: ActivityId; label: string; icon: string }[] = [
  { id: "terminal", label: "terminal", icon: "▣" },
  { id: "files", label: "files", icon: "◫" },
  { id: "sysinfo", label: "sysinfo", icon: "▤" },
  { id: "process", label: "process", icon: "☰" },
];

interface PaneRuntime {
  pane: Pane;
  el: HTMLElement;
  terminal?: TerminalBlockView;
  editor?: MonacoPane;
}

/** Wave-style workspace: split blocks + Monaco IDE + activity rail. */
export async function bootWorkspace() {
  const shell = document.getElementById("workspace-shell");
  if (shell) shell.hidden = false;
  const classic = document.getElementById("classic-shell");
  if (classic) classic.hidden = true;

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

  document.getElementById("btn-split-h")?.addEventListener("click", () => {
    alert("下一版支持动态分屏；当前默认左右双块布局。");
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
      for (const rt of paneRuntimes.values()) {
        rt.terminal?.term.applyMetricsFromTheme();
        void rt.terminal?.resize();
      }
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
      btn.innerHTML = `<span class="rail-icon">${a.icon}</span><span class="rail-label">${a.label}</span>`;
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

      const chrome = document.createElement("header");
      chrome.className = "pane-chrome";
      chrome.innerHTML = `
        <span class="pane-title">${escapeHtml(blockTitle(pane.block))}</span>
        <span class="pane-actions">
          <button type="button" class="pane-btn" data-action="focus" title="聚焦">◎</button>
        </span>`;
      chrome.querySelector("[data-action=focus]")?.addEventListener("click", () => {
        tab.activePaneId = pane.id;
        persistAndRender();
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
      const ed = new MonacoPane(rt.el, {
        path: block.filePath,
        initialContent: welcomeEditorText(),
        onSave: async (path, content) => {
          await writeText(path, content);
        },
      });
      rt.editor = ed;
      ed.mount();
      if (block.filePath) {
        try {
          const text = await readText(block.filePath);
          await ed.openFile(block.filePath, text);
        } catch (e) {
          await ed.openFile(block.filePath, `// 无法读取: ${e}`);
        }
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
    header.innerHTML = `<span class="files-root" title="${escapeHtml(root)}">${escapeHtml(fileName(root) || root)}</span>`;
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
        row.textContent = `${ent.is_dir ? "▸ " : "· "}${ent.name}`;
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

  function welcomeEditorText(): string {
    return `// GlyphTerm 工作区 · 专业编辑器 (Monaco)
// — 与 VS Code / Cursor 同源编辑内核
//
// ⌘S  保存文件
// 左侧 files 打开项目文件
// 右侧/左侧块可并排：终端 + 编辑器
//
// 打开项目: 默认 ~/projects/glyphterm
`;
  }
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
}
