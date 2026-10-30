import { DEFAULT_GEOMETRY, type Geometry } from "./geometry";
import { NO_LOOK } from "./looks";

/* ---------- ASCII ---------- */

export const CHARSETS = {
  standard: " .:-=+*#%@",
  dense: " .'`^\",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$",
  blocks: " ░▒▓█",
  braille: "", // drawn from 2×4 dot cells, see ascii.ts
  binary: " 01",
  matrix: " ﾊﾐﾋｰｳｼﾅﾓﾆｻﾜﾂｵﾘｱﾎﾃﾏｹﾒｴｶｷﾑﾕﾗｾﾈｽﾀﾇﾍ",
  moons: "🌑🌘🌗🌖🌕",
  custom: "",
} as const;
export type Charset = keyof typeof CHARSETS;

export type AsciiColour = "mono" | "original" | "duotone" | "terminal" | "amber" | "inverted" | "rainbow";
export type AsciiFont = "jetbrains" | "plex" | "vt323" | "courier";
export type AsciiBg = "black" | "paper" | "transparent" | "custom";

export type AsciiSettings = {
  enabled: boolean;
  charset: Charset;
  custom: string;
  cols: number;
  colour: AsciiColour;
  duoA: string;
  duoB: string;
  brightness: number;
  contrast: number;
  gamma: number;
  edges: "off" | "soft" | "strong";
  dither: "none" | "ordered" | "floyd" | "atkinson";
  invert: boolean;
  font: AsciiFont;
  background: AsciiBg;
  bgColor: string;
  crt: boolean;
};

export const DEFAULT_ASCII: AsciiSettings = {
  enabled: false,
  charset: "standard",
  custom: " .oO@",
  cols: 96,
  colour: "original",
  duoA: "#1b1f4a",
  duoB: "#ffd36e",
  brightness: 0,
  contrast: 0,
  gamma: 0,
  edges: "off",
  dither: "none",
  invert: false,
  font: "jetbrains",
  background: "black",
  bgColor: "#16213e",
  crt: false,
};

/* ---------- Print ---------- */

export type FrameKind = "none" | "instant" | "sx70" | "mini" | "wide" | "strip" | "film" | "border";

export type FrameSettings = {
  kind: FrameKind;
  caption: string;
  date: boolean;
  /** Plain border: colour and thickness (% of the long side). */
  borderColor: "white" | "black";
  borderSize: number;
  /** Paper texture strength, 0 … 100. */
  paper: number;
};

export const DEFAULT_FRAME: FrameSettings = {
  kind: "none",
  caption: "",
  date: false,
  borderColor: "white",
  borderSize: 6,
  paper: 30,
};

/* ---------- The edit ---------- */

export const HSL_COLOURS = ["red", "orange", "yellow", "green", "aqua", "blue", "purple", "magenta"] as const;
export const HSL_SWATCH = ["#e5484d", "#f08a24", "#f5d90a", "#46a758", "#12a594", "#3e63dd", "#8e4ec6", "#d6409f"];

/** Everything that describes one edit. Plain data: easy to undo, save as a preset, or restore. */
export type Edit = {
  look: string;
  strength: number;
  // Light
  exposure: number;
  contrast: number;
  highlights: number;
  shadows: number;
  whites: number;
  blacks: number;
  // Colour
  temperature: number;
  tint: number;
  saturation: number;
  vibrance: number;
  skin: number;
  /** 8 colours × [hue, saturation, luminance], −100 … 100. */
  hsl: number[];
  splitShadowHue: number;
  splitShadow: number;
  splitHighHue: number;
  splitHigh: number;
  splitBalance: number;
  // Detail
  clarity: number;
  texture: number;
  sharpness: number;
  dehaze: number;
  // Film
  grain: number;
  grainSize: number;
  grainRough: number;
  fade: number;
  halation: number;
  leak: number;
  leakStyle: number;
  // Effects
  vignette: number;
  vignetteMid: number;
  blur: number;
  blurMode: number;
  // Crop
  geometry: Geometry;
  // ASCII and print
  ascii: AsciiSettings;
  frame: FrameSettings;
};

export const DEFAULT_EDIT: Edit = {
  look: NO_LOOK,
  strength: 12,
  exposure: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  whites: 0,
  blacks: 0,
  temperature: 0,
  tint: 0,
  saturation: 0,
  vibrance: 0,
  skin: 0,
  hsl: new Array(24).fill(0),
  splitShadowHue: 210,
  splitShadow: 0,
  splitHighHue: 40,
  splitHigh: 0,
  splitBalance: 0,
  clarity: 0,
  texture: 0,
  sharpness: 20,
  dehaze: 0,
  grain: 0,
  grainSize: 50,
  grainRough: 50,
  fade: 0,
  halation: 0,
  leak: 0,
  leakStyle: 0,
  vignette: 0,
  vignetteMid: 50,
  blur: 0,
  blurMode: 0,
  geometry: DEFAULT_GEOMETRY,
  ascii: DEFAULT_ASCII,
  frame: DEFAULT_FRAME,
};

export type NumKey = {
  [K in keyof Edit]: Edit[K] extends number ? K : never;
}[keyof Edit];

/* ---------- Tools ---------- */

export type SliderParam = {
  kind: "slider";
  label: string;
  min: number;
  max: number;
  step: number;
  decimals: number;
  get: (e: Edit) => number;
  set: (e: Edit, v: number) => Edit;
  def: number;
  /** Draws the track as a hue rainbow. */
  hue?: boolean;
};

export type ChoiceParam = {
  kind: "choice";
  label: string;
  options: { value: string; label: string }[];
  get: (e: Edit) => string;
  set: (e: Edit, v: string) => Edit;
};

export type Param = SliderParam | ChoiceParam;

export type ToolGroup = "Light" | "Colour" | "Detail" | "Film" | "Effects" | "Crop";

export type Tool = {
  id: string;
  label: string;
  short: string;
  group: ToolGroup;
  params: Param[];
  /** The HSL tool picks a colour first, then edits it. */
  hsl?: boolean;
  /** Extra buttons for the crop tool. */
  crop?: boolean;
};

const num = (
  key: NumKey,
  label: string,
  min = -100,
  max = 100,
  opts: Partial<Pick<SliderParam, "step" | "decimals" | "hue">> = {},
): SliderParam => ({
  kind: "slider",
  label,
  min,
  max,
  step: opts.step ?? 1,
  decimals: opts.decimals ?? 0,
  hue: opts.hue,
  def: DEFAULT_EDIT[key],
  get: (e) => e[key],
  set: (e, v) => ({ ...e, [key]: v }),
});

/** One HSL channel (0 hue, 1 saturation, 2 luminance) of one colour. */
export const hslSlider = (colour: number, channel: number, label: string): SliderParam => ({
  kind: "slider",
  label,
  min: -100,
  max: 100,
  step: 1,
  decimals: 0,
  def: 0,
  get: (e) => e.hsl[colour * 3 + channel],
  set: (e, v) => {
    const hsl = [...e.hsl];
    hsl[colour * 3 + channel] = v;
    return { ...e, hsl };
  },
});

const geo = <K extends keyof Geometry>(key: K, v: Geometry[K]) => (e: Edit): Edit => ({
  ...e,
  geometry: { ...e.geometry, [key]: v },
});

/** 22 adjustments in six groups. */
export const TOOLS: Tool[] = [
  { id: "exposure", label: "Exposure", short: "Expo", group: "Light", params: [num("exposure", "Exposure", -3, 3, { step: 0.1, decimals: 1 })] },
  { id: "contrast", label: "Contrast", short: "Contrast", group: "Light", params: [num("contrast", "Contrast")] },
  { id: "highlights", label: "Highlights", short: "Highs", group: "Light", params: [num("highlights", "Highlights")] },
  { id: "shadows", label: "Shadows", short: "Shadows", group: "Light", params: [num("shadows", "Shadows")] },
  { id: "whites", label: "Whites / Blacks", short: "W / B", group: "Light", params: [num("whites", "Whites"), num("blacks", "Blacks")] },
  { id: "temperature", label: "Temperature", short: "Temp", group: "Colour", params: [num("temperature", "Temperature")] },
  { id: "tint", label: "Tint", short: "Tint", group: "Colour", params: [num("tint", "Tint")] },
  { id: "saturation", label: "Saturation", short: "Sat", group: "Colour", params: [num("saturation", "Saturation")] },
  { id: "vibrance", label: "Vibrance", short: "Vibrance", group: "Colour", params: [num("vibrance", "Vibrance")] },
  { id: "skin", label: "Skin tone", short: "Skin", group: "Colour", params: [num("skin", "Skin tone")] },
  { id: "hsl", label: "HSL", short: "HSL", group: "Colour", hsl: true, params: [] },
  {
    id: "split",
    label: "Split tone",
    short: "Split",
    group: "Colour",
    params: [
      num("splitShadow", "Shadows", 0, 100),
      num("splitShadowHue", "Shadow hue", 0, 360, { hue: true }),
      num("splitHigh", "Highlights", 0, 100),
      num("splitHighHue", "Highlight hue", 0, 360, { hue: true }),
      num("splitBalance", "Balance"),
    ],
  },
  { id: "clarity", label: "Clarity", short: "Clarity", group: "Detail", params: [num("clarity", "Clarity")] },
  { id: "texture", label: "Texture", short: "Texture", group: "Detail", params: [num("texture", "Texture")] },
  { id: "sharpness", label: "Sharpness", short: "Sharpen", group: "Detail", params: [num("sharpness", "Sharpness", 0, 100)] },
  { id: "dehaze", label: "Dehaze", short: "Dehaze", group: "Detail", params: [num("dehaze", "Dehaze")] },
  {
    id: "grain",
    label: "Grain",
    short: "Grain",
    group: "Film",
    params: [num("grain", "Amount", 0, 100), num("grainSize", "Size", 0, 100), num("grainRough", "Roughness", 0, 100)],
  },
  { id: "fade", label: "Fade", short: "Fade", group: "Film", params: [num("fade", "Fade", 0, 100)] },
  { id: "halation", label: "Halation", short: "Halation", group: "Film", params: [num("halation", "Halation", 0, 100)] },
  {
    id: "leak",
    label: "Light leak",
    short: "Leak",
    group: "Film",
    params: [
      num("leak", "Strength", 0, 100),
      {
        kind: "choice",
        label: "Style",
        options: [
          { value: "0", label: "Edge" },
          { value: "1", label: "Corner" },
          { value: "2", label: "Bottom" },
          { value: "3", label: "Flare" },
        ],
        get: (e) => String(e.leakStyle),
        set: (e, v) => ({ ...e, leakStyle: Number(v) }),
      },
    ],
  },
  {
    id: "vignette",
    label: "Vignette",
    short: "Vignette",
    group: "Effects",
    params: [num("vignette", "Amount"), num("vignetteMid", "Midpoint", 0, 100)],
  },
  {
    id: "blur",
    label: "Blur / Tilt-shift",
    short: "Blur",
    group: "Effects",
    params: [
      num("blur", "Amount", 0, 100),
      {
        kind: "choice",
        label: "Mode",
        options: [
          { value: "0", label: "Blur" },
          { value: "1", label: "Tilt-shift" },
        ],
        get: (e) => String(e.blurMode),
        set: (e, v) => ({ ...e, blurMode: Number(v) }),
      },
    ],
  },
  {
    id: "crop",
    label: "Crop and rotate",
    short: "Crop",
    group: "Crop",
    crop: true,
    params: [
      {
        kind: "choice",
        label: "Aspect",
        options: ["original", "1:1", "4:5", "3:4", "9:16", "16:9", "3:2", "2.39:1"].map((a) => ({ value: a, label: a })),
        get: (e) => e.geometry.aspect,
        set: (e, v) => geo("aspect", v as Geometry["aspect"])(e),
      },
      {
        kind: "slider",
        label: "Straighten",
        min: -45,
        max: 45,
        step: 0.5,
        decimals: 1,
        def: 0,
        get: (e) => e.geometry.straighten,
        set: (e, v) => geo("straighten", v)(e),
      },
    ],
  },
];

export function isParamEdited(e: Edit, p: Param) {
  if (p.kind === "slider") return p.get(e) !== p.def;
  return p.get(e) !== p.get(DEFAULT_EDIT);
}

export function isToolEdited(e: Edit, t: Tool) {
  if (t.hsl) return e.hsl.some((v) => v !== 0);
  if (t.crop) {
    const g = e.geometry;
    return g.aspect !== "original" || g.rotate !== 0 || g.flip || g.straighten !== 0;
  }
  // Choice params only count when their amount slider is in use.
  return t.params.some((p) => p.kind === "slider" && isParamEdited(e, p));
}

export const isAdjusted = (e: Edit) => TOOLS.some((t) => isToolEdited(e, t));

export function isEdited(e: Edit) {
  return e.look !== NO_LOOK || isAdjusted(e) || e.ascii.enabled || e.frame.kind !== "none";
}

export function formatValue(v: number, decimals: number, signed = true) {
  const s = Math.abs(v).toFixed(decimals);
  if (!signed) return s;
  if (Number(s) === 0) return (0).toFixed(decimals);
  return (v > 0 ? "+" : "−") + s;
}

/** Applies a partial edit on top of another, merging the nested settings. */
export function mergeEdit(base: Edit, patch: Partial<Omit<Edit, "ascii" | "frame" | "geometry">> & {
  ascii?: Partial<AsciiSettings>;
  frame?: Partial<FrameSettings>;
  geometry?: Partial<Geometry>;
}): Edit {
  return {
    ...base,
    ...patch,
    ascii: { ...base.ascii, ...patch.ascii },
    frame: { ...base.frame, ...patch.frame },
    geometry: { ...base.geometry, ...patch.geometry },
  };
}
