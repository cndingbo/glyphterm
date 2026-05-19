/** Drag-to-resize split gutter between two panes. */

export interface SplitResizeOptions {
  direction: "row" | "column";
  getSplit: () => number;
  setSplit: (pct: number) => void;
  onCommit?: (pct: number) => void;
  min?: number;
  max?: number;
}

export function attachSplitResizer(
  splitRoot: HTMLElement,
  gutter: HTMLElement,
  opts: SplitResizeOptions,
): () => void {
  const min = opts.min ?? 22;
  const max = opts.max ?? 78;

  const apply = (pct: number) => {
    const clamped = Math.min(max, Math.max(min, pct));
    splitRoot.style.setProperty("--split", `${clamped}%`);
    opts.setSplit(clamped);
    return clamped;
  };

  const onPointerDown = (ev: PointerEvent) => {
    if (ev.button !== 0) return;
    ev.preventDefault();
    gutter.setPointerCapture(ev.pointerId);
    gutter.classList.add("dragging");
    document.body.classList.add("ws-split-dragging");
    document.body.classList.add(
      opts.direction === "row" ? "ws-split-dragging-col" : "ws-split-dragging-row",
    );

    const onMove = (move: PointerEvent) => {
      const rect = splitRoot.getBoundingClientRect();
      let pct: number;
      if (opts.direction === "row") {
        pct = ((move.clientX - rect.left) / rect.width) * 100;
      } else {
        pct = ((move.clientY - rect.top) / rect.height) * 100;
      }
      apply(pct);
    };

    const onUp = (up: PointerEvent) => {
      gutter.releasePointerCapture(up.pointerId);
      gutter.classList.remove("dragging");
      document.body.classList.remove("ws-split-dragging");
      document.body.classList.remove("ws-split-dragging-col", "ws-split-dragging-row");
      gutter.removeEventListener("pointermove", onMove);
      gutter.removeEventListener("pointerup", onUp);
      gutter.removeEventListener("pointercancel", onUp);
      const final = opts.getSplit();
      opts.onCommit?.(final);
      // Trigger resize on terminal/editor inside panes
      window.dispatchEvent(new Event("resize"));
    };

    gutter.addEventListener("pointermove", onMove);
    gutter.addEventListener("pointerup", onUp);
    gutter.addEventListener("pointercancel", onUp);
  };

  gutter.addEventListener("pointerdown", onPointerDown);
  return () => gutter.removeEventListener("pointerdown", onPointerDown);
}
