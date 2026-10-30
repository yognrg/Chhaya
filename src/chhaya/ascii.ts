import { type AsciiSettings, CHARSETS } from "./edit";

/**
 * Photo → ASCII. The edited frame is shrunk to one sample per character
 * (2×4 per character for braille), tone-adjusted, optionally dithered and
 * edge-traced, then drawn with a monospace font.
 */

/** Width ÷ height of one character cell. */
const CELL = 0.55;

export type AsciiCell = { ch: string; r: number; g: number; b: number; l: number };
export type AsciiGrid = { cols: number; rows: number; cells: AsciiCell[] };

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16 - 0.5);

let scratch: HTMLCanvasElement | OffscreenCanvas | null = null;
function sampleCanvas(w: number, h: number) {
  if (!scratch) scratch = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(w, h) : document.createElement("canvas");
  scratch.width = w;
  scratch.height = h;
  return scratch.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D;
}

export function rowsFor(cols: number, w: number, h: number) {
  return Math.max(1, Math.round(cols * (h / w) * CELL));
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
          for (const [dx, dy] of [[1, 0], [2, 0], [-1, 1], [0, 1], [1, 1], [0, 2]]) add(dx, dy, 1 / 8);
        }
      }
    }
  }
  return out;
}

/** Builds the character grid from any drawable (the edited photo or the live viewfinder). */
export function toGrid(src: CanvasImageSource, srcW: number, srcH: number, s: AsciiSettings, cols = s.cols): AsciiGrid {
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
    const map = [[0, 0, 1], [0, 1, 2], [0, 2, 4], [1, 0, 8], [1, 1, 16], [1, 2, 32], [0, 3, 64], [1, 3, 128]];
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
        cells[cy * cols + cx] = { ch: String.fromCharCode(0x2800 + code), r, g, b, l: sum / 8 };
      }
    }
    return { cols, rows, cells };
  }

  const chars = ramp(s);
  const levels = s.dither === "none" ? null : diffuse(Float32Array.from(ink), cols, rows, chars.length, s.dither);

  // Sobel on luminance for edge lines.
  const edgeT = s.edges === "strong" ? 0.18 : s.edges === "soft" ? 0.32 : Infinity;
  const L = (x: number, y: number) => lum[Math.min(rows - 1, Math.max(0, y)) * cols + Math.min(cols - 1, Math.max(0, x))];

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      let ch: string;
      if (edgeT !== Infinity) {
        const gx = L(x + 1, y - 1) + 2 * L(x + 1, y) + L(x + 1, y + 1) - L(x - 1, y - 1) - 2 * L(x - 1, y) - L(x - 1, y + 1);
        const gy = L(x - 1, y + 1) + 2 * L(x, y + 1) + L(x + 1, y + 1) - L(x - 1, y - 1) - 2 * L(x, y - 1) - L(x + 1, y - 1);
        const mag = Math.hypot(gx, gy);
        if (mag > edgeT) {
          // The edge runs perpendicular to the gradient.
          const a = ((Math.atan2(gy, gx * CELL) * 180) / Math.PI + 180) % 180;
          ch = a < 22.5 || a >= 157.5 ? "|" : a < 67.5 ? "/" : a < 112.5 ? "_" : "\\";
          const [r, g, b] = colourAt(x, y);
          cells[i] = { ch, r, g, b, l: lum[i] };
          continue;
        }
      }
      const q = levels ? levels[i] : Math.round(ink[i] * (chars.length - 1));
      ch = chars[Math.max(0, Math.min(chars.length - 1, q))];
      const [r, g, b] = colourAt(x, y);
      cells[i] = { ch, r, g, b, l: lum[i] };
    }
  }
  return { cols, rows, cells };
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
  switch (s.colour) {
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
export function drawGrid(ctx: CanvasRenderingContext2D, grid: AsciiGrid, s: AsciiSettings, width: number, height: number) {
  const cw = width / grid.cols;
  const chh = height / grid.rows;
  const bg = background(s);
  ctx.save();
  ctx.clearRect(0, 0, width, height);
  if (bg) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);
  }
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
  ctx.restore();
}

/** Size of the rendered ASCII image for a given output width. */
export function gridSize(grid: AsciiGrid, width: number) {
  const cw = width / grid.cols;
  return { width: Math.round(width), height: Math.round((cw / CELL) * grid.rows) };
}

export function gridToText(grid: AsciiGrid) {
  const lines: string[] = [];
  for (let y = 0; y < grid.rows; y++) {
    let line = "";
    for (let x = 0; x < grid.cols; x++) line += grid.cells[y * grid.cols + x].ch;
    lines.push(line.replace(/\s+$/, ""));
  }
  return lines.join("\n");
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
<body style="margin:0;background:${bg}"><pre style="margin:0;padding:24px;font:10px/1.1 'JetBrains Mono',ui-monospace,monospace;letter-spacing:0">${body}</pre></body>`;
}
