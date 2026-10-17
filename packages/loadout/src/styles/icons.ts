// Inline SVG icons, drawn at 24x24 with the current colour.
import { html, type TemplateResult } from 'lit';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';

const PATHS = {
  check: '<path d="m5 12 5 5 9-10"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  half: '<path d="M12 3a9 9 0 0 1 0 18Z" fill="currentColor"/><circle cx="12" cy="12" r="9"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chev: '<path d="m9 6 6 6-6 6"/>',
  drive: '<rect x="3" y="7" width="18" height="10" rx="2"/><path d="M7 12h.01M11 12h.01"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.9-3M4 4v4h4M4 13a8 8 0 0 0 14.9 3M20 20v-4h-4"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  alert: '<path d="M12 3 2 20h20L12 3Z"/><path d="M12 10v4M12 17h.01"/>',
  vault:
    '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="12" cy="12" r="3.5"/><path d="M12 8.5V7M12 17v-1.5M15.5 12H17M7 12h1.5"/>',
  queue: '<path d="M4 6h16M4 12h16M4 18h10"/>',
  empty:
    '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  library:
    '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  discover: '<path d="M12 3 2 8l10 5 10-5-10-5Z"/><path d="m2 16 10 5 10-5"/><path d="m2 12 10 5 10-5"/>',
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  minus: '<path d="M5 12h14"/>',
  back: '<path d="m15 6-6 6 6 6"/>',
  play: '<path d="M7 5v14l11-7Z"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="1.5"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  logo: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
} as const;

export type IconName = keyof typeof PATHS;

/** An inline SVG icon from the set above. */
export const icon = (name: IconName, cls = 'i'): TemplateResult =>
  html`<svg
    class=${cls}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    ${unsafeSVG(PATHS[name])}
  </svg>`;
