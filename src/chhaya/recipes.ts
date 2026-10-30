/**
 * Recipe looks: a look written as a short list of colour steps instead of
 * hand-tuned parameters. Recipes are plain JSON (see data/recipe-looks.json),
 * so adding a look means adding one entry. They are baked into the same 33³
 * LUT as every other look, so they cost nothing extra at render time.
 *
 * Step vocabularies (our own implementations, values come from the sources
 * listed in CREDITS.md):
 *  - "css-*": CSS filter functions, per the W3C Filter Effects spec.
 *  - "blend": a flat colour layer composited with a W3C blend mode.
 *  - "m-*", "rgb", "tint", "add", "gray": colour-matrix steps where offsets are
 *    in 0–255 units, the convention used by Flutter-style colour matrices.
 */

import type { RGB } from "./looks";

export type BlendMode = "normal" | "multiply" | "screen" | "overlay" | "darken" | "lighten" | "soft-light";

export type Step =
  | ["css-sepia" | "css-contrast" | "css-brightness" | "css-saturate" | "css-grayscale", number]
  | ["css-hue", number] // degrees
  | ["blend", number, number, number, number, BlendMode] // r, g, b (0–255), alpha (0–1), mode
  | ["m-brightness" | "m-contrast" | "m-saturation" | "m-hue", number]
  | ["rgb", number, number, number] // per-channel scale
  | ["tint", number, number, number, number] // r, g, b (0–255), amount (0–1)
  | ["add", number, number, number] // per-channel offset, 0–255
  | ["gray"];

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const clampRGB = (c: RGB): RGB => [clamp01(c[0]), clamp01(c[1]), clamp01(c[2])];

type M3 = [number, number, number, number, number, number, number, number, number];
const mat = (m: M3, c: RGB): RGB => [
  m[0] * c[0] + m[1] * c[1] + m[2] * c[2],
  m[3] * c[0] + m[4] * c[1] + m[5] * c[2],
  m[6] * c[0] + m[7] * c[1] + m[8] * c[2],
];

/** W3C Filter Effects: sepia(), saturate(), hue-rotate() matrices. */
function cssSepia(a: number): M3 {
  const k = 1 - Math.min(1, a);
  return [
    0.393 + 0.607 * k, 0.769 - 0.769 * k, 0.189 - 0.189 * k,
    0.349 - 0.349 * k, 0.686 + 0.314 * k, 0.168 - 0.168 * k,
    0.272 - 0.272 * k, 0.534 - 0.534 * k, 0.131 + 0.869 * k,
  ];
}
function cssSaturate(s: number): M3 {
  return [
    0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s,
    0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s,
    0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s,
  ];
}
function hueRotate(rad: number): M3 {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return [
    0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928,
    0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.14, 0.072 - c * 0.072 - s * 0.283,
    0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072,
  ];
}

/** W3C Compositing: separable blend modes, backdrop b and source s. */
function blendChannel(b: number, s: number, mode: BlendMode) {
  switch (mode) {
    case "multiply": return b * s;
    case "screen": return b + s - b * s;
    case "overlay": return b <= 0.5 ? 2 * b * s : 1 - 2 * (1 - b) * (1 - s);
    case "darken": return Math.min(b, s);
    case "lighten": return Math.max(b, s);
    case "soft-light": {
      if (s <= 0.5) return b - (1 - 2 * s) * b * (1 - b);
      const d = b <= 0.25 ? ((16 * b - 12) * b + 4) * b : Math.sqrt(b);
      return b + (2 * s - 1) * (d - b);
    }
    default: return s;
  }
}

export function applyRecipe(steps: Step[], rgb: RGB): RGB {
  let c: RGB = [...rgb];
  for (const st of steps) {
    switch (st[0]) {
      case "css-sepia": c = mat(cssSepia(st[1]), c); break;
      case "css-saturate": c = mat(cssSaturate(st[1]), c); break;
      case "css-hue": c = mat(hueRotate((st[1] * Math.PI) / 180), c); break;
      case "css-grayscale": c = mat(cssSaturate(1 - Math.min(1, st[1])), c); break;
      case "css-contrast": { const a = st[1]; c = [c[0] * a + 0.5 - 0.5 * a, c[1] * a + 0.5 - 0.5 * a, c[2] * a + 0.5 - 0.5 * a]; break; }
      case "css-brightness": c = [c[0] * st[1], c[1] * st[1], c[2] * st[1]]; break;
      case "blend": {
        const [, r, g, b, a, mode] = st;
        const src = [r / 255, g / 255, b / 255];
        c = [0, 1, 2].map((i) => c[i] + (blendChannel(c[i], src[i], mode) - c[i]) * a) as RGB;
        break;
      }
      case "m-brightness": {
        // Offsets: negative values ×255, positive ×100 (in 0–255 units).
        const v = (st[1] <= 0 ? st[1] * 255 : st[1] * 100) / 255;
        c = [c[0] + v, c[1] + v, c[2] + v];
        break;
      }
      case "m-contrast": {
        const adj = st[1] * 255;
        const f = (259 * (adj + 255)) / (255 * (259 - adj));
        const o = (128 * (1 - f)) / 255;
        c = [c[0] * f + o, c[1] * f + o, c[2] * f + o];
        break;
      }
      case "m-saturation": {
        const v = st[1] * 100;
        const x = 1 + (v > 0 ? (3 * v) / 100 : v / 100);
        const [lr, lg, lb] = [0.3086, 0.6094, 0.082];
        c = mat([
          lr * (1 - x) + x, lg * (1 - x), lb * (1 - x),
          lr * (1 - x), lg * (1 - x) + x, lb * (1 - x),
          lr * (1 - x), lg * (1 - x), lb * (1 - x) + x,
        ], c);
        break;
      }
      case "m-hue": c = mat(hueRotate(st[1] * Math.PI), c); break;
      case "rgb": c = [c[0] * st[1], c[1] * st[2], c[2] * st[3]]; break;
      case "tint": {
        const [, r, g, b, k] = st;
        c = [c[0] * (1 - k) + (r / 255) * k, c[1] * (1 - k) + (g / 255) * k, c[2] * (1 - k) + (b / 255) * k];
        break;
      }
      case "add": c = [c[0] + st[1] / 255, c[1] + st[2] / 255, c[2] + st[3] / 255]; break;
      case "gray": { const l = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; c = [l, l, l]; break; }
    }
    // Each filter primitive clamps its output, as browsers and colour matrices do.
    c = clampRGB(c);
  }
  return c;
}

const hex = (c: RGB) => "#" + c.map((v) => Math.round(clamp01(v) * 255).toString(16).padStart(2, "0")).join("");

/** Two swatch colours for UI hints: a recipe applied to a skin tone and a sky blue. */
export function recipeSwatch(steps: Step[]): [string, string] {
  return [hex(applyRecipe(steps, [0.86, 0.66, 0.54])), hex(applyRecipe(steps, [0.45, 0.62, 0.8]))];
}
