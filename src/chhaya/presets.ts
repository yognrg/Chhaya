import { DEFAULT_EDIT, type Edit, mergeEdit } from "./edit";

/** A preset is a look plus adjustments plus a frame (or ASCII), saved together. */
export type Preset = {
  id: string;
  name: string;
  goodFor: string;
  /** Look code shown on the thumbnail. */
  code: string;
  edit: Edit;
  custom?: boolean;
};

const p = (id: string, name: string, goodFor: string, code: string, patch: Parameters<typeof mergeEdit>[1]): Preset => ({
  id,
  name,
  goodFor,
  code,
  edit: mergeEdit(DEFAULT_EDIT, patch),
});

export const PRESETS: Preset[] = [
  p("sunday", "Sunday Morning", "Portraits, cafés", "K1", { look: "k1", exposure: 0.3, fade: 15, grain: 10, grainSize: 30 }),
  p("monsoon", "Monsoon", "Rainy streets, hills", "F3", {
    look: "f3", clarity: -10, vignette: 20, splitShadow: 30, splitShadowHue: 200, splitHigh: 15, splitHighHue: 180,
  }),
  p("digicam", "90s Digicam", "Party, friends", "N1", {
    look: "n1", exposure: 0.3, contrast: 15, sharpness: 40, frame: { kind: "border", date: true, borderColor: "white", borderSize: 0 },
  }),
  p("golden", "Golden Hour", "Sunsets", "K2", { look: "k2", temperature: 20, halation: 30 }),
  p("nightwalk", "Night Walk", "City at night", "K5", { look: "k5", shadows: 20, grain: 25, grainSize: 50 }),
  p("mumbai", "Mumbai Local", "Street, documentary", "F1", { look: "f1", contrast: 15, grain: 25, grainSize: 50 }),
  p("pastel", "Soft Pastel", "Flowers, fashion", "F4", { look: "f4", highlights: -30, fade: 25 }),
  p("noir", "Film Noir", "Moody black and white", "K6", { look: "k6", contrast: 30, vignette: 35 }),
  p("instant", "Instant Memory", "Prints", "T3", { look: "t3", frame: { kind: "instant", caption: "a moment" } }),
  p("strip", "Photo Strip", "Photo booth fun", "T6", { look: "t6", frame: { kind: "strip" } }),
  p("neon", "Neon Dreams", "Concerts, neon signs", "S1", { look: "s1", saturation: 15, halation: 40 }),
  p("slides", "Slide Show", "Travel", "K7", { look: "k7", frame: { kind: "film" } }),
  p("cinema", "Cinema", "Cinematic stills", "F5", { look: "f5", grain: 10, grainSize: 30, geometry: { aspect: "2.39:1" } }),
  p("lofi", "Lo-fi Toy", "Experimental", "T1", { look: "t1", vignette: 60, vignetteMid: 25, leak: 45, leakStyle: 1 }),
  p("terminal", "Terminal", "Profile pictures", "TX", {
    ascii: { enabled: true, colour: "terminal", background: "black", cols: 120, crt: true, charset: "standard" },
  }),
  p("typewriter", "Typewriter", "Posters", "TW", {
    ascii: { enabled: true, colour: "mono", background: "paper", charset: "dense", cols: 140, font: "courier" },
  }),
];

const KEY = "chhaya.presets.v1";

/** Your own presets live in this browser only. */
export function loadCustomPresets(): Preset[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as Preset[];
    // Older saves may miss newer fields: rebuild on top of today's defaults.
    return list.map((x) => ({ ...x, custom: true, edit: mergeEdit(DEFAULT_EDIT, x.edit) }));
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
