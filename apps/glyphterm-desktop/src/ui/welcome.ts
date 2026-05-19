/** Editor empty state — shown until a file is opened. */

export interface WelcomePanel {
  el: HTMLElement;
  show: () => void;
  hide: () => void;
}

export function createWelcomePanel(): WelcomePanel {
  const el = document.createElement("div");
  el.className = "editor-welcome";
  el.innerHTML = `
    <div class="welcome-glow" aria-hidden="true"></div>
    <div class="welcome-content">
      <p class="welcome-eyebrow">GlyphTerm Editor</p>
      <h2 class="welcome-title">专业代码编辑</h2>
      <p class="welcome-desc">Monaco 内核 · 与 VS Code / Cursor 同源 · 支持 ⌘S 保存</p>
      <ul class="welcome-shortcuts">
        <li><kbd>⌘S</kbd><span>保存文件</span></li>
        <li><kbd>files</kbd><span>侧栏浏览项目</span></li>
        <li><kbd>⊞</kbd><span>分屏（即将支持拖拽）</span></li>
      </ul>
    </div>
  `;

  return {
    el,
    show: () => {
      el.hidden = false;
    },
    hide: () => {
      el.hidden = true;
    },
  };
}
