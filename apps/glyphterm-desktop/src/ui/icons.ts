/** Inline SVG icons — currentColor, 20×20 */

export const iconTerminal = `<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect x="2" y="3" width="16" height="14" rx="2" stroke="currentColor" stroke-width="1.4"/><path d="M5 7.5L7.5 10L5 12.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 12.5H14" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`;

export const iconFiles = `<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M4 4h5.5L12 6.5V16H4V4z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M9.5 4v3H12" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>`;

export const iconSysinfo = `<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect x="3" y="10" width="3" height="7" rx="1" fill="currentColor" opacity=".5"/><rect x="8.5" y="6" width="3" height="11" rx="1" fill="currentColor" opacity=".75"/><rect x="14" y="3" width="3" height="14" rx="1" fill="currentColor"/></svg>`;

export const iconProcess = `<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M4 5h12M4 10h12M4 15h8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`;

export const iconSplit = `<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect x="2" y="3" width="7" height="14" rx="1.5" stroke="currentColor" stroke-width="1.3"/><rect x="11" y="3" width="7" height="14" rx="1.5" stroke="currentColor" stroke-width="1.3"/></svg>`;

export const iconGear = `<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="2.5" stroke="currentColor" stroke-width="1.3"/><path d="M10 2.5v2M10 15v2M2.5 10h2M15 10h2M4.4 4.4l1.4 1.4M14.2 14.2l1.4 1.4M4.4 15.6l1.4-1.4M14.2 5.8l1.4-1.4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>`;

export const iconFolder = `<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2 4.5h4l1.5 1.5H14V13H2V4.5z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>`;

export const iconFile = `<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 2h5l3 3v9H4V2z" stroke="currentColor" stroke-width="1.2"/><path d="M9 2v3h3" stroke="currentColor" stroke-width="1.2"/></svg>`;

export const ACTIVITY_ICONS: Record<string, string> = {
  terminal: iconTerminal,
  files: iconFiles,
  sysinfo: iconSysinfo,
  process: iconProcess,
};
