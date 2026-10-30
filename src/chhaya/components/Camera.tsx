"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { captureFrame, type Facing, type Photo, startCamera, stopCamera } from "../camera";
import { DEFAULT_EDIT } from "../edit";
import { coverCrop, Renderer } from "../gl/renderer";
import { getLook, LOOKS, NO_LOOK } from "../looks";
import { Icon } from "./Icon";
import { UploadButton } from "./UploadButton";

const CAMERA_LOOKS = [NO_LOOK, ...LOOKS.map((l) => l.id)];
const COUNT_FROM = 3;

type Props = {
  look: string;
  onLookChange: (id: string) => void;
  onCapture: (photo: Photo) => void;
  onUpload: (file: File) => void;
  onClose: () => void;
};

type CamError = "blocked" | "missing" | "webgl" | null;

export function Camera({ look, onLookChange, onCapture, onUpload, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const lookRef = useRef(look);
  lookRef.current = look;

  const [facing, setFacing] = useState<Facing>("environment");
  const [canFlip, setCanFlip] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<CamError>(null);
  const [timer, setTimer] = useState(true);
  const [count, setCount] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);
  const countTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  // Live viewfinder: every video frame goes through the same GPU pipeline as the export.
  useEffect(() => {
    const canvas = canvasRef.current!;
    const video = videoRef.current!;
    try {
      rendererRef.current = new Renderer(canvas);
    } catch {
      setError("webgl");
      return;
    }
    const r = rendererRef.current;
    let raf = 0;
    let frame = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      if (video.readyState < 2 || !video.videoWidth) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      r.setSize(canvas.clientWidth * dpr, canvas.clientHeight * dpr);
      r.setSource(video, video.videoWidth, video.videoHeight);
      r.render({
        edit: { ...DEFAULT_EDIT, look: lookRef.current },
        crop: coverCrop(video.videoWidth, video.videoHeight, canvas.width, canvas.height),
        mirror: video.dataset.mirror === "1",
        grainSeed: frame++,
      });
      if (frame === 1) setReady(true);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      r.dispose();
      rendererRef.current = null;
    };
  }, []);

  const mirror = facing === "user";

  const shoot = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;
    setFlash(true);
    setTimeout(() => setFlash(false), 80);
    const photo = await captureFrame(video, mirror);
    onCapture(photo);
  }, [mirror, onCapture]);

  const cancelCount = () => {
    if (countTimer.current) clearTimeout(countTimer.current);
    countTimer.current = null;
    setCount(null);
  };

  const onShutter = () => {
    if (!ready) return;
    if (count !== null) return cancelCount();
    if (!timer) return void shoot();
    const tick = (n: number) => {
      setCount(n);
      countTimer.current = setTimeout(() => {
        if (n > 1) tick(n - 1);
        else {
          setCount(null);
          void shoot();
        }
      }, 1000);
    };
    tick(COUNT_FROM);
  };

  useEffect(() => () => cancelCount(), []);

  const stepLook = useCallback(
    (dir: number) => {
      const i = CAMERA_LOOKS.indexOf(lookRef.current);
      const next = CAMERA_LOOKS[(i + dir + CAMERA_LOOKS.length) % CAMERA_LOOKS.length];
      onLookChange(next);
    },
    [onLookChange],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "ArrowRight") stepLook(1);
      else if (e.key === "ArrowLeft") stepLook(-1);
      else if (e.key === " " || e.key === "Enter") {
        if (e.target === document.body) {
          e.preventDefault();
          onShutter();
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
        <div className="ch-frame">
          <canvas ref={canvasRef} className="ch-viewfinder-canvas" aria-label="Viewfinder, swipe to change look" role="img" />
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
            <div className="ch-countdown" key={count} aria-live="assertive">
              {count}
            </div>
          )}
          {flash && <div className="ch-flash" />}
        </div>
      </div>

      <div className="ch-modes" role="tablist" aria-label="Mode">
        <span className="ch-mode is-active" role="tab" aria-selected="true">Photo</span>
        <span className="ch-mode" role="tab" aria-selected="false" aria-disabled="true" title="coming soon">Strip</span>
        <span className="ch-mode" role="tab" aria-selected="false" aria-disabled="true" title="coming soon">ASCII</span>
      </div>

      <footer className="ch-camera-bar">
        <UploadButton className="ch-icon-btn" onFile={onUpload} ariaLabel="Upload a photo">
          <Icon name="upload" size={22} />
        </UploadButton>
        <button
          className={`ch-shutter${count !== null ? " is-counting" : ""}`}
          onClick={onShutter}
          disabled={!ready}
          aria-label={count !== null ? "Cancel countdown" : "Take photo"}
        >
          <svg className="ch-shutter-ring" viewBox="0 0 64 64" aria-hidden="true">
            <circle cx="32" cy="32" r="30" />
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
