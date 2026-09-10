"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BoardCanvas, type BoardSquare } from "@/components/board/BoardCanvas";
import { BoardChrome } from "@/components/board/BoardChrome";
import { SquarePanel } from "@/components/board/SquarePanel";
import { useBoardCamera } from "@/components/board/useBoardCamera";

const CELL = 12;

export default function HomePage() {
  const [squares, setSquares] = useState<BoardSquare[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState({ w: 0, h: 0 });
  const { scale, offsetX, offsetY, fitToView, zoomIn, zoomOut } =
    useBoardCamera(CELL);
  const hasFitted = useRef(false);

  useEffect(() => {
    fetch("/api/squares")
      .then((response) => response.json())
      .then((data) => setSquares(data.squares ?? []));
  }, []);

  const onViewport = useCallback(
    (w: number, h: number) => {
      setView({ w, h });
      if (!hasFitted.current && w > 0 && h > 0) {
        hasFitted.current = true;
        fitToView(w, h);
      }
    },
    [fitToView],
  );

  return (
    <main className="relative h-[100dvh] w-screen overflow-hidden bg-[#f6f7f9]">
      <BoardCanvas
        squares={squares}
        cellPx={CELL}
        scale={scale}
        offsetX={offsetX}
        offsetY={offsetY}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onViewport={onViewport}
      />
      <BoardChrome
        onZoomIn={() => zoomIn(view.w, view.h)}
        onZoomOut={() => zoomOut(view.w, view.h)}
        onFit={() => fitToView(view.w, view.h)}
      />
      <SquarePanel
        squareId={selectedId}
        onClose={() => setSelectedId(null)}
      />
    </main>
  );
}
