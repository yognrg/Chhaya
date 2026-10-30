"use client";

import { useRef, useState } from "react";
import { formatValue } from "../edit";

type Props = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  /** Where the slider resets to on double-tap. Also gets the haptic tick. */
  defaultValue: number;
  decimals: number;
  signed?: boolean;
  /** Shows the track as a hue rainbow (split tone hues). */
  hue?: boolean;
  onChange: (v: number) => void;
};

/**
 * A 1px hairline slider with a centre tick, VSCO-style. Built on a real
 * range input, so arrow keys, screen readers and value text all work.
 */
export function HairlineSlider({
  label, value, min, max, step, defaultValue, decimals, signed = true, hue, onChange,
}: Props) {
  const [dragging, setDragging] = useState(false);
  const lastTap = useRef(0);
  // After a double-tap reset, ignore the jump-to-finger change until release.
  const locked = useRef(false);
  const pct = ((value - min) / (max - min)) * 100;
  const originPct = ((Math.min(Math.max(0, min), max) - min) / (max - min)) * 100;
  const hasCentre = min < 0 && max > 0 && !hue;
  const text = formatValue(value, decimals, signed);

  const set = (v: number) => {
    // A light haptic tick when crossing the default, where supported.
    if ((value - defaultValue) * (v - defaultValue) <= 0 && v !== value) {
      navigator.vibrate?.(6);
    }
    onChange(v);
  };

  const reset = () => set(defaultValue);
  const release = () => {
    setDragging(false);
    locked.current = false;
  };

  return (
    <div className={`ch-slider${dragging ? " is-dragging" : ""}`}>
      <div className="ch-slider-value" aria-hidden="true">{text}</div>
      <div className="ch-slider-track">
        <div className={`ch-slider-line${hue ? " is-hue" : ""}`} />
        {hasCentre && <div className="ch-slider-tick" style={{ left: `${originPct}%` }} />}
        <div
          hidden={hue}
          className="ch-slider-fill"
          style={{ left: `${Math.min(pct, originPct)}%`, width: `${Math.abs(pct - originPct)}%` }}
        />
        <div className="ch-slider-thumb" style={{ left: `${pct}%` }} />
        <input
          type="range"
          aria-label={label}
          aria-valuetext={text}
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => {
            if (!locked.current) set(Number(e.target.value));
          }}
          onPointerDown={() => {
            setDragging(true);
            const now = performance.now();
            if (now - lastTap.current < 300) {
              locked.current = true;
              reset();
            }
            lastTap.current = now;
          }}
          onPointerUp={release}
          onPointerCancel={release}
          onBlur={release}
          onKeyDown={(e) => {
            if (e.key === "Backspace" || e.key === "Delete") reset();
          }}
        />
      </div>
    </div>
  );
}
