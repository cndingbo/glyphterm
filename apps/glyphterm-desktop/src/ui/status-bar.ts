import { fileName } from "../fs/client";
import { t } from "../i18n";
import type { BottomPanelView } from "../workspace/bottom-panel";

export interface WorkspaceStatusSnapshot {
  workspaceRoot: string;
  activeFile?: string;
  splitPct: number;
  splitDirection: "row" | "column";
  activePaneKind?: "terminal" | "editor";
  languageLabel?: string;
  problemErrors?: number;
  problemWarnings?: number;
  bottomPanelOpen?: boolean;
  bottomPanelView?: BottomPanelView;
}

export interface WorkspaceStatusBar {
  sync: (snap: WorkspaceStatusSnapshot) => void;
  refreshLabels: () => void;
}

export function createWorkspaceStatusBar(
  rootEl: HTMLElement,
  handlers: {
    onWorkspaceClick: () => void;
    onProblemsClick: () => void;
    onOutputClick: () => void;
  },
): WorkspaceStatusBar {
  rootEl.innerHTML = `
    <button type="button" class="status-item status-workspace" title=""></button>
    <span class="status-spacer"></span>
    <span class="status-item status-file" title=""></span>
    <button type="button" class="status-item status-problems" hidden></button>
    <button type="button" class="status-item status-output"></button>
    <span class="status-item status-language" hidden></span>
    <span class="status-item status-layout"></span>
  `;

  const workspaceBtn = rootEl.querySelector(
    ".status-workspace",
  ) as HTMLButtonElement;
  const fileEl = rootEl.querySelector(".status-file") as HTMLElement;
  const problemsBtn = rootEl.querySelector(
    ".status-problems",
  ) as HTMLButtonElement;
  const outputBtn = rootEl.querySelector(".status-output") as HTMLButtonElement;
  const languageEl = rootEl.querySelector(".status-language") as HTMLElement;
  const layoutEl = rootEl.querySelector(".status-layout") as HTMLElement;

  workspaceBtn.addEventListener("click", handlers.onWorkspaceClick);
  problemsBtn.addEventListener("click", handlers.onProblemsClick);
  outputBtn.addEventListener("click", handlers.onOutputClick);
  outputBtn.textContent = t("bottomPanel.output");

  let last: WorkspaceStatusSnapshot | null = null;

  function sync(snap: WorkspaceStatusSnapshot) {
    last = snap;
    const folder = fileName(snap.workspaceRoot) || snap.workspaceRoot;
    workspaceBtn.textContent = folder;
    workspaceBtn.title = `${snap.workspaceRoot}\n${t("status.changeWorkspaceTitle")}`;

    if (snap.activeFile) {
      const short = fileName(snap.activeFile);
      fileEl.textContent = short;
      fileEl.title = snap.activeFile;
    } else if (snap.activePaneKind === "terminal") {
      fileEl.textContent = t("status.terminalActive");
      fileEl.title = "";
    } else {
      fileEl.textContent = t("status.noFile");
      fileEl.title = "";
    }

    const err = snap.problemErrors ?? 0;
    const warn = snap.problemWarnings ?? 0;
    if (err + warn > 0) {
      problemsBtn.hidden = false;
      problemsBtn.textContent = t("status.problemsBadge", {
        errors: String(err),
        warnings: String(warn),
      });
      problemsBtn.classList.toggle(
        "active",
        Boolean(snap.bottomPanelOpen && snap.bottomPanelView === "problems"),
      );
    } else {
      problemsBtn.hidden = false;
      problemsBtn.textContent = t("bottomPanel.problems");
      problemsBtn.classList.toggle(
        "active",
        Boolean(snap.bottomPanelOpen && snap.bottomPanelView === "problems"),
      );
    }
    problemsBtn.title = t("bottomPanel.problemsTitle");

    outputBtn.classList.toggle(
      "active",
      Boolean(snap.bottomPanelOpen && snap.bottomPanelView === "output"),
    );
    outputBtn.title = t("bottomPanel.outputTitle");

    if (snap.languageLabel) {
      languageEl.hidden = false;
      languageEl.textContent = snap.languageLabel;
      languageEl.title = t("status.languageTitle");
    } else {
      languageEl.hidden = true;
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
    outputBtn.textContent = t("bottomPanel.output");
    if (last) sync(last);
  }

  return { sync, refreshLabels };
}
