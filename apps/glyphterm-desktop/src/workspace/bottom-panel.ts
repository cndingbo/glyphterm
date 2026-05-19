export type BottomPanelView = "problems" | "output";

export interface BottomPanelState {
  open: boolean;
  view: BottomPanelView;
  /** Panel height in px */
  height: number;
}

const STORAGE_KEY = "glyphterm-bottom-panel";

const DEFAULT: BottomPanelState = {
  open: false,
  view: "problems",
  height: 200,
};

export function loadBottomPanelState(): BottomPanelState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT };
    const parsed = JSON.parse(raw) as BottomPanelState;
    return {
      open: Boolean(parsed.open),
      view: parsed.view === "output" ? "output" : "problems",
      height: clampHeight(parsed.height ?? DEFAULT.height),
    };
  } catch {
    return { ...DEFAULT };
  }
}

export function saveBottomPanelState(state: BottomPanelState) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ...state,
      height: clampHeight(state.height),
    }),
  );
}

export function clampHeight(h: number): number {
  return Math.min(480, Math.max(120, Math.round(h)));
}
