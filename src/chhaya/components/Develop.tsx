"use client";

import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { type AsciiGrid, gridToText } from "../ascii";
import type { Photo } from "../camera";
import { DEFAULT_EDIT, type Edit, isAdjusted, isEdited } from "../edit";
import { deliver, type Format, renderFull } from "../export";
import { finish } from "../finish";
import { INSTANT_KINDS, type Rect } from "../frames";
import { layout } from "../geometry";
import { coverCrop, Renderer } from "../gl/renderer";
import { getLook, LOOKS, NO_LOOK } from "../looks";
import { importLut, removeImportedLut } from "../lut-import";
import {
  blendEdit,
  CATEGORIES,
  type Category,
  loadCustomPresets,
  loadFavourites,
  type Preset,
  PRESETS,
  saveCustomPresets,
  saveFavourites,
} from "../presets";
import { useHistory } from "../useHistory";
import { AdjustPanel } from "./AdjustPanel";
import { AsciiPanel } from "./AsciiPanel";
import { Chips } from "./Chips";
import { HairlineSlider } from "./HairlineSlider";
import { Icon } from "./Icon";
import { PrintPanel } from "./PrintPanel";
import { UploadButton } from "./UploadButton";

export type Tab = "presets" | "looks" | "adjust" | "ascii" | "print";

type Props = {
  photo: Photo;
  initialEdit: Edit;
  initialTab: Tab;
  onBack: () => void;
};

type SaveState = "idle" | "menu" | "working" | "done" | "error";

const THUMB = 120;
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
  const [category, setCategory] = useState<Category | "All" | "Favourites">("All");
  const [favs, setFavs] = useState<string[]>([]);
  const [intensity, setIntensity] = useState(100);
  // The edit a preset is applied on top of, so trying presets (or the intensity) never stacks.
  const presetBase = useRef<Edit | null>(null);
  const lastApplied = useRef<Edit | null>(null);
  // Bumped when an imported LUT is added or removed, so the looks list refreshes.
  const [lookVersion, setLookVersion] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const strip = useMemo(() => [NO_LOOK, ...LOOKS.map((l) => l.id)], [lookVersion]);
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

  useEffect(() => {
    setCustom(loadCustomPresets());
    setFavs(loadFavourites());
  }, []);

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
    if (k !== lastKind.current && [...INSTANT_KINDS, "strip", "grid"].includes(k)) setDevelopKey((n) => n + 1);
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
      const jobs: [string, Edit][] = [
        ...strip.map((id): [string, Edit] => [id, { ...DEFAULT_EDIT, look: id }]),
        ...PRESETS.map((p): [string, Edit] => [`preset:${p.id}`, p.edit]),
        ...loadCustomPresets().map((p): [string, Edit] => [`preset:${p.id}`, p.edit]),
      ];
      // Small batches with a pause between, so the editor stays responsive while ~200 previews render.
      for (let i = 0; i < jobs.length && !cancelled; i += 24) {
        for (const [key, e] of jobs.slice(i, i + 24)) {
          r.render({ edit: { ...e, geometry: DEFAULT_EDIT.geometry }, matrix, span: small.width * c.w });
          out[key] = canvas.toDataURL("image/jpeg", 0.8);
        }
        if (!cancelled) setThumbs({ ...out });
        await new Promise((res) => setTimeout(res, 0));
      }
      r.dispose();
      small.close();
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [photo, custom.length, strip]);

  const pickLook = (id: string) => {
    if (id === edit.look && id !== NO_LOOK) {
      setStrengthOpen((o) => !o);
      return;
    }
    setStrengthOpen(false);
    history.push({ ...edit, look: id, strength: 12 });
  };

  // Presets set the whole look; a strip keeps its strip frame unless the preset picks one.
  const presetTarget = (p: Preset, base: Edit): Edit => {
    const frame = p.edit.frame.kind === "none" && photo.strip > 1 ? base.frame : p.edit.frame;
    return { ...p.edit, frame: { ...frame, caption: frame.caption || base.frame.caption } };
  };

  const applyPreset = (p: Preset, amount = p.intensity, live = false) => {
    // Start from the edit before any preset, unless something else changed since.
    if (!presetBase.current || lastApplied.current !== history.value) presetBase.current = history.value;
    const base = presetBase.current;
    const next = blendEdit(base, presetTarget(p, base), amount / 100);
    lastApplied.current = next;
    setPresetId(p.id);
    setIntensity(amount);
    if (live) history.set(next);
    else history.push(next);
  };

  const toggleFav = (id: string) => {
    const next = favs.includes(id) ? favs.filter((x) => x !== id) : [...favs, id];
    setFavs(next);
    saveFavourites(next);
  };

  const onImportLut = async (file: File) => {
    try {
      const { look, saved } = await importLut(file);
      setLookVersion((v) => v + 1);
      setStrengthOpen(false);
      history.push({ ...edit, look: look.id, strength: 12 });
      setNotice(saved ? `imported "${look.name}"` : `imported "${look.name}" for this visit (storage is full)`);
    } catch (err) {
      setNotice((err as Error).message || "couldn't read that LUT file");
    }
    setTimeout(() => setNotice(null), 3200);
  };

  const removeLut = (id: string) => {
    if (!window.confirm("remove this imported LUT?")) return;
    removeImportedLut(id);
    setLookVersion((v) => v + 1);
    history.push({ ...edit, look: NO_LOOK });
  };

  const saveAsPreset = () => {
    const name = window.prompt("name this preset", `My look ${custom.length + 1}`)?.trim();
    if (!name) return;
    const look = getLook(edit.look);
    const p: Preset = {
      id: `custom-${Date.now()}`,
      name,
      goodFor: "saved on this device",
      category: "Mine",
      intensity: 100,
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
  // Imported LUTs also show up as presets under "Mine".
  const lutPresets: Preset[] = LOOKS.filter((l) => l.lut).map((l) => ({
    id: `lut:${l.id}`,
    name: l.name,
    goodFor: "your imported LUT",
    category: "Mine",
    intensity: 100,
    code: l.code,
    edit: { ...DEFAULT_EDIT, look: l.id },
  }));
  const allPresets = [...PRESETS, ...custom, ...lutPresets];
  const shownPresets = allPresets.filter((p) =>
    category === "All" ? true : category === "Favourites" ? favs.includes(p.id) : p.category === category,
  );
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
        <div className="ch-top-left">
          <button className="ch-icon-btn" onClick={leave} aria-label="Back">
            <Icon name="back" />
          </button>
          <span className="ch-top-mark" aria-label="Chhaya">
            Chhaya<span className="ch-top-dot" aria-hidden="true" />
          </span>
        </div>
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
              history.push({ ...DEFAULT_EDIT, frame: photo.strip > 1 ? { ...DEFAULT_EDIT.frame, kind: "grid", grid: edit.frame.grid } : DEFAULT_EDIT.frame });
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
              {preset ? (
                <div className="ch-control" key={preset.id}>
                  <div className="ch-control-head">
                    <span className="ch-control-name">{preset.name}</span>
                    <span className="ch-head-actions">
                      <button
                        className={`ch-icon-btn ch-icon-sm${favs.includes(preset.id) ? " is-fav" : ""}`}
                        aria-label={favs.includes(preset.id) ? "Remove from favourites" : "Add to favourites"}
                        aria-pressed={favs.includes(preset.id)}
                        onClick={() => toggleFav(preset.id)}
                      >
                        <Icon name="star" size={18} />
                      </button>
                    </span>
                  </div>
                  <span className="ch-label ch-faint ch-preset-meta">
                    {preset.category} · {preset.goodFor}
                  </span>
                  <HairlineSlider
                    label={`${preset.name} intensity`}
                    value={intensity}
                    min={0}
                    max={100}
                    step={1}
                    defaultValue={preset.intensity}
                    decimals={0}
                    signed={false}
                    onChange={(v) => applyPreset(preset, v, true)}
                  />
                </div>
              ) : (
                <div className="ch-control ch-control-quiet" key="none">
                  <span className="ch-control-name">Presets</span>
                  <span className="ch-label ch-faint">{allPresets.length} presets · a look, adjustments and a frame in one tap</span>
                </div>
              )}
            </div>
            <Chips
              label="Preset category"
              value={category}
              options={(["All", "Favourites", ...CATEGORIES, "Mine"] as const).map((c) => ({
                value: c,
                label: c === "Favourites" ? `★ ${favs.length || ""}`.trim() : c,
              }))}
              onChange={setCategory}
            />
            <div className="ch-looks" role="listbox" aria-label="Presets">
              <button className="ch-look" onClick={saveAsPreset} aria-label="Save current edit as a preset">
                <span className="ch-look-thumb ch-look-add">
                  <Icon name="plus" />
                </span>
                <span className="ch-look-code">Save</span>
              </button>
              {shownPresets.length === 0 && (
                <p className="ch-label ch-faint ch-empty">
                  {category === "Favourites" ? "tap ★ on a preset to keep it here" : "nothing here yet"}
                </p>
              )}
              {shownPresets.map((p) => {
                const on = p.id === presetId;
                return (
                  <button
                    key={p.id}
                    role="option"
                    aria-selected={on}
                    aria-label={`${p.name}, good for ${p.goodFor}${p.custom ? ". Tap again to delete" : ""}`}
                    className={`ch-look ch-preset${on ? " is-on" : ""}`}
                    onClick={() => (on && p.custom ? deletePreset(p) : on ? undefined : applyPreset(p))}
                  >
                    <span
                      className="ch-look-thumb"
                      style={thumbs[`preset:${p.id}`] ? { backgroundImage: `url(${thumbs[`preset:${p.id}`]})` } : undefined}
                    >
                      {p.edit.ascii.enabled && <span className="ch-thumb-badge">ASCII</span>}
                      {favs.includes(p.id) && <span className="ch-thumb-star" aria-hidden="true">★</span>}
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
                    {look.lut ? (
                      <button className="ch-text-btn ch-remove" onClick={() => removeLut(look.id)}>
                        remove LUT
                      </button>
                    ) : (
                      <span className="ch-label ch-faint">inspired by {look.inspiredBy}</span>
                    )}
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
                    {notice ??
                      (look
                        ? `${look.family} · ${look.character.toLowerCase()} · tap again for strength`
                        : `${LOOKS.length} looks · pick one, or import a .cube / HaldCLUT LUT`)}
                  </span>
                </div>
              )}
            </div>
            <div className="ch-looks" role="listbox" aria-label="Film looks">
              <UploadButton className="ch-look" onFile={onImportLut} ariaLabel="Import a LUT (.cube or HaldCLUT .png)" accept=".cube,.png,image/png">
                <span className="ch-look-thumb ch-look-add">
                  <Icon name="plus" />
                </span>
                <span className="ch-look-code">LUT</span>
              </UploadButton>
              {strip.map((id, i) => {
                const l = getLook(id);
                const prev = i > 0 ? getLook(strip[i - 1]) : undefined;
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
