import { NO_LOOK } from "./looks";

/** Everything that describes one edit. Plain data, so it's easy to undo and to save as a preset later. */
export type Edit = {
  look: string;
  /** Look strength, 0 … 12 like VSCO. */
  strength: number;
  exposure: number;
  contrast: number;
  saturation: number;
  grain: number;
  vignette: number;
};

export type ToolKey = "exposure" | "contrast" | "saturation" | "grain" | "vignette";

export type Tool = {
  key: ToolKey;
  label: string;
  short: string;
  min: number;
  max: number;
  step: number;
  /** Values are shown with a sign and this many decimals. */
  decimals: number;
};

/** Phase 1 tools. The rest of the 22 adjustments slot into this list. */
export const TOOLS: Tool[] = [
  { key: "exposure", label: "Exposure", short: "Expo", min: -3, max: 3, step: 0.1, decimals: 1 },
  { key: "contrast", label: "Contrast", short: "Contrast", min: -100, max: 100, step: 1, decimals: 0 },
  { key: "saturation", label: "Saturation", short: "Sat", min: -100, max: 100, step: 1, decimals: 0 },
  { key: "grain", label: "Grain", short: "Grain", min: 0, max: 100, step: 1, decimals: 0 },
  { key: "vignette", label: "Vignette", short: "Vignette", min: -100, max: 100, step: 1, decimals: 0 },
];

export const DEFAULT_EDIT: Edit = {
  look: NO_LOOK,
  strength: 12,
  exposure: 0,
  contrast: 0,
  saturation: 0,
  grain: 0,
  vignette: 0,
};

export function isToolEdited(edit: Edit, key: ToolKey) {
  return edit[key] !== DEFAULT_EDIT[key];
}

export function isEdited(edit: Edit) {
  return (
    edit.look !== NO_LOOK ||
    TOOLS.some((t) => isToolEdited(edit, t.key))
  );
}

export function formatValue(v: number, decimals: number, signed = true) {
  const s = Math.abs(v).toFixed(decimals);
  if (!signed) return s;
  if (Number(s) === 0) return (0).toFixed(decimals);
  return (v > 0 ? "+" : "−") + s;
}
