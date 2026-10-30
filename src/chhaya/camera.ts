export type Facing = "user" | "environment";

export type Photo = {
  /** The unedited pixels. Edits are always re-applied from this. */
  bitmap: ImageBitmap;
  width: number;
  height: number;
  name: string;
  takenAt: Date;
};

/** Camera captures are cropped to 4:5, a good fit for phones and posting. */
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

/** Grabs the current video frame as the 4:5 crop the viewfinder shows. */
export async function captureFrame(video: HTMLVideoElement, mirror: boolean): Promise<Photo> {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  let sw = vw;
  let sh = vh;
  if (vw / vh > CAPTURE_ASPECT) sw = Math.round(vh * CAPTURE_ASPECT);
  else sh = Math.round(vw / CAPTURE_ASPECT);
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
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);
  const bitmap = await createImageBitmap(c);
  const takenAt = new Date();
  return { bitmap, width: sw, height: sh, name: fileStamp(takenAt), takenAt };
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
  };
}

function fileStamp(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `chhaya-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
