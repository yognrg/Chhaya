import { gridGeometry, type GridLayout } from "../grids";

/** A small drawing of a grid layout, drawn from the same geometry as the print. */
export function GridTile({ grid, dark = false }: { grid: GridLayout; dark?: boolean }) {
  const g = gridGeometry(grid, 10);
  return (
    <svg className="ch-grid-tile" viewBox={`0 0 ${g.w} ${g.h}`} aria-hidden="true" preserveAspectRatio="xMidYMid meet">
      <rect width={g.w} height={g.h} fill={dark ? "#0f0f0e" : "#fbfaf7"} />
      {g.cells.map((c, i) => (
        <rect key={i} x={c.x} y={c.y} width={c.w} height={c.h} fill={dark ? "#5c5a55" : "#9b9892"} />
      ))}
    </svg>
  );
}
