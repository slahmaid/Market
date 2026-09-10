"use client";

import { useCallback, useState } from "react";
import { GRID_SIZE } from "@/lib/pricing/constants";

const MIN_SCALE = 0.5;
const MAX_SCALE = 8;
const STEP = 1.25;

export function useBoardCamera(cellPx: number) {
  const boardPx = GRID_SIZE * cellPx;
  const [scale, setScale] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);

  const fitToView = useCallback(
    (viewW: number, viewH: number) => {
      const s = Math.min(viewW / boardPx, viewH / boardPx);
      setScale(s);
      setOffsetX((viewW - boardPx * s) / 2);
      setOffsetY((viewH - boardPx * s) / 2);
    },
    [boardPx],
  );

  const zoomAtCenter = useCallback(
    (factor: number, viewW: number, viewH: number) => {
      setScale((prev) => {
        const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev * factor));
        const cx = viewW / 2;
        const cy = viewH / 2;
        setOffsetX((ox) => cx - ((cx - ox) / prev) * next);
        setOffsetY((oy) => cy - ((cy - oy) / prev) * next);
        return next;
      });
    },
    [],
  );

  const zoomIn = (viewW: number, viewH: number) => zoomAtCenter(STEP, viewW, viewH);
  const zoomOut = (viewW: number, viewH: number) => zoomAtCenter(1 / STEP, viewW, viewH);

  return { scale, offsetX, offsetY, fitToView, zoomIn, zoomOut, setOffsetX, setOffsetY };
}
