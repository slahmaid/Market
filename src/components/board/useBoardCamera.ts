"use client";

import { useCallback, useState, type SetStateAction } from "react";
import { GRID_SIZE } from "@/lib/pricing/constants";

const MIN_SCALE = 0.5;
const MAX_SCALE = 8;
const STEP = 1.25;

export type BoardCamera = {
  scale: number;
  offsetX: number;
  offsetY: number;
};

function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

export function fitCameraToView(
  boardPx: number,
  viewW: number,
  viewH: number,
): BoardCamera {
  const scale = clampScale(Math.min(viewW / boardPx, viewH / boardPx));
  return {
    scale,
    offsetX: (viewW - boardPx * scale) / 2,
    offsetY: (viewH - boardPx * scale) / 2,
  };
}

export function zoomCameraAtCenter(
  camera: BoardCamera,
  factor: number,
  viewW: number,
  viewH: number,
): BoardCamera {
  const scale = clampScale(camera.scale * factor);
  const cx = viewW / 2;
  const cy = viewH / 2;
  return {
    scale,
    offsetX: cx - ((cx - camera.offsetX) / camera.scale) * scale,
    offsetY: cy - ((cy - camera.offsetY) / camera.scale) * scale,
  };
}

export function useBoardCamera(cellPx: number) {
  const boardPx = GRID_SIZE * cellPx;
  const [camera, setCamera] = useState<BoardCamera>({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  });

  const fitToView = useCallback(
    (viewW: number, viewH: number) => {
      setCamera(fitCameraToView(boardPx, viewW, viewH));
    },
    [boardPx],
  );

  const zoomAtCenter = useCallback(
    (factor: number, viewW: number, viewH: number) => {
      setCamera((current) =>
        zoomCameraAtCenter(current, factor, viewW, viewH),
      );
    },
    [],
  );

  const zoomIn = (viewW: number, viewH: number) => zoomAtCenter(STEP, viewW, viewH);
  const zoomOut = (viewW: number, viewH: number) => zoomAtCenter(1 / STEP, viewW, viewH);
  const panBy = useCallback((deltaX: number, deltaY: number) => {
    setCamera((current) => ({
      ...current,
      offsetX: current.offsetX + deltaX,
      offsetY: current.offsetY + deltaY,
    }));
  }, []);
  const setOffsetX = useCallback((value: SetStateAction<number>) => {
    setCamera((current) => ({
      ...current,
      offsetX:
        typeof value === "function" ? value(current.offsetX) : value,
    }));
  }, []);
  const setOffsetY = useCallback((value: SetStateAction<number>) => {
    setCamera((current) => ({
      ...current,
      offsetY:
        typeof value === "function" ? value(current.offsetY) : value,
    }));
  }, []);

  return {
    ...camera,
    fitToView,
    zoomIn,
    zoomOut,
    panBy,
    setOffsetX,
    setOffsetY,
  };
}
