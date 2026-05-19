import { fileName } from "../fs/client";
import { t } from "../i18n";

export interface WorkspaceStatusSnapshot {
  workspaceRoot: string;
  activeFile?: string;
  splitPct: number;
  splitDirection: "row" | "column";
  activePaneKind?: "terminal" | "editor";
}

export interface WorkspaceStatusBar {
  sync: (snap: WorkspaceStatusSnapshot) => void;
  refreshLabels: () => void;
}

export function createWorkspaceStatusBar(
  rootEl: HTMLElement,
  onWorkspaceClick: () => void,
): WorkspaceStatusBar {
  rootEl.innerHTML = `
    <button type="button" class="status-item status-workspace" title=""></button>
    <span class="status-spacer"></span>
    <span class="status-item status-file" title=""></span>
    <span class="status-item status-layout"></span>
  `;

  const workspaceBtn = rootEl.querySelector(
    ".status-workspace",
  ) as HTMLButtonElement;
  const fileEl = rootEl.querySelector(".status-file") as HTMLElement;
  const layoutEl = rootEl.querySelector(".status-layout") as HTMLElement;

  workspaceBtn.addEventListener("click", onWorkspaceClick);

  let last: WorkspaceStatusSnapshot | null = null;

  function sync(snap: WorkspaceStatusSnapshot) {
    last = snap;
    const folder = fileName(snap.workspaceRoot) || snap.workspaceRoot;
    workspaceBtn.textContent = folder;
    workspaceBtn.title = snap.workspaceRoot;

    if (snap.activeFile) {
      fileEl.textContent = snap.activeFile;
      fileEl.title = snap.activeFile;
      fileEl.hidden = false;
    } else if (snap.activePaneKind === "terminal") {
      fileEl.textContent = t("status.terminalActive");
      fileEl.title = "";
      fileEl.hidden = false;
    } else {
      fileEl.textContent = t("status.noFile");
      fileEl.title = "";
      fileEl.hidden = false;
    }

    const axis =
      snap.splitDirection === "row"
        ? t("status.splitHorizontal")
        : t("status.splitVertical");
    layoutEl.textContent = t("status.layout", {
      pct: String(Math.round(snap.splitPct)),
      axis,
    });
    layoutEl.title = t("status.layoutTitle");
  }

  function refreshLabels() {
    if (last) sync(last);
    workspaceBtn.title = last?.workspaceRoot ?? "";
  }

  return { sync, refreshLabels };
}
