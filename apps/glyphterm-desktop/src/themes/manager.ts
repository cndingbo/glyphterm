import { createColorMapper } from "./colors";
import { DEFAULT_THEME_ID, THEME_PRESETS } from "./presets";
import type { TerminalTheme } from "./types";

const STORAGE_KEY = "glyphterm-theme-id";

export type ColorMapper = ReturnType<typeof createColorMapper>;

let current: TerminalTheme =
  THEME_PRESETS.find((t) => t.id === DEFAULT_THEME_ID) ?? THEME_PRESETS[0];
let mapper: ColorMapper = createColorMapper(current);
const themeListeners = new Set<() => void>();

export function onThemeChange(fn: () => void): () => void {
  themeListeners.add(fn);
  return () => themeListeners.delete(fn);
}

export function listThemes(): TerminalTheme[] {
  return THEME_PRESETS;
}

export function getTheme(): TerminalTheme {
  return current;
}

export function getColorMapper(): ColorMapper {
  return mapper;
}

function setDerivedUiVars(r: HTMLElement, theme: TerminalTheme) {
  const u = theme.ui;
  const isLight = theme.id === "paper";

  r.style.setProperty("--surface", u.tabBar);
  r.style.setProperty("--surface-raised", u.titlebar);
  r.style.setProperty("--surface-overlay", u.bg);
  r.style.setProperty("--text-muted", u.tabInactiveFg);
  r.style.setProperty("--text-subtle", isLight ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.28)");
  r.style.setProperty("--accent-soft", u.accentMuted);
  r.style.setProperty("--accent-glow", `color-mix(in srgb, ${u.accent} 22%, transparent)`);
  r.style.setProperty("--danger", isLight ? "#dc2626" : "#f87171");
  r.style.setProperty("--pane-bg", theme.terminal.background);
  r.style.setProperty("--editor-bg", theme.terminal.background);
  r.style.setProperty(
    "--shadow-pane",
    isLight
      ? "0 1px 0 rgba(0,0,0,0.04), 0 12px 40px -16px rgba(0,0,0,0.12)"
      : "0 1px 0 rgba(255,255,255,0.04), 0 16px 48px -20px rgba(0,0,0,0.65)",
  );
  r.style.setProperty(
    "--focus-ring",
    `0 0 0 1px ${u.accentMuted}, 0 0 24px -4px ${u.accentMuted}`,
  );
  r.style.setProperty("--rail-width", "56px");
  r.style.setProperty("--radius-sm", "6px");
  r.style.setProperty("--radius-md", "10px");
  r.style.setProperty("--radius-lg", "14px");
  r.style.setProperty("--font-ui", '-apple-system, BlinkMacSystemFont, "PingFang SC", "Segoe UI", sans-serif');
  r.style.setProperty("--font-mono", theme.font.family);
}

export function applyTheme(theme: TerminalTheme): void {
  current = theme;
  mapper = createColorMapper(theme);
  document.documentElement.dataset.theme = theme.id;

  const r = document.documentElement;
  const u = theme.ui;
  r.style.setProperty("--bg", u.bg);
  r.style.setProperty("--fg", u.fg);
  r.style.setProperty("--titlebar", u.titlebar);
  r.style.setProperty("--tab-bar", u.tabBar);
  r.style.setProperty("--tab-active-bg", u.tabActiveBg);
  r.style.setProperty("--tab-active-fg", u.tabActiveFg);
  r.style.setProperty("--tab-inactive-fg", u.tabInactiveFg);
  r.style.setProperty("--border", u.border);
  r.style.setProperty("--accent", u.accent);
  r.style.setProperty("--accent-muted", u.accentMuted);
  r.style.setProperty("--button-bg", u.buttonBg);
  r.style.setProperty("--button-border", u.buttonBorder);
  r.style.setProperty("--button-hover-bg", u.buttonHoverBg);
  r.style.setProperty("--terminal-bg", theme.terminal.background);
  r.style.setProperty("--selection", theme.terminal.selection);
  setDerivedUiVars(r, theme);

  for (const fn of themeListeners) fn();
}

export function loadSavedTheme(): TerminalTheme {
  const id = localStorage.getItem(STORAGE_KEY) ?? DEFAULT_THEME_ID;
  const theme = THEME_PRESETS.find((t) => t.id === id) ?? THEME_PRESETS[0];
  applyTheme(theme);
  return theme;
}

export function saveTheme(id: string): TerminalTheme | undefined {
  const theme = THEME_PRESETS.find((t) => t.id === id);
  if (!theme) return undefined;
  localStorage.setItem(STORAGE_KEY, id);
  applyTheme(theme);
  return theme;
}
