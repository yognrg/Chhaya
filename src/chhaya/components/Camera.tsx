"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { drawGrid, gridSize, toGrid } from "../ascii";
import {
  CAPTURE_ASPECT,
  captureFrame,
  capturePhoto,
  type Facing,
  type Photo,
  stackStrip,
  startCamera,
  stopCamera,
} from "../camera";
import { getGrid, GRIDS } from "../grids";
import { DEFAULT_ASCII, DEFAULT_EDIT } from "../edit";
import { cropMatrix } from "../geometry";
import { coverCrop, Renderer } from "../gl/renderer";
import { getLook, LOOKS, NO_LOOK } from "../looks";
import { GridTile } from "./GridTile";
import { Icon } from "./Icon";
import { UploadButton } from "./UploadButton";

const TIMERS = [0, 3, 5, 10] as const;

/** Screen ring-light colours: warm, skin-flattering tones first, then fun ones. */
export const GLOWS: { id: string; label: string; color: string }[] = [
  { id: "warm-white", label: "Warm white", color: "#FFE9D2" },
  { id: "peach", label: "Peach", color: "#FFC9A3" },
  { id: "golden", label: "Golden hour", color: "#FFD27A" },
  { id: "rose", label: "Rose", color: "#F7A8B8" },
  { id: "blush", label: "Blush", color: "#F9D3DC" },
  { id: "soft-white", label: "Soft white", color: "#FFF8F0" },
  { id: "cool-white", label: "Cool white", color: "#EAF2FF" },
  { id: "lavender", label: "Lavender", color: "#A99CF5" },
  { id: "violet", label: "Violet", color: "#D17AF0" },
  { id: "pink", label: "Pink", color: "#F08AA0" },
  { id: "sky", label: "Sky", color: "#9ED8F7" },
  { id: "blue", label: "Blue", color: "#4A90F0" },
  { id: "mint", label: "Mint", color: "#A8EBC8" },
  { id: "yellow", label: "Yellow", color: "#F9E05A" },
  { id: "orange", label: "Orange", color: "#F2A93B" },
];

type Panel = "grid" | "filter" | "light" | "timer" | null;

const hexRgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
/** The night background blended towards the light colour by `level` (0 … 1). */
function glowBackground(color: string, level: number) {
  const night = [15, 15, 14];
  const c = hexRgb(color);
  const mix = c.map((v, i) => Math.round(night[i] + (v - night[i]) * level));
  const lum = (0.2126 * mix[0] + 0.7152 * mix[1] + 0.0722 * mix[2]) / 255;
  return { bg: `rgb(${mix.join(",")})`, light: lum > 0.55 };
}
/** Live ASCII uses fewer columns than the editor so it stays smooth on phones. */
const LIVE_ASCII = { ...DEFAULT_ASCII, enabled: true, cols: 72 };

export type CameraMode = "photo" | "strip" | "ascii";
const MODES: { id: CameraMode; label: string }[] = [
  { id: "photo", label: "Photo" },
  { id: "strip", label: "Strip" },
  { id: "ascii", label: "ASCII" },
];

type Props = {
  look: string;
  mode: CameraMode;
  onModeChange: (m: CameraMode) => void;
  onLookChange: (id: string) => void;
  onCapture: (photo: Photo, mode: CameraMode, grid: string) => void;
  grid: string;
  onGridChange: (id: string) => void;
  onUpload: (file: File) => void;
  onClose: () => void;
};

type CamError = "blocked" | "missing" | "webgl" | null;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function thumb(p: Photo) {
  const c = document.createElement("canvas");
  c.width = 96;
  c.height = Math.round(96 / (p.width / p.height));
  c.getContext("2d")!.drawImage(p.bitmap, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.7);
}

export function Camera({ look, mode, onModeChange, onLookChange, onCapture, onUpload, onClose, grid, onGridChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const asciiRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const lookRef = useRef(look);
  lookRef.current = look;
  const modeRef = useRef(mode);
  modeRef.current = mode;

  const [facing, setFacing] = useState<Facing>("environment");
  const [canFlip, setCanFlip] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<CamError>(null);
  const [timer, setTimer] = useState<(typeof TIMERS)[number]>(3);
  const [panel, setPanel] = useState<Panel>(null);
  const [glow, setGlow] = useState<string | null>(null);
  const [glowLevel, setGlowLevel] = useState(70);
  const [customGlow, setCustomGlow] = useState("#FFB38A");
  const [lookFamily, setLookFamily] = useState("All");
  const [count, setCount] = useState<number | null>(null);
  const [countFrom, setCountFrom] = useState(3);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(false);
  const [stripThumbs, setStripThumbs] = useState<string[]>([]);
  const run = useRef(0);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  /** Set once a stream is playing; the next frame drawn from it marks the camera ready. */
  const needReady = useRef(false);

  // Start (or restart, on flip) the camera.
  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    setReady(false);
    needReady.current = false;
    startCamera(facing)
      .then(async (s) => {
        if (cancelled) return stopCamera(s);
        stream = s;
        const v = videoRef.current!;
        v.srcObject = s;
        await v.play().catch(() => {});
        if (!cancelled) needReady.current = true;
        const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
        setCanFlip(devices.filter((d) => d.kind === "videoinput").length > 1);
        setError(null);
      })
      .catch((err: DOMException) => {
        if (cancelled) return;
        setError(err?.name === "NotAllowedError" || err?.name === "SecurityError" ? "blocked" : "missing");
      });
    return () => {
      cancelled = true;
      stopCamera(stream);
    };
  }, [facing]);

  // Live viewfinder: every video frame goes through the same GPU pipeline as the export,
  // and in ASCII mode through the same character engine too.
  useEffect(() => {
    const canvas = canvasRef.current!;
    const video = videoRef.current!;
    let r: Renderer;
    try {
      r = new Renderer(canvas);
    } catch {
      setError("webgl");
      return;
    }
    let raf = 0;
    let frame = 0;
    let lastAscii = 0;
    const draw = (t: number) => {
      raf = requestAnimationFrame(draw);
      if (video.readyState < 2 || !video.videoWidth) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      try {
        r.setSize(canvas.clientWidth * dpr, canvas.clientHeight * dpr);
        r.setSource(video, video.videoWidth, video.videoHeight);
        const crop = coverCrop(video.videoWidth, video.videoHeight, canvas.width, canvas.height);
        r.render({
          edit: { ...DEFAULT_EDIT, look: lookRef.current },
          matrix: cropMatrix(crop, video.dataset.mirror === "1"),
          span: video.videoWidth * crop.w,
          grainSeed: frame++,
        });
      } catch {
        // iOS Safari can fail on a frame while the stream warms up; try the next one.
        return;
      }
      if (needReady.current) {
        needReady.current = false;
        setReady(true);
      }
      // ASCII at ~24fps, read straight from the frame just drawn.
      const ac = asciiRef.current;
      if (modeRef.current === "ascii" && ac && t - lastAscii > 40) {
        lastAscii = t;
        const grid = toGrid(canvas, canvas.width, canvas.height, LIVE_ASCII);
        const size = gridSize(grid, canvas.width);
        if (ac.width !== size.width || ac.height !== size.height) {
          ac.width = size.width;
          ac.height = size.height;
        }
        drawGrid(ac.getContext("2d")!, grid, LIVE_ASCII, size.width, size.height);
      }
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      r.dispose();
    };
  }, []);

  // Mirror defaults to on for the front camera (like a mirror) and off for the back; either can be switched.
  const [mirror, setMirror] = useState(false);
  useEffect(() => setMirror(facing === "user"), [facing]);
  const layout = getGrid(grid);
  const shots = mode === "strip" ? layout.shots : 1;
  const aspect = mode === "strip" ? layout.aspect : CAPTURE_ASPECT;
  const glowColor = glow === "custom" ? customGlow : GLOWS.find((g) => g.id === glow)?.color;

  const grab = useCallback(
    async (still: boolean) => {
      const video = videoRef.current!;
      setFlash(true);
      // With a ring light on, the flash holds a little longer to light the face.
      setTimeout(() => setFlash(false), glowColor ? 220 : 80);
      navigator.vibrate?.(10);
      return still ? capturePhoto(video, mirror, aspect) : captureFrame(video, mirror, aspect);
    },
    [mirror, aspect, glowColor],
  );

  /** Counts down from n; resolves false if cancelled meanwhile. */
  const countdown = async (n: number, id: number) => {
    setCountFrom(n);
    for (let k = n; k > 0; k--) {
      if (run.current !== id) return false;
      setCount(k);
      await sleep(1000);
    }
    setCount(null);
    return run.current === id;
  };

  const cancel = () => {
    run.current++;
    setCount(null);
    setBusy(false);
    setStripThumbs([]);
  };

  const onShutter = async () => {
    if (!ready || error) return;
    if (busy) return cancel();
    const id = ++run.current;
    setBusy(true);
    setPanel(null);
    const m = modeRef.current;
    try {
      if (m === "strip") {
        const shots: Photo[] = [];
        setStripThumbs([]);
        const g = getGrid(grid);
        for (let i = 0; i < g.shots; i++) {
          // The timer before the first shot, then a short beat between the rest.
          const ok = await countdown(i === 0 ? timer : timer ? 2 : 1, id);
          if (!ok) return shots.forEach((s) => s.bitmap.close());
          const shot = await grab(false);
          shots.push(shot);
          setStripThumbs((t) => [...t, thumb(shot)]);
        }
        await sleep(350);
        if (run.current !== id) return shots.forEach((s) => s.bitmap.close());
        onCapture(await stackStrip(shots, g.aspect), "strip", g.id);
      } else {
        if (!(await countdown(timer, id))) return;
        onCapture(await grab(true), m, grid);
      }
    } finally {
      if (run.current === id) {
        setBusy(false);
        setStripThumbs([]);
      }
    }
  };

  useEffect(() => () => void run.current++, []);

  const stepLook = useCallback(
    (dir: number) => {
      // Read the list each time: imported LUTs can be added while the app is open.
      const all = [NO_LOOK, ...LOOKS.map((l) => l.id)];
      const i = all.indexOf(lookRef.current);
      const next = all[(i + dir + all.length) % all.length];
      onLookChange(next);
    },
    [onLookChange],
  );

  const pickMode = (m: CameraMode) => {
    if (busy) cancel();
    onModeChange(m);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "ArrowRight") stepLook(1);
      else if (e.key === "ArrowLeft") stepLook(-1);
      else if (e.key === " " || e.key === "Enter") {
        if (e.target === document.body) {
          e.preventDefault();
          void onShutter();
        }
      } else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const current = getLook(look);
  const glowBg = glowColor ? glowBackground(glowColor, glowLevel / 100) : null;
  const families = ["All", ...Array.from(new Set(LOOKS.map((l) => l.family)))];
  const shownLooks = [NO_LOOK, ...LOOKS.filter((l) => lookFamily === "All" || l.family === lookFamily).map((l) => l.id)];
  const togglePanel = (p: Panel) => setPanel((cur) => (cur === p ? null : p));

  return (
    <div
      className={`ch-screen ch-night ch-camera${glowBg ? " is-glow" : ""}${glowBg?.light ? " is-glow-light" : ""}`}
      style={glowBg ? { background: glowBg.bg } : undefined}
    >
      <video ref={videoRef} data-mirror={mirror ? "1" : "0"} playsInline muted className="ch-hidden-video" />

      <header className="ch-camera-top">
        <button className="ch-icon-btn" onClick={onClose} aria-label="Close camera">
          <Icon name="close" />
        </button>
        <div className="ch-look-title" key={look} aria-live="polite">
          <span className="ch-look-name">{current?.name ?? "Original"}</span>
          <span className="ch-label">{current?.code ?? "no look"}</span>
        </div>
        <div className="ch-top-actions">
        <button
          className={`ch-icon-btn${mirror ? " is-on" : ""}`}
          onClick={() => setMirror((m) => !m)}
          aria-label={mirror ? "Mirrored, tap for normal" : "Normal, tap to mirror"}
          aria-pressed={mirror}
          title={mirror ? "mirrored" : "normal"}
        >
          <Icon name="flipH" />
        </button>
        </div>
      </header>

      <div
        className="ch-viewfinder"
        onPointerDown={(e) => (swipe.current = { x: e.clientX, y: e.clientY })}
        onPointerUp={(e) => {
          const s = swipe.current;
          swipe.current = null;
          if (!s) return;
          const dx = e.clientX - s.x;
          if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(e.clientY - s.y)) stepLook(dx < 0 ? 1 : -1);
        }}
      >
        <div className="ch-frame" style={{ ["--frame-aspect" as string]: String(aspect) }}>
          <canvas ref={canvasRef} className="ch-viewfinder-canvas" aria-label="Viewfinder, swipe to change look" role="img" />
          {mode === "ascii" && <canvas ref={asciiRef} className="ch-viewfinder-canvas ch-ascii-live" aria-hidden="true" />}
          {!ready && !error && <p className="ch-viewfinder-msg">starting camera…</p>}
          {error && (
            <div className="ch-viewfinder-msg">
              <p>
                {error === "blocked" && "camera is blocked. allow it in your browser settings, or upload a photo."}
                {error === "missing" && "no camera? upload a photo."}
                {error === "webgl" && "this browser can't run the film pipeline (WebGL2 is off)."}
              </p>
              {error !== "webgl" && (
                <UploadButton className="ch-pill ch-pill-light" onFile={onUpload}>upload a photo</UploadButton>
              )}
            </div>
          )}
          {count !== null && (
            <div className="ch-countdown" key={`${count}-${stripThumbs.length}`} aria-live="assertive">
              {count}
            </div>
          )}
          {flash && <div className="ch-flash" style={glowColor ? { background: glowColor } : undefined} />}
        </div>
      </div>

      {mode === "strip" && (
        <div className="ch-strip-slots" aria-label={`${stripThumbs.length} of ${shots} shots`}>
          {Array.from({ length: shots }, (_, i) => (
            <span key={i} className={`ch-strip-slot${stripThumbs[i] ? " is-filled" : ""}`}>
              {stripThumbs[i] && <img src={stripThumbs[i]} alt="" />}
            </span>
          ))}
        </div>
      )}

      {panel && (
        <div className="ch-cam-panel" role="dialog" aria-label={panel}>
          <div className="ch-cam-panel-head">
            <span className="ch-cam-panel-title">
              {panel === "grid" ? "Grid" : panel === "filter" ? "Filter" : panel === "light" ? "Light" : "Timer"}
            </span>
            <button className="ch-icon-btn ch-icon-sm" onClick={() => setPanel(null)} aria-label="Close">
              <Icon name="close" size={18} />
            </button>
          </div>

          {panel === "grid" && (
            <div className="ch-cam-grids">
              <button
                className={`ch-cam-grid${mode !== "strip" ? " is-on" : ""}`}
                onClick={() => {
                  pickMode("photo");
                  setPanel(null);
                }}
              >
                <span className="ch-cam-grid-art ch-cam-grid-single" />
                <span>1 photo</span>
              </button>
              {GRIDS.map((g) => (
                <button
                  key={g.id}
                  className={`ch-cam-grid${mode === "strip" && grid === g.id ? " is-on" : ""}`}
                  aria-label={`${g.label}, layout ${g.id}`}
                  onClick={() => {
                    onGridChange(g.id);
                    pickMode("strip");
                    setPanel(null);
                  }}
                >
                  <span className="ch-cam-grid-art">
                    <GridTile grid={g} />
                  </span>
                  <span>{g.label}</span>
                </button>
              ))}
            </div>
          )}

          {panel === "filter" && (
            <>
              <div className="ch-chips ch-cam-chips" role="radiogroup" aria-label="Look family">
                {families.map((f) => (
                  <button key={f} role="radio" aria-checked={lookFamily === f} className={`ch-chip${lookFamily === f ? " is-on" : ""}`} onClick={() => setLookFamily(f)}>
                    {f}
                  </button>
                ))}
              </div>
              <div className="ch-cam-looks" role="listbox" aria-label="Looks">
                {shownLooks.map((id) => {
                  const l = getLook(id);
                  return (
                    <button
                      key={id}
                      role="option"
                      aria-selected={look === id}
                      className={`ch-cam-look${look === id ? " is-on" : ""}`}
                      onClick={() => onLookChange(id)}
                    >
                      <span
                        className="ch-cam-look-sw"
                        style={{ background: l ? `linear-gradient(135deg, ${l.swatch[0]} 0 50%, ${l.swatch[1]} 50%)` : "#3a3936" }}
                      />
                      <span className="ch-cam-look-code">{l?.code ?? "—"}</span>
                      <span className="ch-cam-look-name">{l?.name ?? "Original"}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {panel === "light" && (
            <>
              <div className="ch-glows" role="radiogroup" aria-label="Light colour">
                <button role="radio" aria-checked={!glow} aria-label="Light off" className={`ch-glow ch-glow-off${!glow ? " is-on" : ""}`} onClick={() => setGlow(null)}>
                  <Icon name="off" size={20} />
                </button>
                <label className={`ch-glow ch-glow-custom${glow === "custom" ? " is-on" : ""}`} aria-label="Pick any colour">
                  <input
                    type="color"
                    value={customGlow}
                    onChange={(e) => {
                      setCustomGlow(e.target.value);
                      setGlow("custom");
                    }}
                    onClick={() => setGlow("custom")}
                  />
                </label>
                {GLOWS.map((g) => (
                  <button
                    key={g.id}
                    role="radio"
                    aria-checked={glow === g.id}
                    aria-label={g.label}
                    title={g.label}
                    className={`ch-glow${glow === g.id ? " is-on" : ""}`}
                    style={{ background: g.color }}
                    onClick={() => setGlow(g.id)}
                  />
                ))}
              </div>
              <div className="ch-glow-level">
                <input
                  type="range"
                  min={10}
                  max={100}
                  value={glowLevel}
                  aria-label="Light brightness"
                  onChange={(e) => {
                    setGlowLevel(Number(e.target.value));
                    if (!glow) setGlow("warm-white");
                  }}
                  style={{ ["--fill" as string]: `${((glowLevel - 10) / 90) * 100}%` }}
                />
                <span>{glowLevel}%</span>
              </div>
              <p className="ch-cam-hint">the screen lights your face. warm tones flatter skin; turn your screen brightness up.</p>
            </>
          )}

          {panel === "timer" && (
            <div className="ch-timers" role="radiogroup" aria-label="Countdown">
              {TIMERS.map((t) => (
                <button
                  key={t}
                  role="radio"
                  aria-checked={timer === t}
                  className={`ch-timer-opt${timer === t ? " is-on" : ""}`}
                  onClick={() => {
                    setTimer(t);
                    setPanel(null);
                  }}
                >
                  <Icon name="timer" size={18} />
                  {t ? `${t}s` : "Off"}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="ch-cam-tools" role="toolbar" aria-label="Camera tools">
        <button className={`ch-cam-tool${panel === "grid" ? " is-open" : ""}${mode === "strip" ? " is-on" : ""}`} onClick={() => togglePanel("grid")} aria-expanded={panel === "grid"}>
          <Icon name="grid" />
          <span>{mode === "strip" ? `${layout.shots} photos` : "Grid"}</span>
        </button>
        <button className={`ch-cam-tool${panel === "filter" ? " is-open" : ""}${look !== NO_LOOK ? " is-on" : ""}`} onClick={() => togglePanel("filter")} aria-expanded={panel === "filter"}>
          <Icon name="hsl" />
          <span>{current?.code ?? "Filter"}</span>
        </button>
        <button className={`ch-cam-tool${panel === "light" ? " is-open" : ""}${glow ? " is-on" : ""}`} onClick={() => togglePanel("light")} aria-expanded={panel === "light"}>
          <Icon name="lamp" />
          <span>Light</span>
        </button>
        <button className={`ch-cam-tool${panel === "timer" ? " is-open" : ""}${timer ? " is-on" : ""}`} onClick={() => togglePanel("timer")} aria-expanded={panel === "timer"}>
          <Icon name="timer" />
          <span>{timer ? `${timer}s` : "Timer"}</span>
        </button>
      </div>

      <div className="ch-modes" role="tablist" aria-label="Mode">
        {MODES.map((m) => (
          <button
            key={m.id}
            className={`ch-mode${mode === m.id ? " is-active" : ""}`}
            role="tab"
            aria-selected={mode === m.id}
            onClick={() => pickMode(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>

      <footer className="ch-camera-bar">
        <UploadButton className="ch-icon-btn" onFile={onUpload} ariaLabel="Upload a photo">
          <Icon name="upload" size={22} />
        </UploadButton>
        <button
          className={`ch-shutter${count !== null ? " is-counting" : ""}${busy ? " is-busy" : ""}`}
          onClick={() => void onShutter()}
          disabled={!ready}
          aria-label={busy ? "Cancel" : mode === "strip" ? `Take ${shots} photos` : "Take photo"}
        >
          <svg className="ch-shutter-ring" viewBox="0 0 64 64" aria-hidden="true" key={`${count !== null}-${stripThumbs.length}`}>
            <circle cx="32" cy="32" r="30" style={{ animationDuration: `${countFrom * 1000}ms` }} />
          </svg>
          <span className="ch-shutter-core" />
        </button>
        <button className="ch-icon-btn" onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))} aria-label="Switch camera" disabled={!canFlip}>
          <Icon name="switchCam" size={24} />
        </button>
      </footer>
    </div>
  );
}
