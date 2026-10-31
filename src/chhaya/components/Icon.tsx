/** Thin line icons: 20px, 1.4px stroke, drawn on a 24 grid. */

const PATHS = {
  exposure: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
    </>
  ),
  contrast: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor" stroke="none" />
    </>
  ),
  saturation: <path d="M12 3.5c3 3.6 6 7.1 6 10.5a6 6 0 0 1-12 0c0-3.4 3-6.9 6-10.5Z" />,
  grain: (
    <>
      {[
        [6, 6], [12, 5], [18, 7], [8, 11], [15, 11], [5, 16], [11, 16], [17, 15], [8, 20], [14, 19],
      ].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="0.9" fill="currentColor" stroke="none" />
      ))}
    </>
  ),
  vignette: (
    <>
      <rect x="3.5" y="5.5" width="17" height="13" rx="1" />
      <ellipse cx="12" cy="12" rx="5.5" ry="4" />
    </>
  ),
  highlights: (
    <>
      <path d="M5 16a7 7 0 0 1 14 0Z" fill="currentColor" stroke="none" opacity="0.25" />
      <path d="M5 16a7 7 0 0 1 14 0M3 16h18M12 4v2M5.6 7.6 7 9M18.4 7.6 17 9" />
    </>
  ),
  shadows: <path d="M15.5 4.5a7.5 7.5 0 1 0 4 11.5 6 6 0 0 1-4-11.5Z" />,
  whites: (
    <>
      <circle cx="8.5" cy="12" r="4.5" />
      <circle cx="15.5" cy="12" r="4.5" fill="currentColor" />
    </>
  ),
  temperature: (
    <>
      <path d="M10 14.5V5a2 2 0 0 1 4 0v9.5a4 4 0 1 1-4 0Z" />
      <path d="M12 10v6" />
    </>
  ),
  tint: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4a8 8 0 0 0 0 16Z" fill="currentColor" stroke="none" opacity="0.35" />
    </>
  ),
  vibrance: <path d="M12 3.5 13.8 10l6.7 2-6.7 2L12 20.5 10.2 14l-6.7-2 6.7-2Z" />,
  skin: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M9 10h.01M15 10h.01M9 14.5a4 4 0 0 0 6 0" />
    </>
  ),
  hsl: (
    <>
      <circle cx="9" cy="9.5" r="5" />
      <circle cx="15" cy="9.5" r="5" />
      <circle cx="12" cy="14.5" r="5" />
    </>
  ),
  split: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M6.3 17.7 17.7 6.3" />
    </>
  ),
  clarity: <path d="M12 3.5 20 12l-8 8.5L4 12Z M12 3.5v17" />,
  texture: <path d="M4 4l16 16M4 10l10 10M10 4l10 10M4 16l4 4M16 4l4 4" />,
  sharpness: <path d="M12 4 20.5 19h-17Z" />,
  dehaze: <path d="M4 8c2.7-2 5.3 2 8 0s5.3-2 8 0M4 12.5c2.7-2 5.3 2 8 0s5.3-2 8 0M4 17c2.7-2 5.3 2 8 0s5.3-2 8 0" />,
  fade: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="1" />
      <path d="M4 15h16M4 10h16" opacity="0.5" />
    </>
  ),
  dust: (
    <>
      <circle cx="7" cy="8" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="6.5" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="11" cy="14" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="17.5" cy="16.5" r="1.1" fill="currentColor" stroke="none" />
      <path d="M5 19c3-1 5-4 6-7" />
    </>
  ),
  halation: (
    <>
      <circle cx="12" cy="12" r="3.5" />
      <circle cx="12" cy="12" r="7.5" strokeDasharray="1.5 2.5" />
    </>
  ),
  leak: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="1" />
      <path d="M4 13a9 9 0 0 0 9-9M4 8.5A4.5 4.5 0 0 0 8.5 4" />
    </>
  ),
  blur: (
    <>
      <circle cx="12" cy="12" r="3" />
      <circle cx="12" cy="12" r="8" strokeDasharray="2 2.5" />
    </>
  ),
  crop: <path d="M7 3v14h14M3 7h14v14" />,
  rotate: <path d="M5 13a7 7 0 1 0 2-5.5M5 4v4h4" />,
  flipH: <path d="M12 3v18M9 7 4 17h5ZM15 7l5 10h-5Z" />,
  off: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="m6.4 17.6 11.2-11.2" />
    </>
  ),
  grid: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="1.2" />
      <rect x="13" y="4" width="7" height="7" rx="1.2" />
      <rect x="4" y="13" width="7" height="7" rx="1.2" />
      <rect x="13" y="13" width="7" height="7" rx="1.2" />
    </>
  ),
  lamp: (
    <>
      <path d="M12 3v2.5M5.5 14a6.5 6.5 0 0 1 13 0Z" />
      <path d="M4 14h16M10 14a2 2 0 0 0 4 0" />
      <path d="M12 18.5v1.5M7.2 17.6l-1 1.2M16.8 17.6l1 1.2" />
    </>
  ),
  /** Switch camera: two arrows chasing round a lens. */
  switchCam: (
    <>
      <path d="M19.2 9.5A7.6 7.6 0 0 0 5.6 7.4" />
      <path d="M19.6 5.3v4.4h-4.4" />
      <path d="M4.8 14.5a7.6 7.6 0 0 0 13.6 2.1" />
      <path d="M4.4 18.7v-4.4h4.4" />
      <circle cx="12" cy="12" r="2.6" />
    </>
  ),
  star: <path d="m12 3.8 2.5 5.2 5.7.8-4.1 4 1 5.6L12 16.7l-5.1 2.7 1-5.6-4.1-4 5.7-.8Z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  copy: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="1.5" />
      <path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8" />
    </>
  ),
  undo: <path d="M9 7 5 11l4 4M5 11h9a5 5 0 0 1 0 10h-2" />,
  redo: <path d="m15 7 4 4-4 4M19 11h-9a5 5 0 0 0 0 10h2" />,
  reset: <path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4" />,
  flip: (
    <>
      <path d="M4 8h3l1.5-2h7L17 8h3v11H4Z" />
      <path d="M9 13.5a3 3 0 0 1 5.2-2M15 12.5a3 3 0 0 1-5.2 2M14.2 9.5v2h-2M9.8 16.5v-2h2" />
    </>
  ),
  upload: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="1" />
      <path d="m3.5 16 5-5 4 4 2.5-2.5 5 5" />
      <circle cx="15.5" cy="9" r="1.5" />
    </>
  ),
  timer: (
    <>
      <circle cx="12" cy="13" r="7.5" />
      <path d="M12 13V9M10 3h4" />
    </>
  ),
  back: <path d="m14.5 5-7 7 7 7" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  save: <path d="M12 4v11M7 10.5l5 5 5-5M5 20h14" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
