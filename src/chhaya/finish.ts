import { drawGrid, gridSize, toGrid, type AsciiGrid } from "./ascii";
import type { Edit } from "./edit";
import { compose, type Composed } from "./frames";

export type Meta = { strip: number; takenAt: Date };

let asciiCanvas: HTMLCanvasElement | null = null;

/**
 * After the GPU pass: ASCII (if on), then the print frame.
 * `asciiWidth` sets how wide the ASCII image is drawn (preview size or export size).
 */
export function finish(
  graded: CanvasImageSource,
  w: number,
  h: number,
  edit: Edit,
  meta: Meta,
  opts: { asciiWidth?: number; target?: HTMLCanvasElement } = {},
): Composed & { grid: AsciiGrid | null } {
  let img: CanvasImageSource = graded;
  let iw = w;
  let ih = h;
  let grid: AsciiGrid | null = null;

  if (edit.ascii.enabled) {
    grid = toGrid(graded, w, h, edit.ascii);
    const size = gridSize(grid, opts.asciiWidth ?? w);
    const c = opts.target && edit.frame.kind === "none" ? opts.target : (asciiCanvas ??= document.createElement("canvas"));
    c.width = size.width;
    c.height = size.height;
    drawGrid(c.getContext("2d")!, grid, edit.ascii, size.width, size.height);
    img = c;
    iw = size.width;
    ih = size.height;
  }

  return { ...compose(img, iw, ih, edit.frame, meta), grid };
}
