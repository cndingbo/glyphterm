/** Terminal frame from Rust (`glyphterm-core`). */
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

const FONT =
  '14px "Sarasa Mono SC", "PingFang SC", "Noto Sans Mono CJK SC", monospace';

const SELECT_FILL = "rgba(110, 231, 209, 0.22)";

export class TerminalCanvas {
  private ctx: CanvasRenderingContext2D;
  private cellW = 9;
  private cellH = 18;
  private frame: Frame | null = null;
  private dpr = window.devicePixelRatio || 1;

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2d context unavailable");
    this.ctx = ctx;
    this.resizeCanvas();
    window.addEventListener("resize", () => this.resizeCanvas());
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

  /** Map pointer position to grid cell. */
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
    this.resizeCanvas();
    const { ctx, cellW, cellH } = this;
    const { cols, rows, cells, selection } = frame;

    ctx.fillStyle = "#08090B";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    if (selection) {
      this.drawSelection(selection, cols, cellW, cellH);
    }

    ctx.font = FONT;
    ctx.textBaseline = "top";

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const cell = cells[idx];
        if (!cell || cell.wideCont) continue;

        const x = c * cellW;
        const y = r * cellH;
        const fg = rgb(cell.fg);
        const bg = rgb(cell.bg);

        if (bg !== "#08090B") {
          ctx.fillStyle = bg;
          const w = isWideAt(cells, cols, idx) ? cellW * 2 : cellW;
          ctx.fillRect(x, y, w, cellH);
        }

        if (!cell.ch) continue;
        ctx.fillStyle = fg;
        ctx.font = cell.bold ? `bold ${FONT}` : FONT;
        ctx.fillText(cell.ch, x + 1, y + 1);
      }
    }

    const cx = frame.cursorCol * cellW;
    const cy = frame.cursorRow * cellH;
    ctx.strokeStyle = "rgba(110, 231, 209, 0.85)";
    ctx.lineWidth = 1;
    ctx.strokeRect(cx + 0.5, cy + 0.5, cellW - 1, cellH - 1);
  }

  private drawSelection(
    sel: SelectionView,
    cols: number,
    cellW: number,
    cellH: number,
  ) {
    const { ctx } = this;
    ctx.fillStyle = SELECT_FILL;
    for (let r = sel.startRow; r <= sel.endRow; r++) {
      const c0 = r === sel.startRow ? sel.startCol : 0;
      const c1 = r === sel.endRow ? sel.endCol : cols - 1;
      const x = c0 * cellW;
      const y = r * cellH;
      const w = (c1 - c0 + 1) * cellW;
      ctx.fillRect(x, y, w, cellH);
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
  const samples = [
    '14px "Sarasa Mono SC"',
    '14px "PingFang SC"',
    '14px "Noto Sans Mono CJK SC"',
  ];
  return samples.some((f) => document.fonts.check(f));
}

function rgb(n: number): string {
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return `rgb(${r},${g},${b})`;
}

function isWideAt(cells: CellView[], cols: number, idx: number): boolean {
  const next = cells[idx + 1];
  return !!next?.wideCont;
}
