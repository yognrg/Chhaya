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
  /** Reserved for the halation pass (phase 2). */
  halation: number;
  params: LookParams;
};

export const NO_LOOK = "none";

/** The ten looks shipped in phase 1. Codes follow the plan's family table. */
export const LOOKS: Look[] = [
  {
    id: "k1",
    code: "K1",
    name: "Portra Glow",
    inspiredBy: "Kodak Portra 400",
    character: "Warm skin, soft pastel greens, gentle contrast",
    swatch: ["#e9b99a", "#8fae9b"],
    grain: 0.22,
    grainSize: 1,
    halation: 0.1,
    params: {
      warmth: 0.22,
      sat: 0.9,
      contrast: -0.12,
      fade: 0.03,
      gamma: [1.04, 1.03, 0.99],
      shadows: [0.46, 0.55, 0.52],
      highlights: [0.6, 0.53, 0.46],
      split: [0.18, 0.2],
      rollOff: 0.35,
    },
  },
  {
    id: "k2",
    code: "K2",
    name: "Golden Hour",
    inspiredBy: "Kodak Gold 200",
    character: "Yellow-gold warmth, punchy reds, nostalgic",
    swatch: ["#f0c35a", "#c8623e"],
    grain: 0.32,
    grainSize: 1.2,
    halation: 0.15,
    params: {
      mix: [1.08, -0.04, -0.04, 0, 1, 0, -0.02, 0, 1.02],
      warmth: 0.4,
      sat: 1.12,
      contrast: 0.15,
      gamma: [1.05, 1.02, 0.9],
      highlights: [0.66, 0.56, 0.36],
      split: [0, 0.3],
      fade: 0.02,
    },
  },
  {
    id: "k5",
    code: "K5",
    name: "Tungsten Night",
    inspiredBy: "Kodak CineStill 800T",
    character: "Cool blue cast, red halation glow around lights",
    swatch: ["#2f4f7a", "#e14b4b"],
    grain: 0.34,
    grainSize: 1.2,
    halation: 0.5,
    params: {
      warmth: -0.45,
      tint: 0.05,
      sat: 1.05,
      contrast: 0.12,
      gamma: [0.96, 1, 1.08],
      shadows: [0.4, 0.48, 0.62],
      highlights: [0.6, 0.5, 0.46],
      split: [0.32, 0.12],
    },
  },
  {
    id: "k6",
    code: "K6",
    name: "Tri-X Push",
    inspiredBy: "Kodak Tri-X 400",
    character: "Black and white, deep blacks, gritty",
    swatch: ["#e6e6e6", "#1b1b1b"],
    grain: 0.65,
    grainSize: 1.6,
    halation: 0,
    params: {
      mix: [0.5, 0.4, 0.1, 0.5, 0.4, 0.1, 0.5, 0.4, 0.1],
      mono: true,
      contrast: 0.55,
      lift: [-0.02, -0.02, -0.02],
      gamma: [0.95, 0.95, 0.95],
    },
  },
  {
    id: "f1",
    code: "F1",
    name: "Classic Chrome",
    inspiredBy: "Fujifilm Classic Chrome",
    character: "Muted, documentary, low saturation",
    swatch: ["#a9a08f", "#5f7380"],
    grain: 0.18,
    grainSize: 1,
    halation: 0,
    params: {
      mix: [0.96, 0.04, 0, 0.02, 0.96, 0.02, 0, 0.06, 0.94],
      sat: 0.7,
      contrast: 0.22,
      gamma: [0.98, 1, 1],
      shadows: [0.45, 0.5, 0.56],
      highlights: [0.55, 0.52, 0.47],
      split: [0.18, 0.12],
      rollOff: 0.3,
    },
  },
  {
    id: "f3",
    code: "F3",
    name: "Superia Green",
    inspiredBy: "Fujifilm Superia 400",
    character: "Green-cyan shadows, cool, everyday snapshot",
    swatch: ["#6fa38f", "#d7c49a"],
    grain: 0.32,
    grainSize: 1.1,
    halation: 0,
    params: {
      tint: -0.14,
      warmth: -0.08,
      sat: 1,
      contrast: 0.1,
      shadows: [0.4, 0.56, 0.54],
      highlights: [0.54, 0.53, 0.47],
      split: [0.3, 0.12],
      fade: 0.02,
    },
  },
  {
    id: "f4",
    code: "F4",
    name: "Pro Neg",
    inspiredBy: "Fujifilm Pro 400H",
    character: "Pastel, airy, minty highlights",
    swatch: ["#cfe3d6", "#e8c6c2"],
    grain: 0.18,
    grainSize: 1,
    halation: 0,
    params: {
      sat: 0.8,
      contrast: -0.25,
      fade: 0.06,
      gamma: [1.08, 1.1, 1.08],
      shadows: [0.54, 0.5, 0.52],
      highlights: [0.5, 0.58, 0.54],
      split: [0.1, 0.26],
      rollOff: 0.5,
    },
  },
  {
    id: "s1",
    code: "S1",
    name: "Night Neon",
    inspiredBy: "Sony cyberpunk look",
    character: "Teal and magenta, crushed shadows",
    swatch: ["#1fb4b8", "#d83a9c"],
    grain: 0.14,
    grainSize: 1,
    halation: 0.3,
    params: {
      sat: 1.25,
      contrast: 0.3,
      lift: [-0.03, -0.03, -0.03],
      shadows: [0.34, 0.56, 0.6],
      highlights: [0.66, 0.4, 0.6],
      split: [0.46, 0.34],
    },
  },
  {
    id: "t3",
    code: "T3",
    name: "Polaroid 600",
    inspiredBy: "Polaroid 600 film",
    character: "Soft, warm, slightly green shadows",
    swatch: ["#e8d6b4", "#6f8a72"],
    grain: 0.2,
    grainSize: 1,
    halation: 0,
    params: {
      warmth: 0.18,
      sat: 0.88,
      contrast: -0.1,
      fade: 0.08,
      shadows: [0.45, 0.55, 0.48],
      highlights: [0.6, 0.55, 0.46],
      split: [0.26, 0.16],
      rollOff: 0.45,
    },
  },
  {
    id: "t1",
    code: "T1",
    name: "Lomo Cross",
    inspiredBy: "Lomography cross-processing",
    character: "Yellow-green highlights, blue shadows",
    swatch: ["#d6e04a", "#2a4f8a"],
    grain: 0.34,
    grainSize: 1.2,
    halation: 0,
    params: {
      sat: 1.28,
      contrast: 0.35,
      gamma: [1.06, 1.12, 0.82],
      shadows: [0.34, 0.42, 0.68],
      highlights: [0.62, 0.66, 0.36],
      split: [0.4, 0.4],
    },
  },
];

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
