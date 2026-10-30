"use client";

import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { type AsciiGrid, gridToText } from "../ascii";
import type { Photo } from "../camera";
import { DEFAULT_EDIT, type Edit, isAdjusted, isEdited } from "../edit";
import { deliver, type Format, renderFull } from "../export";
import { finish } from "../finish";
import { INSTANT_KINDS, type Rect } from "../frames";
import { layout } from "../geometry";
import { coverCrop, Renderer } from "../gl/renderer";
import { getLook, LOOKS, NO_LOOK } from "../looks";
import { loadCustomPresets, type Preset, PRESETS, saveCustomPresets } from "../presets";
import { useHistory } from "../useHistory";
import { AdjustPanel } from "./AdjustPanel";
import { AsciiPanel } from "./AsciiPanel";
import { HairlineSlider } from "./HairlineSlider";
import { Icon } from "./Icon";
import { PrintPanel } from "./PrintPanel";

export type Tab = "presets" | "looks" | "adjust" | "ascii" | "print";

type Props = {
  photo: Photo;
  initialEdit: Edit;
  initialTab: Tab;
  onBack: () => void;
};

type SaveState = "idle" | "menu" | "working" | "done" | "error";

const THUMB = 120;
const STRIP = [NO_LOOK, ...LOOKS.map((l) => l.id)];
const TABS: { id: Tab; label: string }[] = [
  { id: "presets", label: "Presets" },
  { id: "looks", label: "Looks" },
  { id: "adjust", label: "Adjust" },
  { id: "ascii", label: "ASCII" },
  { id: "print", label: "Print" },
];

export function Develop({ photo, initialEdit, initialTab, onBack }: Props) {
  const history = useHistory<Edit>(initialEdit);
  const edit = history.value;

  const [tab, setTab] = useState<Tab>(initialTab);
  const [strengthOpen, setStrengthOpen] = useState(false);
  const [compare, setCompare] = useState(false);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [custom, setCustom] = useState<Preset[]>([]);
  const [presetId, setPresetId] = useState<string | null>(null);
  const [save, setSave] = useState<SaveState>("idle");
  const [savedOnce, setSavedOnce] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const displayRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const gridRef = useRef<AsciiGrid | null>(null);
  const [stage, setStage] = useState<{ w: number; h: number } | null>(null);
  const [shown, setShown] = useState<{ w: number; h: number; image: Rect } | null>(null);
  const [developKey, setDevelopKey] = useState(0);
  const lastKind = useRef(initialEdit.frame.kind);

  useEffect(() => setCustom(loadCustomPresets()), []);

  // Measure the stage (content box).
  useLayoutEffect(() => {
    const el = stageRef.current!;
    const measure = () => {
      const cs = getComputedStyle(el);
      setStage({
        w: el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight),
        h: el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom),
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // One GPU renderer per photo, drawing off screen; the visible canvas shows the finished print.
  useEffect(() => {
    const r = new Renderer(document.createElement("canvas"), { preserve: true });
    r.setSource(photo.bitmap, photo.width, photo.height);
    rendererRef.current = r;
    return () => {
      r.dispose();
      rendererRef.current = null;
    };
  }, [photo]);

  // Re-render on any change, at most once per frame.
  useEffect(() => {
    const r = rendererRef.current;
    const display = displayRef.current;
    if (!r || !display || !stage || stage.w <= 0 || stage.h <= 0) return;
    const raf = requestAnimationFrame(() => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const gl = r.canvas as HTMLCanvasElement;
      let out: { canvas: CanvasImageSource; width: number; height: number; image: Rect };

      if (compare) {
        const s = Math.min(1, (stage.w * dpr) / photo.width, (stage.h * dpr) / photo.height);
        r.setSize(photo.width * s, photo.height * s);
        r.render({ bypass: true });
        out = { canvas: gl, width: gl.width, height: gl.height, image: { x: 0, y: 0, w: gl.width, h: gl.height } };
      } else {
        const lay = layout(photo.width, photo.height, edit.geometry);
        const s = Math.min(1, (stage.w * dpr) / lay.width, (stage.h * dpr) / lay.height);
        r.setSize(lay.width * s, lay.height * s);
        r.render({ edit, matrix: lay.matrix, span: lay.span, grainSeed: 0 });
        const done = finish(gl, gl.width, gl.height, edit, { strip: photo.strip, takenAt: photo.takenAt }, {
          asciiWidth: Math.max(gl.width, 900),
        });
        gridRef.current = done.grid;
        out = { canvas: done.canvas, width: done.canvas.width, height: done.canvas.height, image: done.image };
      }

      // Fit the finished image in the stage.
      const a = out.width / out.height;
      const w = Math.floor(Math.min(stage.w, stage.h * a));
      const h = Math.floor(w / a);
      display.width = Math.round(w * dpr);
      display.height = Math.round(h * dpr);
      const ctx = display.getContext("2d")!;
      ctx.imageSmoothingQuality = "high";
      ctx.clearRect(0, 0, display.width, display.height);
      ctx.drawImage(out.canvas, 0, 0, display.width, display.height);
      const k = w / out.width;
      const image = { x: out.image.x * k, y: out.image.y * k, w: out.image.w * k, h: out.image.h * k };
      setShown((p) =>
        p && p.w === w && p.h === h && p.image.x === image.x && p.image.y === image.y && p.image.w === image.w
          ? p
          : { w, h, image },
      );
    });
    return () => cancelAnimationFrame(raf);
  }, [edit, compare, stage, photo]);

  // Instant prints develop from milky white, like the real thing.
  useEffect(() => {
    const k = edit.frame.kind;
    if (k !== lastKind.current && [...INSTANT_KINDS, "strip"].includes(k)) setDevelopKey((n) => n + 1);
    lastKind.current = k;
  }, [edit.frame.kind]);

  // Look and preset thumbnails, rendered once per photo by the same pipeline.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const side = Math.min(photo.width, photo.height / photo.strip);
      const small = await createImageBitmap(photo.bitmap, 0, 0, photo.width, photo.height / photo.strip, {
        resizeWidth: Math.round((photo.width / side) * THUMB * 2),
        resizeHeight: Math.round((photo.height / photo.strip / side) * THUMB * 2),
        resizeQuality: "medium",
      });
      const canvas = document.createElement("canvas");
      const r = new Renderer(canvas, { preserve: true });
      r.setSize(THUMB, THUMB);
      r.setSource(small, small.width, small.height);
      const c = coverCrop(small.width, small.height, 1, 1);
      const matrix = new Float32Array([c.w, 0, 0, 0, c.h, 0, c.x, c.y, 1]);
      const out: Record<string, string> = {};
      const shot = (key: string, e: Edit) => {
        r.render({ edit: { ...e, geometry: DEFAULT_EDIT.geometry }, matrix, span: small.width * c.w });
        out[key] = canvas.toDataURL("image/jpeg", 0.82);
      };
      for (const id of STRIP) shot(id, { ...DEFAULT_EDIT, look: id });
      for (const p of [...PRESETS, ...loadCustomPresets()]) shot(`preset:${p.id}`, p.edit);
      r.dispose();
      small.close();
      if (!cancelled) setThumbs(out);
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [photo, custom.length]);

  const pickLook = (id: string) => {
    if (id === edit.look && id !== NO_LOOK) {
      setStrengthOpen((o) => !o);
      return;
    }
    setStrengthOpen(false);
    history.push({ ...edit, look: id, strength: 12 });
  };

  const applyPreset = (p: Preset) => {
    setPresetId(p.id);
    // Presets set the whole look; a strip keeps its strip frame unless the preset picks one.
    const frame = p.edit.frame.kind === "none" && photo.strip > 1 ? edit.frame : p.edit.frame;
    history.push({ ...p.edit, frame: { ...frame, caption: frame.caption || edit.frame.caption } });
  };

  const saveAsPreset = () => {
    const name = window.prompt("name this preset", `My look ${custom.length + 1}`)?.trim();
    if (!name) return;
    const look = getLook(edit.look);
    const p: Preset = {
      id: `custom-${Date.now()}`,
      name,
      goodFor: "saved on this device",
      code: look?.code ?? "★",
      edit,
      custom: true,
    };
    const list = [...custom, p];
    setCustom(list);
    saveCustomPresets(list);
    setPresetId(p.id);
  };

  const deletePreset = (p: Preset) => {
    if (!window.confirm(`delete "${p.name}"?`)) return;
    const list = custom.filter((x) => x.id !== p.id);
    setCustom(list);
    saveCustomPresets(list);
    setPresetId(null);
  };

  const doSave = async (format: Format) => {
    setSave("working");
    try {
      const blob = await renderFull(photo, edit, format);
      await deliver(blob, `${photo.name}${edit.ascii.enabled ? "-ascii" : ""}.${format}`);
      setSave("done");
      setSavedOnce(true);
      setTimeout(() => setSave((s) => (s === "done" ? "idle" : s)), 1600);
    } catch (err) {
      setSave((err as DOMException)?.name === "AbortError" ? "idle" : "error");
    }
  };

  const copyAscii = async () => {
    const grid = gridRef.current;
    if (!grid) return false;
    try {
      await navigator.clipboard.writeText(gridToText(grid));
      return true;
    } catch {
      return false;
    }
  };

  const leave = useCallback(() => {
    if (isEdited(history.value) && !savedOnce && !window.confirm("leave this photo? it isn't saved yet.")) return;
    onBack();
  }, [history.value, savedOnce, onBack]);

  // Keyboard: undo/redo, and backslash to compare like desktop editors.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement && e.target.type === "text") return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) history.redo();
        else history.undo();
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        history.redo();
      } else if (e.key === "\\") setCompare(true);
      else if (e.key === "Escape") {
        if (save === "menu") setSave("idle");
        else if (strengthOpen) setStrengthOpen(false);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === "\\") setCompare(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [history, save, strengthOpen]);

  const look = getLook(edit.look);
  const allPresets = [...PRESETS, ...custom];
  const preset = allPresets.find((p) => p.id === presetId);
  const dotFor: Record<Tab, boolean> = {
    presets: !!preset,
    looks: edit.look !== NO_LOOK,
    adjust: isAdjusted(edit),
    ascii: edit.ascii.enabled,
    print: edit.frame.kind !== "none" || edit.frame.date,
  };

  return (
    <div className="ch-screen ch-paper ch-develop">
      <header className="ch-develop-top">
        <button className="ch-icon-btn" onClick={leave} aria-label="Back">
          <Icon name="back" />
        </button>
        <div className="ch-history">
          <button className="ch-icon-btn" onClick={history.undo} disabled={!history.canUndo} aria-label="Undo">
            <Icon name="undo" />
          </button>
          <button className="ch-icon-btn" onClick={history.redo} disabled={!history.canRedo} aria-label="Redo">
            <Icon name="redo" />
          </button>
          <button
            className="ch-icon-btn"
            onClick={() => {
              setPresetId(null);
              history.push({ ...DEFAULT_EDIT, frame: photo.strip > 1 ? { ...DEFAULT_EDIT.frame, kind: "strip" } : DEFAULT_EDIT.frame });
            }}
            disabled={!isEdited(edit)}
            aria-label="Reset all edits"
          >
            <Icon name="reset" />
          </button>
        </div>
        <div className="ch-save-wrap">
          <button
            className={`ch-pill ch-pill-ink ch-save is-${save}`}
            onClick={() => setSave((s) => (s === "menu" ? "idle" : s === "idle" || s === "error" ? "menu" : s))}
            aria-haspopup="menu"
            aria-expanded={save === "menu"}
            disabled={save === "working"}
          >
            {save === "working" ? "developing…" : save === "done" ? <><Icon name="check" size={16} /> saved</> : "Save"}
          </button>
          {save === "menu" && (
            <div className="ch-menu" role="menu">
              <button role="menuitem" onClick={() => doSave("png")}>
                PNG <span className="ch-menu-hint">full size, lossless</span>
              </button>
              <button role="menuitem" onClick={() => doSave("jpg")}>
                JPG <span className="ch-menu-hint">full size, smaller</span>
              </button>
              {edit.ascii.enabled && (
                <>
                  <button role="menuitem" onClick={() => doSave("txt")}>
                    TXT <span className="ch-menu-hint">plain ASCII text</span>
                  </button>
                  <button role="menuitem" onClick={() => doSave("html")}>
                    HTML <span className="ch-menu-hint">coloured text page</span>
                  </button>
                </>
              )}
            </div>
          )}
          {save === "error" && <p className="ch-save-error" role="alert">couldn't save. try again.</p>}
        </div>
      </header>

      <div className="ch-stage" ref={stageRef}>
        <div className="ch-photo-wrap" style={shown ? { width: shown.w, height: shown.h } : undefined}>
          <canvas
            ref={displayRef}
            className={`ch-photo${edit.frame.kind !== "none" && edit.frame.kind !== "film" && !compare ? " is-print" : ""}`}
            style={shown ? { width: shown.w, height: shown.h } : undefined}
            role="img"
            aria-label={compare ? "Original photo" : `Edited photo${look ? `, ${look.name}` : ""}. Hold to compare.`}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              setCompare(true);
            }}
            onPointerUp={() => setCompare(false)}
            onPointerCancel={() => setCompare(false)}
            onContextMenu={(e) => e.preventDefault()}
          />
          {developKey > 0 && shown && !compare && (
            <span
              key={developKey}
              className="ch-developing"
              style={{ left: shown.image.x - 0.5, top: shown.image.y - 0.5, width: shown.image.w + 1, height: shown.image.h + 1 }}
              aria-hidden="true"
            />
          )}
        </div>
        <p className={`ch-label ch-compare-hint${compare ? " is-on" : ""}`}>{compare ? "original" : "hold to compare"}</p>
      </div>

      <section className="ch-panel" aria-label="Edit">
        {tab === "presets" && (
          <>
            <div className="ch-panel-control">
              <div className="ch-control ch-control-quiet" key={preset?.id ?? "none"}>
                <span className="ch-control-name">{preset?.name ?? "Presets"}</span>
                <span className="ch-label ch-faint">
                  {preset ? preset.goodFor : "a look, adjustments and a frame in one tap"}
                </span>
              </div>
            </div>
            <div className="ch-looks" role="listbox" aria-label="Presets">
              <button className="ch-look" onClick={saveAsPreset} aria-label="Save current edit as a preset">
                <span className="ch-look-thumb ch-look-add">
                  <Icon name="plus" />
                </span>
                <span className="ch-look-code">Save</span>
              </button>
              {allPresets.map((p) => {
                const on = p.id === presetId;
                return (
                  <button
                    key={p.id}
                    role="option"
                    aria-selected={on}
                    aria-label={`${p.name}, good for ${p.goodFor}${p.custom ? ". Tap again to delete" : ""}`}
                    className={`ch-look ch-preset${on ? " is-on" : ""}`}
                    onClick={() => (on && p.custom ? deletePreset(p) : applyPreset(p))}
                  >
                    <span
                      className="ch-look-thumb"
                      style={thumbs[`preset:${p.id}`] ? { backgroundImage: `url(${thumbs[`preset:${p.id}`]})` } : undefined}
                    >
                      {p.edit.ascii.enabled && <span className="ch-thumb-badge">ASCII</span>}
                      {p.custom && on && <span className="ch-thumb-badge">delete</span>}
                    </span>
                    <span className="ch-look-code ch-preset-name">{p.name}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {tab === "looks" && (
          <>
            <div className="ch-panel-control">
              {strengthOpen && look ? (
                <div className="ch-control">
                  <div className="ch-control-head">
                    <span className="ch-control-name">{look.name}</span>
                    <span className="ch-label ch-faint">inspired by {look.inspiredBy}</span>
                  </div>
                  <HairlineSlider
                    label={`${look.name} strength`}
                    value={edit.strength}
                    min={0}
                    max={12}
                    step={0.1}
                    defaultValue={12}
                    decimals={1}
                    signed={false}
                    onChange={(v) => history.set({ ...edit, strength: v })}
                  />
                </div>
              ) : (
                <div className="ch-control ch-control-quiet" key={edit.look}>
                  <span className="ch-control-name">{look?.name ?? "Original"}</span>
                  <span className="ch-label ch-faint">
                    {look ? `${look.character.toLowerCase()} · tap again for strength` : "40 film looks · pick one"}
                  </span>
                </div>
              )}
            </div>
            <div className="ch-looks" role="listbox" aria-label="Film looks">
              {STRIP.map((id, i) => {
                const l = getLook(id);
                const prev = i > 0 ? getLook(STRIP[i - 1]) : undefined;
                const on = id === edit.look;
                return (
                  <Fragment key={id}>
                    {l && prev?.family !== l.family && <span className="ch-looks-divider" aria-hidden="true" title={l.family} />}
                    <button
                      role="option"
                      aria-selected={on}
                      aria-label={l ? `${l.code}, ${l.name}, inspired by ${l.inspiredBy}` : "Original, no look"}
                      className={`ch-look${on ? " is-on" : ""}`}
                      onClick={() => pickLook(id)}
                    >
                      <span
                        className="ch-look-thumb"
                        style={
                          thumbs[id]
                            ? { backgroundImage: `url(${thumbs[id]})` }
                            : l
                              ? { background: `linear-gradient(135deg, ${l.swatch[0]} 0 50%, ${l.swatch[1]} 50%)` }
                              : undefined
                        }
                      />
                      <span className="ch-look-code">{l?.code ?? "—"}</span>
                    </button>
                  </Fragment>
                );
              })}
            </div>
          </>
        )}

        {tab === "adjust" && <AdjustPanel edit={edit} onLive={history.set} onCommit={history.push} />}
        {tab === "ascii" && <AsciiPanel edit={edit} onLive={history.set} onCommit={history.push} onCopy={copyAscii} />}
        {tab === "print" && <PrintPanel edit={edit} onLive={history.set} onCommit={history.push} />}

        <nav className="ch-tabs" role="tablist" aria-label="Edit mode">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              className={`ch-tab${tab === t.id ? " is-on" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
              {dotFor[t.id] && <span className="ch-dot" aria-hidden="true" />}
            </button>
          ))}
        </nav>
      </section>
    </div>
  );
}
