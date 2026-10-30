"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { drawGrid, gridSize, toGrid } from "../ascii";
import {
  CAPTURE_ASPECT,
  captureFrame,
  type Facing,
  type Photo,
  STRIP_ASPECT,
  STRIP_SHOTS,
  stackStrip,
  startCamera,
  stopCamera,
} from "../camera";
import { DEFAULT_ASCII, DEFAULT_EDIT } from "../edit";
import { cropMatrix } from "../geometry";
import { coverCrop, Renderer } from "../gl/renderer";
import { getLook, LOOKS, NO_LOOK } from "../looks";
import { Icon } from "./Icon";
import { UploadButton } from "./UploadButton";

const CAMERA_LOOKS = [NO_LOOK, ...LOOKS.map((l) => l.id)];
const COUNT_FROM = 3;
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
  onCapture: (photo: Photo, mode: CameraMode) => void;
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

export function Camera({ look, mode, onModeChange, onLookChange, onCapture, onUpload, onClose }: Props) {
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
  const [timer, setTimer] = useState(true);
  const [count, setCount] = useState<number | null>(null);
  const [countFrom, setCountFrom] = useState(COUNT_FROM);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(false);
  const [stripThumbs, setStripThumbs] = useState<string[]>([]);
  const run = useRef(0);
  const swipe = useRef<{ x: number; y: number } | null>(null);

  // Start (or restart, on flip) the camera.
  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    setReady(false);
    startCamera(facing)
      .then(async (s) => {
        if (cancelled) return stopCamera(s);
        stream = s;
        const v = videoRef.current!;
        v.srcObject = s;
        await v.play().catch(() => {});
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
      r.setSize(canvas.clientWidth * dpr, canvas.clientHeight * dpr);
      r.setSource(video, video.videoWidth, video.videoHeight);
      const crop = coverCrop(video.videoWidth, video.videoHeight, canvas.width, canvas.height);
      r.render({
        edit: { ...DEFAULT_EDIT, look: lookRef.current },
        matrix: cropMatrix(crop, video.dataset.mirror === "1"),
        span: video.videoWidth * crop.w,
        grainSeed: frame++,
      });
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
      if (frame === 1) setReady(true);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      r.dispose();
    };
  }, []);

  const mirror = facing === "user";
  const aspect = mode === "strip" ? STRIP_ASPECT : CAPTURE_ASPECT;

  const grab = useCallback(async () => {
    const video = videoRef.current!;
    setFlash(true);
    setTimeout(() => setFlash(false), 80);
    navigator.vibrate?.(10);
    return captureFrame(video, mirror, aspect);
  }, [mirror, aspect]);

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
    const m = modeRef.current;
    try {
      if (m === "strip") {
        const shots: Photo[] = [];
        setStripThumbs([]);
        for (let i = 0; i < STRIP_SHOTS; i++) {
          const ok = await countdown(timer ? (i === 0 ? COUNT_FROM : 2) : i === 0 ? 0 : 1, id);
          if (!ok) return shots.forEach((s) => s.bitmap.close());
          const shot = await grab();
          shots.push(shot);
          setStripThumbs((t) => [...t, thumb(shot)]);
        }
        await sleep(350);
        if (run.current !== id) return shots.forEach((s) => s.bitmap.close());
        onCapture(await stackStrip(shots), "strip");
      } else {
        if (!(await countdown(timer ? COUNT_FROM : 0, id))) return;
        onCapture(await grab(), m);
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
      const i = CAMERA_LOOKS.indexOf(lookRef.current);
      const next = CAMERA_LOOKS[(i + dir + CAMERA_LOOKS.length) % CAMERA_LOOKS.length];
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

  return (
    <div className="ch-screen ch-night ch-camera">
      <video ref={videoRef} data-mirror={mirror ? "1" : "0"} playsInline muted className="ch-hidden-video" />

      <header className="ch-camera-top">
        <button className="ch-icon-btn" onClick={onClose} aria-label="Close camera">
          <Icon name="close" />
        </button>
        <div className="ch-look-title" key={look} aria-live="polite">
          <span className="ch-look-name">{current?.name ?? "Original"}</span>
          <span className="ch-label">{current?.code ?? "no look"}</span>
        </div>
        <button
          className={`ch-icon-btn${timer ? " is-on" : ""}`}
          onClick={() => setTimer((t) => !t)}
          aria-label={timer ? "Countdown on, 3 seconds" : "Countdown off"}
          aria-pressed={timer}
        >
          <Icon name="timer" />
          <span className="ch-icon-badge">{timer ? "3" : ""}</span>
        </button>
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
        <div className={`ch-frame${mode === "strip" ? " is-strip" : ""}`}>
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
          {flash && <div className="ch-flash" />}
        </div>
      </div>

      {mode === "strip" && (
        <div className="ch-strip-slots" aria-label={`${stripThumbs.length} of ${STRIP_SHOTS} shots`}>
          {Array.from({ length: STRIP_SHOTS }, (_, i) => (
            <span key={i} className={`ch-strip-slot${stripThumbs[i] ? " is-filled" : ""}`}>
              {stripThumbs[i] && <img src={stripThumbs[i]} alt="" />}
            </span>
          ))}
        </div>
      )}

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
          aria-label={busy ? "Cancel" : mode === "strip" ? "Take 4 photos" : "Take photo"}
        >
          <svg className="ch-shutter-ring" viewBox="0 0 64 64" aria-hidden="true" key={`${count !== null}-${stripThumbs.length}`}>
            <circle cx="32" cy="32" r="30" style={{ animationDuration: `${countFrom * 1000}ms` }} />
          </svg>
          <span className="ch-shutter-core" />
        </button>
        <button className="ch-icon-btn" onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))} aria-label="Switch camera" disabled={!canFlip}>
          <Icon name="flip" size={22} />
        </button>
      </footer>
    </div>
  );
}
