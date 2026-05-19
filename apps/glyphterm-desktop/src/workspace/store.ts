import type { Block, Pane, WorkspaceState, WorkspaceTab } from "./types";

const STORAGE_KEY = "glyphterm-workspace-v1";

function uid(): string {
  return crypto.randomUUID();
}

export function createTerminalBlock(title = "local"): Block {
  return { kind: "terminal", title };
}

export function createEditorBlock(filePath: string | null = null): Block {
  return {
    kind: "editor",
    filePath,
    title: filePath ? filePath.split(/[/\\]/).pop() ?? "editor" : "欢迎",
  };
}

export function createPane(block: Block): Pane {
  return { id: uid(), block };
}

export function createWorkspaceTab(name: string): WorkspaceTab {
  const left = createPane(createTerminalBlock());
  const right = createPane(createEditorBlock());
  return {
    id: uid(),
    name,
    layout: {
      direction: "row",
      split: 52,
      panes: [left, right],
    },
    activePaneId: left.id,
  };
}

export function defaultWorkspaceState(): WorkspaceState {
  const t1 = createWorkspaceTab("T1");
  return {
    tabs: [t1],
    activeTabId: t1.id,
    activity: "terminal",
    sidePanelOpen: false,
  };
}

export function loadWorkspaceState(): WorkspaceState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultWorkspaceState();
    const parsed = JSON.parse(raw) as WorkspaceState;
    if (!parsed.tabs?.length) return defaultWorkspaceState();
    return parsed;
  } catch {
    return defaultWorkspaceState();
  }
}

export function saveWorkspaceState(state: WorkspaceState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function activeTab(state: WorkspaceState): WorkspaceTab {
  return (
    state.tabs.find((t) => t.id === state.activeTabId) ?? state.tabs[0]
  );
}

export function findPane(tab: WorkspaceTab, paneId: string): Pane | undefined {
  return tab.layout.panes.find((p) => p.id === paneId);
}
