import { type AsciiSettings, DEFAULT_ASCII } from "./edit";

/**
 * One-tap ASCII recipes: a full set of settings each. They start from the
 * defaults, so a recipe never inherits a stray setting from the last one.
 */
export type AsciiRecipe = { id: string; name: string; hint: string; settings: Partial<AsciiSettings> };

export const ASCII_RECIPES: AsciiRecipe[] = [
  { id: "classic", name: "Classic", hint: "white text on black", settings: { colour: "mono" } },
  { id: "colour-text", name: "Colour text", hint: "photo colours", settings: { charset: "dense", cols: 140 } },
  { id: "terminal", name: "Terminal", hint: "green CRT", settings: { colour: "terminal", font: "vt323", crt: true, curve: 45 } },
  { id: "amber", name: "Amber CRT", hint: "warm monitor", settings: { colour: "amber", font: "vt323", crt: true, curve: 60, grain: 20 } },
  { id: "matrix", name: "Matrix", hint: "falling code", settings: { charset: "matrix", colour: "terminal", cols: 110 } },
  { id: "sketch", name: "Braille sketch", hint: "pen on paper", settings: { charset: "braille", colour: "mono", background: "paper", cols: 120, contrast: 20 } },
  { id: "blueprint", name: "Blueprint", hint: "edge lines", settings: { charset: "standard", edges: "strong", colour: "mono", background: "custom", bgColor: "#123a75", cols: 120 } },
  { id: "newsprint", name: "Newsprint", hint: "halftone dots", settings: { style: "halftone", colour: "mono", background: "paper", cols: 110, grain: 25 } },
  { id: "pop", name: "Pop art", hint: "colour halftone", settings: { style: "halftone", background: "paper", cols: 80, contrast: 25 } },
  { id: "pixel", name: "Pixel art", hint: "64 colours", settings: { style: "pixel", dither: "ordered", cols: 96 } },
  { id: "gameboy", name: "Game Boy", hint: "4 greens", settings: { style: "pixel", colour: "gameboy", dither: "atkinson", cols: 120 } },
  { id: "pico8", name: "PICO-8", hint: "16 colours", settings: { style: "pixel", colour: "pico8", dither: "floyd", cols: 112 } },
  { id: "cga", name: "CGA", hint: "1981 PC", settings: { style: "pixel", colour: "cga", dither: "ordered", cols: 128, crt: true, curve: 35 } },
  { id: "one-bit", name: "1-bit", hint: "black and white dither", settings: { style: "pixel", colour: "mono", dither: "atkinson", background: "paper", cols: 180 } },
  { id: "mosaic", name: "Mosaic", hint: "glazed tiles", settings: { style: "mosaic", cols: 64, background: "custom", bgColor: "#e9e4da" } },
  { id: "lego", name: "Bricks", hint: "toy bricks from above", settings: { style: "lego", cols: 48 } },
  { id: "vhs", name: "VHS glitch", hint: "torn tape", settings: { style: "pixel", cols: 180, glitch: 55, grain: 45, crt: true, curve: 25 } },
  { id: "neon", name: "Neon tint", hint: "one colour", settings: { colour: "tint", tintColor: "#ff4f9a", charset: "dense", cols: 130, crt: true } },
];

export function applyRecipe(r: AsciiRecipe): AsciiSettings {
  return { ...DEFAULT_ASCII, ...r.settings, enabled: true };
}

/** Which recipe the settings match, if any. */
export function matchRecipe(a: AsciiSettings): string | null {
  const keys = Object.keys(DEFAULT_ASCII) as (keyof AsciiSettings)[];
  for (const r of ASCII_RECIPES) {
    const want = applyRecipe(r);
    if (keys.every((k) => k === "enabled" || want[k] === a[k])) return r.id;
  }
  return null;
}
