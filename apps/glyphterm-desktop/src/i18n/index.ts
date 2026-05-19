import { en } from "./locales/en";
import { zhHans } from "./locales/zh-Hans";

export type Locale = "en" | "zh-Hans";
export type MessageTree = typeof en;

const STORAGE_KEY = "glyphterm-locale";
const DEFAULT_LOCALE: Locale = "en";

const catalogs: Record<Locale, MessageTree> = {
  en,
  "zh-Hans": zhHans,
};

let current: Locale = DEFAULT_LOCALE;
const listeners = new Set<() => void>();

function getByPath(tree: MessageTree, key: string): string | undefined {
  const parts = key.split(".");
  let node: unknown = tree;
  for (const part of parts) {
    if (node === null || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" ? node : undefined;
}

/** Translate `key` with optional `{name}` interpolation. */
export function t(
  key: string,
  vars?: Record<string, string | number>,
): string {
  const raw =
    getByPath(catalogs[current], key) ??
    getByPath(catalogs.en, key) ??
    key;
  if (!vars) return raw;
  return Object.entries(vars).reduce(
    (s, [k, v]) => s.replaceAll(`{${k}}`, String(v)),
    raw,
  );
}

export function getLocale(): Locale {
  return current;
}

export function listLocales(): { id: Locale; label: string }[] {
  return [
    { id: "en", label: "English" },
    { id: "zh-Hans", label: "简体中文" },
  ];
}

export function onLocaleChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  document.documentElement.lang = current === "zh-Hans" ? "zh-Hans" : "en";
  applyI18nToDocument();
  for (const fn of listeners) fn();
}

export function setLocale(locale: Locale): void {
  if (!catalogs[locale]) return;
  current = locale;
  localStorage.setItem(STORAGE_KEY, locale);
  notify();
}

export function initI18n(): Locale {
  const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;
  current =
    saved && saved in catalogs ? saved : DEFAULT_LOCALE;
  document.documentElement.lang = current === "zh-Hans" ? "zh-Hans" : "en";
  applyI18nToDocument();
  return current;
}

export function wireLanguageSelector(
  selectId = "ui-locale",
): HTMLSelectElement | null {
  const sel = document.getElementById(selectId) as HTMLSelectElement | null;
  if (!sel) return null;

  sel.innerHTML = "";
  for (const loc of listLocales()) {
    const opt = document.createElement("option");
    opt.value = loc.id;
    opt.textContent = loc.label;
    if (loc.id === current) opt.selected = true;
    sel.appendChild(opt);
  }

  sel.addEventListener("change", () => {
    setLocale(sel.value as Locale);
  });

  onLocaleChange(() => {
    sel.value = current;
  });

  return sel;
}

/** Theme display name for picker. */
export function themeDisplayName(theme: {
  name: string;
  nameZh: string;
}): string {
  return current === "zh-Hans" ? theme.nameZh : theme.name;
}

/** Apply `data-i18n*` attributes across the static shell. */
export function applyI18nToDocument(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n;
    if (key) el.textContent = t(key);
  });

  root.querySelectorAll<HTMLElement>("[data-i18n-title]").forEach((el) => {
    const key = el.dataset.i18nTitle;
    if (key) el.title = t(key);
  });

  root.querySelectorAll<HTMLElement>("[data-i18n-aria]").forEach((el) => {
    const key = el.dataset.i18nAria;
    if (key) el.setAttribute("aria-label", t(key));
  });

  root.querySelectorAll<HTMLOptionElement>("[data-i18n-option]").forEach((el) => {
    const key = el.dataset.i18nOption;
    if (key) el.textContent = t(key);
  });
}
