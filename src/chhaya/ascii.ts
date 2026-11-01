import { type AsciiSettings, CHARSETS } from "./edit";

/**
 * Photo → ASCII. The edited frame is shrunk to one sample per character
 * (2×4 per character for braille), tone-adjusted, optionally dithered and
 * edge-traced, then drawn with a monospace font.
 */

/** Width ÷ height of one character cell. Picture styles use square cells. */
const CELL = 0.55;
export const cellAspect = (s: AsciiSettings) => ((s.style ?? "ascii") === "ascii" ? CELL : 1);

/** `k` is ink coverage 0 … 1 (already dithered where the style dithers). */
export type AsciiCell = {
  ch: string;
  r: number;
  g: number;
  b: number;
  l: number;
  k: number;
};
export type AsciiGrid = {
  cols: number;
  rows: number;
  cells: AsciiCell[];
  aspect: number;
};

/* Retro palettes. */
const PALETTES: Partial<Record<AsciiSettings["colour"], [number, number, number][]>> = {
  gameboy: ["#0f380f", "#306230", "#8bac0f", "#9bbc0f"].map(hexToRgb),
  pico8: [
    "#000000",
    "#1d2b53",
    "#7e2553",
    "#008751",
    "#ab5236",
    "#5f574f",
    "#c2c3c7",
    "#fff1e8",
    "#ff004d",
    "#ffa300",
    "#ffec27",
    "#00e436",
    "#29adff",
    "#83769c",
    "#ff77a8",
    "#ffccaa",
  ].map(hexToRgb),
  cga: ["#000000", "#55ffff", "#ff55ff", "#ffffff"].map(hexToRgb),
};
/** 64 colours (4 levels a channel): the "original" colours when a picture style is dithered. */
const RETRO64: [number, number, number][] = [];
for (let r = 0; r < 4; r++)
  for (let g = 0; g < 4; g++) for (let b = 0; b < 4; b++) RETRO64.push([r * 85, g * 85, b * 85]);

function nearest(pal: [number, number, number][], r: number, g: number, b: number) {
  let best = pal[0];
  let bd = Infinity;
  for (const p of pal) {
    // Weighted RGB distance: close enough to perceptual for small palettes.
    const d = 2 * (p[0] - r) ** 2 + 4 * (p[1] - g) ** 2 + 3 * (p[2] - b) ** 2;
    if (d < bd) {
      bd = d;
      best = p;
    }
  }
  return best;
}

/** Palette quantisation with optional error diffusion, in place on an RGB float array. */
function quantise(
  rgb: Float32Array,
  w: number,
  h: number,
  pal: [number, number, number][],
  kind: AsciiSettings["dither"],
) {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 3;
      let r = rgb[i];
      let g = rgb[i + 1];
      let b = rgb[i + 2];
      if (kind === "ordered") {
        const t = BAYER4[(y % 4) * 4 + (x % 4)] * 64;
        r += t;
        g += t;
        b += t;
      }
      const q = nearest(pal, r, g, b);
      const er = r - q[0];
      const eg = g - q[1];
      const eb = b - q[2];
      rgb[i] = q[0];
      rgb[i + 1] = q[1];
      rgb[i + 2] = q[2];
      if (kind !== "floyd" && kind !== "atkinson") continue;
      const add = (dx: number, dy: number, f: number) => {
        const xx = x + dx;
        const yy = y + dy;
        if (xx < 0 || xx >= w || yy >= h) return;
        const j = (yy * w + xx) * 3;
        rgb[j] += er * f;
        rgb[j + 1] += eg * f;
        rgb[j + 2] += eb * f;
      };
      if (kind === "floyd") {
        add(1, 0, 7 / 16);
        add(-1, 1, 3 / 16);
        add(0, 1, 5 / 16);
        add(1, 1, 1 / 16);
      } else
        for (const [dx, dy] of [
          [1, 0],
          [2, 0],
          [-1, 1],
          [0, 1],
          [1, 1],
          [0, 2],
        ])
          add(dx, dy, 1 / 8);
    }
  }
}

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16 - 0.5);

let scratch: HTMLCanvasElement | OffscreenCanvas | null = null;
function sampleCanvas(w: number, h: number) {
  if (!scratch)
    scratch = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(w, h) : document.createElement("canvas");
  scratch.width = w;
  scratch.height = h;
  return scratch.getContext("2d", {
    willReadFrequently: true,
  }) as CanvasRenderingContext2D;
}

export function rowsFor(cols: number, w: number, h: number, aspect = CELL) {
  return Math.max(1, Math.round(cols * (h / w) * aspect));
}

function ramp(s: AsciiSettings): string[] {
  const set = s.charset === "custom" ? s.custom || " .oO@" : CHARSETS[s.charset];
  return [...set];
}

function tone(l: number, s: AsciiSettings) {
  l = l + s.brightness / 200;
  l = (l - 0.5) * (1 + s.contrast / 100) + 0.5;
  l = Math.min(1, Math.max(0, l));
  return Math.pow(l, Math.pow(2, -s.gamma / 100));
}

/** Light paper backgrounds want dense characters where the photo is dark. */
export const isLightBg = (s: AsciiSettings) =>
  s.background === "paper" || (s.background === "custom" && hexLuma(s.bgColor) > 0.5);

/** Error diffusion over a grid of 0 … 1 values, quantised to `levels`. */
function diffuse(v: Float32Array, w: number, h: number, levels: number, kind: AsciiSettings["dither"]) {
  const out = new Uint16Array(w * h);
  const n = levels - 1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let val = v[i];
      if (kind === "ordered") val += BAYER4[(y % 4) * 4 + (x % 4)] / n;
      const q = Math.max(0, Math.min(n, Math.round(val * n)));
      out[i] = q;
      if (kind === "floyd" || kind === "atkinson") {
        const err = val - q / n;
        const add = (dx: number, dy: number, f: number) => {
          const xx = x + dx;
          const yy = y + dy;
          if (xx >= 0 && xx < w && yy < h) v[yy * w + xx] += err * f;
        };
        if (kind === "floyd") {
          add(1, 0, 7 / 16);
          add(-1, 1, 3 / 16);
          add(0, 1, 5 / 16);
          add(1, 1, 1 / 16);
        } else {
          for (const [dx, dy] of [
            [1, 0],
            [2, 0],
            [-1, 1],
            [0, 1],
            [1, 1],
            [0, 2],
          ])
            add(dx, dy, 1 / 8);
        }
      }
    }
  }
  return out;
}

/** Builds the character grid from any drawable (the edited photo or the live viewfinder). */
export function toGrid(src: CanvasImageSource, srcW: number, srcH: number, s: AsciiSettings, cols = s.cols): AsciiGrid {
  const aspect = cellAspect(s);
  if (aspect !== CELL) return pictureGrid(src, srcW, srcH, s, cols, aspect);
  const rows = rowsFor(cols, srcW, srcH);
  const braille = s.charset === "braille";
  const sw = braille ? cols * 2 : cols;
  const sh = braille ? rows * 4 : rows;

  const ctx = sampleCanvas(sw, sh);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, sw, sh);
  const px = ctx.getImageData(0, 0, sw, sh).data;

  const light = isLightBg(s);
  const lum = new Float32Array(sw * sh);
  for (let i = 0; i < sw * sh; i++) {
    let l = tone((0.2126 * px[i * 4] + 0.7152 * px[i * 4 + 1] + 0.0722 * px[i * 4 + 2]) / 255, s);
    if (s.invert) l = 1 - l;
    lum[i] = l;
  }
  // Ink density: on dark backgrounds bright pixels get dense characters, on paper the reverse.
  const ink = Float32Array.from(lum, (l) => (light ? 1 - l : l));

  const cells: AsciiCell[] = new Array(cols * rows);
  const colourAt = (cx: number, cy: number) => {
    const sx = braille ? cx * 2 : cx;
    const sy = braille ? cy * 4 : cy;
    const i = (sy * sw + sx) * 4;
    return [px[i], px[i + 1], px[i + 2]];
  };

  if (braille) {
    const bits = diffuse(Float32Array.from(ink), sw, sh, 2, s.dither === "none" ? "floyd" : s.dither);
    // Unicode braille dot order: (0,0)=1 (0,1)=2 (0,2)=4 (1,0)=8 (1,1)=16 (1,2)=32 (0,3)=64 (1,3)=128
    const map = [
      [0, 0, 1],
      [0, 1, 2],
      [0, 2, 4],
      [1, 0, 8],
      [1, 1, 16],
      [1, 2, 32],
      [0, 3, 64],
      [1, 3, 128],
    ];
    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        let code = 0;
        let sum = 0;
        for (const [dx, dy, bit] of map) {
          const i = (cy * 4 + dy) * sw + cx * 2 + dx;
          if (bits[i]) code |= bit;
          sum += lum[i];
        }
        const [r, g, b] = colourAt(cx, cy);
        cells[cy * cols + cx] = {
          ch: String.fromCharCode(0x2800 + code),
          r,
          g,
          b,
          l: sum / 8,
          k: 1,
        };
      }
    }
    return paletteCells({ cols, rows, cells, aspect }, s);
  }

  const chars = ramp(s);
  const levels = s.dither === "none" ? null : diffuse(Float32Array.from(ink), cols, rows, chars.length, s.dither);

  // Sobel on luminance for edge lines.
  const edgeT = s.edges === "strong" ? 0.18 : s.edges === "soft" ? 0.32 : Infinity;
  const L = (x: number, y: number) =>
    lum[Math.min(rows - 1, Math.max(0, y)) * cols + Math.min(cols - 1, Math.max(0, x))];

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      let ch: string;
      if (edgeT !== Infinity) {
        const gx =
          L(x + 1, y - 1) + 2 * L(x + 1, y) + L(x + 1, y + 1) - L(x - 1, y - 1) - 2 * L(x - 1, y) - L(x - 1, y + 1);
        const gy =
          L(x - 1, y + 1) + 2 * L(x, y + 1) + L(x + 1, y + 1) - L(x - 1, y - 1) - 2 * L(x, y - 1) - L(x + 1, y - 1);
        const mag = Math.hypot(gx, gy);
        if (mag > edgeT) {
          // The edge runs perpendicular to the gradient.
          const a = ((Math.atan2(gy, gx * CELL) * 180) / Math.PI + 180) % 180;
          ch = a < 22.5 || a >= 157.5 ? "|" : a < 67.5 ? "/" : a < 112.5 ? "_" : "\\";
          const [r, g, b] = colourAt(x, y);
          cells[i] = { ch, r, g, b, l: lum[i], k: 1 };
          continue;
        }
      }
      const q = levels ? levels[i] : Math.round(ink[i] * (chars.length - 1));
      ch = chars[Math.max(0, Math.min(chars.length - 1, q))];
      const [r, g, b] = colourAt(x, y);
      cells[i] = { ch, r, g, b, l: lum[i], k: 1 };
    }
  }
  return paletteCells({ cols, rows, cells, aspect }, s);
}

/** Characters keep their shapes; palette colours just snap each one to the palette. */
function paletteCells(grid: AsciiGrid, s: AsciiSettings): AsciiGrid {
  const pal = PALETTES[s.colour];
  if (!pal) return grid;
  for (const c of grid.cells) [c.r, c.g, c.b] = nearest(pal, c.r * 1.15, c.g * 1.15, c.b * 1.15);
  return grid;
}

/**
 * Pixel art, halftone, mosaic and LEGO: one square cell per sample. Tone
 * settings apply to every channel; palettes and dithering work on colour.
 */
function pictureGrid(
  src: CanvasImageSource,
  srcW: number,
  srcH: number,
  s: AsciiSettings,
  cols: number,
  aspect: number,
): AsciiGrid {
  const rows = rowsFor(cols, srcW, srcH, aspect);
  const ctx = sampleCanvas(cols, rows);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, cols, rows);
  const px = ctx.getImageData(0, 0, cols, rows).data;
  const n = cols * rows;
  const light = isLightBg(s);

  const rgb = new Float32Array(n * 3);
  const lum = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const l0 = (0.2126 * px[i * 4] + 0.7152 * px[i * 4 + 1] + 0.0722 * px[i * 4 + 2]) / 255;
    let l = tone(l0, s);
    if (s.invert) l = 1 - l;
    lum[i] = l;
    // Carry the tone change over to colour by scaling towards the new luminance.
    for (let c = 0; c < 3; c++) {
      let v = px[i * 4 + c] / 255;
      if (s.invert) v = 1 - v;
      const base = s.invert ? 1 - l0 : l0;
      v = base > 0.001 ? (v * l) / base : l;
      rgb[i * 3 + c] = Math.min(255, Math.max(0, v * 255));
    }
  }

  // Ink: how much of each cell is covered. Halftone dots grow with it; mono pixels are on or off.
  const ink = Float32Array.from(lum, (l) => (light ? 1 - l : l));
  const style = s.style;
  let k: Float32Array | Uint16Array = ink;
  if (s.colour === "mono" && style !== "halftone") {
    k = diffuse(Float32Array.from(ink), cols, rows, 2, s.dither === "none" ? "ordered" : s.dither);
  }

  const pal =
    PALETTES[s.colour] ?? (s.colour === "original" && s.dither !== "none" && style === "pixel" ? RETRO64 : null);
  if (pal) quantise(rgb, cols, rows, pal, style === "pixel" || style === "mosaic" ? s.dither : "none");

  const cells: AsciiCell[] = new Array(n);
  for (let i = 0; i < n; i++) {
    cells[i] = {
      ch: " ",
      r: Math.round(Math.min(255, Math.max(0, rgb[i * 3]))),
      g: Math.round(Math.min(255, Math.max(0, rgb[i * 3 + 1]))),
      b: Math.round(Math.min(255, Math.max(0, rgb[i * 3 + 2]))),
      l: lum[i],
      k: k[i],
    };
  }
  return { cols, rows, cells, aspect };
}

/* ---------- colour ---------- */

function hexToRgb(h: string): [number, number, number] {
  const n = parseInt(h.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function hexLuma(h: string) {
  const [r, g, b] = hexToRgb(h);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

export function background(s: AsciiSettings): string | null {
  switch (s.background) {
    case "paper":
      return "#f6f5f2";
    case "black":
      return s.colour === "amber" ? "#120a02" : s.colour === "terminal" ? "#020a04" : "#0f0f0e";
    case "transparent":
      return null;
    default:
      return s.bgColor;
  }
}

function cellColour(c: AsciiCell, x: number, y: number, s: AsciiSettings): string {
  const light = isLightBg(s);
  const picture = (s.style ?? "ascii") !== "ascii";
  switch (s.colour) {
    case "gameboy":
    case "pico8":
    case "cga":
      return `rgb(${c.r},${c.g},${c.b})`;
    case "tint": {
      const t = hexToRgb(s.tintColor ?? "#ff4f9a");
      const v = picture ? c.l : 0.35 + c.l * 0.65;
      return `rgb(${Math.round(t[0] * v)},${Math.round(t[1] * v)},${Math.round(t[2] * v)})`;
    }
    case "mono":
      return light ? "#141413" : "#f2f1ee";
    case "terminal":
      return `rgb(${Math.round(40 + c.l * 40)},${Math.round(150 + c.l * 105)},${Math.round(70 + c.l * 40)})`;
    case "amber":
      return `rgb(255,${Math.round(140 + c.l * 70)},${Math.round(c.l * 60)})`;
    case "inverted":
      return `rgb(${255 - c.r},${255 - c.g},${255 - c.b})`;
    case "duotone": {
      const a = hexToRgb(s.duoA);
      const b = hexToRgb(s.duoB);
      const t = c.l;
      return `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`;
    }
    case "rainbow":
      return `hsl(${((x + y * 0.6) * 4) % 360} 85% ${light ? 38 : 50 + c.l * 20}%)`;
    default: {
      if (picture) return `rgb(${c.r},${c.g},${c.b})`;
      // Original colour, nudged so dark colours stay readable on black (and light on paper).
      const k = light ? 0.85 : 1.25;
      return `rgb(${Math.min(255, Math.round(c.r * k))},${Math.min(255, Math.round(c.g * k))},${Math.min(255, Math.round(c.b * k))})`;
    }
  }
}

/** CSS font-family for each ASCII font. The next/font families come in as CSS variables. */
export function fontFamily(s: AsciiSettings) {
  const v = (name: string) =>
    typeof document === "undefined" ? "" : getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  switch (s.font) {
    case "plex":
      return `${v("--font-plex") || "'IBM Plex Mono'"}, ui-monospace, monospace`;
    case "vt323":
      return `${v("--font-vt323") || "VT323"}, ui-monospace, monospace`;
    case "courier":
      return `"Courier New", Courier, ui-monospace, monospace`;
    default:
      return `${v("--font-jetbrains") || "'JetBrains Mono'"}, ui-monospace, monospace`;
  }
}

/** Draws the grid. `width` is the output width in pixels; the height follows the grid. */
export function drawGrid(
  ctx: CanvasRenderingContext2D,
  grid: AsciiGrid,
  s: AsciiSettings,
  width: number,
  height: number,
) {
  const cw = width / grid.cols;
  const chh = height / grid.rows;
  const bg = background(s);
  ctx.save();
  ctx.clearRect(0, 0, width, height);
  if (bg) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);
  }
  const style = s.style ?? "ascii";
  if (style !== "ascii") drawPicture(ctx, grid, s, cw, chh, bg);
  else {
    const size = s.charset === "braille" ? chh * 1.0 : Math.min(chh * 0.95, cw / 0.58);
    ctx.font = `${s.font === "vt323" ? size * 1.15 : size}px ${fontFamily(s)}`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";

    {
      const single = s.colour === "mono";
      if (single) ctx.fillStyle = cellColour(grid.cells[0], 0, 0, s);
      for (let y = 0; y < grid.rows; y++) {
        for (let x = 0; x < grid.cols; x++) {
          const c = grid.cells[y * grid.cols + x];
          if (c.ch === " " || c.ch === "⠀") continue;
          if (!single) ctx.fillStyle = cellColour(c, x, y, s);
          ctx.fillText(c.ch, (x + 0.5) * cw, (y + 0.5) * chh);
        }
      }
    }
  }

  if (s.glitch > 0) glitch(ctx, width, height, s.glitch / 100, chh);
  if (s.crt) {
    // Glow: blur a copy of the text layer once and add it on top, then scanlines.
    const copy = document.createElement("canvas");
    copy.width = ctx.canvas.width;
    copy.height = ctx.canvas.height;
    copy.getContext("2d")!.drawImage(ctx.canvas, 0, 0);
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.5;
    ctx.filter = `blur(${Math.max(1, cw * 0.35)}px)`;
    ctx.drawImage(copy, 0, 0);
    ctx.filter = "none";
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    const step = Math.max(2, Math.round(chh / 4));
    for (let y = 0; y < height; y += step) ctx.fillRect(0, y, width, Math.max(1, step / 2));
  }
  if (s.grain > 0) grain(ctx, width, height, s.grain / 100);
  if (s.curve > 0) curve(ctx, width, height, s.curve / 100, bg);
  ctx.restore();
}

function drawPicture(
  ctx: CanvasRenderingContext2D,
  grid: AsciiGrid,
  s: AsciiSettings,
  cw: number,
  chh: number,
  bg: string | null,
) {
  const style = s.style;
  const mono = s.colour === "mono";
  const light = isLightBg(s);
  for (let y = 0; y < grid.rows; y++) {
    for (let x = 0; x < grid.cols; x++) {
      const c = grid.cells[y * grid.cols + x];
      if (mono && style !== "halftone" && c.k < 0.5) continue;
      const fill = cellColour(c, x, y, s);
      const x0 = x * cw;
      const y0 = y * chh;
      if (style === "pixel") {
        ctx.fillStyle = fill;
        // A hair of overlap hides seams between cells.
        ctx.fillRect(x0, y0, cw + 0.5, chh + 0.5);
      } else if (style === "halftone") {
        // Every other row shifts half a cell, like a printed screen.
        const r = Math.sqrt(Math.max(0, c.k)) * cw * 0.72;
        if (r < 0.3) continue;
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.arc(x0 + cw * (y % 2 ? 1 : 0.5), y0 + chh * 0.5, r, 0, Math.PI * 2);
        ctx.fill();
      } else if (style === "mosaic") {
        const gap = Math.max(1, cw * 0.1);
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.roundRect(x0 + gap / 2, y0 + gap / 2, cw - gap, chh - gap, cw * 0.12);
        ctx.fill();
        // A little light on each tile so it reads as glazed.
        ctx.fillStyle = "rgba(255,255,255,0.12)";
        ctx.fillRect(x0 + gap, y0 + gap, (cw - gap * 2) * 0.5, Math.max(1, gap * 0.6));
      } else {
        // LEGO: a plate with a raised stud.
        ctx.fillStyle = fill;
        ctx.fillRect(x0, y0, cw + 0.5, chh + 0.5);
        ctx.strokeStyle = "rgba(0,0,0,0.28)";
        ctx.lineWidth = Math.max(1, cw * 0.04);
        ctx.strokeRect(x0 + ctx.lineWidth / 2, y0 + ctx.lineWidth / 2, cw - ctx.lineWidth, chh - ctx.lineWidth);
        const cx = x0 + cw / 2;
        const cy = y0 + chh / 2;
        const r = cw * 0.3;
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.beginPath();
        ctx.arc(cx + r * 0.12, cy + r * 0.16, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.35)";
        ctx.lineWidth = Math.max(1, cw * 0.05);
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.78, Math.PI * 1.05, Math.PI * 1.6);
        ctx.stroke();
      }
    }
  }
  void bg;
  void light;
}

/** A small deterministic random, so the preview and the saved file match. */
function rng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** RGB split plus a few torn horizontal slices. */
function glitch(ctx: CanvasRenderingContext2D, w: number, h: number, amt: number, rowH: number) {
  const img = ctx.getImageData(0, 0, w, h);
  const src = new Uint8ClampedArray(img.data);
  const d = img.data;
  const shift = Math.max(1, Math.round(w * 0.006 * amt));
  for (let y = 0; y < h; y++) {
    const row = y * w * 4;
    for (let x = 0; x < w; x++) {
      const i = row + x * 4;
      const xr = Math.min(w - 1, x + shift);
      const xb = Math.max(0, x - shift);
      d[i] = src[row + xr * 4];
      d[i + 2] = src[row + xb * 4 + 2];
    }
  }
  ctx.putImageData(img, 0, 0);
  const rand = rng(7);
  const copy = document.createElement("canvas");
  copy.width = w;
  copy.height = h;
  copy.getContext("2d")!.drawImage(ctx.canvas, 0, 0);
  const slices = Math.round(4 + amt * 14);
  for (let i = 0; i < slices; i++) {
    const sy = Math.floor(rand() * h);
    const sh = Math.max(1, Math.round(rowH * (0.3 + rand() * 1.6)));
    const dx = Math.round((rand() - 0.5) * w * 0.12 * amt);
    ctx.drawImage(copy, 0, sy, w, sh, dx, sy, w, sh);
  }
}

let grainTile: HTMLCanvasElement | null = null;
/** Monochrome film grain, laid on with overlay. */
function grain(ctx: CanvasRenderingContext2D, w: number, h: number, amt: number) {
  if (!grainTile) {
    grainTile = document.createElement("canvas");
    grainTile.width = grainTile.height = 256;
    const g = grainTile.getContext("2d")!;
    const im = g.createImageData(256, 256);
    const rand = rng(11);
    for (let i = 0; i < im.data.length; i += 4) {
      const v = Math.round(128 + (rand() + rand() + rand() - 1.5) * 120);
      im.data[i] = im.data[i + 1] = im.data[i + 2] = v;
      im.data[i + 3] = 255;
    }
    g.putImageData(im, 0, 0);
  }
  const scale = Math.max(1, Math.round(w / 1400));
  ctx.save();
  ctx.globalCompositeOperation = "overlay";
  ctx.globalAlpha = Math.min(1, amt * 0.9);
  ctx.imageSmoothingEnabled = false;
  for (let y = 0; y < h; y += 256 * scale)
    for (let x = 0; x < w; x += 256 * scale) ctx.drawImage(grainTile, x, y, 256 * scale, 256 * scale);
  ctx.restore();
}

/** CRT screen bulge: rows then columns squeezed towards the edges, dark corners. */
function curve(ctx: CanvasRenderingContext2D, w: number, h: number, amt: number, bg: string | null) {
  const k = 0.12 * amt;
  const a = document.createElement("canvas");
  a.width = w;
  a.height = h;
  const ac = a.getContext("2d")!;
  ac.drawImage(ctx.canvas, 0, 0);
  const b = document.createElement("canvas");
  b.width = w;
  b.height = h;
  const bc = b.getContext("2d")!;
  const band = Math.max(1, Math.round(h / 600));
  for (let y = 0; y < h; y += band) {
    const ny = ((y + band / 2) / h) * 2 - 1;
    const rw = w * (1 - k * ny * ny);
    bc.drawImage(a, 0, y, w, band, (w - rw) / 2, y, rw, band);
  }
  ac.clearRect(0, 0, w, h);
  const bandX = Math.max(1, Math.round(w / 600));
  for (let x = 0; x < w; x += bandX) {
    const nx = ((x + bandX / 2) / w) * 2 - 1;
    const rh = h * (1 - k * nx * nx);
    ac.drawImage(b, x, 0, bandX, h, x, (h - rh) / 2, bandX, rh);
  }
  ctx.save();
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#050505";
  if (bg !== null) ctx.fillRect(0, 0, w, h);
  ctx.drawImage(a, 0, 0);
  // Vignette for the glass.
  const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) / 2);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, `rgba(0,0,0,${0.55 * amt})`);
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/** Size of the rendered ASCII image for a given output width. */
export function gridSize(grid: AsciiGrid, width: number) {
  const cw = width / grid.cols;
  return {
    width: Math.round(width),
    height: Math.round((cw / grid.aspect) * grid.rows),
  };
}

export function gridToText(grid: AsciiGrid) {
  const lines: string[] = [];
  for (let y = 0; y < grid.rows; y++) {
    let line = "";
    for (let x = 0; x < grid.cols; x++) line += grid.cells[y * grid.cols + x].ch;
    lines.push(line.replace(/\s+$/, ""));
  }
  // Credit, centred under the art.
  const credit =
    "Chhaya. · " +
    new Date()
      .toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
      .toLowerCase();
  const pad = " ".repeat(Math.max(0, Math.floor((grid.cols - credit.length) / 2)));
  return lines.join("\n") + "\n\n" + pad + credit + "\n";
}

export function gridToHtml(grid: AsciiGrid, s: AsciiSettings) {
  const esc = (c: string) => (c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === "&" ? "&amp;" : c);
  let body = "";
  for (let y = 0; y < grid.rows; y++) {
    for (let x = 0; x < grid.cols; x++) {
      const c = grid.cells[y * grid.cols + x];
      body += c.ch === " " ? " " : `<span style="color:${cellColour(c, x, y, s)}">${esc(c.ch)}</span>`;
    }
    body += "\n";
  }
  const bg = background(s) ?? "transparent";
  return `<!doctype html><meta charset="utf-8"><title>Chhaya ASCII</title>
<body style="margin:0;background:${bg}"><pre style="margin:0;padding:24px;font:10px/1.1 'JetBrains Mono',ui-monospace,monospace;letter-spacing:0">${body}</pre><p style="margin:0 0 24px;text-align:center;font:14px Georgia,serif;color:${isLightBg(s) ? "#2b2a27" : "#f2f1ee"}">Chhaya<span style="color:#ff4f9a">.</span></p></body>`;
}
