/** Terminal frame from Rust (`glyphterm-core`). */
import { getColorMapper, getTheme } from "./themes";

export interface CellView {
  ch: string;
  fg: number;
  bg: number;
  bold: boolean;
  wideCont: boolean;
}

export interface SelectionView {
  startCol: number;
  startRow: number;
  endCol: number;
  endRow: number;
}

export interface Frame {
  cols: number;
  rows: number;
  cursorCol: number;
  cursorRow: number;
  scrollbackLines: number;
  cells: CellView[];
  selection?: SelectionView;
}

export interface FramePayload {
  tabId: number;
  frame: Frame;
}

export class TerminalCanvas {
  private ctx: CanvasRenderingContext2D;
  private cellW = 9;
  private cellH = 20;
  private paddingX = 2;
  private paddingY = 2;
  private frame: Frame | null = null;
  private dpr = window.devicePixelRatio || 1;

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2d context unavailable");
    this.ctx = ctx;
    this.applyMetricsFromTheme();
    this.resizeCanvas();
    window.addEventListener("resize", () => this.resizeCanvas());
  }

  /** Re-read cell metrics when theme changes. */
  applyMetricsFromTheme() {
    const t = getTheme();
    this.cellW = t.render.cellWidth;
    this.cellH = t.render.cellHeight;
    this.paddingX = t.render.paddingX;
    this.paddingY = t.render.paddingY;
  }

  focus() {
    this.canvas.focus();
  }

  cellDimensions() {
    return { cellW: this.cellW, cellH: this.cellH };
  }

  gridSize() {
    const rect = this.canvas.getBoundingClientRect();
    const cols = Math.max(20, Math.floor(rect.width / this.cellW));
    const rows = Math.max(8, Math.floor(rect.height / this.cellH));
    return { cols, rows };
  }

  cellFromEvent(ev: { clientX: number; clientY: number }): {
    col: number;
    row: number;
  } {
    const rect = this.canvas.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;
    const col = Math.max(
      0,
      Math.min(
        (this.frame?.cols ?? 1) - 1,
        Math.floor(x / this.cellW),
      ),
    );
    const row = Math.max(
      0,
      Math.min(
        (this.frame?.rows ?? 1) - 1,
        Math.floor(y / this.cellH),
      ),
    );
    return { col, row };
  }

  render(frame: Frame) {
    this.frame = frame;
    this.applyMetricsFromTheme();
    this.resizeCanvas();

    const theme = getTheme();
    const map = getColorMapper();
    const { ctx, cellW, cellH, paddingX, paddingY } = this;
    const { cols, rows, cells, selection } = frame;
    const termBg = theme.terminal.background;

    ctx.fillStyle = termBg;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const stripe = theme.render.rowStripeAlpha;
    if (stripe > 0) {
      ctx.fillStyle = `rgba(127,127,127,${stripe})`;
      for (let r = 1; r < rows; r += 2) {
        ctx.fillRect(0, r * cellH, cols * cellW, cellH);
      }
    }

    if (selection) {
      this.drawSelection(selection, cols, cellW, cellH, theme.terminal.selection);
    }

    const font = `${theme.font.size}px ${theme.font.family}`;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const cell = cells[idx];
        if (!cell || cell.wideCont) continue;

        const x = c * cellW;
        const y = r * cellH;
        const fg = map(cell.fg, "fg", cell.bold);
        const bg = map(cell.bg, "bg", false);

        if (bg !== termBg) {
          ctx.fillStyle = bg;
          const w = isWideAt(cells, cols, idx) ? cellW * 2 : cellW;
          ctx.fillRect(x, y, w, cellH);
        }

        if (!cell.ch || cell.ch === " ") continue;
        ctx.fillStyle = fg;
        ctx.font = cell.bold ? `bold ${font}` : font;
        ctx.textBaseline = "top";
        ctx.fillText(cell.ch, x + paddingX, y + paddingY);
      }
    }

    this.drawCursor(frame, cellW, cellH, theme.terminal.cursor);
  }

  private drawCursor(
    frame: Frame,
    cellW: number,
    cellH: number,
    color: string,
  ) {
    const { ctx } = this;
    const cx = frame.cursorCol * cellW;
    const cy = frame.cursorRow * cellH;
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.55;
    ctx.fillRect(cx + 1, cy + 1, cellW - 2, cellH - 2);
    ctx.globalAlpha = 1;
  }

  private drawSelection(
    sel: SelectionView,
    cols: number,
    cellW: number,
    cellH: number,
    fill: string,
  ) {
    const { ctx } = this;
    ctx.fillStyle = fill;
    for (let r = sel.startRow; r <= sel.endRow; r++) {
      const c0 = r === sel.startRow ? sel.startCol : 0;
      const c1 = r === sel.endRow ? sel.endCol : cols - 1;
      ctx.fillRect(c0 * cellW, r * cellH, (c1 - c0 + 1) * cellW, cellH);
    }
  }

  private resizeCanvas() {
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width * this.dpr));
    const h = Math.max(1, Math.floor(rect.height * this.dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }
  }
}

export function checkCjkFonts(): boolean {
  if (!("fonts" in document)) return true;
  const family = getTheme().font.family;
  const sample = `14px ${family.split(",")[0]}`;
  return document.fonts.check(sample);
}

function isWideAt(cells: CellView[], cols: number, idx: number): boolean {
  return !!cells[idx + 1]?.wideCont;
}
