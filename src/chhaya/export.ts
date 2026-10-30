import { gridToHtml, gridToText } from "./ascii";
import type { Photo } from "./camera";
import type { Edit } from "./edit";
import { finish } from "./finish";
import { layout } from "./geometry";
import { Renderer } from "./gl/renderer";

export type Format = "png" | "jpg" | "txt" | "html";

/** Renders the edit at full size with the same pipeline as the preview. */
export async function renderFull(photo: Photo, edit: Edit, format: Format): Promise<Blob> {
  const canvas = document.createElement("canvas");
  const r = new Renderer(canvas, { preserve: true });
  try {
    const lay = layout(photo.width, photo.height, edit.geometry);
    r.setSize(lay.width, lay.height);
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
    const blob = await new Promise<Blob | null>((res) => out.canvas.toBlob(res, type, 0.94));
    if (!blob) throw new Error("export-failed");
    return blob;
  } finally {
    r.dispose();
  }
}

/** Share sheet on phones, a plain download everywhere else. */
export async function deliver(blob: Blob, filename: string): Promise<"shared" | "saved"> {
  const file = new File([blob], filename, { type: blob.type });
  const coarse = matchMedia("(pointer: coarse)").matches;
  if (coarse && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return "shared";
    } catch (err) {
      if ((err as DOMException).name === "AbortError") throw err;
      // Fall through to a download.
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return "saved";
}
