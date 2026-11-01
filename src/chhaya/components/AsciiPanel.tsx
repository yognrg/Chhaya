"use client";

import { useState } from "react";
import { fontFamily } from "../ascii";
import { ASCII_RECIPES, applyRecipe, matchRecipe } from "../ascii-recipes";
import { type AsciiSettings, DEFAULT_ASCII, type Edit } from "../edit";
import { Chips } from "./Chips";
import { HairlineSlider } from "./HairlineSlider";
import { Icon, type IconName } from "./Icon";

type Props = {
  edit: Edit;
  onLive: (e: Edit) => void;
  onCommit: (e: Edit) => void;
  onCopy: () => Promise<boolean>;
};

type Item = { id: string; label: string; icon: IconName };

const ITEMS: Item[] = [
  { id: "power", label: "ASCII", icon: "ascii" },
  { id: "recipe", label: "Recipes", icon: "recipe" },
  { id: "style", label: "Style", icon: "style" },
  { id: "chars", label: "Chars", icon: "chars" },
  { id: "detail", label: "Detail", icon: "detail" },
  { id: "colour", label: "Colour", icon: "colour" },
  { id: "tone", label: "Tone", icon: "tone" },
  { id: "edges", label: "Edges", icon: "edges" },
  { id: "dither", label: "Dither", icon: "dither" },
  { id: "invert", label: "Invert", icon: "invert" },
  { id: "font", label: "Font", icon: "font" },
  { id: "bg", label: "Backgr.", icon: "background" },
  { id: "crt", label: "CRT", icon: "crt" },
  { id: "glitch", label: "Glitch", icon: "glitch" },
  { id: "grain", label: "Grain", icon: "grain" },
  { id: "copy", label: "Copy", icon: "copy" },
];

/** Settings that only mean something when cells are characters. */
const TEXT_ONLY = new Set(["chars", "edges", "font", "copy"]);

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
    case "recipe": return false;
    case "style": return a.style !== d.style;
    case "glitch": return a.glitch > 0;
    case "grain": return a.grain > 0;
    case "chars": return a.charset !== d.charset;
    case "detail": return a.cols !== d.cols;
    case "colour": return a.colour !== d.colour;
    case "tone": return a.brightness !== 0 || a.contrast !== 0 || a.gamma !== 0;
    case "edges": return a.edges !== d.edges;
    case "dither": return a.dither !== d.dither;
    case "invert": return a.invert;
    case "font": return a.font !== d.font;
    case "bg": return a.background !== d.background;
    case "crt": return a.crt || a.curve > 0;
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
    case "recipe": {
      const on = matchRecipe(a);
      control = (
        <Chips
          label="Recipes"
          value={a.enabled ? (on ?? "") : ""}
          options={ASCII_RECIPES.map((r) => ({ value: r.id, label: r.name }))}
          onChange={(v) => {
            const r = ASCII_RECIPES.find((x) => x.id === v);
            if (r) onCommit({ ...edit, ascii: applyRecipe(r) });
          }}
        />
      );
      break;
    }
    case "style":
      control = (
        <Chips
          label="Style"
          value={a.style}
          options={[
            { value: "ascii", label: "Characters" },
            { value: "pixel", label: "Pixel art" },
            { value: "halftone", label: "Halftone" },
            { value: "mosaic", label: "Mosaic" },
            { value: "lego", label: "Bricks" },
          ]}
          onChange={(v) => commit({ style: v })}
        />
      );
      break;
    case "glitch":
      control = (
        <HairlineSlider
          label="Glitch"
          value={a.glitch}
          min={0}
          max={100}
          step={1}
          defaultValue={0}
          decimals={0}
          signed={false}
          onChange={(v) => live({ glitch: v })}
        />
      );
      break;
    case "grain":
      control = (
        <HairlineSlider
          label="Film grain"
          value={a.grain}
          min={0}
          max={100}
          step={1}
          defaultValue={0}
          decimals={0}
          signed={false}
          onChange={(v) => live({ grain: v })}
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
          label={a.style === "ascii" ? "Columns" : "Cells across"}
          value={a.cols}
          min={a.style === "ascii" ? 40 : 16}
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
              { value: "tint", label: "Tint", swatch: a.tintColor },
              { value: "terminal", label: "Terminal", swatch: "#33ff66" },
              { value: "amber", label: "Amber CRT", swatch: "#ffb000" },
              { value: "inverted", label: "Inverted" },
              { value: "rainbow", label: "Rainbow" },
              { value: "gameboy", label: "Game Boy", swatch: "#8bac0f" },
              { value: "pico8", label: "PICO-8", swatch: "#ff004d" },
              { value: "cga", label: "CGA", swatch: "#55ffff" },
            ]}
            onChange={(v) => commit({ colour: v })}
          />
          {a.colour === "tint" && (
            <div className="ch-colour-pair">
              <label>
                <span className="ch-label ch-faint">tint</span>
                <input type="color" value={a.tintColor} onChange={(e) => live({ tintColor: e.target.value })} />
              </label>
            </div>
          )}
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
        <>
          <Chips
            label="Scanlines and glow"
            value={a.crt ? "on" : "off"}
            options={[{ value: "off", label: "Off" }, { value: "on", label: "CRT glow" }]}
            onChange={(v) => commit({ crt: v === "on" })}
          />
          <HairlineSlider
            label="Screen curve"
            value={a.curve}
            min={0}
            max={100}
            step={1}
            defaultValue={0}
            decimals={0}
            signed={false}
            onChange={(v) => live({ curve: v })}
          />
        </>
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
              {copied === "done"
                ? "copied"
                : copied === "fail"
                  ? "couldn't copy"
                  : a.enabled
                    ? `${a.cols} ${a.style === "ascii" ? "columns" : "cells across"}`
                    : "off"}
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
            disabled={(x.id === "copy" && !a.enabled) || (TEXT_ONLY.has(x.id) && a.style !== "ascii")}
            title={TEXT_ONLY.has(x.id) && a.style !== "ascii" ? "only for the Characters style" : undefined}
          >
            <Icon name={x.icon} />
            <span className="ch-tool-label">{x.label}</span>
            {edited(a, x.id) && <span className="ch-dot" aria-hidden="true" />}
          </button>
        ))}
      </div>
    </>
  );
}
