import { DEFAULT_EDIT, type Edit } from "../edit";
import { bakeLut, getLook, LUT_SIZE, NO_LOOK } from "../looks";
import { FRAG, VERT } from "./shaders";

export type Crop = { x: number; y: number; w: number; h: number };

export type RenderOptions = {
  edit?: Edit;
  /** Output uv → source uv (see geometry.ts). Defaults to the whole source. */
  matrix?: Float32Array;
  /** Source pixels across the output width. Sizes the blurs. */
  span?: number;
  bypass?: boolean;
  /** Changes the grain pattern. Keep it fixed for stills, vary it for live video. */
  grainSeed?: number;
};

type Canvas = HTMLCanvasElement | OffscreenCanvas;

const IDENTITY = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);

/** The crop of a source that fills an output of the given aspect, centred. */
export function coverCrop(srcW: number, srcH: number, outW: number, outH: number): Crop {
  const sa = srcW / srcH;
  const oa = outW / outH;
  if (sa > oa) {
    const w = oa / sa;
    return { x: (1 - w) / 2, y: 0, w, h: 1 };
  }
  const h = sa / oa;
  return { x: 0, y: (1 - h) / 2, w: 1, h };
}

let noiseData: Uint8Array | null = null;

/** 256² gaussian-ish noise, made once. Grain samples this instead of per-pixel random. */
function noise(): Uint8Array {
  if (noiseData) return noiseData;
  const n = 256 * 256;
  const d = new Uint8Array(n);
  let s = 0x9e3779b9;
  const rnd = () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
  for (let i = 0; i < n; i++) {
    const g = (rnd() + rnd() + rnd() + rnd()) / 4; // ≈ gaussian, mean 0.5
    d[i] = Math.max(0, Math.min(255, Math.round(128 + (g - 0.5) * 2.2 * 255)));
  }
  noiseData = d;
  return d;
}

const UNIFORMS = [
  "uSrc", "uLut", "uNoise", "uXform", "uBypass", "uRes", "uSpan",
  "uExposure", "uContrast", "uHighlights", "uShadows", "uWhites", "uBlacks",
  "uTemp", "uTint", "uSaturation", "uVibrance", "uSkin", "uHsl", "uSplit", "uSplitBalance",
  "uClarity", "uTexture", "uSharpness", "uDehaze", "uLutMix",
  "uFade", "uHalation", "uLeak", "uLeakStyle",
  "uGrain", "uGrainSize", "uGrainRough", "uGrainOffset",
  "uVignette", "uVigMid", "uBlur", "uBlurMode",
] as const;

/**
 * One WebGL2 pipeline used for the live viewfinder, the edit preview,
 * look thumbnails and the full-size export, so they always match.
 */
export class Renderer {
  readonly canvas: Canvas;
  readonly gl: WebGL2RenderingContext;
  readonly maxSize: number;
  private prog: WebGLProgram;
  private src: WebGLTexture;
  private noiseTex: WebGLTexture;
  private luts = new Map<string, WebGLTexture>();
  private u = {} as Record<(typeof UNIFORMS)[number], WebGLUniformLocation | null>;
  srcWidth = 0;
  srcHeight = 0;

  constructor(canvas: Canvas, opts: { preserve?: boolean } = {}) {
    this.canvas = canvas;
    const gl = canvas.getContext("webgl2", {
      antialias: false,
      alpha: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: !!opts.preserve,
      powerPreference: "high-performance",
    }) as WebGL2RenderingContext | null;
    if (!gl) throw new Error("webgl2-unavailable");
    this.gl = gl;
    this.maxSize = Math.min(
      gl.getParameter(gl.MAX_TEXTURE_SIZE) as number,
      ...(gl.getParameter(gl.MAX_VIEWPORT_DIMS) as Int32Array),
    );

    this.prog = this.link(VERT, FRAG);
    gl.useProgram(this.prog);
    for (const name of UNIFORMS) this.u[name] = gl.getUniformLocation(this.prog, name);
    gl.uniform1i(this.u.uSrc, 0);
    gl.uniform1i(this.u.uLut, 1);
    gl.uniform1i(this.u.uNoise, 2);

    // An empty VAO: the vertex shader makes its own triangle.
    gl.bindVertexArray(gl.createVertexArray());

    this.src = this.texture2D(gl.CLAMP_TO_EDGE, gl.LINEAR_MIPMAP_LINEAR);
    this.noiseTex = this.texture2D(gl.REPEAT, gl.LINEAR);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, 256, 256, 0, gl.RED, gl.UNSIGNED_BYTE, noise());
  }

  private link(vs: string, fs: string) {
    const gl = this.gl;
    const compile = (type: number, source: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, source);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(s) ?? "shader-compile");
      }
      return s;
    };
    const p = gl.createProgram()!;
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(p) ?? "program-link");
    }
    return p;
  }

  private texture2D(wrap: number, minFilter: number) {
    const gl = this.gl;
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, minFilter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    return t;
  }

  private lut(id: string) {
    const hit = this.luts.get(id);
    if (hit) return hit;
    const gl = this.gl;
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_3D, t);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    for (const p of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T, gl.TEXTURE_WRAP_R]) {
      gl.texParameteri(gl.TEXTURE_3D, p, gl.CLAMP_TO_EDGE);
    }
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    const n = LUT_SIZE;
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA8, n, n, n, 0, gl.RGBA, gl.UNSIGNED_BYTE, bakeLut(getLook(id)));
    this.luts.set(id, t);
    return t;
  }

  /** Upload a frame. Call once for a photo, or every frame for video. */
  setSource(source: TexImageSource, width: number, height: number) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.src);
    // No UNPACK_FLIP_Y: browsers ignore it for ImageBitmap. The shader flips instead.
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    // Mipmaps give clean downscaling and cheap wide blurs (clarity, halation, tilt-shift).
    gl.generateMipmap(gl.TEXTURE_2D);
    this.srcWidth = width;
    this.srcHeight = height;
  }

  /** Resize the drawing buffer, clamped to what the GPU can do. */
  setSize(width: number, height: number) {
    const s = Math.min(1, this.maxSize / Math.max(width, height));
    const w = Math.max(1, Math.round(width * s));
    const h = Math.max(1, Math.round(height * s));
    if (this.canvas.width !== w) this.canvas.width = w;
    if (this.canvas.height !== h) this.canvas.height = h;
  }

  render(opts: RenderOptions = {}) {
    const gl = this.gl;
    const u = this.u;
    const e = opts.edit ?? DEFAULT_EDIT;
    const look = e.look === NO_LOOK ? undefined : getLook(e.look);
    const w = this.canvas.width;
    const h = this.canvas.height;
    const mix = look ? e.strength / 12 : 0;

    gl.viewport(0, 0, w, h);
    gl.useProgram(this.prog);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.src);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_3D, this.lut(look?.id ?? NO_LOOK));
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.noiseTex);

    gl.uniformMatrix3fv(u.uXform, false, opts.matrix ?? IDENTITY);
    gl.uniform1i(u.uBypass, opts.bypass ? 1 : 0);
    gl.uniform2f(u.uRes, w, h);
    gl.uniform1f(u.uSpan, opts.span ?? this.srcWidth);

    gl.uniform1f(u.uExposure, e.exposure);
    gl.uniform1f(u.uContrast, e.contrast / 100);
    gl.uniform1f(u.uHighlights, e.highlights / 100);
    gl.uniform1f(u.uShadows, e.shadows / 100);
    gl.uniform1f(u.uWhites, e.whites / 100);
    gl.uniform1f(u.uBlacks, e.blacks / 100);
    gl.uniform1f(u.uTemp, e.temperature / 100);
    gl.uniform1f(u.uTint, e.tint / 100);
    gl.uniform1f(u.uSaturation, e.saturation / 100);
    gl.uniform1f(u.uVibrance, e.vibrance / 100);
    gl.uniform1f(u.uSkin, e.skin / 100);
    gl.uniform1fv(u.uHsl, e.hsl.map((v) => v / 100));
    gl.uniform4f(u.uSplit, e.splitShadowHue / 360, e.splitShadow / 100, e.splitHighHue / 360, e.splitHigh / 100);
    gl.uniform1f(u.uSplitBalance, e.splitBalance / 100);
    gl.uniform1f(u.uClarity, e.clarity / 100);
    gl.uniform1f(u.uTexture, e.texture / 100);
    gl.uniform1f(u.uSharpness, e.sharpness / 100);
    gl.uniform1f(u.uDehaze, e.dehaze / 100);
    gl.uniform1f(u.uLutMix, mix);
    gl.uniform1f(u.uFade, (e.fade / 100) * 0.3);
    gl.uniform1f(u.uHalation, Math.min(1, (look?.halation ?? 0) * mix + e.halation / 100));
    gl.uniform1f(u.uLeak, e.leak / 100);
    gl.uniform1i(u.uLeakStyle, e.leakStyle);
    gl.uniform1f(u.uGrain, (look?.grain ?? 0) * mix + e.grain / 100);
    gl.uniform1f(u.uGrainSize, (look?.grainSize ?? 1) * (0.4 + (e.grainSize / 100) * 1.2));
    gl.uniform1f(u.uGrainRough, e.grainRough / 100);
    const seed = opts.grainSeed ?? 0;
    gl.uniform2f(u.uGrainOffset, fract(seed * 0.618), fract(seed * 0.414));
    gl.uniform1f(u.uVignette, Math.max(-1, Math.min(1, (look?.vignette ?? 0) * mix + e.vignette / 100)));
    gl.uniform1f(u.uVigMid, 0.05 + (e.vignetteMid / 100) * 0.7);
    gl.uniform1f(u.uBlur, e.blur / 100);
    gl.uniform1i(u.uBlurMode, e.blurMode);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  dispose() {
    this.gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}

const fract = (x: number) => x - Math.floor(x);

export function webgl2Supported() {
  try {
    return !!document.createElement("canvas").getContext("webgl2");
  } catch {
    return false;
  }
}
