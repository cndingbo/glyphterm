import { t } from "../i18n";

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
        <li><kbd>files</kbd><span>${t("welcome.shortcutFiles")}</span></li>
        <li><kbd>⊞</kbd><span>${t("welcome.shortcutSplit")}</span></li>
      </ul>
    </div>
  `;
  }

  render();

  return {
    el,
    show: () => {
      el.hidden = false;
    },
    hide: () => {
      el.hidden = true;
    },
    refresh: render,
  };
}
