export type Facing = "user" | "environment";

export type Photo = {
  /** The unedited pixels. Edits are always re-applied from this. */
  bitmap: ImageBitmap;
  width: number;
  height: number;
  name: string;
  takenAt: Date;
  /** How many shots are stacked top to bottom (4 for a photo strip, else 1). */
  strip: number;
};

/** Photo and ASCII captures are 4:5 (good on phones and for posting). Grid shots use their layout's aspect. */
export const CAPTURE_ASPECT = 4 / 5;

export async function startCamera(facing: Facing): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error("no-camera");
  return navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: { ideal: facing },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    },
  });
}

export function stopCamera(stream: MediaStream | null) {
  stream?.getTracks().forEach((t) => t.stop());
}

/** Crops the centre of a source to `aspect`, mirroring if asked. */
async function cropToPhoto(src: CanvasImageSource, vw: number, vh: number, mirror: boolean, aspect: number): Promise<Photo> {
  let sw = vw;
  let sh = vh;
  if (vw / vh > aspect) sw = Math.round(vh * aspect);
  else sh = Math.round(vw / aspect);
  const sx = Math.round((vw - sw) / 2);
  const sy = Math.round((vh - sh) / 2);

  const c = document.createElement("canvas");
  c.width = sw;
  c.height = sh;
  const ctx = c.getContext("2d")!;
  if (mirror) {
    ctx.translate(sw, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(src, sx, sy, sw, sh, 0, 0, sw, sh);
  const bitmap = await createImageBitmap(c);
  const takenAt = new Date();
  return { bitmap, width: sw, height: sh, name: fileStamp(takenAt), takenAt, strip: 1 };
}

/** Grabs the current video frame as the crop the viewfinder shows. Fast; used for grid shots. */
export function captureFrame(video: HTMLVideoElement, mirror: boolean, aspect = CAPTURE_ASPECT): Promise<Photo> {
  return cropToPhoto(video, video.videoWidth, video.videoHeight, mirror, aspect);
}

type ImageCaptureLike = { takePhoto: () => Promise<Blob> };

/**
 * A full-resolution still from the camera sensor where the browser supports it
 * (Chrome on Android and desktop), usually several times the video's pixels.
 * Falls back to the video frame elsewhere (iOS Safari) or if it takes too long.
 */
export async function capturePhoto(video: HTMLVideoElement, mirror: boolean, aspect = CAPTURE_ASPECT): Promise<Photo> {
  // Take the video frame first: asking for a still can briefly disturb the live stream.
  const frame = await captureFrame(video, mirror, aspect);
  const track = (video.srcObject as MediaStream | null)?.getVideoTracks()[0];
  const IC = (globalThis as { ImageCapture?: new (t: MediaStreamTrack) => ImageCaptureLike }).ImageCapture;
  if (!track || !IC) return frame;
  try {
    const blob = await Promise.race([
      new IC(track).takePhoto(),
      new Promise<never>((_, no) => setTimeout(() => no(new Error("slow")), 2500)),
    ]);
    const bmp = await createImageBitmap(blob);
    const bigger = bmp.width * bmp.height > frame.width * frame.height * 1.2;
    // Many webcams re-meter when switching to photo mode and return a dark still
    // (worst with the screen light on). Only use the still if it's as bright as what we saw.
    const brightEnough = meanLuma(bmp) >= meanLuma(frame.bitmap) * 0.8;
    if (bigger && brightEnough) {
      const photo = await cropToPhoto(bmp, bmp.width, bmp.height, mirror, aspect);
      bmp.close();
      frame.bitmap.close();
      return photo;
    }
    bmp.close();
  } catch {
    // Not supported for this camera, or too slow: keep the video frame.
  }
  return frame;
}

/** Average brightness (0 … 1) of an image, from a small sample. */
function meanLuma(src: ImageBitmap): number {
  const c = document.createElement("canvas");
  c.width = 32;
  c.height = 32;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(src, 0, 0, 32, 32);
  const d = ctx.getImageData(0, 0, 32, 32).data;
  let sum = 0;
  for (let i = 0; i < d.length; i += 4) sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
  return sum / (d.length / 4) / 255;
}

/** Stacks grid shots into one tall image; the grid frame lays them out. */
export async function stackStrip(shots: Photo[], aspect: number): Promise<Photo> {
  const w = Math.min(...shots.map((s) => s.width));
  const h = Math.round(w / aspect);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h * shots.length;
  const ctx = c.getContext("2d")!;
  shots.forEach((s, i) => ctx.drawImage(s.bitmap, 0, i * h, w, h));
  shots.forEach((s) => s.bitmap.close());
  const bitmap = await createImageBitmap(c);
  return { ...shots[0], bitmap, width: w, height: c.height, strip: shots.length };
}

export async function photoFromFile(file: File): Promise<Photo> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const base = file.name.replace(/\.[^.]+$/, "") || "photo";
  return {
    bitmap,
    width: bitmap.width,
    height: bitmap.height,
    name: `chhaya-${base}`,
    takenAt: new Date(file.lastModified || Date.now()),
    strip: 1,
  };
}

function fileStamp(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `chhaya-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
