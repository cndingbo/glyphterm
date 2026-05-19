import { t } from "../i18n";

export type OutputChannel = "GlyphTerm" | "Tasks" | "Extension";

export interface OutputLine {
  id: string;
  channel: OutputChannel;
  text: string;
  time: number;
}

const MAX_LINES = 500;
let lines: OutputLine[] = [];
const listeners = new Set<() => void>();

function uid(): string {
  return crypto.randomUUID();
}

function notify() {
  listeners.forEach((fn) => fn());
}

export function appendOutput(
  channel: OutputChannel,
  text: string,
  opts?: { newline?: boolean },
) {
  const chunk = opts?.newline === false ? text : `${text}\n`;
  lines.push({
    id: uid(),
    channel,
    text: chunk,
    time: Date.now(),
  });
  if (lines.length > MAX_LINES) {
    lines = lines.slice(-MAX_LINES);
  }
  notify();
}

export function clearOutput(channel?: OutputChannel) {
  if (!channel) {
    lines = [];
  } else {
    lines = lines.filter((l) => l.channel !== channel);
  }
  notify();
}

export function getOutputLines(): readonly OutputLine[] {
  return lines;
}

export function onOutputChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function bootstrapOutputLog() {
  if (lines.length > 0) return;
  appendOutput("GlyphTerm", t("output.boot"));
}
