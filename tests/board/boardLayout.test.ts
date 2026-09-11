import { describe, expect, it } from "vitest";
import {
  buildBoardLayout,
  centerCellSize,
  cornerCellSize,
  hitTestCell,
} from "@/components/board/boardLayout";
import { GRID_SIZE } from "@/lib/pricing/constants";

describe("boardLayout", () => {
  it("fills the board exactly", () => {
    const layout = buildBoardLayout(1000, 800);
    expect(layout.edgesX[0]).toBe(0);
    expect(layout.edgesY[0]).toBe(0);
    expect(layout.edgesX[GRID_SIZE]).toBeCloseTo(1000);
    expect(layout.edgesY[GRID_SIZE]).toBeCloseTo(800);
  });

  it("makes center cells larger than corner cells", () => {
    const layout = buildBoardLayout(1000, 1000);
    const center = centerCellSize(layout);
    const corner = cornerCellSize(layout);
    expect(center.w).toBeGreaterThan(corner.w);
    expect(center.h).toBeGreaterThan(corner.h);
  });

  it("hit-tests center of a cell", () => {
    const layout = buildBoardLayout(1000, 1000);
    const hit = hitTestCell(layout, 500, 500);
    expect(hit).not.toBeNull();
    expect(hit!.x).toBeGreaterThanOrEqual(20);
    expect(hit!.x).toBeLessThanOrEqual(29);
  });
});
