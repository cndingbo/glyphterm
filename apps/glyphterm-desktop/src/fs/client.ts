import { invoke } from "@tauri-apps/api/core";

export interface FsEntry {
  name: string;
  path: string;
  is_dir: boolean;
}

export interface FsSearchHit {
  path: string;
  name: string;
  relative: string;
}

export async function getWorkspaceRoot(): Promise<string> {
  return invoke<string>("workspace_get_root");
}

export async function setWorkspaceRoot(path: string): Promise<string> {
  return invoke<string>("workspace_set_root", { path });
}

export async function listDir(path?: string): Promise<FsEntry[]> {
  return invoke<FsEntry[]>("fs_list_dir", { path: path ?? null });
}

export async function searchFiles(
  query: string,
  limit = 50,
): Promise<FsSearchHit[]> {
  return invoke<FsSearchHit[]>("fs_search_files", { query, limit });
}

export async function readText(path: string): Promise<string> {
  return invoke<string>("fs_read_text", { path });
}

export async function writeText(path: string, content: string): Promise<void> {
  return invoke("fs_write_text", { path, content });
}

export function fileName(path: string): string {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || path;
}

export function languageIdForPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    json: "json",
    md: "markdown",
    rs: "rust",
    py: "python",
    go: "go",
    yml: "yaml",
    yaml: "yaml",
    html: "html",
    css: "css",
    scss: "scss",
    toml: "toml",
    sh: "shell",
    zsh: "shell",
    sql: "sql",
  };
  return map[ext] ?? "plaintext";
}
