"use client";

import { UploadButton } from "./UploadButton";

type Props = {
  onStart: () => void;
  onUpload: (file: File) => void;
};

export function Intro({ onStart, onUpload }: Props) {
  return (
    <div className="ch-screen ch-night ch-intro">
      <div className="ch-intro-mark">
        <span className="ch-glyph" lang="mr" aria-hidden="true">छ</span>
        <h1 className="ch-wordmark">
          Chhaya<span className="ch-dot-stop">.</span>
        </h1>
        <p className="ch-tagline">a film camera for moments</p>
      </div>

      <div className="ch-intro-actions">
        <button className="ch-pill ch-pill-light" onClick={onStart}>
          start camera
        </button>
        <UploadButton className="ch-text-btn" onFile={onUpload}>
          or upload a photo
        </UploadButton>
        <p className="ch-fineprint">
          chhaya asks for your camera only to take photos.
          <br />
          everything happens on this device. nothing is uploaded.
        </p>
      </div>
    </div>
  );
}
