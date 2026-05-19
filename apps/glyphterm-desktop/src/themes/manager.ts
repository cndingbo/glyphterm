import { createColorMapper } from "./colors";
import { DEFAULT_THEME_ID, THEME_PRESETS } from "./presets";
import type { TerminalTheme } from "./types";

const STORAGE_KEY = "glyphterm-theme-id";

export type ColorMapper = ReturnType<typeof createColorMapper>;

let current: TerminalTheme =
  THEME_PRESETS.find((t) => t.id === DEFAULT_THEME_ID) ?? THEME_PRESETS[0];
let mapper: ColorMapper = createColorMapper(current);

export function listThemes(): TerminalTheme[] {
  return THEME_PRESETS;
}

export function getTheme(): TerminalTheme {
  return current;
}

export function getColorMapper(): ColorMapper {
  return mapper;
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
