import { CENTER, GRID_SIZE } from "@/lib/pricing/constants";

/** Edge cells are baseline 1; center cells grow up to this multiplier. */
export const CENTER_SIZE_BOOST = 2.75;

export type BoardLayout = {
  boardW: number;
  boardH: number;
  /** Left edges of columns 0..GRID_SIZE (last value = boardW). */
  edgesX: number[];
  /** Top edges of rows 0..GRID_SIZE (last value = boardH). */
  edgesY: number[];
};

function axisWeight(index: number): number {
  const dist = Math.abs(index - CENTER) / CENTER; // 0 center → 1 edge
  const t = Math.min(1, Math.max(0, dist));
  // Smooth falloff: center largest, edges smallest
  return 1 + (CENTER_SIZE_BOOST - 1) * (1 - t) * (1 - t);
}

function buildEdges(count: number, total: number): number[] {
  const weights = Array.from({ length: count }, (_, i) => axisWeight(i));
  const sum = weights.reduce((a, b) => a + b, 0);
  const edges = new Array<number>(count + 1);
  edges[0] = 0;
  let acc = 0;
  for (let i = 0; i < count; i++) {
    acc += (weights[i]! / sum) * total;
    edges[i + 1] = acc;
  }
  edges[count] = total;
  return edges;
}

/**
 * Build a board that fills `boardW` × `boardH` exactly.
 * Column/row thickness grows toward the center for fairness.
 */
export function buildBoardLayout(boardW: number, boardH: number): BoardLayout {
  const w = Math.max(1, boardW);
  const h = Math.max(1, boardH);
  return {
    boardW: w,
    boardH: h,
    edgesX: buildEdges(GRID_SIZE, w),
    edgesY: buildEdges(GRID_SIZE, h),
  };
}

/** Aspect-matched logical board for a viewport (fills screen at scale 1). */
export function layoutForViewport(viewW: number, viewH: number): BoardLayout {
  return buildBoardLayout(Math.max(1, viewW), Math.max(1, viewH));
}

export function cellRect(
  layout: BoardLayout,
  x: number,
  y: number,
): { px: number; py: number; pw: number; ph: number } {
  const left = layout.edgesX[x]!;
  const right = layout.edgesX[x + 1]!;
  const top = layout.edgesY[y]!;
  const bottom = layout.edgesY[y + 1]!;
  return {
    px: left,
    py: top,
    pw: right - left,
    ph: bottom - top,
  };
}

export function hitTestCell(
  layout: BoardLayout,
  boardX: number,
  boardY: number,
): { x: number; y: number } | null {
  if (
    boardX < 0 ||
    boardY < 0 ||
    boardX >= layout.boardW ||
    boardY >= layout.boardH
  ) {
    return null;
  }
  const x = findIndex(layout.edgesX, boardX);
  const y = findIndex(layout.edgesY, boardY);
  if (x < 0 || y < 0) return null;
  return { x, y };
}

function findIndex(edges: number[], value: number): number {
  // edges are ascending; last equals board size
  for (let i = 0; i < edges.length - 1; i++) {
    if (value >= edges[i]! && value < edges[i + 1]!) return i;
  }
  // right/bottom edge pixel
  if (value === edges[edges.length - 1]) return edges.length - 2;
  return -1;
}

export function centerCellSize(layout: BoardLayout): {
  w: number;
  h: number;
} {
  const c = Math.floor(CENTER);
  const rect = cellRect(layout, c, c);
  return { w: rect.pw, h: rect.ph };
}

export function cornerCellSize(layout: BoardLayout): {
  w: number;
  h: number;
} {
  const rect = cellRect(layout, 0, 0);
  return { w: rect.pw, h: rect.ph };
}
