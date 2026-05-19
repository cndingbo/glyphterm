import type { MessageTree } from "./en";

/** Simplified Chinese UI strings. */
export const zhHans: MessageTree = {
  app: {
    hint: "字形终端 · 工作区",
    brandMark: "字",
  },
  settings: {
    language: "语言",
    uiMode: "界面",
    uiModeTitle: "经典终端 / Wave 工作区",
    theme: "主题",
    themeTitle: "配色主题",
  },
  uiMode: {
    workspace: "工作区",
    classic: "经典",
  },
  actions: {
    newLocal: "+ 本地",
    newLocalTitle: "新本地标签 (⌘T)",
    newSsh: "+ SSH",
    newSshTitle: "SSH 远程 (⌘⇧N)",
    newWorkspaceTab: "新工作区标签",
    splitLayout: "分屏布局",
    resetSplit: "重置分屏为 50/50",
    toggleSplitAxis: "切换分屏方向（横 / 竖）",
  },
  palette: {
    hint: "↑↓ 选择 · Enter 执行 · Esc 关闭",
    empty: "没有匹配的命令",
    toggleFiles: "资源管理器：显示文件树",
    toggleTerminal: "聚焦终端活动栏",
    newLocal: "终端：新建本地会话",
    newSsh: "终端：新建 SSH 会话",
    resetSplit: "布局：重置分屏 50/50",
    toggleSplitAxis: "布局：切换分屏方向",
    openClassic: "切换到经典终端布局",
    openWorkspace: "切换到工作区布局",
    themePrefix: "主题：",
    languagePrefix: "语言：",
  },
  a11y: {
    workspaceTabs: "工作区标签",
    activityBar: "活动栏",
    terminalTabs: "终端标签",
  },
  activity: {
    terminal: "终端",
    files: "文件",
    sysinfo: "系统",
    process: "进程",
  },
  pane: {
    focus: "聚焦",
    term: "TERM",
    edit: "EDIT",
    welcome: "欢迎",
    local: "local",
  },
  explorer: {
    title: "资源管理器",
  },
  sysinfo: {
    title: "系统信息",
    body: "下一版接入 CPU / 内存 / 磁盘指标。",
  },
  placeholder: {
    comingSoon: "即将推出",
  },
  welcome: {
    eyebrow: "GlyphTerm Editor",
    title: "专业代码编辑",
    desc: "Monaco 内核 · 与 VS Code / Cursor 同源 · 支持 ⌘S 保存",
    shortcutSave: "保存文件",
    shortcutFiles: "侧栏浏览项目",
    shortcutSplit: "拖动分屏条调整左右区域大小",
  },
  terminal: {
    idlePrompt: "字形终端",
    idleHint: "输入命令开始 · CJK 宽度由引擎保证",
  },
  ssh: {
    host: "SSH 主机:",
    user: "用户名:",
    port: "端口:",
    password: "密码 (留空则使用 ssh-agent / ~/.ssh/id_ed25519):",
    failed: "SSH 连接失败: {error}",
  },
  split: {
    gutterTitle: "拖动以调整分屏",
  },
  errors: {
    readFile: "// 无法读取: {error}",
  },
  font: {
    banner:
      "建议安装 CJK 等宽字体（如 Sarasa Mono SC）：brew install --cask font-sarasa-gothic",
  },
};
