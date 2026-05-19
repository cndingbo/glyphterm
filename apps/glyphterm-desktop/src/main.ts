import { bootClassic } from "./app/classic-app";
import { bootWorkspace } from "./app/workspace-app";
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

loadSavedTheme();
wireModeToggle();

const mode = localStorage.getItem(MODE_KEY) ?? "workspace";
if (mode === "classic") {
  await bootClassic();
} else {
  await bootWorkspace();
}
