/** UI chrome + terminal palette for GlyphTerm. */
export interface TerminalTheme {
  id: string;
  name: string;
  /** Display name in 中文 */
  nameZh: string;
  ui: ThemeUi;
  terminal: ThemeTerminal;
  font: ThemeFont;
  render: ThemeRender;
}

export interface ThemeUi {
  bg: string;
  fg: string;
  titlebar: string;
  tabBar: string;
  tabActiveBg: string;
  tabActiveFg: string;
  tabInactiveFg: string;
  border: string;
  accent: string;
  accentMuted: string;
  buttonBg: string;
  buttonBorder: string;
  buttonHoverBg: string;
}

export interface ThemeTerminal {
  background: string;
  foreground: string;
  cursor: string;
  selection: string;
  /** ANSI 0–7 */
  ansi: readonly [string, string, string, string, string, string, string, string];
  /** ANSI 8–15 (bright) */
  ansiBright: readonly [string, string, string, string, string, string, string, string];
}

export interface ThemeFont {
  family: string;
  size: number;
  lineHeight: number;
}

export interface ThemeRender {
  cellWidth: number;
  cellHeight: number;
  paddingX: number;
  paddingY: number;
  /** Alternating row wash (0 = off) */
  rowStripeAlpha: number;
}
