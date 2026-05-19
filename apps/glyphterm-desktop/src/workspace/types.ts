/** Wave-style workspace: tabs → split panes → blocks. */

export type BlockKind = "terminal" | "editor";

export interface TerminalBlock {
  kind: "terminal";
  /** PTY tab id; unset until first mount */
  tabId?: number;
  title: string;
}

export interface EditorBlock {
  kind: "editor";
  filePath: string | null;
  title: string;
}

export type Block = TerminalBlock | EditorBlock;

export interface Pane {
  id: string;
  block: Block;
}

export interface SplitLayout {
  direction: "row" | "column";
  /** Percent for first pane (0–100) */
  split: number;
  panes: [Pane, Pane];
}

export interface WorkspaceTab {
  id: string;
  name: string;
  layout: SplitLayout;
  activePaneId: string;
}

export type ActivityId = "terminal" | "files" | "sysinfo" | "process";

export interface WorkspaceState {
  tabs: WorkspaceTab[];
  activeTabId: string;
  activity: ActivityId;
  sidePanelOpen: boolean;
}
