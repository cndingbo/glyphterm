const FILES_KEY = "glyphterm-recent-files";
const WORKSPACES_KEY = "glyphterm-recent-workspaces";
const MAX_FILES = 24;
const MAX_WORKSPACES = 8;

export interface RecentFileEntry {
  path: string;
  name: string;
  openedAt: number;
}

function readList<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as T[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeList<T>(key: string, list: T[]) {
  localStorage.setItem(key, JSON.stringify(list));
}

export function listRecentFiles(): RecentFileEntry[] {
  return readList<RecentFileEntry>(FILES_KEY).sort(
    (a, b) => b.openedAt - a.openedAt,
  );
}

export function recordRecentFile(path: string) {
  const name = path.split(/[/\\]/).pop() ?? path;
  const now = Date.now();
  const next = [
    { path, name, openedAt: now },
    ...listRecentFiles().filter((e) => e.path !== path),
  ].slice(0, MAX_FILES);
  writeList(FILES_KEY, next);
}

export function listRecentWorkspaces(): string[] {
  return readList<string>(WORKSPACES_KEY);
}

export function recordRecentWorkspace(path: string) {
  const next = [
    path,
    ...listRecentWorkspaces().filter((p) => p !== path),
  ].slice(0, MAX_WORKSPACES);
  writeList(WORKSPACES_KEY, next);
}
