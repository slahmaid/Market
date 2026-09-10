import { describe, expect, it } from "vitest";
import { nextBoardCoordinate } from "@/components/board/boardNavigation";

describe("board keyboard navigation", () => {
  it("starts at the center and follows arrow keys", () => {
    expect(nextBoardCoordinate(null, "Enter")).toEqual({ x: 25, y: 25 });
    expect(nextBoardCoordinate({ x: 25, y: 25 }, "ArrowLeft")).toEqual({
      x: 24,
      y: 25,
    });
  });

  it("keeps the focus cursor inside the board", () => {
    expect(nextBoardCoordinate({ x: 0, y: 0 }, "ArrowLeft")).toEqual({
      x: 0,
      y: 0,
    });
    expect(nextBoardCoordinate({ x: 49, y: 49 }, "ArrowDown")).toEqual({
      x: 49,
      y: 49,
    });
  });
});
