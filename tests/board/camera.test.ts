import { describe, expect, it } from "vitest";
import {
  fitCameraToView,
  zoomCameraAtCenter,
  type BoardCamera,
} from "@/components/board/useBoardCamera";

describe("board camera transforms", () => {
  it("round-trips zoom without offset drift", () => {
    const fitted = fitCameraToView(600, 1280, 800);
    const zoomed = zoomCameraAtCenter(fitted, 1.25, 1280, 800);
    const restored = zoomCameraAtCenter(zoomed, 1 / 1.25, 1280, 800);

    expect(restored.scale).toBeCloseTo(fitted.scale);
    expect(restored.offsetX).toBeCloseTo(fitted.offsetX);
    expect(restored.offsetY).toBeCloseTo(fitted.offsetY);
  });

  it("returns the same result when replayed from identical state", () => {
    const camera: BoardCamera = { scale: 1.33, offsetX: 241, offsetY: 1 };

    expect(zoomCameraAtCenter(camera, 1.25, 1280, 800)).toEqual(
      zoomCameraAtCenter(camera, 1.25, 1280, 800),
    );
  });

  it("clamps fit scale to camera limits", () => {
    expect(fitCameraToView(600, 100, 100).scale).toBe(0.5);
    expect(fitCameraToView(600, 6000, 6000).scale).toBe(8);
  });
});
