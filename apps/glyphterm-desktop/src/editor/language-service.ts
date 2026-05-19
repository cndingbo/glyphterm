import { languageIdForPath } from "../fs/client";

export type LanguageSupport = "full" | "basic" | "none";

export interface LanguageCapability {
  id: string;
  support: LanguageSupport;
  features: string[];
}

const CAPABILITIES: Record<string, LanguageCapability> = {
  typescript: {
    id: "typescript",
    support: "full",
    features: ["syntax", "diagnostics", "completion"],
  },
  javascript: {
    id: "javascript",
    support: "full",
    features: ["syntax", "diagnostics", "completion"],
  },
  json: {
    id: "json",
    support: "full",
    features: ["syntax", "diagnostics"],
  },
  css: { id: "css", support: "full", features: ["syntax", "diagnostics"] },
  scss: { id: "scss", support: "full", features: ["syntax", "diagnostics"] },
  html: { id: "html", support: "full", features: ["syntax", "diagnostics"] },
  markdown: {
    id: "markdown",
    support: "basic",
    features: ["syntax"],
  },
  rust: {
    id: "rust",
    support: "basic",
    features: ["syntax"],
  },
  plaintext: {
    id: "plaintext",
    support: "none",
    features: [],
  },
};

export function capabilityForPath(path: string | null): LanguageCapability {
  const id = path ? languageIdForPath(path) : "plaintext";
  return CAPABILITIES[id] ?? CAPABILITIES.plaintext;
}

export function languageLabelForPath(path: string | null): string {
  const cap = capabilityForPath(path);
  const labels: Record<string, string> = {
    typescript: "TypeScript",
    javascript: "JavaScript",
    json: "JSON",
    css: "CSS",
    scss: "SCSS",
    html: "HTML",
    markdown: "Markdown",
    rust: "Rust",
    shell: "Shell",
    python: "Python",
    go: "Go",
    yaml: "YAML",
    toml: "TOML",
    plaintext: "Plain Text",
  };
  return labels[cap.id] ?? cap.id;
}
