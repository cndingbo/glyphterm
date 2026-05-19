import type { TerminalTheme } from "./types";

/** Backend default pens from `glyphgrid` (match for remapping). */
const RUST_DEFAULT_FG = 0xf5f3ee;
const RUST_DEFAULT_BG = 0x08090b;

/** `glyphvt` / standard ANSI palette (24-bit). */
const ENGINE_ANSI: number[] = [
  0x000000, 0xcd3131, 0x0dbc79, 0xe5e510, 0x2472c8, 0xbc3fbc, 0x11a8cd, 0xe5e5e5,
  0x666666, 0xf14c4c, 0x23d18b, 0xf5f543, 0x3b8eea, 0xd670d6, 0x29b8db, 0xffffff,
];

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h, 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function rgbNum(r: number, g: number, b: number): number {
  return ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff);
}

function dist2(a: number, b: number): number {
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  const dr = ar - br;
  const dg = ag - bg;
  const db = ab - bb;
  return dr * dr + dg * dg + db * db;
}

/** Map engine RGB → themed CSS color. */
export function createColorMapper(theme: TerminalTheme) {
  const table = new Map<number, string>();

  table.set(RUST_DEFAULT_FG, theme.terminal.foreground);
  table.set(RUST_DEFAULT_BG, theme.terminal.background);

  const allAnsi = [...theme.terminal.ansi, ...theme.terminal.ansiBright];
  ENGINE_ANSI.forEach((code, i) => {
    table.set(code, allAnsi[i] ?? theme.terminal.foreground);
  });

  const bg = theme.terminal.background;
  const fg = theme.terminal.foreground;

  return (rgb: number, kind: "fg" | "bg", bold: boolean): string => {
    const key = rgb & 0xffffff;
    const exact = table.get(key);
    if (exact) {
      if (bold && kind === "fg") {
        return brighten(exact, 0.08);
      }
      return exact;
    }

    // Near-match for truecolor / slight drift
    let best = "";
    let bestD = 999999;
    for (const [k, v] of table) {
      const d = dist2(key, k);
      if (d < bestD) {
        bestD = d;
        best = v;
      }
    }
    if (bestD < 1200) return bold && kind === "fg" ? brighten(best, 0.06) : best;

    // Unknown truecolor — use as-is
    if (kind === "bg" && key === 0) return bg;
    const [r, g, b] = [(key >> 16) & 0xff, (key >> 8) & 0xff, key & 0xff];
    const css = `rgb(${r},${g},${b})`;
    return bold && kind === "fg" ? brighten(css, 0.05) : css;
  };
}

function brighten(css: string, amount: number): string {
  const m = css.match(/rgb\((\d+),(\d+),(\d+)\)/);
  if (!m) return css;
  const f = (i: number) =>
    Math.min(255, Math.round(Number(m[i]) + 255 * amount));
  return `rgb(${f(1)},${f(2)},${f(3)})`;
}

export function parseHexColor(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return rgbNum(r, g, b);
}
