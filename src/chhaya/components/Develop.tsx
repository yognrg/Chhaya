"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Photo } from "../camera";
import { DEFAULT_EDIT, type Edit, isEdited, isToolEdited, TOOLS, type ToolKey } from "../edit";
import { deliver, type Format, renderFull } from "../export";
import { coverCrop, Renderer } from "../gl/renderer";
import { getLook, LOOKS, NO_LOOK } from "../looks";
import { useHistory } from "../useHistory";
import { HairlineSlider } from "./HairlineSlider";
import { Icon, type IconName } from "./Icon";

type Props = {
  photo: Photo;
  initialLook: string;
  onBack: () => void;
};

type Tab = "looks" | "adjust";
type SaveState = "idle" | "menu" | "working" | "done" | "error";

const THUMB = 120;
const STRIP = [NO_LOOK, ...LOOKS.map((l) => l.id)];

export function Develop({ photo, initialLook, onBack }: Props) {
  const history = useHistory<Edit>({ ...DEFAULT_EDIT, look: initialLook });
  const edit = history.value;

  const [tab, setTab] = useState<Tab>("looks");
  const [tool, setTool] = useState<ToolKey | null>(null);
  const [strengthOpen, setStrengthOpen] = useState(false);
  const [compare, setCompare] = useState(false);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [save, setSave] = useState<SaveState>("idle");
  const [savedOnce, setSavedOnce] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const [fit, setFit] = useState<{ w: number; h: number } | null>(null);

  // Fit the photo inside the stage.
  useLayoutEffect(() => {
    const stage = stageRef.current!;
    const measure = () => {
      const cs = getComputedStyle(stage);
      const sw = stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const sh = stage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      const a = photo.width / photo.height;
      const w = Math.min(sw, sh * a);
      setFit({ w: Math.floor(w), h: Math.floor(w / a) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(stage);
    return () => ro.disconnect();
  }, [photo]);

  // One renderer per photo for the preview.
  useEffect(() => {
    const r = new Renderer(canvasRef.current!);
    r.setSource(photo.bitmap, photo.width, photo.height);
    rendererRef.current = r;
    return () => {
      r.dispose();
      rendererRef.current = null;
    };
  }, [photo]);

  // Re-render whenever the edit, the compare state or the size changes.
  useEffect(() => {
    const r = rendererRef.current;
    if (!r || !fit) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const scale = Math.min(1, photo.width / (fit.w * dpr));
    r.setSize(fit.w * dpr * scale, fit.h * dpr * scale);
    r.render({ edit, bypass: compare, grainSeed: 0 });
  }, [edit, compare, fit, photo]);

  // Look thumbnails, rendered once per photo by the same pipeline.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const side = Math.min(photo.width, photo.height);
      const small = await createImageBitmap(photo.bitmap, {
        resizeWidth: Math.round((photo.width / side) * THUMB * 2),
        resizeHeight: Math.round((photo.height / side) * THUMB * 2),
        resizeQuality: "medium",
      });
      const canvas = document.createElement("canvas");
      const r = new Renderer(canvas, { preserve: true });
      r.setSize(THUMB, THUMB);
      r.setSource(small, small.width, small.height);
      const crop = coverCrop(small.width, small.height, 1, 1);
      const out: Record<string, string> = {};
      for (const id of STRIP) {
        r.render({ edit: { ...DEFAULT_EDIT, look: id }, crop });
        out[id] = canvas.toDataURL("image/jpeg", 0.82);
      }
      r.dispose();
      small.close();
      if (!cancelled) setThumbs(out);
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [photo]);

  const pickLook = (id: string) => {
    if (id === edit.look && id !== NO_LOOK) {
      setStrengthOpen((o) => !o);
      return;
    }
    setStrengthOpen(false);
    history.push({ ...edit, look: id, strength: 12 });
  };

  const doSave = async (format: Format) => {
    setSave("working");
    try {
      const blob = await renderFull(photo, edit, format);
      await deliver(blob, `${photo.name}.${format}`);
      setSave("done");
      setSavedOnce(true);
      setTimeout(() => setSave((s) => (s === "done" ? "idle" : s)), 1600);
    } catch (err) {
      setSave((err as DOMException)?.name === "AbortError" ? "idle" : "error");
    }
  };

  const leave = useCallback(() => {
    if (isEdited(history.value) && !savedOnce && !window.confirm("leave this photo? it isn't saved yet.")) return;
    onBack();
  }, [history.value, savedOnce, onBack]);

  // Keyboard: undo/redo, and backslash to compare like desktop editors.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
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
        else if (tool) setTool(null);
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
  }, [history, save, strengthOpen, tool]);

  const look = getLook(edit.look);
  const activeTool = TOOLS.find((t) => t.key === tool);

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
            onClick={() => history.push({ ...DEFAULT_EDIT })}
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
            </div>
          )}
          {save === "error" && <p className="ch-save-error" role="alert">couldn't save. try again.</p>}
        </div>
      </header>

      <div className="ch-stage" ref={stageRef}>
        <canvas
          ref={canvasRef}
          className="ch-photo"
          style={fit ? { width: fit.w, height: fit.h } : undefined}
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
        <p className={`ch-label ch-compare-hint${compare ? " is-on" : ""}`}>{compare ? "original" : "hold to compare"}</p>
      </div>

      <section className="ch-panel" aria-label="Edit">
        <div className="ch-panel-control">
          {tab === "looks" && strengthOpen && look && (
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
          )}
          {tab === "looks" && !strengthOpen && (
            <div className="ch-control ch-control-quiet">
              <span className="ch-control-name">{look?.name ?? "Original"}</span>
              <span className="ch-label ch-faint">
                {look ? `inspired by ${look.inspiredBy} · tap again for strength` : "pick a look"}
              </span>
            </div>
          )}
          {tab === "adjust" && activeTool && (
            <div className="ch-control">
              <div className="ch-control-head">
                <span className="ch-label">{activeTool.label}</span>
              </div>
              <HairlineSlider
                label={activeTool.label}
                value={edit[activeTool.key]}
                min={activeTool.min}
                max={activeTool.max}
                step={activeTool.step}
                defaultValue={DEFAULT_EDIT[activeTool.key]}
                decimals={activeTool.decimals}
                signed={activeTool.min < 0}
                onChange={(v) => history.set({ ...edit, [activeTool.key]: v })}
              />
            </div>
          )}
          {tab === "adjust" && !activeTool && (
            <div className="ch-control ch-control-quiet">
              <span className="ch-label ch-faint">pick a tool · double-tap a slider to reset</span>
            </div>
          )}
        </div>

        {tab === "looks" ? (
          <div className="ch-looks" role="listbox" aria-label="Film looks">
            {STRIP.map((id) => {
              const l = getLook(id);
              const on = id === edit.look;
              return (
                <button
                  key={id}
                  role="option"
                  aria-selected={on}
                  aria-label={l ? `${l.code}, ${l.name}` : "Original, no look"}
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
              );
            })}
          </div>
        ) : (
          <div className="ch-tools" role="toolbar" aria-label="Adjustments">
            {TOOLS.map((t) => (
              <button
                key={t.key}
                className={`ch-tool${tool === t.key ? " is-on" : ""}`}
                onClick={() => setTool((k) => (k === t.key ? null : t.key))}
                aria-pressed={tool === t.key}
                aria-label={`${t.label}${isToolEdited(edit, t.key) ? ", edited" : ""}`}
              >
                <Icon name={t.key as IconName} />
                <span className="ch-tool-label">{t.short}</span>
                {isToolEdited(edit, t.key) && <span className="ch-dot" aria-hidden="true" />}
              </button>
            ))}
          </div>
        )}

        <nav className="ch-tabs" role="tablist" aria-label="Edit mode">
          {(["looks", "adjust"] as Tab[]).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              className={`ch-tab${tab === t ? " is-on" : ""}`}
              onClick={() => setTab(t)}
            >
              {t === "looks" ? "Looks" : "Adjust"}
              {t === "looks" && edit.look !== NO_LOOK && <span className="ch-dot" aria-hidden="true" />}
              {t === "adjust" && TOOLS.some((x) => isToolEdited(edit, x.key)) && <span className="ch-dot" aria-hidden="true" />}
            </button>
          ))}
        </nav>
      </section>
    </div>
  );
}
