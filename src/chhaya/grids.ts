/**
 * Photo booth grids: how many shots, how they're arranged, and the card around
 * them. Used by the camera (Grid picker), the Print tab and the print compositor,
 * so a layout only has to be described once.
 *
 * pad, gap and foot are fractions of one cell's width.
 */

export type GridLayout = {
  id: string;
  label: string;
  shots: number;
  cols: number;
  rows: number;
  /** Width ÷ height of one cell. Strip shots are captured at this aspect. */
  aspect: number;
  pad: number;
  gap: number;
  /** Extra space under the photos for the caption and the Chhaya mark. */
  foot: number;
};

export const GRIDS: GridLayout[] = [
  { id: "2-side", label: "2 photos", shots: 2, cols: 2, rows: 1, aspect: 0.8, pad: 0.1, gap: 0.06, foot: 0.36 },
  { id: "2-strip", label: "2 photos", shots: 2, cols: 1, rows: 2, aspect: 0.8, pad: 0.08, gap: 0.04, foot: 0.24 },
  { id: "3-strip", label: "3 photos", shots: 3, cols: 1, rows: 3, aspect: 1.3, pad: 0.08, gap: 0.05, foot: 0.22 },
  { id: "3-strip-foot", label: "3 photos", shots: 3, cols: 1, rows: 3, aspect: 1.15, pad: 0.03, gap: 0.03, foot: 0.55 },
  { id: "4-strip-wide", label: "4 photos", shots: 4, cols: 1, rows: 4, aspect: 1.4, pad: 0.12, gap: 0.1, foot: 0.3 },
  { id: "4-strip", label: "4 photos", shots: 4, cols: 1, rows: 4, aspect: 4 / 3, pad: 0.07, gap: 0.04, foot: 0.32 },
  { id: "4-strip-tight", label: "4 photos", shots: 4, cols: 1, rows: 4, aspect: 1.2, pad: 0, gap: 0.03, foot: 0 },
  { id: "4-strip-thin", label: "4 photos", shots: 4, cols: 1, rows: 4, aspect: 1.15, pad: 0.06, gap: 0.06, foot: 0.06 },
  { id: "2x2", label: "4 photos", shots: 4, cols: 2, rows: 2, aspect: 0.8, pad: 0.1, gap: 0.08, foot: 0.45 },
  { id: "2x2-tight", label: "4 photos", shots: 4, cols: 2, rows: 2, aspect: 0.8, pad: 0, gap: 0.02, foot: 0 },
  { id: "2x2-thin", label: "4 photos", shots: 4, cols: 2, rows: 2, aspect: 0.8, pad: 0.05, gap: 0.04, foot: 0.05 },
  { id: "3x2", label: "6 photos", shots: 6, cols: 2, rows: 3, aspect: 1, pad: 0.08, gap: 0.05, foot: 0.3 },
];

/** The classic 4-shot strip, used when nothing else is chosen. */
export const DEFAULT_GRID = "4-strip";

export function getGrid(id: string | undefined): GridLayout {
  return GRIDS.find((g) => g.id === id) ?? GRIDS.find((g) => g.id === DEFAULT_GRID)!;
}

type Rect = { x: number; y: number; w: number; h: number };

/** Card size, cell rectangles and the footer area for a cell width. */
export function gridGeometry(g: GridLayout, cellW: number) {
  const cellH = cellW / g.aspect;
  const pad = g.pad * cellW;
  const gap = g.gap * cellW;
  const foot = Math.max(g.foot, g.pad) * cellW;
  const w = 2 * pad + g.cols * cellW + (g.cols - 1) * gap;
  const photosH = g.rows * cellH + (g.rows - 1) * gap;
  const h = pad + photosH + foot;
  const cells: Rect[] = [];
  for (let r = 0; r < g.rows; r++) {
    for (let c = 0; c < g.cols; c++) {
      cells.push({ x: pad + c * (cellW + gap), y: pad + r * (cellH + gap), w: cellW, h: cellH });
    }
  }
  return { w, h, cells, foot: { x: 0, y: pad + photosH, w, h: foot }, photos: { x: pad, y: pad, w: w - 2 * pad, h: photosH } };
}
