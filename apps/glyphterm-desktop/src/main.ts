import { bootClassic } from "./app/classic-app";
import { bootWorkspace } from "./app/workspace-app";
import { initI18n, wireLanguageSelector } from "./i18n";
import { initCommandPaletteShortcut } from "./ui/command-palette";
import { loadSavedTheme } from "./themes";

const MODE_KEY = "glyphterm-ui-mode";

function wireModeToggle() {
  const sel = document.getElementById("ui-mode") as HTMLSelectElement | null;
  if (!sel) return;
  const saved = localStorage.getItem(MODE_KEY) ?? "workspace";
  sel.value = saved;
  sel.addEventListener("change", () => {
    localStorage.setItem(MODE_KEY, sel.value);
    location.reload();
  });
}

initI18n();
wireLanguageSelector();
loadSavedTheme();
wireModeToggle();
initCommandPaletteShortcut();

const mode = localStorage.getItem(MODE_KEY) ?? "workspace";
if (mode === "classic") {
  await bootClassic();
} else {
  await bootWorkspace();
}
