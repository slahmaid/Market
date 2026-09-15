"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const MAX_SCALE = 8;
const STEP = 1.25;
/** Higher = snappier zoom animation (still one drawImage/frame with cached grid). */
const ZOOM_LERP = 0.22;
const SETTLE = 0.001;

export type BoardCamera = {
  scale: number;
  offsetX: number;
  offsetY: number;
};

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Min zoom: entire board visible (contain / letterbox), never cropped. */
export function fitScaleForView(
  boardW: number,
  boardH: number,
  viewW: number,
  viewH: number,
): number {
  if (viewW <= 0 || viewH <= 0 || boardW <= 0 || boardH <= 0) return 1;
  return Math.min(viewW / boardW, viewH / boardH);
}

export function clampScale(
  scale: number,
  boardW: number,
  boardH: number,
  viewW: number,
  viewH: number,
): number {
  const minScale = fitScaleForView(boardW, boardH, viewW, viewH);
  return Math.min(MAX_SCALE, Math.max(minScale, scale));
}

export function clampCameraToBoard(
  camera: BoardCamera,
  boardW: number,
  boardH: number,
  viewW: number,
  viewH: number,
): BoardCamera {
  if (viewW <= 0 || viewH <= 0) return camera;

  const scaledW = boardW * camera.scale;
  const scaledH = boardH * camera.scale;
  let { offsetX, offsetY } = camera;

  if (scaledW <= viewW) {
    offsetX = (viewW - scaledW) / 2;
  } else {
    const minX = viewW - scaledW;
    offsetX = Math.min(0, Math.max(minX, offsetX));
  }

  if (scaledH <= viewH) {
    offsetY = (viewH - scaledH) / 2;
  } else {
    const minY = viewH - scaledH;
    offsetY = Math.min(0, Math.max(minY, offsetY));
  }

  return { scale: camera.scale, offsetX, offsetY };
}

export function fitCameraToView(
  boardW: number,
  boardH: number,
  viewW: number,
  viewH: number,
): BoardCamera {
  const scale = Math.min(
    MAX_SCALE,
    fitScaleForView(boardW, boardH, viewW, viewH),
  );
  return clampCameraToBoard(
    {
      scale,
      offsetX: (viewW - boardW * scale) / 2,
      offsetY: (viewH - boardH * scale) / 2,
    },
    boardW,
    boardH,
    viewW,
    viewH,
  );
}

export function zoomCameraAtCenter(
  camera: BoardCamera,
  factor: number,
  viewW: number,
  viewH: number,
  boardW: number,
  boardH: number,
): BoardCamera {
  const minScale = fitScaleForView(boardW, boardH, viewW, viewH);
  const nextScale = clampScale(
    camera.scale * factor,
    boardW,
    boardH,
    viewW,
    viewH,
  );

  if (nextScale <= minScale + 1e-9) {
    return fitCameraToView(boardW, boardH, viewW, viewH);
  }

  const cx = viewW / 2;
  const cy = viewH / 2;
  return clampCameraToBoard(
    {
      scale: nextScale,
      offsetX: cx - ((cx - camera.offsetX) / camera.scale) * nextScale,
      offsetY: cy - ((cy - camera.offsetY) / camera.scale) * nextScale,
    },
    boardW,
    boardH,
    viewW,
    viewH,
  );
}

function lerpCamera(from: BoardCamera, to: BoardCamera, t: number): BoardCamera {
  return {
    scale: from.scale + (to.scale - from.scale) * t,
    offsetX: from.offsetX + (to.offsetX - from.offsetX) * t,
    offsetY: from.offsetY + (to.offsetY - from.offsetY) * t,
  };
}

function near(a: BoardCamera, b: BoardCamera): boolean {
  return (
    Math.abs(a.scale - b.scale) < SETTLE &&
    Math.abs(a.offsetX - b.offsetX) < SETTLE &&
    Math.abs(a.offsetY - b.offsetY) < SETTLE
  );
}

export function useBoardCamera() {
  const [camera, setCamera] = useState<BoardCamera>({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  });
  const [boardSize, setBoardSize] = useState({ w: 1, h: 1 });
  const boardSizeRef = useRef(boardSize);
  const cameraRef = useRef(camera);
  const targetRef = useRef(camera);
  const rafRef = useRef<number | null>(null);

  boardSizeRef.current = boardSize;
  cameraRef.current = camera;

  const stopAnim = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const animateTowardTarget = useCallback(() => {
    stopAnim();
    if (prefersReducedMotion()) {
      setCamera(targetRef.current);
      cameraRef.current = targetRef.current;
      return;
    }

    const tick = () => {
      const next = lerpCamera(cameraRef.current, targetRef.current, ZOOM_LERP);
      if (near(next, targetRef.current)) {
        setCamera(targetRef.current);
        cameraRef.current = targetRef.current;
        rafRef.current = null;
        return;
      }
      cameraRef.current = next;
      setCamera(next);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [stopAnim]);

  useEffect(() => () => stopAnim(), [stopAnim]);

  const setBoardDimensions = useCallback((boardW: number, boardH: number) => {
    setBoardSize({ w: Math.max(1, boardW), h: Math.max(1, boardH) });
  }, []);

  const fitToView = useCallback(
    (
      viewW: number,
      viewH: number,
      boardW = boardSizeRef.current.w,
      boardH = boardSizeRef.current.h,
    ) => {
      const w = Math.max(1, boardW);
      const h = Math.max(1, boardH);
      setBoardSize({ w, h });
      const next = fitCameraToView(w, h, viewW, viewH);
      targetRef.current = next;
      animateTowardTarget();
    },
    [animateTowardTarget],
  );

  const zoomAtCenter = useCallback(
    (factor: number, viewW: number, viewH: number) => {
      const { w, h } = boardSizeRef.current;
      // Zoom from the visual camera, not a stale mid-lerp target
      const next = zoomCameraAtCenter(
        cameraRef.current,
        factor,
        viewW,
        viewH,
        w,
        h,
      );
      targetRef.current = next;
      animateTowardTarget();
    },
    [animateTowardTarget],
  );

  const zoomIn = (viewW: number, viewH: number) =>
    zoomAtCenter(STEP, viewW, viewH);
  const zoomOut = (viewW: number, viewH: number) =>
    zoomAtCenter(1 / STEP, viewW, viewH);

  /** Pan is immediate (no lerp) so dragging stays 1:1 with the finger. */
  const panBy = useCallback(
    (deltaX: number, deltaY: number, viewW: number, viewH: number) => {
      stopAnim();
      const { w, h } = boardSizeRef.current;
      const next = clampCameraToBoard(
        {
          ...cameraRef.current,
          offsetX: cameraRef.current.offsetX + deltaX,
          offsetY: cameraRef.current.offsetY + deltaY,
        },
        w,
        h,
        viewW,
        viewH,
      );
      targetRef.current = next;
      cameraRef.current = next;
      setCamera(next);
    },
    [stopAnim],
  );

  return {
    ...camera,
    boardW: boardSize.w,
    boardH: boardSize.h,
    setBoardDimensions,
    fitToView,
    zoomIn,
    zoomOut,
    panBy,
  };
}
