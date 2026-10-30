"use client";

import type { CSSProperties } from "react";

type Option<T extends string> = { value: T; label: string; style?: CSSProperties; swatch?: string };

/** A row of round chips, one selected. Used for styles, modes and aspect ratios. */
export function Chips<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="ch-chips" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={o.value === value}
          className={`ch-chip${o.value === value ? " is-on" : ""}`}
          style={o.style}
          onClick={() => onChange(o.value)}
        >
          {o.swatch && <span className="ch-chip-swatch" style={{ background: o.swatch }} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}
