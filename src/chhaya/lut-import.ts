/**
 * Import your own looks: Adobe/Resolve .cube files or HaldCLUT PNGs.
 * Any size is resampled to our 33³ LUT, so an imported look renders exactly
 * like a built-in one (live camera, preview and export).
 */

import { type Look, LUT_SIZE, registerLook, unregisterLook } from "./looks";

type Table = { n: number; data: Float32Array }; // n³ RGB entries, r fastest, values 0 … 1

export function parseCube(text: string): Table {
  let n = 0;
  let min = [0, 0, 0];
  let max = [1, 1, 1];
  const values: number[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const parts = line.split(/\s+/);
    const key = parts[0].toUpperCase();
    if (key === "LUT_3D_SIZE") n = parseInt(parts[1], 10);
    else if (key === "DOMAIN_MIN") min = parts.slice(1, 4).map(Number);
    else if (key === "DOMAIN_MAX") max = parts.slice(1, 4).map(Number);
    else if (key === "LUT_1D_SIZE") throw new Error("1D LUTs aren't supported, only 3D .cube files.");
    else if (/^[-+.\d]/.test(parts[0]) && parts.length >= 3) values.push(+parts[0], +parts[1], +parts[2]);
  }
  if (!n || values.length < n * n * n * 3) throw new Error("This .cube file looks incomplete.");
  const data = new Float32Array(n * n * n * 3);
  for (let i = 0; i < data.length; i++) {
    const c = i % 3;
    data[i] = (values[i] - min[c]) / (max[c] - min[c] || 1);
  }
  return { n, data };
}

/** HaldCLUT level L: an L³ × L³ image holding an L²-sized cube, r fastest. */
export function parseHald(img: ImageData): Table {
  const w = img.width;
  const level = Math.round(Math.cbrt(w));
  if (level * level * level !== w || img.height !== w) throw new Error("That PNG isn't a HaldCLUT (it must be a square of size L³, like 512 or 1728).");
  const n = level * level;
  const data = new Float32Array(n * n * n * 3);
  for (let i = 0; i < n * n * n; i++) {
    data[i * 3] = img.data[i * 4] / 255;
    data[i * 3 + 1] = img.data[i * 4 + 1] / 255;
    data[i * 3 + 2] = img.data[i * 4 + 2] / 255;
  }
  return { n, data };
}

/** Trilinear resample to our 33³ RGBA8 layout. */
export function resample(t: Table): Uint8Array {
  const N = LUT_SIZE;
  const out = new Uint8Array(N * N * N * 4);
  const at = (r: number, g: number, b: number, c: number) => t.data[((b * t.n + g) * t.n + r) * 3 + c];
  let o = 0;
  for (let bi = 0; bi < N; bi++) {
    for (let gi = 0; gi < N; gi++) {
      for (let ri = 0; ri < N; ri++) {
        const p = [ri, gi, bi].map((v) => (v / (N - 1)) * (t.n - 1));
        const i0 = p.map(Math.floor);
        const i1 = i0.map((v) => Math.min(t.n - 1, v + 1));
        const f = p.map((v, k) => v - i0[k]);
        for (let c = 0; c < 3; c++) {
          let v = 0;
          for (let corner = 0; corner < 8; corner++) {
            const rr = corner & 1 ? i1[0] : i0[0];
            const gg = corner & 2 ? i1[1] : i0[1];
            const bb = corner & 4 ? i1[2] : i0[2];
            const w = (corner & 1 ? f[0] : 1 - f[0]) * (corner & 2 ? f[1] : 1 - f[1]) * (corner & 4 ? f[2] : 1 - f[2]);
            v += at(rr, gg, bb, c) * w;
          }
          out[o + c] = Math.round(Math.min(1, Math.max(0, v)) * 255);
        }
        out[o + 3] = 255;
        o += 4;
      }
    }
  }
  return out;
}

/* ---------- storage (this device only) ---------- */

const KEY = "chhaya.luts.v1";
type Stored = { id: string; name: string; rgb: string }; // rgb: base64 of 33³ × 3 bytes

const toB64 = (rgba: Uint8Array) => {
  const rgb = new Uint8Array((rgba.length / 4) * 3);
  for (let i = 0, j = 0; i < rgba.length; i += 4) {
    rgb[j++] = rgba[i];
    rgb[j++] = rgba[i + 1];
    rgb[j++] = rgba[i + 2];
  }
  let s = "";
  for (let i = 0; i < rgb.length; i += 0x8000) s += String.fromCharCode(...rgb.subarray(i, i + 0x8000));
  return btoa(s);
};
const fromB64 = (b64: string) => {
  const s = atob(b64);
  const out = new Uint8Array((s.length / 3) * 4);
  for (let i = 0, j = 0; i < s.length; i += 3) {
    out[j++] = s.charCodeAt(i);
    out[j++] = s.charCodeAt(i + 1);
    out[j++] = s.charCodeAt(i + 2);
    out[j++] = 255;
  }
  return out;
};

function readStore(): Stored[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]") as Stored[];
  } catch {
    return [];
  }
}

function lookFor(s: Stored, index: number): Look {
  return {
    id: s.id,
    code: `U${index + 1}`,
    name: s.name,
    family: "Imported",
    inspiredBy: "your LUT file",
    character: "imported LUT",
    swatch: ["#d9d4c8", "#6e6c66"],
    grain: 0,
    grainSize: 1,
    halation: 0,
    params: {},
    lut: fromB64(s.rgb),
  };
}

/** Registers saved LUTs as looks. Call once on start. */
export function loadImportedLuts(): Look[] {
  return readStore().map((s, i) => {
    const look = lookFor(s, i);
    registerLook(look);
    return look;
  });
}

/** Reads a .cube or HaldCLUT .png file, registers it as a look and saves it on this device. */
export async function importLut(file: File): Promise<{ look: Look; saved: boolean }> {
  let table: Table;
  if (/\.cube$/i.test(file.name)) {
    table = parseCube(await file.text());
  } else {
    const bmp = await createImageBitmap(file, { colorSpaceConversion: "none", premultiplyAlpha: "none" });
    const c = document.createElement("canvas");
    c.width = bmp.width;
    c.height = bmp.height;
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(bmp, 0, 0);
    bmp.close();
    table = parseHald(ctx.getImageData(0, 0, c.width, c.height));
  }
  const store = readStore();
  const s: Stored = {
    id: `lut-${Date.now().toString(36)}`,
    name: file.name.replace(/\.(cube|png)$/i, "").slice(0, 28) || "My LUT",
    rgb: toB64(resample(table)),
  };
  const look = lookFor(s, store.length);
  registerLook(look);
  let saved = true;
  try {
    localStorage.setItem(KEY, JSON.stringify([...store, s]));
  } catch {
    saved = false; // Storage full or blocked: the look still works for this visit.
  }
  return { look, saved };
}

export function removeImportedLut(id: string) {
  unregisterLook(id);
  try {
    localStorage.setItem(KEY, JSON.stringify(readStore().filter((s) => s.id !== id)));
  } catch {
    // Nothing to do: it is already gone from this visit.
  }
}
