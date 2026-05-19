import { invoke } from "@tauri-apps/api/core";
import { t } from "../i18n";

/** Wave-style structured terminal cards (Bash / Update). */

export type AiBlockStatus = "pending" | "running" | "done" | "failed";

export interface BashAiBlock {
  type: "bash";
  id: string;
  command: string;
  title?: string;
  status: AiBlockStatus;
  output?: string;
}

export interface UpdateFileEntry {
  path: string;
  summary: string;
}

export interface UpdateAiBlock {
  type: "update";
  id: string;
  title?: string;
  files: UpdateFileEntry[];
  status: AiBlockStatus;
}

export type AiBlock = BashAiBlock | UpdateAiBlock;

const BLOCK_PREFIX = "::glyphterm-block::";

export function parseAiBlockLine(line: string): AiBlock | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith(BLOCK_PREFIX)) return null;
  try {
    const json = trimmed.slice(BLOCK_PREFIX.length);
    return JSON.parse(json) as AiBlock;
  } catch {
    return null;
  }
}

export function serializeAiBlock(block: AiBlock): string {
  return `${BLOCK_PREFIX}${JSON.stringify(block)}`;
}

function uid(): string {
  return crypto.randomUUID();
}

export function createDemoBashBlock(command: string): BashAiBlock {
  return {
    type: "bash",
    id: uid(),
    command,
    title: t("aiBlock.bashTitle"),
    status: "pending",
  };
}

export function createDemoUpdateBlock(paths: string[]): UpdateAiBlock {
  return {
    type: "update",
    id: uid(),
    title: t("aiBlock.updateTitle"),
    status: "done",
    files: paths.map((path) => ({
      path,
      summary: t("aiBlock.updateFileSummary"),
    })),
  };
}

export interface AiBlockOverlay {
  mount: () => void;
  addBlock: (block: AiBlock) => void;
  clear: () => void;
}

export function createAiBlockOverlay(
  host: HTMLElement,
  opts: {
    onRunBash?: (block: BashAiBlock) => void | Promise<void>;
    onOpenFile?: (path: string) => void;
  },
): AiBlockOverlay {
  const stack = document.createElement("div");
  stack.className = "ai-block-stack";
  host.prepend(stack);

  function renderBlock(block: AiBlock): HTMLElement {
    const card = document.createElement("article");
    card.className = `ai-block ai-block-${block.type}`;
    card.dataset.blockId = block.id;

    if (block.type === "bash") {
      card.innerHTML = `
        <header class="ai-block-header">
          <span class="ai-block-kind">${t("aiBlock.bashBadge")}</span>
          <span class="ai-block-title">${escapeHtml(block.title ?? t("aiBlock.bashTitle"))}</span>
          <span class="ai-block-status status-${block.status}">${escapeHtml(t(`aiBlock.status.${block.status}`))}</span>
        </header>
        <pre class="ai-block-command"><code>${escapeHtml(block.command)}</code></pre>
        <footer class="ai-block-actions">
          <button type="button" class="ai-btn primary" data-run>${escapeHtml(t("aiBlock.run"))}</button>
          <button type="button" class="ai-btn" data-copy>${escapeHtml(t("aiBlock.copy"))}</button>
        </footer>`;
      card.querySelector("[data-run]")?.addEventListener("click", () => {
        void opts.onRunBash?.(block);
      });
      card.querySelector("[data-copy]")?.addEventListener("click", () => {
        void navigator.clipboard?.writeText(block.command);
      });
    } else {
      const files = block.files
        .map(
          (f) =>
            `<button type="button" class="ai-file-row" data-path="${escapeHtml(f.path)}"><span class="ai-file-path">${escapeHtml(f.path)}</span><span class="ai-file-summary">${escapeHtml(f.summary)}</span></button>`,
        )
        .join("");
      card.innerHTML = `
        <header class="ai-block-header">
          <span class="ai-block-kind">${t("aiBlock.updateBadge")}</span>
          <span class="ai-block-title">${escapeHtml(block.title ?? t("aiBlock.updateTitle"))}</span>
          <span class="ai-block-status status-${block.status}">${escapeHtml(t(`aiBlock.status.${block.status}`))}</span>
        </header>
        <div class="ai-block-files">${files}</div>`;
      card.querySelectorAll("[data-path]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const path = (btn as HTMLElement).dataset.path;
          if (path) opts.onOpenFile?.(path);
        });
      });
    }
    return card;
  }

  return {
    mount: () => {},
    addBlock(block: AiBlock) {
      stack.appendChild(renderBlock(block));
    },
    clear: () => {
      stack.innerHTML = "";
    },
  };
}

/** Run bash block command in the bound PTY tab. */
export async function runBashBlockInTerminal(
  tabId: number,
  block: BashAiBlock,
  onStatus: (status: AiBlockStatus) => void,
) {
  onStatus("running");
  try {
    await invoke("terminal_write", {
      data: `${block.command}\n`,
      tabId,
    });
    onStatus("done");
  } catch {
    onStatus("failed");
  }
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
}
