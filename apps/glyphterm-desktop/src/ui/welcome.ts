import { fileName } from "../fs/client";
import { t } from "../i18n";
import { listRecentWorkspaces } from "../workspace/recent-files";

/** Editor empty state — shown until a file is opened. */

export interface WelcomePanel {
  el: HTMLElement;
  show: () => void;
  hide: () => void;
  refresh: () => void;
}

export function createWelcomePanel(): WelcomePanel {
  const el = document.createElement("div");
  el.className = "editor-welcome";

  function render() {
    el.innerHTML = `
    <div class="welcome-glow" aria-hidden="true"></div>
    <div class="welcome-content">
      <p class="welcome-eyebrow">${t("welcome.eyebrow")}</p>
      <h2 class="welcome-title">${t("welcome.title")}</h2>
      <p class="welcome-desc">${t("welcome.desc")}</p>
      <ul class="welcome-shortcuts">
        <li><kbd>⌘S</kbd><span>${t("welcome.shortcutSave")}</span></li>
        <li><kbd>⌘P</kbd><span>${t("welcome.shortcutQuickOpen")}</span></li>
        <li><kbd>⌘K</kbd><span>${t("welcome.shortcutPalette")}</span></li>
        <li><kbd>⊞</kbd><span>${t("welcome.shortcutSplit")}</span></li>
      </ul>
      ${renderRecentWorkspaces()}
    </div>
  `;
  }

  function renderRecentWorkspaces(): string {
    const roots = listRecentWorkspaces().slice(0, 4);
    if (!roots.length) return "";
    const items = roots
      .map(
        (r) =>
          `<li><button type="button" class="welcome-ws-btn" data-root="${escapeAttr(r)}">${escapeHtml(fileName(r) || r)}</button></li>`,
      )
      .join("");
    return `
      <div class="welcome-workspaces">
        <p class="welcome-ws-label">${t("welcome.recentWorkspaces")}</p>
        <ul class="welcome-ws-list">${items}</ul>
        <p class="welcome-ws-hint">${t("welcome.recentWorkspacesHint")}</p>
      </div>`;
  }

  function wireWorkspaceButtons() {
    el.querySelectorAll(".welcome-ws-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const root = (btn as HTMLElement).dataset.root;
        if (root) {
          window.dispatchEvent(
            new CustomEvent("glyphterm-open-workspace", { detail: { root } }),
          );
        }
      });
    });
  }

  function escapeHtml(s: string) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  }

  function escapeAttr(s: string) {
    return s.replace(/"/g, "&quot;");
  }

  function renderInner() {
    render();
    wireWorkspaceButtons();
  }

  renderInner();

  return {
    el,
    show: () => {
      el.hidden = false;
    },
    hide: () => {
      el.hidden = true;
    },
    refresh: renderInner,
  };
}
