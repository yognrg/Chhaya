"use client";

import { type ReactNode, useRef } from "react";

type Props = {
  onFile: (file: File) => void;
  className?: string;
  ariaLabel?: string;
  children: ReactNode;
};

export function UploadButton({ onFile, className, ariaLabel, children }: Props) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" className={className} aria-label={ariaLabel} onClick={() => input.current?.click()}>
        {children}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) onFile(f);
        }}
      />
    </>
  );
}
