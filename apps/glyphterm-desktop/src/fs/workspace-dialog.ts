import { open } from "@tauri-apps/plugin-dialog";
import { t } from "../i18n";

/** Native OS folder picker — returns absolute path or null if cancelled. */
export async function pickWorkspaceFolder(
  defaultPath?: string,
): Promise<string | null> {
  const selected = await open({
    directory: true,
    multiple: false,
    defaultPath: defaultPath || undefined,
    title: t("workspace.pickFolderTitle"),
  });
  if (selected === null) return null;
  if (Array.isArray(selected)) return selected[0] ?? null;
  return selected;
}
