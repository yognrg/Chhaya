import type { FrameKind, FrameSettings } from "./edit";
import { getGrid, gridGeometry } from "./grids";

/**
 * Prints: lays the finished photo (or ASCII image) into a Polaroid, strip,
 * film frame or border. Proportions follow the real formats.
 */

export const FRAMES: { kind: FrameKind; label: string; hint: string }[] = [
  { kind: "none", label: "None", hint: "just the photo" },
  { kind: "instant", label: "600", hint: "instant, square" },
  { kind: "sx70", label: "SX-70", hint: "creamy, square" },
  { kind: "mini", label: "Mini", hint: "54 × 86" },
  { kind: "wide", label: "Wide", hint: "108 × 86" },
  { kind: "film", label: "35mm", hint: "film negative" },
  { kind: "border", label: "Border", hint: "plain" },
];

/** Largest print we compose, in pixels. Safe for phone browsers' canvas limits. */
const MAX_PIXELS = 14_000_000;

export const INSTANT_KINDS: FrameKind[] = ["instant", "sx70", "mini", "wide"];

export type Rect = { x: number; y: number; w: number; h: number };
export type Composed = { canvas: HTMLCanvasElement; image: Rect };

type Ctx = CanvasRenderingContext2D;

function cssVar(name: string, fallback: string) {
  if (typeof document === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}
const displayFont = () => `Cirka, ${cssVar("--font-display-fallback", "Georgia")}, Georgia, serif`;

/** Draws the centre of `img` that fills `dst`. */
function cover(ctx: Ctx, img: CanvasImageSource, iw: number, ih: number, dst: Rect, src: Rect = { x: 0, y: 0, w: iw, h: ih }) {
  const da = dst.w / dst.h;
  const sa = src.w / src.h;
  let { x, y, w, h } = src;
  if (sa > da) {
    w = h * da;
    x += (src.w - w) / 2;
  } else {
    h = w / da;
    y += (src.h - h) / 2;
  }
  ctx.drawImage(img, x, y, w, h, dst.x, dst.y, dst.w, dst.h);
}

function roundRect(ctx: Ctx, r: Rect, rad: number) {
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, rad);
}

let grainTile: HTMLCanvasElement | null = null;
function paperPattern(ctx: Ctx) {
  if (!grainTile) {
    grainTile = document.createElement("canvas");
    grainTile.width = grainTile.height = 128;
    const g = grainTile.getContext("2d")!;
    const d = g.createImageData(128, 128);
    for (let i = 0; i < d.data.length; i += 4) {
      const v = 128 + (Math.random() - 0.5) * 120;
      d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
      d.data[i + 3] = 255;
    }
    g.putImageData(d, 0, 0);
  }
  return ctx.createPattern(grainTile, "repeat")!;
}

/** Paper texture over the card only (the photo is redrawn on top afterwards). */
function paper(ctx: Ctx, card: Rect, amount: number, rad = 0) {
  if (amount <= 0) return;
  ctx.save();
  roundRect(ctx, card, rad);
  ctx.clip();
  ctx.globalAlpha = (amount / 100) * 0.16;
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = paperPattern(ctx);
  ctx.fillRect(card.x, card.y, card.w, card.h);
  ctx.restore();
}

function caption(ctx: Ctx, text: string, cx: number, cy: number, size: number, colour: string) {
  if (!text) return;
  ctx.save();
  ctx.fillStyle = colour;
  ctx.font = `${size}px ${displayFont()}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, cx, cy);
  ctx.restore();
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const PINK = "#ff4f9a";

/**
 * The Chhaya mark: "Chhaya" with the pink dot as its full stop, the date in
 * smaller type underneath. Centred on `cx`, sitting on `bottom`.
 */
function watermark(ctx: Ctx, cx: number, bottom: number, size: number, when: Date, ink: string, faint: string, glow = false) {
  const date = `${when.getDate()} ${MONTHS[when.getMonth()]} ${when.getFullYear()}`;
  const dateSize = size * 0.62;
  ctx.save();
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  if (glow) {
    // A soft halo keeps the mark readable on busy photos.
    ctx.shadowColor = ink.startsWith("rgba(246") ? "rgba(0,0,0,0.4)" : "rgba(255,255,255,0.4)";
    ctx.shadowBlur = size * 0.4;
  }
  ctx.font = `${size}px ${displayFont()}`;
  const word = ctx.measureText("Chhaya").width;
  // The full stop is a real pink dot, like the wordmark, so it reads even at this size.
  const r = size * 0.1;
  const gap = size * 0.06;
  const wordY = bottom - dateSize * 1.25;
  const x = cx - (word + gap + 2 * r) / 2;
  ctx.fillStyle = ink;
  ctx.fillText("Chhaya", x, wordY);
  ctx.shadowBlur = 0;
  ctx.fillStyle = PINK;
  ctx.beginPath();
  ctx.arc(x + word + gap + r, wordY - r, r, 0, Math.PI * 2);
  ctx.fill();
  if (glow) ctx.shadowBlur = size * 0.4;
  ctx.font = `${dateSize}px ${displayFont()}`;
  ctx.textAlign = "center";
  ctx.fillStyle = faint;
  ctx.fillText(date, cx, bottom);
  ctx.restore();
}

/** Total height of the watermark for a given size, used to leave room for it. */
const markHeight = (size: number) => size * (0.8 + 0.62 * 1.25);

/** Picks light or dark ink from the brightness of what's already drawn under the mark. */
function inkFor(ctx: Ctx, region: Rect) {
  const c = document.createElement("canvas");
  c.width = 16;
  c.height = 4;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.drawImage(ctx.canvas, region.x, region.y, Math.max(1, region.w), Math.max(1, region.h), 0, 0, 16, 4);
  const d = g.getImageData(0, 0, 16, 4).data;
  let sum = 0;
  for (let i = 0; i < d.length; i += 4) sum += (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
  return sum / (d.length / 4) > 0.55
    ? { ink: "rgba(20,20,19,0.82)", faint: "rgba(20,20,19,0.6)" }
    : { ink: "rgba(246,245,242,0.92)", faint: "rgba(246,245,242,0.72)" };
}

/** The mark on the photo itself, bottom centre, in ink that suits the photo. */
function markOnPhoto(ctx: Ctx, image: Rect, when: Date) {
  const size = Math.max(9, Math.min(image.w, image.h) * 0.032);
  const h = markHeight(size);
  const margin = size * 0.9;
  const { ink, faint } = inkFor(ctx, { x: image.x + image.w * 0.35, y: image.y + image.h - margin - h, w: image.w * 0.3, h });
  watermark(ctx, image.x + image.w / 2, image.y + image.h - margin, size, when, ink, faint, true);
}

/** Orange seven-segment-style date in the corner, like a 90s point-and-shoot. */
function dateStamp(ctx: Ctx, r: Rect, when: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  const text = `'${p(when.getFullYear() % 100)} ${p(when.getMonth() + 1)} ${p(when.getDate())}`;
  const size = Math.max(10, Math.min(r.w, r.h) * 0.05);
  ctx.save();
  ctx.font = `600 ${size}px ${cssVar("--font-vt323", "ui-monospace")}, ui-monospace, monospace`;
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  ctx.shadowColor = "rgba(255,120,30,0.9)";
  ctx.shadowBlur = size * 0.5;
  ctx.fillStyle = "#ff9a3c";
  ctx.fillText(text, r.x + r.w - size * 0.8, r.y + r.h - size * 0.6);
  ctx.restore();
}

/** A 2D context that scales images with high-quality smoothing. */
function hq(c: HTMLCanvasElement) {
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  return ctx;
}

function canvasOf(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = Math.round(w);
  c.height = Math.round(h);
  return c;
}

/** Composes a print. `strip` is how many shots are stacked in `img` (photo strips). */
export function compose(
  img: CanvasImageSource,
  iw: number,
  ih: number,
  f: FrameSettings,
  meta: { strip: number; takenAt: Date },
): Composed {
  const date = meta.takenAt;

  if (f.kind === "none") {
    const c = canvasOf(iw, ih);
    const ctx = hq(c);
    ctx.drawImage(img, 0, 0, iw, ih);
    const image = { x: 0, y: 0, w: iw, h: ih };
    if (f.date) dateStamp(ctx, image, date);
    markOnPhoto(ctx, image, date);
    return { canvas: c, image };
  }

  if (f.kind === "border") {
    const t = (f.borderSize / 100) * Math.max(iw, ih);
    const c = canvasOf(iw + 2 * t, ih + 2 * t);
    const ctx = hq(c);
    ctx.fillStyle = f.borderColor === "white" ? "#fbfaf7" : "#0f0f0e";
    ctx.fillRect(0, 0, c.width, c.height);
    paper(ctx, { x: 0, y: 0, w: c.width, h: c.height }, f.borderColor === "white" ? f.paper : 0);
    const image = { x: t, y: t, w: iw, h: ih };
    ctx.drawImage(img, image.x, image.y, iw, ih);
    if (f.date) dateStamp(ctx, image, date);
    const size = Math.min(iw, ih) * 0.03;
    if (t > markHeight(size) * 1.4) {
      const white = f.borderColor === "white";
      watermark(ctx, c.width / 2, c.height - (t - markHeight(size)) / 2, size, date,
        white ? "#2b2a27" : "#f2f1ee", white ? "#6e6c66" : "#a3a19b");
    } else {
      markOnPhoto(ctx, image, date);
    }
    return { canvas: c, image };
  }

  if (INSTANT_KINDS.includes(f.kind)) {
    // Image aspect and margins, in units of the image width, from the real formats.
    const spec = {
      instant: { a: 1, side: 0.06, top: 0.07, bottom: 0.3, paper: "#f6f3ec", rad: 0.008 },
      sx70: { a: 79 / 77, side: 0.055, top: 0.06, bottom: 0.24, paper: "#efe6d3", rad: 0.008 },
      mini: { a: 46 / 62, side: 0.087, top: 0.15, bottom: 0.37, paper: "#f7f6f2", rad: 0.06 },
      wide: { a: 99 / 62, side: 0.045, top: 0.07, bottom: 0.17, paper: "#f7f6f2", rad: 0.03 },
    }[f.kind as "instant" | "sx70" | "mini" | "wide"];
    // Keep the full resolution of the shorter side.
    const A = Math.min(iw, ih * spec.a);
    const AH = A / spec.a;
    const card = { x: 0, y: 0, w: A * (1 + 2 * spec.side), h: AH + A * (spec.top + spec.bottom) };
    const c = canvasOf(card.w, card.h);
    const ctx = hq(c);
    const rad = A * spec.rad;
    ctx.fillStyle = spec.paper;
    roundRect(ctx, card, rad);
    ctx.fill();
    paper(ctx, card, f.paper, rad);
    const image = { x: A * spec.side, y: A * spec.top, w: A, h: AH };
    cover(ctx, img, iw, ih, image);
    // A hint of inner shadow where the photo meets the paper.
    ctx.strokeStyle = "rgba(0,0,0,0.12)";
    ctx.lineWidth = Math.max(1, A * 0.002);
    ctx.strokeRect(image.x, image.y, image.w, image.h);
    if (f.date) dateStamp(ctx, image, date);
    const bottomTop = image.y + image.h;
    const band = card.h - bottomTop;
    const size = A * 0.032;
    caption(ctx, f.caption, card.w / 2, bottomTop + band * 0.38, Math.min(A * 0.07, band * 0.28), "#2b2a27");
    watermark(ctx, card.w / 2, card.h - Math.min(band * 0.14, A * 0.035), size, date, "#2b2a27", "#7a7871");
    return { canvas: c, image };
  }

  if (f.kind === "grid" || f.kind === "strip") {
    // Photo booth grids. Shots are stacked top to bottom in the image; a single
    // photo is repeated into every cell.
    const g = getGrid(f.kind === "strip" ? "4-strip" : f.grid);
    const n = Math.max(1, meta.strip);
    const sh = ih / n;
    // Cells use the shots' full width, but the whole print stays under ~14 MP:
    // phones (iOS Safari especially) refuse to draw or save larger canvases.
    const full = gridGeometry(g, iw);
    const geo = gridGeometry(g, iw * Math.min(1, Math.sqrt(MAX_PIXELS / (full.w * full.h))));
    const c = canvasOf(geo.w, geo.h);
    const ctx = hq(c);
    const dark = f.borderColor === "black";
    ctx.fillStyle = dark ? "#0f0f0e" : "#fbfaf7";
    ctx.fillRect(0, 0, c.width, c.height);
    paper(ctx, { x: 0, y: 0, w: c.width, h: c.height }, dark ? 0 : f.paper);
    geo.cells.forEach((cell, i) => {
      const k = i % n;
      cover(ctx, img, iw, ih, cell, { x: 0, y: k * sh, w: iw, h: sh });
    });
    const last = geo.cells[geo.cells.length - 1];
    if (f.date) dateStamp(ctx, last, date);
    const ink = dark ? "#f2f1ee" : "#2b2a27";
    const foot = geo.foot;
    const size = Math.min(geo.w * 0.05, geo.cells[0].w * 0.06);
    if (foot.h > size * 3.2) {
      // Enough paper at the bottom: caption, then the mark at the very bottom.
      const roomForCaption = foot.h > size * 5.5;
      if (f.caption && roomForCaption) caption(ctx, f.caption, geo.w / 2, foot.y + foot.h * 0.36, size * 1.5, ink);
      watermark(ctx, geo.w / 2, geo.h - Math.min(foot.h * 0.16, size * 1.1), size, date, ink, dark ? "#a3a19b" : "#7a7871");
    } else {
      // No paper to write on: put the mark on the photos, centred across the bottom row.
      markOnPhoto(ctx, { x: geo.photos.x, y: last.y, w: geo.photos.w, h: last.h }, date);
    }
    return { canvas: c, image: geo.photos };
  }

  // 35mm film: 3:2 frame, black rebate with sprocket holes and edge print.
  const land = iw >= ih;
  const W = land ? Math.min(iw, ih * 1.5) : Math.min(iw, ih / 1.5);
  const H = land ? W / 1.5 : W * 1.5;
  const band = Math.min(W, H) * 0.17;
  const side = Math.min(W, H) * 0.04;
  const c = canvasOf(W + 2 * side, H + 2 * band);
  const ctx = hq(c);
  ctx.fillStyle = "#121110";
  ctx.fillRect(0, 0, c.width, c.height);
  const holeW = band * 0.42;
  const holeH = band * 0.5;
  const step = holeW * 2.05;
  ctx.fillStyle = "#e9e4d8";
  for (let x = step * 0.4; x < c.width - holeW; x += step) {
    for (const y of [band * 0.16, c.height - band * 0.16 - holeH]) {
      roundRect(ctx, { x, y, w: holeW, h: holeH }, holeW * 0.18);
      ctx.fill();
    }
  }
  ctx.fillStyle = "#f28a1c";
  ctx.font = `600 ${band * 0.17}px ${cssVar("--font-jetbrains", "ui-monospace")}, ui-monospace, monospace`;
  ctx.textBaseline = "middle";
  ctx.fillText("CHHAYA 400  ▸ 24", side + W * 0.05, band * 0.84);
  ctx.textAlign = "right";
  ctx.fillText("24A ▸", side + W * 0.95, c.height - band * 0.84);
  const image = { x: side, y: band, w: W, h: H };
  cover(ctx, img, iw, ih, image);
  if (f.date) dateStamp(ctx, image, date);
  markOnPhoto(ctx, image, date);
  return { canvas: c, image };
}
