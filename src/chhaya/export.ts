import type { Photo } from "./camera";
import type { Edit } from "./edit";
import { Renderer } from "./gl/renderer";

export type Format = "png" | "jpg";

/** Renders the edit at full size with the same pipeline as the preview. */
export async function renderFull(photo: Photo, edit: Edit, format: Format): Promise<Blob> {
  const canvas = document.createElement("canvas");
  const r = new Renderer(canvas, { preserve: true });
  try {
    r.setSize(photo.width, photo.height);
    r.setSource(photo.bitmap, photo.width, photo.height);
    r.render({ edit, grainSeed: 0 });
    const type = format === "png" ? "image/png" : "image/jpeg";
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, type, 0.94));
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
