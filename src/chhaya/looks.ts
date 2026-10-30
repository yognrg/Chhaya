/**
 * Film looks.
 *
 * Each look is described by a handful of colour parameters. On first use the
 * parameters are baked into a 33³ 3D LUT, which the shader samples. Later the
 * baked LUTs can be swapped for hand-graded LUT PNG strips without touching
 * the pipeline: anything that produces 33³ RGBA bytes works.
 *
 * Names are our own; `inspiredBy` is shown as a small hint in the UI.
 */

export type RGB = [number, number, number];

export type LookParams = {
  /** 3×3 channel mixer, row-major: out.r = m[0]*r + m[1]*g + m[2]*b … */
  mix?: number[];
  /** −1 cooler … +1 warmer */
  warmth?: number;
  /** −1 greener … +1 more magenta */
  tint?: number;
  /** Per-channel lift (black point), gamma and gain (white point). */
  lift?: RGB;
  gamma?: RGB;
  gain?: RGB;
  /** Saturation multiplier, 1 = unchanged. */
  sat?: number;
  /** Convert to black and white before toning. */
  mono?: boolean;
  /** S-curve strength, −0.9 … 1. */
  contrast?: number;
  /** Split tone colours (0.5 grey = neutral) and their strength. */
  shadows?: RGB;
  highlights?: RGB;
  split?: [number, number];
  /** Lifts blacks for a matte finish, 0 … 0.3. */
  fade?: number;
  /** Softens the brightest highlights, 0 … 1. */
  rollOff?: number;
  /** Maps luminance onto a two-colour ramp (shadow → highlight), mixed in by `duoMix`. */
  duotone?: [RGB, RGB];
  duoMix?: number;
};

export type Look = {
  id: string;
  code: string;
  name: string;
  inspiredBy: string;
  character: string;
  /** Two swatch colours used for UI hints before a thumbnail exists. */
  swatch: [string, string];
  /** Film defaults applied at full strength (0 … 1). */
  grain: number;
  grainSize: number;
  /** Red glow around bright lights, 0 … 1. */
  halation: number;
  /** Built-in vignette, −1 … 1 (Pin Hole, Disposable). */
  vignette?: number;
  family: string;
  params: LookParams;
};

export const NO_LOOK = "none";

type Row = [code: string, name: string, inspiredBy: string, character: string, swatch: [string, string], grain: number, grainSize: number, halation: number, params: LookParams, vignette?: number];

const FAMILIES: [string, Row[]][] = [
  ["Kodak-inspired", [
    ["K1", "Portra Glow", "Kodak Portra 400", "Warm skin, soft pastel greens, gentle contrast", ["#e9b99a", "#8fae9b"], 0.22, 1, 0.1,
      { warmth: 0.22, sat: 0.9, contrast: -0.12, fade: 0.03, gamma: [1.04, 1.03, 0.99], shadows: [0.46, 0.55, 0.52], highlights: [0.6, 0.53, 0.46], split: [0.18, 0.2], rollOff: 0.35 }],
    ["K2", "Golden Hour", "Kodak Gold 200", "Yellow-gold warmth, punchy reds, nostalgic", ["#f0c35a", "#c8623e"], 0.32, 1.2, 0.15,
      { mix: [1.08, -0.04, -0.04, 0, 1, 0, -0.02, 0, 1.02], warmth: 0.4, sat: 1.12, contrast: 0.15, gamma: [1.05, 1.02, 0.9], highlights: [0.66, 0.56, 0.36], split: [0, 0.3], fade: 0.02 }],
    ["K3", "Ultra Pop", "Kodak Ultramax 400", "Saturated, contrasty, cool shadows", ["#f2a33a", "#3b6aa8"], 0.34, 1.2, 0.1,
      { warmth: 0.15, sat: 1.25, contrast: 0.3, shadows: [0.4, 0.46, 0.6], highlights: [0.58, 0.53, 0.45], split: [0.3, 0.15] }],
    ["K4", "Ektar Vivid", "Kodak Ektar 100", "Very saturated, clean blues, almost no grain", ["#d9433c", "#2f6fb5"], 0.08, 0.8, 0.05,
      { mix: [1.1, -0.05, -0.05, -0.03, 1.06, -0.03, -0.04, -0.04, 1.08], sat: 1.35, contrast: 0.25, gamma: [1, 0.98, 1.04] }],
    ["K5", "Tungsten Night", "Kodak CineStill 800T", "Cool blue cast, red halation glow around lights", ["#2f4f7a", "#e14b4b"], 0.34, 1.2, 0.6,
      { warmth: -0.45, tint: 0.05, sat: 1.05, contrast: 0.12, gamma: [0.96, 1, 1.08], shadows: [0.4, 0.48, 0.62], highlights: [0.6, 0.5, 0.46], split: [0.32, 0.12] }],
    ["K6", "Tri-X Push", "Kodak Tri-X 400", "Black and white, deep blacks, gritty", ["#e6e6e6", "#1b1b1b"], 0.65, 1.6, 0,
      { mix: [0.5, 0.4, 0.1, 0.5, 0.4, 0.1, 0.5, 0.4, 0.1], mono: true, contrast: 0.55, lift: [-0.02, -0.02, -0.02], gamma: [0.95, 0.95, 0.95] }],
    ["K7", "Kodachrome '72", "Kodachrome 64", "Rich reds, deep blues, vintage slide film", ["#b8352f", "#264c7a"], 0.16, 1, 0.05,
      { mix: [1.12, -0.06, -0.06, -0.02, 1.02, 0, -0.04, -0.02, 1.06], sat: 1.15, contrast: 0.35, warmth: 0.1, lift: [-0.02, -0.02, -0.01], shadows: [0.44, 0.47, 0.58], split: [0.25, 0] }],
  ]],
  ["Fujifilm-inspired", [
    ["F1", "Classic Chrome", "Fujifilm Classic Chrome", "Muted, documentary, low saturation", ["#a9a08f", "#5f7380"], 0.18, 1, 0,
      { mix: [0.96, 0.04, 0, 0.02, 0.96, 0.02, 0, 0.06, 0.94], sat: 0.7, contrast: 0.22, gamma: [0.98, 1, 1], shadows: [0.45, 0.5, 0.56], highlights: [0.55, 0.52, 0.47], split: [0.18, 0.12], rollOff: 0.3 }],
    ["F2", "Velvia Punch", "Fujifilm Velvia 50", "Hyper-saturated landscapes, magenta-leaning", ["#c23a7b", "#2c8a5c"], 0.06, 0.8, 0,
      { sat: 1.5, contrast: 0.4, tint: 0.12, gamma: [1, 0.97, 1.02], lift: [-0.02, -0.02, -0.02] }],
    ["F3", "Superia Green", "Fujifilm Superia 400", "Green-cyan shadows, cool, everyday snapshot", ["#6fa38f", "#d7c49a"], 0.32, 1.1, 0,
      { tint: -0.14, warmth: -0.08, sat: 1, contrast: 0.1, shadows: [0.4, 0.56, 0.54], highlights: [0.54, 0.53, 0.47], split: [0.3, 0.12], fade: 0.02 }],
    ["F4", "Pro Neg", "Fujifilm Pro 400H", "Pastel, airy, minty highlights", ["#cfe3d6", "#e8c6c2"], 0.18, 1, 0,
      { sat: 0.8, contrast: -0.25, fade: 0.06, gamma: [1.08, 1.1, 1.08], shadows: [0.54, 0.5, 0.52], highlights: [0.5, 0.58, 0.54], split: [0.1, 0.26], rollOff: 0.5 }],
    ["F5", "Eterna Film", "Fujifilm Eterna", "Flat cinematic, low contrast, teal shadows", ["#4a6b6b", "#c9a27a"], 0.16, 1, 0.05,
      { sat: 0.72, contrast: -0.3, fade: 0.05, shadows: [0.4, 0.54, 0.56], highlights: [0.58, 0.53, 0.46], split: [0.3, 0.18], rollOff: 0.5 }],
    ["F6", "Acros Fine", "Fujifilm Acros 100", "Smooth black and white, silver tones", ["#d9d9d9", "#3a3a3a"], 0.2, 0.8, 0,
      { mix: [0.35, 0.5, 0.15, 0.35, 0.5, 0.15, 0.35, 0.5, 0.15], mono: true, contrast: 0.2, rollOff: 0.4, shadows: [0.49, 0.5, 0.52], split: [0.1, 0] }],
    ["F7", "Instant Fuji", "Instax Mini film", "Bright, slightly washed, cool whites", ["#e9eef2", "#f2b7c6"], 0.14, 1, 0,
      { gamma: [1.12, 1.14, 1.18], sat: 0.92, contrast: -0.08, fade: 0.04, warmth: -0.1, highlights: [0.48, 0.5, 0.56], split: [0, 0.2] }],
  ]],
  ["Sony-inspired", [
    ["S1", "Night Neon", "Sony cyberpunk look", "Teal and magenta, crushed shadows", ["#1fb4b8", "#d83a9c"], 0.14, 1, 0.3,
      { sat: 1.25, contrast: 0.3, lift: [-0.03, -0.03, -0.03], shadows: [0.34, 0.56, 0.6], highlights: [0.66, 0.4, 0.6], split: [0.46, 0.34] }],
    ["S2", "Clean Cine", "Sony S-Cinetone", "Natural skin, soft roll-off, video look", ["#d8b49c", "#5b7d8c"], 0, 1, 0,
      { warmth: 0.08, sat: 0.95, contrast: -0.05, rollOff: 0.6, gamma: [1.03, 1.02, 1] }],
    ["S3", "Mono Hard", "Sony B&W creative look", "High-contrast black and white", ["#f2f2f2", "#0f0f0f"], 0.12, 1, 0,
      { mix: [0.4, 0.45, 0.15, 0.4, 0.45, 0.15, 0.4, 0.45, 0.15], mono: true, contrast: 0.75, lift: [-0.04, -0.04, -0.04] }],
    ["S4", "Soft Teal", "Sony creative look FL", "Faded teal, lifted blacks", ["#7aa6a6", "#d5c2a8"], 0.12, 1, 0,
      { sat: 0.8, contrast: -0.1, fade: 0.1, shadows: [0.4, 0.56, 0.58], highlights: [0.56, 0.53, 0.47], split: [0.35, 0.12] }],
  ]],
  ["Panasonic-inspired", [
    ["P1", "L Classic Neo", "Lumix L.ClassicNeo", "Retro, slightly faded, warm mids", ["#c9a07a", "#7f8a6a"], 0.3, 1.1, 0,
      { warmth: 0.2, sat: 0.82, contrast: 0.05, fade: 0.06, gamma: [1.04, 1.02, 0.94], shadows: [0.48, 0.52, 0.46], split: [0.18, 0] }],
    ["P2", "Monochrome D", "Lumix L.Monochrome D", "Dramatic black and white, strong grain", ["#e0e0e0", "#141414"], 0.75, 1.5, 0,
      { mix: [0.45, 0.45, 0.1, 0.45, 0.45, 0.1, 0.45, 0.45, 0.1], mono: true, contrast: 0.6, gamma: [0.92, 0.92, 0.92] }],
    ["P3", "Cinelike", "Lumix Cinelike D", "Flat, wide range, made for grading", ["#9b9389", "#5e6a72"], 0, 1, 0,
      { sat: 0.85, contrast: -0.4, fade: 0.04, rollOff: 0.7 }],
    ["P4", "Lumix Vivid", "Lumix Vivid", "Bright everyday colour, clean", ["#e5532f", "#2a8ac8"], 0, 1, 0,
      { sat: 1.3, contrast: 0.18, gamma: [1.04, 1.04, 1.04] }],
  ]],
  ["Canon-inspired", [
    ["C1", "Canon Skin", "Canon picture style Portrait", "Flattering warm skin, soft", ["#e6b8a2", "#9a7a6a"], 0, 1, 0,
      { warmth: 0.15, sat: 0.95, contrast: -0.06, gamma: [1.05, 1.02, 1], rollOff: 0.4, highlights: [0.56, 0.52, 0.5], split: [0, 0.12] }],
    ["C2", "AE-1 Memory", "Canon AE-1 era film", "Warm, soft focus, light fade", ["#d9a86a", "#8b6b5a"], 0.32, 1.2, 0.15,
      { warmth: 0.3, sat: 0.88, contrast: -0.05, fade: 0.07, gamma: [1.04, 1.01, 0.92], highlights: [0.62, 0.55, 0.42], split: [0.1, 0.22] }],
    ["C3", "IXUS Flash", "Canon IXUS / PowerShot", "2000s digicam, cool flash, crisp", ["#d6e2ec", "#4a5b6e"], 0.08, 1, 0,
      { warmth: -0.22, sat: 1.1, contrast: 0.3, gamma: [1.08, 1.1, 1.14], rollOff: 0 }],
    ["C4", "Canon Faithful", "Canon picture style Faithful", "Neutral, true colour", ["#bfb5aa", "#6d7a82"], 0, 1, 0,
      { sat: 0.95, contrast: -0.04 }],
  ]],
  ["Nikon, Olympus, Leica-inspired", [
    ["N1", "Coolpix 2004", "Nikon Coolpix digicam", "Cyan-blue, harsh flash, date stamp vibe", ["#a9cde0", "#e2e2e2"], 0.1, 1, 0,
      { warmth: -0.3, tint: -0.05, sat: 1.05, contrast: 0.3, gamma: [1.06, 1.1, 1.14], highlights: [0.48, 0.52, 0.56], split: [0, 0.25] }],
    ["N2", "OM Grainy", "Olympus Grainy Film art filter", "Harsh B&W, heavy grain", ["#cfcfcf", "#090909"], 1, 1.8, 0,
      { mix: [0.4, 0.5, 0.1, 0.4, 0.5, 0.1, 0.4, 0.5, 0.1], mono: true, contrast: 0.85, lift: [-0.05, -0.05, -0.05] }],
    ["N3", "Pin Hole", "Olympus Pin Hole art filter", "Dark vignette, toy camera", ["#3b3326", "#c9a560"], 0.3, 1.2, 0,
      { warmth: 0.2, sat: 0.9, contrast: 0.25, gamma: [1.02, 1, 0.9], highlights: [0.6, 0.55, 0.42], split: [0, 0.2] }, 0.85],
    ["N4", "Leica Soft", "Leica classic look", "Gentle contrast, deep warm blacks", ["#bfa58a", "#2a2420"], 0.14, 1, 0,
      { warmth: 0.1, sat: 0.9, contrast: 0.12, lift: [0.0, -0.01, -0.02], shadows: [0.54, 0.5, 0.46], split: [0.2, 0], rollOff: 0.5 }],
  ]],
  ["Toy, instant and lab", [
    ["T1", "Lomo Cross", "Lomography cross-processing", "Yellow-green highlights, blue shadows", ["#d6e04a", "#2a4f8a"], 0.34, 1.2, 0,
      { sat: 1.28, contrast: 0.35, gamma: [1.06, 1.12, 0.82], shadows: [0.34, 0.42, 0.68], highlights: [0.62, 0.66, 0.36], split: [0.4, 0.4] }, 0.3],
    ["T2", "Redscale", "Redscale film", "Orange-red everything", ["#d9532b", "#5a1f12"], 0.4, 1.3, 0.2,
      { mix: [0.6, 0.4, 0, 0.25, 0.5, 0, 0.1, 0.2, 0], contrast: 0.2, duotone: [[0.18, 0.04, 0.02], [1, 0.78, 0.45]], duoMix: 0.55 }],
    ["T3", "Polaroid 600", "Polaroid 600 film", "Soft, warm, slightly green shadows", ["#e8d6b4", "#6f8a72"], 0.2, 1, 0,
      { warmth: 0.18, sat: 0.88, contrast: -0.1, fade: 0.08, shadows: [0.45, 0.55, 0.48], highlights: [0.6, 0.55, 0.46], split: [0.26, 0.16], rollOff: 0.45 }],
    ["T4", "SX-70 Dream", "Polaroid SX-70", "Creamy, faded, low contrast", ["#efe0c2", "#b49a8a"], 0.2, 1, 0,
      { warmth: 0.25, sat: 0.7, contrast: -0.3, fade: 0.12, highlights: [0.6, 0.56, 0.46], shadows: [0.55, 0.48, 0.5], split: [0.2, 0.25], rollOff: 0.6 }],
    ["T5", "Expired '98", "Expired consumer film", "Colour shifts, magenta cast, faded", ["#c88aa0", "#7a8a5a"], 0.6, 1.5, 0.1,
      { tint: 0.3, sat: 0.8, contrast: -0.1, fade: 0.12, shadows: [0.48, 0.56, 0.44], highlights: [0.6, 0.5, 0.54], split: [0.3, 0.3] }],
    ["T6", "Disposable", "Disposable camera", "Flash, warm, soft corners", ["#f0c88a", "#5a4a3a"], 0.55, 1.4, 0.1,
      { warmth: 0.3, sat: 1.05, contrast: 0.2, gamma: [1.06, 1.03, 0.94], fade: 0.03 }, 0.4],
    ["T7", "VHS Tape", "Camcorder / VHS", "Soft, colour bleed, scanlines", ["#8ab0c8", "#c85a8a"], 0.3, 2, 0,
      { sat: 1.15, contrast: -0.05, fade: 0.08, tint: 0.08, shadows: [0.42, 0.5, 0.6], highlights: [0.58, 0.5, 0.54], split: [0.3, 0.2] }],
    ["T8", "Sepia Print", "Old sepia print", "Brown monochrome, paper texture", ["#c8a070", "#3a2a1a"], 0.35, 1.2, 0,
      { mono: true, contrast: 0.1, fade: 0.06, duotone: [[0.16, 0.1, 0.05], [0.96, 0.88, 0.72]], duoMix: 1 }],
    ["T9", "Cyanotype", "Cyanotype print", "Prussian blue monochrome", ["#d9e4f0", "#1f3f7a"], 0.2, 1, 0,
      { mono: true, contrast: 0.15, duotone: [[0.04, 0.12, 0.32], [0.88, 0.93, 0.98]], duoMix: 1 }],
    ["T10", "Infrared", "Infrared film", "White foliage, dark skies", ["#f5f0f2", "#2a1f3a"], 0.3, 1.2, 0.2,
      { mix: [-0.3, 1.6, -0.3, -0.3, 1.6, -0.3, -0.3, 1.6, -0.3], mono: true, contrast: 0.3, duotone: [[0.12, 0.06, 0.16], [1, 0.97, 0.98]], duoMix: 0.6 }],
  ]],
];

/** All 40 looks, grouped by camera family. Codes follow the plan. */
export const LOOKS: Look[] = FAMILIES.flatMap(([family, rows]) =>
  rows.map(([code, name, inspiredBy, character, swatch, grain, grainSize, halation, params, vignette]) => ({
    id: code.toLowerCase(),
    code,
    name,
    inspiredBy,
    character,
    swatch,
    grain,
    grainSize,
    halation,
    vignette,
    family,
    params,
  })),
);

export function getLook(id: string): Look | undefined {
  return LOOKS.find((l) => l.id === id);
}

/* ---------- LUT baking ---------- */

export const LUT_SIZE = 33;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const luma = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

function sCurve(x: number, k: number) {
  const e = 1 + k;
  return x < 0.5 ? 0.5 * Math.pow(2 * x, e) : 1 - 0.5 * Math.pow(2 * (1 - x), e);
}

/** Applies a look to one colour (sRGB-ish, 0 … 1). Exported for tests and tooling. */
export function applyLook(p: LookParams, rgb: RGB): RGB {
  let [r, g, b] = rgb;

  if (p.mix) {
    const m = p.mix;
    [r, g, b] = [
      m[0] * r + m[1] * g + m[2] * b,
      m[3] * r + m[4] * g + m[5] * b,
      m[6] * r + m[7] * g + m[8] * b,
    ];
  }

  if (p.warmth) {
    r += p.warmth * 0.07;
    b -= p.warmth * 0.07;
  }
  if (p.tint) {
    r += p.tint * 0.03;
    g -= p.tint * 0.06;
    b += p.tint * 0.03;
  }

  const lift = p.lift ?? [0, 0, 0];
  const gamma = p.gamma ?? [1, 1, 1];
  const gain = p.gain ?? [1, 1, 1];
  const ch = [r, g, b].map((v, i) => {
    const x = Math.pow(clamp01(v), 1 / gamma[i]);
    return lift[i] + (gain[i] - lift[i]) * x;
  });
  [r, g, b] = ch;

  let l = luma(r, g, b);
  if (p.mono) {
    r = g = b = l;
  } else if (p.sat !== undefined && p.sat !== 1) {
    r = l + (r - l) * p.sat;
    g = l + (g - l) * p.sat;
    b = l + (b - l) * p.sat;
  }

  if (p.contrast) {
    const k = Math.max(-0.9, p.contrast);
    r = sCurve(clamp01(r), k);
    g = sCurve(clamp01(g), k);
    b = sCurve(clamp01(b), k);
  }

  if (p.split) {
    l = clamp01(luma(r, g, b));
    const sw = (1 - l) * (1 - l) * p.split[0];
    const hw = l * l * p.split[1];
    const sh = p.shadows ?? [0.5, 0.5, 0.5];
    const hi = p.highlights ?? [0.5, 0.5, 0.5];
    r += (sh[0] - 0.5) * sw + (hi[0] - 0.5) * hw;
    g += (sh[1] - 0.5) * sw + (hi[1] - 0.5) * hw;
    b += (sh[2] - 0.5) * sw + (hi[2] - 0.5) * hw;
  }

  if (p.rollOff) {
    const ro = p.rollOff;
    const soft = (x: number) => (x > 0.7 ? x - ro * (x - 0.7) * (x - 0.7) * 1.4 : x);
    r = soft(r);
    g = soft(g);
    b = soft(b);
  }

  if (p.duotone) {
    const [lo, hi] = p.duotone;
    const t = clamp01(luma(r, g, b));
    const m = p.duoMix ?? 1;
    r += (lo[0] + (hi[0] - lo[0]) * t - r) * m;
    g += (lo[1] + (hi[1] - lo[1]) * t - g) * m;
    b += (lo[2] + (hi[2] - lo[2]) * t - b) * m;
  }

  if (p.fade) {
    r = p.fade + r * (1 - p.fade);
    g = p.fade + g * (1 - p.fade);
    b = p.fade + b * (1 - p.fade);
  }

  return [clamp01(r), clamp01(g), clamp01(b)];
}

const lutCache = new Map<string, Uint8Array>();

/** RGBA8 bytes for a 33³ LUT, laid out r fastest, then g, then b (WebGL 3D texture order). */
export function bakeLut(look: Look | undefined): Uint8Array {
  const key = look?.id ?? NO_LOOK;
  const hit = lutCache.get(key);
  if (hit) return hit;

  const n = LUT_SIZE;
  const out = new Uint8Array(n * n * n * 4);
  let i = 0;
  for (let bi = 0; bi < n; bi++) {
    for (let gi = 0; gi < n; gi++) {
      for (let ri = 0; ri < n; ri++) {
        const src: RGB = [ri / (n - 1), gi / (n - 1), bi / (n - 1)];
        const [r, g, b] = look ? applyLook(look.params, src) : src;
        out[i++] = Math.round(r * 255);
        out[i++] = Math.round(g * 255);
        out[i++] = Math.round(b * 255);
        out[i++] = 255;
      }
    }
  }
  lutCache.set(key, out);
  return out;
}
