/** English (default UI locale). */
export const en = {
  app: {
    hint: "CJK-first terminal · Workspace",
    brandMark: "G",
  },
  settings: {
    language: "Language",
    uiMode: "Layout",
    uiModeTitle: "Classic terminal or Wave workspace",
    theme: "Theme",
    themeTitle: "Color theme",
  },
  uiMode: {
    workspace: "Workspace",
    classic: "Classic",
  },
  actions: {
    newLocal: "+ Local",
    newLocalTitle: "New local tab (⌘T)",
    newSsh: "+ SSH",
    newSshTitle: "New SSH session (⌘⇧N)",
    newWorkspaceTab: "New workspace tab",
    splitLayout: "Split layout",
    resetSplit: "Reset split to 50/50",
    toggleSplitAxis: "Toggle split axis (horizontal / vertical)",
  },
  palette: {
    hint: "↑↓ navigate · Enter run · Esc close",
    empty: "No matching commands",
    toggleFiles: "Explorer: Show file tree",
    toggleTerminal: "Focus terminal activity",
    newLocal: "Terminal: New local session",
    newSsh: "Terminal: New SSH session",
    resetSplit: "Layout: Reset pane split 50/50",
    toggleSplitAxis: "Layout: Toggle split direction",
    openClassic: "Switch to classic terminal layout",
    openWorkspace: "Switch to workspace layout",
    themePrefix: "Theme:",
    languagePrefix: "Language:",
  },
  a11y: {
    workspaceTabs: "Workspace tabs",
    activityBar: "Activity bar",
    terminalTabs: "Terminal tabs",
  },
  activity: {
    terminal: "terminal",
    files: "files",
    sysinfo: "sysinfo",
    process: "process",
  },
  pane: {
    focus: "Focus pane",
    term: "TERM",
    edit: "EDIT",
    welcome: "Welcome",
    local: "local",
  },
  explorer: {
    title: "Explorer",
  },
  sysinfo: {
    title: "System info",
    body: "CPU, memory, and disk metrics coming in a future release.",
  },
  placeholder: {
    comingSoon: "Coming soon",
  },
  welcome: {
    eyebrow: "GlyphTerm Editor",
    title: "Professional editing",
    desc: "Monaco core · Same engine family as VS Code / Cursor · ⌘S to save",
    shortcutSave: "Save file",
    shortcutFiles: "Browse project in sidebar",
    shortcutSplit: "Drag the gutter between panes to resize",
  },
  terminal: {
    idlePrompt: "GlyphTerm",
    idleHint: "Type to begin · CJK column width handled by the engine",
  },
  ssh: {
    host: "SSH host:",
    user: "Username:",
    port: "Port:",
    password: "Password (empty = ssh-agent / ~/.ssh/id_ed25519):",
    failed: "SSH connection failed: {error}",
  },
  split: {
    gutterTitle: "Drag to resize panes",
  },
  errors: {
    readFile: "// Failed to read: {error}",
  },
  font: {
    banner:
      "Install a CJK monospace font (e.g. Sarasa Mono SC): brew install --cask font-sarasa-gothic",
  },
};

export type MessageTree = typeof en;
