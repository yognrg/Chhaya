"use client";

import { useState } from "react";
import { fontFamily } from "../ascii";
import { type AsciiSettings, DEFAULT_ASCII, type Edit } from "../edit";
import { Chips } from "./Chips";
import { HairlineSlider } from "./HairlineSlider";

type Props = {
  edit: Edit;
  onLive: (e: Edit) => void;
  onCommit: (e: Edit) => void;
  onCopy: () => Promise<boolean>;
};

type Item = { id: string; label: string; glyph: string };

const ITEMS: Item[] = [
  { id: "power", label: "ASCII", glyph: "@" },
  { id: "chars", label: "Chars", glyph: "#" },
  { id: "detail", label: "Detail", glyph: "▤" },
  { id: "colour", label: "Colour", glyph: "◐" },
  { id: "tone", label: "Tone", glyph: "☼" },
  { id: "edges", label: "Edges", glyph: "/" },
  { id: "dither", label: "Dither", glyph: "░" },
  { id: "invert", label: "Invert", glyph: "⇄" },
  { id: "font", label: "Font", glyph: "Aa" },
  { id: "bg", label: "Backgr.", glyph: "■" },
  { id: "crt", label: "CRT", glyph: "▭" },
  { id: "copy", label: "Copy", glyph: "⧉" },
];

const TONES = [
  { key: "brightness", label: "Brightness" },
  { key: "contrast", label: "Contrast" },
  { key: "gamma", label: "Gamma" },
] as const;

/** Whether an item differs from the default, for the pink dot. */
function edited(a: AsciiSettings, id: string) {
  const d = DEFAULT_ASCII;
  switch (id) {
    case "power": return a.enabled;
    case "chars": return a.charset !== d.charset;
    case "detail": return a.cols !== d.cols;
    case "colour": return a.colour !== d.colour;
    case "tone": return a.brightness !== 0 || a.contrast !== 0 || a.gamma !== 0;
    case "edges": return a.edges !== d.edges;
    case "dither": return a.dither !== d.dither;
    case "invert": return a.invert;
    case "font": return a.font !== d.font;
    case "bg": return a.background !== d.background;
    case "crt": return a.crt;
    default: return false;
  }
}

export function AsciiPanel({ edit, onLive, onCommit, onCopy }: Props) {
  const [item, setItem] = useState("power");
  const [tone, setTone] = useState<(typeof TONES)[number]["key"]>("brightness");
  const [copied, setCopied] = useState<"idle" | "done" | "fail">("idle");
  const a = edit.ascii;

  // Changing any setting turns ASCII on: that's what people expect.
  const patch = (p: Partial<AsciiSettings>) => ({ ...edit, ascii: { ...a, enabled: true, ...p } });
  const commit = (p: Partial<AsciiSettings>) => onCommit(patch(p));
  const live = (p: Partial<AsciiSettings>) => onLive(patch(p));

  const copy = async () => {
    const ok = await onCopy();
    setCopied(ok ? "done" : "fail");
    setTimeout(() => setCopied("idle"), 1600);
  };

  const pick = (id: string) => {
    if (id === "copy") return void copy();
    setItem(id);
  };

  let control: React.ReactNode;
  switch (item) {
    case "power":
      control = (
        <Chips
          label="ASCII"
          value={a.enabled ? "on" : "off"}
          options={[{ value: "off", label: "Photo" }, { value: "on", label: "ASCII art" }]}
          onChange={(v) => onCommit({ ...edit, ascii: { ...a, enabled: v === "on" } })}
        />
      );
      break;
    case "chars":
      control = (
        <>
          <Chips
            label="Character set"
            value={a.charset}
            options={[
              { value: "standard", label: "Standard" },
              { value: "dense", label: "Dense" },
              { value: "blocks", label: "Blocks ░▓" },
              { value: "braille", label: "Braille ⠿" },
              { value: "binary", label: "Binary 01" },
              { value: "matrix", label: "Matrix" },
              { value: "moons", label: "Moons 🌗" },
              { value: "custom", label: "Custom" },
            ]}
            onChange={(v) => commit({ charset: v })}
          />
          {a.charset === "custom" && (
            <input
              className="ch-text-input ch-mono-input"
              aria-label="Your characters, darkest to lightest ink"
              placeholder="type characters, light to dense"
              value={a.custom}
              maxLength={40}
              onChange={(e) => live({ custom: e.target.value })}
              onBlur={(e) => commit({ custom: e.target.value })}
            />
          )}
        </>
      );
      break;
    case "detail":
      control = (
        <HairlineSlider
          label="Columns"
          value={a.cols}
          min={40}
          max={240}
          step={1}
          defaultValue={DEFAULT_ASCII.cols}
          decimals={0}
          signed={false}
          onChange={(v) => live({ cols: v })}
        />
      );
      break;
    case "colour":
      control = (
        <>
          <Chips
            label="Colour style"
            value={a.colour}
            options={[
              { value: "original", label: "Original" },
              { value: "mono", label: "Mono" },
              { value: "duotone", label: "Duotone" },
              { value: "terminal", label: "Terminal", swatch: "#33ff66" },
              { value: "amber", label: "Amber CRT", swatch: "#ffb000" },
              { value: "inverted", label: "Inverted" },
              { value: "rainbow", label: "Rainbow" },
            ]}
            onChange={(v) => commit({ colour: v })}
          />
          {a.colour === "duotone" && (
            <div className="ch-colour-pair">
              <label>
                <span className="ch-label ch-faint">dark</span>
                <input type="color" value={a.duoA} onChange={(e) => live({ duoA: e.target.value })} />
              </label>
              <label>
                <span className="ch-label ch-faint">light</span>
                <input type="color" value={a.duoB} onChange={(e) => live({ duoB: e.target.value })} />
              </label>
            </div>
          )}
        </>
      );
      break;
    case "tone": {
      const t = TONES.find((x) => x.key === tone)!;
      control = (
        <>
          <div className="ch-subtabs" role="tablist" aria-label="Tone">
            {TONES.map((x) => (
              <button
                key={x.key}
                role="tab"
                aria-selected={tone === x.key}
                className={`ch-subtab${tone === x.key ? " is-on" : ""}`}
                onClick={() => setTone(x.key)}
              >
                {x.label}
                {a[x.key] !== 0 && <span className="ch-dot" aria-hidden="true" />}
              </button>
            ))}
          </div>
          <HairlineSlider
            key={tone}
            label={t.label}
            value={a[tone]}
            min={-100}
            max={100}
            step={1}
            defaultValue={0}
            decimals={0}
            onChange={(v) => live({ [tone]: v })}
          />
        </>
      );
      break;
    }
    case "edges":
      control = (
        <Chips
          label="Edge lines"
          value={a.edges}
          options={[{ value: "off", label: "Off" }, { value: "soft", label: "Soft" }, { value: "strong", label: "Strong" }]}
          onChange={(v) => commit({ edges: v })}
        />
      );
      break;
    case "dither":
      control = (
        <Chips
          label="Dithering"
          value={a.dither}
          options={[
            { value: "none", label: "None" },
            { value: "ordered", label: "Ordered" },
            { value: "floyd", label: "Floyd–Steinberg" },
            { value: "atkinson", label: "Atkinson" },
          ]}
          onChange={(v) => commit({ dither: v })}
        />
      );
      break;
    case "invert":
      control = (
        <Chips
          label="Invert"
          value={a.invert ? "on" : "off"}
          options={[{ value: "off", label: "Off" }, { value: "on", label: "On" }]}
          onChange={(v) => commit({ invert: v === "on" })}
        />
      );
      break;
    case "font":
      control = (
        <Chips
          label="Font"
          value={a.font}
          options={(
            [
              ["jetbrains", "JetBrains Mono"],
              ["plex", "IBM Plex Mono"],
              ["vt323", "VT323"],
              ["courier", "Courier"],
            ] as const
          ).map(([value, label]) => ({ value, label, style: { fontFamily: fontFamily({ ...a, font: value }) } }))}
          onChange={(v) => commit({ font: v })}
        />
      );
      break;
    case "bg":
      control = (
        <>
          <Chips
            label="Background"
            value={a.background}
            options={[
              { value: "black", label: "Black", swatch: "#0f0f0e" },
              { value: "paper", label: "Paper", swatch: "#f6f5f2" },
              { value: "transparent", label: "Transparent" },
              { value: "custom", label: "Custom", swatch: a.bgColor },
            ]}
            onChange={(v) => commit({ background: v })}
          />
          {a.background === "custom" && (
            <div className="ch-colour-pair">
              <label>
                <span className="ch-label ch-faint">colour</span>
                <input type="color" value={a.bgColor} onChange={(e) => live({ bgColor: e.target.value })} />
              </label>
            </div>
          )}
        </>
      );
      break;
    case "crt":
      control = (
        <Chips
          label="Scanlines and glow"
          value={a.crt ? "on" : "off"}
          options={[{ value: "off", label: "Off" }, { value: "on", label: "CRT glow" }]}
          onChange={(v) => commit({ crt: v === "on" })}
        />
      );
      break;
  }

  const current = ITEMS.find((x) => x.id === item)!;

  return (
    <>
      <div className="ch-panel-control">
        <div className="ch-control" key={item}>
          <div className="ch-control-head">
            <span className="ch-label">{item === "power" ? "ASCII art" : current.label}</span>
            <span className="ch-label ch-faint" aria-live="polite">
              {copied === "done" ? "copied" : copied === "fail" ? "couldn't copy" : a.enabled ? `${a.cols} columns` : "off"}
            </span>
          </div>
          {control}
        </div>
      </div>

      <div className="ch-tools" role="toolbar" aria-label="ASCII settings">
        {ITEMS.map((x) => (
          <button
            key={x.id}
            className={`ch-tool${item === x.id ? " is-on" : ""}`}
            onClick={() => pick(x.id)}
            aria-pressed={x.id === "copy" ? undefined : item === x.id}
            aria-label={x.id === "copy" ? "Copy ASCII text" : x.label}
            disabled={x.id === "copy" && !a.enabled}
          >
            <span className="ch-glyph-icon" aria-hidden="true">{x.glyph}</span>
            <span className="ch-tool-label">{x.label}</span>
            {edited(a, x.id) && <span className="ch-dot" aria-hidden="true" />}
          </button>
        ))}
      </div>
    </>
  );
}
