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
