import { DEFAULT_EDIT, type Edit, mergeEdit } from "./edit";
import PRESET_DATA from "./data/presets.json";
import { getLook, NO_LOOK } from "./looks";

export const CATEGORIES = ["Vintage", "Film", "Instagram style", "Cinematic", "Black and white", "Soft"] as const;
export type Category = (typeof CATEGORIES)[number] | "Mine";

/** A preset is a look plus adjustments plus a frame (or ASCII), saved together. */
export type Preset = {
  id: string;
  name: string;
  goodFor: string;
  category: Category;
  /** Default intensity, 0 … 100. */
  intensity: number;
  /** Look code shown on the thumbnail. */
  code: string;
  edit: Edit;
  custom?: boolean;
};

type PresetRow = {
  id: string;
  name: string;
  category: Category;
  goodFor: string;
  intensity: number;
  code?: string;
  edit: Parameters<typeof mergeEdit>[1];
};

/** Presets are data (data/presets.json): adding one means adding one entry. */
export const PRESETS: Preset[] = (PRESET_DATA as PresetRow[]).map((r) => {
  const edit = mergeEdit(DEFAULT_EDIT, r.edit);
  return {
    id: r.id,
    name: r.name,
    goodFor: r.goodFor,
    category: r.category,
    intensity: r.intensity,
    code: r.code ?? getLook(edit.look)?.code ?? "—",
    edit,
  };
});

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * A preset at partial intensity: numbers move from `base` towards the preset,
 * the look fades in through its strength, and frames, crop and ASCII switch on
 * once the intensity is above zero.
 */
export function blendEdit(base: Edit, target: Edit, t: number): Edit {
  if (t >= 1) return target;
  const out = { ...target } as Edit;
  for (const k of Object.keys(target) as (keyof Edit)[]) {
    const a = base[k];
    const b = target[k];
    if (typeof a === "number" && typeof b === "number") (out[k] as number) = lerp(a, b, t);
  }
  out.hsl = target.hsl.map((v, i) => lerp(base.hsl[i], v, t));
  if (target.look !== NO_LOOK) out.strength = target.strength * t;
  else {
    out.look = base.look;
    out.strength = base.strength * (1 - t);
  }
  if (t <= 0) return base;
  return out;
}

/* ---------- favourites (this device only) ---------- */

const FAV_KEY = "chhaya.favourites.v1";

export function loadFavourites(): string[] {
  try {
    return JSON.parse(localStorage.getItem(FAV_KEY) || "[]") as string[];
  } catch {
    return [];
  }
}

export function saveFavourites(ids: string[]) {
  try {
    localStorage.setItem(FAV_KEY, JSON.stringify(ids));
  } catch {
    // Storage unavailable: favourites last for this visit only.
  }
}

const KEY = "chhaya.presets.v1";

/** Your own presets live in this browser only. */
export function loadCustomPresets(): Preset[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as Preset[];
    // Older saves may miss newer fields: rebuild on top of today's defaults.
    return list.map((x) => ({
      ...x,
      custom: true,
      category: "Mine" as const,
      intensity: x.intensity ?? 100,
      edit: mergeEdit(DEFAULT_EDIT, x.edit),
    }));
  } catch {
    return [];
  }
}

export function saveCustomPresets(list: Preset[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Storage can be unavailable (private mode). Presets then last for this visit only.
  }
}
