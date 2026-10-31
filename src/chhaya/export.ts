import { gridToHtml, gridToText } from "./ascii";
import type { Photo } from "./camera";
import type { Edit } from "./edit";
import { finish } from "./finish";
import { layout } from "./geometry";
import { Renderer } from "./gl/renderer";

export type Format = "png" | "jpg" | "txt" | "html";

const MIN_LONG_SIDE = 3000;

/** Renders the edit at full size with the same pipeline as the preview. */
export async function renderFull(photo: Photo, edit: Edit, format: Format): Promise<Blob> {
  // Phones run out of canvas memory on big prints and hand back an empty canvas or a
  // null blob. Rather than fail, try again smaller: still well above screen size.
  let lastErr: unknown;
  for (const minLong of [MIN_LONG_SIDE, 2048, 0]) {
    try {
      return await renderAt(photo, edit, format, minLong, minLong === 0 ? 0.5 : 1);
    } catch (err) {
      if ((err as Error)?.message === "ascii-off") throw err;
      lastErr = err;
    }
  }
  throw lastErr;
}

async function renderAt(photo: Photo, edit: Edit, format: Format, minLong: number, shrink: number): Promise<Blob> {
  const canvas = document.createElement("canvas");
  const r = new Renderer(canvas, { preserve: true });
  try {
    const lay = layout(photo.width, photo.height, edit.geometry);
    // Never save small: render at least 3000px on the long side (smoothly upsampled on
    // the GPU), so text, frames and the Chhaya mark are drawn sharp at that size and
    // stay crisp when zoomed. Grids are already tall, so they rarely need it.
    const scale = Math.max(1, minLong / Math.max(lay.width, lay.height)) * shrink;
    r.setSize(Math.max(1, Math.round(lay.width * scale)), Math.max(1, Math.round(lay.height * scale)));
    r.setSource(photo.bitmap, photo.width, photo.height);
    r.render({ edit, matrix: lay.matrix, span: lay.span, grainSeed: 0 });
    await document.fonts?.ready;
    // ASCII exports up to 4K wide; enough for crisp characters at any column count.
    const asciiWidth = Math.min(4096, Math.max(2048, canvas.width));
    const out = finish(canvas, canvas.width, canvas.height, edit, { strip: photo.strip, takenAt: photo.takenAt }, { asciiWidth });

    if (format === "txt" || format === "html") {
      if (!out.grid) throw new Error("ascii-off");
      const text = format === "txt" ? gridToText(out.grid) : gridToHtml(out.grid, edit.ascii);
      return new Blob([text], { type: format === "txt" ? "text/plain" : "text/html" });
    }
    const transparent = edit.ascii.enabled && edit.ascii.background === "transparent" && edit.frame.kind === "none";
    const type = format === "png" || transparent ? "image/png" : "image/jpeg";
    const blob = await new Promise<Blob | null>((res) => out.canvas.toBlob(res, type, 0.95));
    // An empty blob means the browser silently gave up on a canvas that was too big.
    if (!blob || blob.size < 1024) throw new Error("export-failed");
    return blob;
  } finally {
    r.dispose();
  }
}

/** What this browser can do with a saved file. Decided once per save. */
export type Device = {
  ios: boolean;
  android: boolean;
  /** Instagram, WhatsApp, Facebook, Snapchat, TikTok, LinkedIn, Line, Android WebViews… */
  inApp: boolean;
  /** navigator.share accepts this file (iOS, iPadOS, Android, Mac Safari, Windows Edge/Chrome). */
  canShare: boolean;
  /** Can put an image on the clipboard (desktop Chrome, Edge, Safari). */
  canCopy: boolean;
  touch: boolean;
};

export function detectDevice(file?: File): Device {
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac; touch points give it away.
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const android = /Android/.test(ua);
  const inApp =
    /FBAN|FBAV|FB_IAB|Instagram|WhatsApp|Snapchat|musical_ly|BytedanceWebview|TikTok|Twitter|LinkedInApp|Line\/|MicroMessenger|Pinterest/i.test(ua) ||
    (android && /; wv\)/.test(ua));
  let canShare = false;
  try {
    canShare = !!file && typeof navigator.share === "function" && !!navigator.canShare?.({ files: [file] });
  } catch {
    canShare = false;
  }
  const canCopy =
    !ios && !android && typeof ClipboardItem !== "undefined" && typeof navigator.clipboard?.write === "function";
  const touch = matchMedia("(pointer: coarse)").matches;
  return { ios, android, inApp, canShare, canCopy, touch };
}

export function fileFor(blob: Blob, filename: string) {
  return new File([blob], filename, { type: blob.type, lastModified: Date.now() });
}

/**
 * Opens the share sheet. Must be called straight from a tap: iOS and Android
 * refuse it once the tap's "user activation" has run out (about 1–5 seconds),
 * which is why saving is split into "develop" and then this tap.
 */
export async function shareFile(file: File): Promise<"shared" | "cancelled"> {
  try {
    await navigator.share({ files: [file] });
    return "shared";
  } catch (err) {
    if ((err as DOMException)?.name === "AbortError") return "cancelled";
    throw err;
  }
}

/**
 * A plain download. The object URL is kept for a minute: revoking it early
 * cancels big downloads in Safari and Firefox.
 */
export function downloadBlob(blob: Blob, filename: string, url?: string) {
  const href = url ?? URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.remove();
    if (!url) URL.revokeObjectURL(href);
  }, 60_000);
}

/** Copies an image to the clipboard. Browsers only accept PNG there. */
export async function copyImage(blob: Blob): Promise<boolean> {
  try {
    const png = blob.type === "image/png" ? blob : await toPng(blob);
    await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
    return true;
  } catch {
    return false;
  }
}

async function toPng(blob: Blob): Promise<Blob> {
  const bmp = await createImageBitmap(blob);
  const c = document.createElement("canvas");
  c.width = bmp.width;
  c.height = bmp.height;
  c.getContext("2d")!.drawImage(bmp, 0, 0);
  bmp.close();
  const png = await new Promise<Blob | null>((res) => c.toBlob(res, "image/png"));
  if (!png) throw new Error("png-failed");
  return png;
}

/** A data URL, for in-app browsers that can't long-press save a blob: URL. */
export function toDataUrl(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(blob);
  });
}
