"use client";

import { useEffect, useRef, useState } from "react";
import { copyImage, type Device, downloadBlob, shareFile, toDataUrl } from "../export";
import { Icon } from "./Icon";

export type Ready = {
  blob: Blob;
  file: File;
  name: string;
  url: string;
  device: Device;
  /** Desktop already started the download on its own. */
  autoSaved: boolean;
};

type Props = {
  ready: Ready;
  onClose: () => void;
  onSaved: () => void;
};

function size(bytes: number) {
  return bytes > 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1e3))} KB`;
}

/**
 * Shown once the photo is developed. Every button here is a fresh tap, which is
 * what iOS and Android need before they open the share sheet or a download.
 * The preview itself can always be pressed and held (or right-clicked) to save,
 * which also works inside Instagram, WhatsApp and other in-app browsers.
 */
export function SaveSheet({ ready, onClose, onSaved }: Props) {
  const { device: d, file, blob, name, url } = ready;
  const image = blob.type.startsWith("image/");
  const [note, setNote] = useState<string | null>(ready.autoSaved ? "saved to your Downloads folder." : null);
  const [preview, setPreview] = useState(url);
  const first = useRef<HTMLButtonElement>(null);

  // In-app browsers often can't long-press save a blob: URL, but can a data: URL.
  useEffect(() => {
    if (!d.inApp || !image) return;
    let live = true;
    toDataUrl(blob).then((u) => live && setPreview(u)).catch(() => {});
    return () => {
      live = false;
    };
  }, [blob, d.inApp, image]);

  useEffect(() => {
    first.current?.focus();
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);

  const share = async () => {
    try {
      const r = await shareFile(file);
      if (r === "shared") {
        onSaved();
        setNote(d.ios ? "done. find it in Photos (or wherever you sent it)." : "shared.");
      }
    } catch {
      // Share refused (old browser, or file too big for it): fall back to a download.
      download();
    }
  };

  const download = () => {
    downloadBlob(blob, name, url);
    onSaved();
    setNote(
      d.ios
        ? "saved to Files › Downloads. to put it in Photos, use Save to Photos instead."
        : d.android
          ? "saved to Downloads. it shows up in your Gallery too."
          : "saved to your Downloads folder.",
    );
  };

  const copy = async () => {
    const ok = await copyImage(blob);
    if (ok) onSaved();
    setNote(ok ? "copied. paste it anywhere." : "couldn't copy here. use Download instead.");
  };

  // The main button: the one that puts the photo where people expect it.
  // iPhone/iPad: the share sheet has "Save Image" (to Photos); a download goes to Files.
  // Android: a download lands in Downloads and the Gallery; the share sheet is second.
  // Desktop: a download; Mac Safari and Windows can also share.
  const shareFirst = d.canShare && (d.ios || (d.touch && !d.android));
  const shareLabel = d.ios && image ? "Save to Photos" : "Share…";
  const hold = d.touch ? "press and hold the photo to save it" : "or right-click the photo › Save image as…";

  return (
    <div className="ch-sheet-scrim" onClick={onClose}>
      <div
        className="ch-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ch-sheet-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ch-sheet-head">
          <span id="ch-sheet-title" className="ch-label">
            {ready.autoSaved ? "saved" : "ready to save"}
          </span>
          <button className="ch-icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>

        {d.inApp && (
          <p className="ch-sheet-warn" role="note">
            <Icon name="external" size={16} />
            <span>
              this app's browser can block saving. if nothing happens, {hold}, or open chhaya in{" "}
              {d.ios ? "Safari" : "Chrome"} from the ••• menu.
            </span>
          </p>
        )}

        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="ch-sheet-img" src={preview} alt={`your photo, ${name}`} />
        ) : (
          <div className="ch-sheet-file">
            <span className="ch-mono">{name}</span>
          </div>
        )}

        <p className="ch-sheet-meta ch-faint">
          {name} · {size(blob.size)}
        </p>

        <div className="ch-sheet-actions">
          {shareFirst ? (
            <>
              <button ref={first} className="ch-pill ch-pill-ink ch-sheet-main" onClick={share}>
                <Icon name="share" size={18} /> {shareLabel}
              </button>
              <button className="ch-pill ch-sheet-alt" onClick={download}>
                <Icon name="save" size={18} /> {d.ios ? "Save to Files" : "Download"}
              </button>
            </>
          ) : (
            <>
              <button ref={first} className="ch-pill ch-pill-ink ch-sheet-main" onClick={download}>
                <Icon name="save" size={18} /> {ready.autoSaved ? "Download again" : "Download"}
              </button>
              {d.canShare && (
                <button className="ch-pill ch-sheet-alt" onClick={share}>
                  <Icon name="share" size={18} /> Share…
                </button>
              )}
            </>
          )}
          {d.canCopy && image && (
            <button className="ch-pill ch-sheet-alt" onClick={copy}>
              <Icon name="copy" size={18} /> Copy image
            </button>
          )}
        </div>

        <p className="ch-sheet-note" aria-live="polite">
          {note ?? (image ? hold : "")}
        </p>
      </div>
    </div>
  );
}
