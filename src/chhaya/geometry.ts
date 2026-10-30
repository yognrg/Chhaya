/**
 * Crop, rotate, flip and straighten, expressed as one 3×3 matrix that maps
 * output uv (0 … 1, top left) to source uv. The shader applies it per pixel,
 * so geometry costs nothing extra and preview and export always agree.
 */

export const ASPECTS = ["original", "1:1", "4:5", "3:4", "9:16", "16:9", "3:2", "2.39:1"] as const;
export type Aspect = (typeof ASPECTS)[number];

export type Geometry = {
  aspect: Aspect;
  /** Quarter turns clockwise. */
  rotate: 0 | 1 | 2 | 3;
  flip: boolean;
  /** Degrees, −45 … 45. */
  straighten: number;
};

export type Layout = {
  width: number;
  height: number;
  /** Column-major mat3 for uniformMatrix3fv. */
  matrix: Float32Array;
  /** How many source pixels span the output width. Used to size blurs. */
  span: number;
};

type M = [number, number, number, number, number, number]; // a b c d e f: x' = a x + b y + c, y' = d x + e y + f

const mul = (p: M, q: M): M => [
  p[0] * q[0] + p[1] * q[3],
  p[0] * q[1] + p[1] * q[4],
  p[0] * q[2] + p[1] * q[5] + p[2],
  p[3] * q[0] + p[4] * q[3],
  p[3] * q[1] + p[4] * q[4],
  p[3] * q[2] + p[4] * q[5] + p[5],
];

const toGl = (m: M) => new Float32Array([m[0], m[3], 0, m[1], m[4], 0, m[2], m[5], 1]);

function aspectRatio(a: Aspect, w: number, h: number) {
  if (a === "original") return w / h;
  const [x, y] = a.split(":").map(Number);
  return x / y;
}

export function layout(srcW: number, srcH: number, g: Geometry): Layout {
  const odd = g.rotate % 2 === 1;
  const rw = odd ? srcH : srcW;
  const rh = odd ? srcW : srcH;

  // Largest centred rect of the chosen aspect.
  const a = aspectRatio(g.aspect, rw, rh);
  let cw = rw;
  let ch = rh;
  if (rw / rh > a) cw = rh * a;
  else ch = rw / a;

  // Shrink so the straightened rect stays inside the photo (no empty corners).
  const t = (Math.abs(g.straighten) * Math.PI) / 180;
  const cos = Math.cos(t);
  const sin = Math.sin(t);
  const k = Math.min(1, rw / (cw * cos + ch * sin), rh / (cw * sin + ch * cos));
  const ow = cw * k;
  const oh = ch * k;

  // output uv → centred pixels
  let m: M = [ow, 0, -ow / 2, 0, oh, -oh / 2];
  // straighten
  const s = (g.straighten * Math.PI) / 180;
  m = mul([Math.cos(s), -Math.sin(s), 0, Math.sin(s), Math.cos(s), 0], m);
  // flip (in the displayed image)
  if (g.flip) m = mul([-1, 0, 0, 0, 1, 0], m);
  // undo the quarter turns: displayed → source is (x, y) → (y, −x) per turn
  for (let i = 0; i < g.rotate; i++) m = mul([0, 1, 0, -1, 0, 0], m);
  // centred source pixels → source uv
  m = mul([1 / srcW, 0, 0.5, 0, 1 / srcH, 0.5], m);

  return { width: Math.round(ow), height: Math.round(oh), matrix: toGl(m), span: ow };
}

/** A plain centred crop (used by the camera), optionally mirrored. */
export function cropMatrix(crop: { x: number; y: number; w: number; h: number }, mirror: boolean) {
  const m: M = mirror ? [-crop.w, 0, crop.x + crop.w, 0, crop.h, crop.y] : [crop.w, 0, crop.x, 0, crop.h, crop.y];
  return toGl(m);
}

export const DEFAULT_GEOMETRY: Geometry = { aspect: "original", rotate: 0, flip: false, straighten: 0 };
