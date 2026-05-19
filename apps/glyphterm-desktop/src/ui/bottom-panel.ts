import * as monaco from "monaco-editor";
import {
  collectProblems,
  problemCounts,
  subscribeDiagnostics,
  type ProblemItem,
} from "../editor/diagnostics";
import { t } from "../i18n";
import {
  clearOutput,
  getOutputLines,
  onOutputChange,
} from "./output-log";
import type { BottomPanelState, BottomPanelView } from "../workspace/bottom-panel";

export interface BottomPanelController {
  sync: (state: BottomPanelState) => void;
  setView: (view: BottomPanelView) => void;
  toggle: (view?: BottomPanelView) => void;
  refresh: () => void;
  onChange: (fn: (state: BottomPanelState) => void) => void;
  getState: () => BottomPanelState;
}

export function createBottomPanel(
  shellEl: HTMLElement,
  opts: {
    onOpenFile: (path: string, line?: number) => void;
    onStateChange: (state: BottomPanelState) => void;
    onResizeHeight: (height: number) => void;
  },
): BottomPanelController {
  shellEl.innerHTML = `
    <div class="bottom-panel-gutter" role="separator" aria-orientation="horizontal" title=""></div>
    <header class="bottom-panel-tabs"></header>
    <div class="bottom-panel-body"></div>
  `;

  const gutter = shellEl.querySelector(".bottom-panel-gutter") as HTMLElement;
  const tabsEl = shellEl.querySelector(".bottom-panel-tabs") as HTMLElement;
  const bodyEl = shellEl.querySelector(".bottom-panel-body") as HTMLElement;
  gutter.title = t("bottomPanel.resizeTitle");

  let state: BottomPanelState = {
    open: false,
    view: "problems",
    height: 200,
  };
  const changeListeners = new Set<(s: BottomPanelState) => void>();

  function emit() {
    opts.onStateChange(state);
    changeListeners.forEach((fn) => fn(state));
  }

  function renderTabs() {
    const { errors, warnings } = problemCounts();
    const probLabel =
      errors + warnings > 0
        ? t("bottomPanel.problemsCount", {
            errors: String(errors),
            warnings: String(warnings),
          })
        : t("bottomPanel.problems");
    const views: { id: BottomPanelView; label: string }[] = [
      { id: "problems", label: probLabel },
      { id: "output", label: t("bottomPanel.output") },
    ];
    tabsEl.innerHTML = "";
    for (const v of views) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `bottom-tab${state.view === v.id ? " active" : ""}`;
      btn.textContent = v.label;
      btn.addEventListener("click", () => {
        state.view = v.id;
        state.open = true;
        emit();
        sync(state);
      });
      tabsEl.appendChild(btn);
    }
    const actions = document.createElement("span");
    actions.className = "bottom-panel-actions";
    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "bottom-tab-action";
    clearBtn.title = t("bottomPanel.clearOutput");
    clearBtn.textContent = t("bottomPanel.clear");
    clearBtn.hidden = state.view !== "output";
    clearBtn.addEventListener("click", () => {
      clearOutput();
      renderBody();
    });
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "bottom-tab-action";
    closeBtn.textContent = "×";
    closeBtn.title = t("bottomPanel.close");
    closeBtn.addEventListener("click", () => {
      state.open = false;
      emit();
      sync(state);
    });
    actions.append(clearBtn, closeBtn);
    tabsEl.appendChild(actions);
  }

  function renderProblems(container: HTMLElement) {
    const problems = collectProblems();
    if (problems.length === 0) {
      container.innerHTML = `<div class="panel-empty"><p>${escapeHtml(t("problems.empty"))}</p><p class="panel-empty-hint">${escapeHtml(t("problems.emptyHint"))}</p></div>`;
      return;
    }
    const ul = document.createElement("ul");
    ul.className = "problems-list";
    for (const p of problems) {
      ul.appendChild(problemRow(p));
    }
    container.innerHTML = "";
    container.appendChild(ul);
  }

  function problemRow(p: ProblemItem): HTMLElement {
    const li = document.createElement("li");
    li.className = `problem-row severity-${p.severity}`;
    li.innerHTML = `
      <span class="problem-sev" aria-hidden="true"></span>
      <span class="problem-msg">${escapeHtml(p.message)}</span>
      <span class="problem-loc">${escapeHtml(p.fileName)}:${p.line}:${p.column}</span>`;
    li.addEventListener("click", () => opts.onOpenFile(p.path, p.line));
    return li;
  }

  function renderOutput(container: HTMLElement) {
    const lines = getOutputLines();
    if (lines.length === 0) {
      container.innerHTML = `<div class="panel-empty"><p>${escapeHtml(t("output.empty"))}</p></div>`;
      return;
    }
    const pre = document.createElement("pre");
    pre.className = "output-log";
    pre.textContent = lines.map((l) => l.text).join("");
    container.innerHTML = "";
    container.appendChild(pre);
    pre.scrollTop = pre.scrollHeight;
  }

  function renderBody() {
    bodyEl.innerHTML = "";
    if (state.view === "problems") renderProblems(bodyEl);
    else renderOutput(bodyEl);
  }

  function sync(next: BottomPanelState) {
    state = next;
    shellEl.hidden = !state.open;
    shellEl.style.height = state.open ? `${state.height}px` : "";
    shellEl.dataset.view = state.view;
    renderTabs();
    renderBody();
  }

  subscribeDiagnostics(() => {
    if (state.open && state.view === "problems") {
      renderTabs();
      renderBody();
    }
  });

  onOutputChange(() => {
    if (state.open && state.view === "output") renderBody();
  });

  let dragging = false;
  gutter.addEventListener("pointerdown", (ev) => {
    if (ev.button !== 0 || !state.open) return;
    ev.preventDefault();
    gutter.setPointerCapture(ev.pointerId);
    dragging = true;
    document.body.classList.add("bottom-panel-dragging");
    const startY = ev.clientY;
    const startH = state.height;

    const onMove = (move: PointerEvent) => {
      const delta = startY - move.clientY;
      const h = Math.min(480, Math.max(120, startH + delta));
      state.height = h;
      shellEl.style.height = `${h}px`;
      opts.onResizeHeight(h);
    };
    const onUp = () => {
      dragging = false;
      gutter.releasePointerCapture(ev.pointerId);
      document.body.classList.remove("bottom-panel-dragging");
      gutter.removeEventListener("pointermove", onMove);
      gutter.removeEventListener("pointerup", onUp);
      gutter.removeEventListener("pointercancel", onUp);
      emit();
    };
    gutter.addEventListener("pointermove", onMove);
    gutter.addEventListener("pointerup", onUp);
    gutter.addEventListener("pointercancel", onUp);
  });

  return {
    sync,
    setView(view) {
      state.view = view;
      state.open = true;
      emit();
      sync(state);
    },
    toggle(view) {
      if (view && state.open && state.view === view) {
        state.open = false;
      } else {
        state.open = true;
        if (view) state.view = view;
      }
      emit();
      sync(state);
    },
    refresh() {
      renderTabs();
      renderBody();
    },
    onChange(fn) {
      changeListeners.add(fn);
      return () => changeListeners.delete(fn);
    },
    getState: () => state,
  };
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
}

/** Jump editor to line after model is ready. */
export function revealLineInEditor(
  editor: monaco.editor.IStandaloneCodeEditor,
  line: number,
) {
  editor.revealLineInCenter(line);
  editor.setPosition({ lineNumber: line, column: 1 });
  editor.focus();
}
