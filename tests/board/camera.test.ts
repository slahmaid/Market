import { describe, expect, it } from "vitest";
import {
  clampCameraToBoard,
  fitCameraToView,
  fitScaleForView,
  zoomCameraAtCenter,
  type BoardCamera,
} from "@/components/board/useBoardCamera";

describe("board camera transforms", () => {
  it("fills the viewport at fit when board matches view size", () => {
    const fitted = fitCameraToView(1280, 800, 1280, 800);
    expect(fitted.scale).toBeCloseTo(1);
    expect(fitted.offsetX).toBeCloseTo(0);
    expect(fitted.offsetY).toBeCloseTo(0);
  });

  it("round-trips zoom without offset drift", () => {
    const fitted = fitCameraToView(1280, 800, 1280, 800);
    const zoomed = zoomCameraAtCenter(fitted, 1.25, 1280, 800, 1280, 800);
    const restored = zoomCameraAtCenter(
      zoomed,
      1 / 1.25,
      1280,
      800,
      1280,
      800,
    );

    expect(restored.scale).toBeCloseTo(fitted.scale);
    expect(restored.offsetX).toBeCloseTo(fitted.offsetX);
    expect(restored.offsetY).toBeCloseTo(fitted.offsetY);
  });

  it("uses fit scale as max zoom-out (entire board visible)", () => {
    expect(fitScaleForView(1280, 800, 1280, 800)).toBeCloseTo(1);
    const fitted = fitCameraToView(1280, 800, 1280, 800);
    const overZoomedOut = zoomCameraAtCenter(
      fitted,
      0.1,
      1280,
      800,
      1280,
      800,
    );
    expect(overZoomedOut.scale).toBeCloseTo(1);
    expect(overZoomedOut.offsetX).toBeCloseTo(0);
    expect(overZoomedOut.offsetY).toBeCloseTo(0);
  });

  it("centers a square board in a wide viewport", () => {
    const fitted = fitCameraToView(720, 720, 1280, 720);
    expect(fitted.scale).toBeCloseTo(1);
    expect(fitted.offsetX).toBeCloseTo((1280 - 720) / 2);
    expect(fitted.offsetY).toBeCloseTo(0);
  });

  it("does not allow panning outside the board", () => {
    const zoomed: BoardCamera = { scale: 2, offsetX: 500, offsetY: -900 };
    const clamped = clampCameraToBoard(zoomed, 1280, 800, 1280, 800);
    expect(clamped.offsetX).toBeGreaterThanOrEqual(1280 - 1280 * 2);
    expect(clamped.offsetX).toBeLessThanOrEqual(0);
    expect(clamped.offsetY).toBeGreaterThanOrEqual(800 - 800 * 2);
    expect(clamped.offsetY).toBeLessThanOrEqual(0);
  });
});
