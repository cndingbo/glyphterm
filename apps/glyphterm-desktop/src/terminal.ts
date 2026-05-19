/** Terminal frame from Rust (`glyphterm-core`). */
export interface CellView {
  ch: string;
  fg: number;
  bg: number;
  bold: boolean;
  wideCont: boolean;
}

export interface Frame {
  cols: number;
  rows: number;
  cursorCol: number;
  cursorRow: number;
  scrollbackLines: number;
  cells: CellView[];
}

const FONT =
  '14px "Sarasa Mono SC", "PingFang SC", "Noto Sans Mono CJK SC", monospace';

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

  render(frame: Frame) {
    this.frame = frame;
    this.resizeCanvas();
    const { ctx, cellW, cellH } = this;
    const { cols, rows, cells } = frame;

    ctx.fillStyle = "#08090B";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

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
        if (cell.bold) ctx.font = `bold ${FONT}`;
        else ctx.font = FONT;
        ctx.fillText(cell.ch, x + 1, y + 1);
      }
    }

    // Cursor
    const cx = frame.cursorCol * cellW;
    const cy = frame.cursorRow * cellH;
    ctx.strokeStyle = "rgba(110, 231, 209, 0.85)";
    ctx.lineWidth = 1;
    ctx.strokeRect(cx + 0.5, cy + 0.5, cellW - 1, cellH - 1);
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
