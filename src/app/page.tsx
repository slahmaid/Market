"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BoardCanvas, type BoardSquare } from "@/components/board/BoardCanvas";
import { BoardChrome } from "@/components/board/BoardChrome";
import { SquarePanel } from "@/components/board/SquarePanel";
import { layoutForViewport } from "@/components/board/boardLayout";
import { useBoardCamera } from "@/components/board/useBoardCamera";
import { listPreviewSquares } from "@/lib/previewBoard";

async function loadSquares(): Promise<BoardSquare[]> {
  try {
    const response = await fetch("/api/squares");
    const text = await response.text();
    if (!response.ok || !text.trim()) {
      return listPreviewSquares();
    }
    const data = JSON.parse(text) as { squares?: BoardSquare[] };
    if (!Array.isArray(data.squares) || data.squares.length === 0) {
      return listPreviewSquares();
    }
    return data.squares;
  } catch {
    return listPreviewSquares();
  }
}

function HomePageContent() {
  const searchParams = useSearchParams();
  const deepSquareId = searchParams.get("square");
  const [squares, setSquares] = useState<BoardSquare[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState({ w: 0, h: 0 });
  const {
    scale,
    offsetX,
    offsetY,
    setBoardDimensions,
    fitToView,
    zoomIn,
    zoomOut,
    panBy,
  } = useBoardCamera();
  const hasFitted = useRef(false);

  const layout = useMemo(
    () => layoutForViewport(Math.max(view.w, 1), Math.max(view.h, 1)),
    [view.w, view.h],
  );

  useEffect(() => {
    let cancelled = false;
    loadSquares().then((next) => {
      if (!cancelled) setSquares(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!deepSquareId || squares.length === 0) return;
    if (squares.some((s) => s.id === deepSquareId)) {
      setSelectedId(deepSquareId);
    }
  }, [deepSquareId, squares]);

  useEffect(() => {
    setBoardDimensions(layout.boardW, layout.boardH);
  }, [layout.boardH, layout.boardW, setBoardDimensions]);

  const onViewport = useCallback(
    (w: number, h: number) => {
      setView({ w, h });
      if (w <= 0 || h <= 0) return;
      const nextLayout = layoutForViewport(w, h);
      if (!hasFitted.current) {
        hasFitted.current = true;
        fitToView(w, h, nextLayout.boardW, nextLayout.boardH);
        return;
      }
      // Edge-to-edge at min zoom; when zoomed keep scale and reclamping via dims
      if (scale <= 1.001) {
        fitToView(w, h, nextLayout.boardW, nextLayout.boardH);
      } else {
        setBoardDimensions(nextLayout.boardW, nextLayout.boardH);
      }
    },
    [fitToView, scale, setBoardDimensions],
  );

  return (
    <main
      data-board-shell
      className="relative h-[100dvh] w-screen overflow-hidden bg-[#f6f7f9] overscroll-none"
    >
      <BoardCanvas
        squares={squares}
        layout={layout}
        scale={scale}
        offsetX={offsetX}
        offsetY={offsetY}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onPan={(dx, dy) => panBy(dx, dy, view.w, view.h)}
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
        onSquareUpdated={(updated) => {
          setSquares((prev) =>
            prev.map((s) => {
              if (s.id !== updated.id) return s;
              const base = updated.imageUrl;
              const imageUrl = base
                ? `${base}${base.includes("?") ? "&" : "?"}v=${Date.now()}`
                : null;
              return {
                ...s,
                imageUrl,
                status: updated.status,
                listPriceCents: updated.listPriceCents,
              };
            }),
          );
        }}
      />
    </main>
  );
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <main
          data-board-shell
          className="relative h-[100dvh] w-screen overflow-hidden bg-[#f6f7f9] overscroll-none"
        />
      }
    >
      <HomePageContent />
    </Suspense>
  );
}
