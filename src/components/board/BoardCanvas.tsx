"use client";

import { useEffect, useRef } from "react";
import {
  cellRect,
  hitTestCell,
  type BoardLayout,
} from "./boardLayout";
import { nextBoardCoordinate } from "./boardNavigation";

export type BoardSquare = {
  id: string;
  x: number;
  y: number;
  status: string;
  imageUrl: string | null;
};

type Props = {
  squares: BoardSquare[];
  layout: BoardLayout;
  scale: number;
  offsetX: number;
  offsetY: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onPan: (deltaX: number, deltaY: number) => void;
  onViewport: (w: number, h: number) => void;
};

/** Paint the static grid once into an offscreen buffer (51+51 lines, not 2500 strokes). */
function paintGrid(
  ctx: CanvasRenderingContext2D,
  layout: BoardLayout,
  selectedId: string | null,
  index: Map<string, BoardSquare>,
  images: Map<string, HTMLImageElement>,
) {
  const { boardW, boardH, edgesX, edgesY } = layout;
  ctx.clearRect(0, 0, boardW, boardH);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, boardW, boardH);

  ctx.beginPath();
  ctx.strokeStyle = "#e6e8ec";
  ctx.lineWidth = 1;
  for (let i = 0; i < edgesX.length; i++) {
    const x = edgesX[i]!;
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, boardH);
  }
  for (let i = 0; i < edgesY.length; i++) {
    const y = edgesY[i]!;
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(boardW, y + 0.5);
  }
  ctx.stroke();

  for (const s of index.values()) {
    if (!s.imageUrl) continue;
    const img = images.get(s.imageUrl);
    if (!img || !img.complete || img.naturalWidth === 0) continue;
    const { px, py, pw, ph } = cellRect(layout, s.x, s.y);
    ctx.drawImage(img, px, py, pw, ph);
  }

  if (!selectedId) return;
  for (const s of index.values()) {
    if (s.id !== selectedId) continue;
    const { px, py, pw, ph } = cellRect(layout, s.x, s.y);
    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 1, py + 1, pw - 2, ph - 2);
    break;
  }
}

export function BoardCanvas({
  squares,
  layout,
  scale,
  offsetX,
  offsetY,
  selectedId,
  onSelect,
  onPan,
  onViewport,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const indexRef = useRef<Map<string, BoardSquare>>(new Map());
  const gridRef = useRef<HTMLCanvasElement | null>(null);
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const viewRef = useRef({ w: 0, h: 0, dpr: 1 });
  const cameraRef = useRef({ scale, offsetX, offsetY });
  const layoutRef = useRef(layout);
  const selectedRef = useRef(selectedId);
  const drawRafRef = useRef<number | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
    moved: boolean;
    total: number;
  } | null>(null);
  const suppressClickRef = useRef(false);
  const onViewportRef = useRef(onViewport);
  onViewportRef.current = onViewport;

  cameraRef.current = { scale, offsetX, offsetY };
  layoutRef.current = layout;
  selectedRef.current = selectedId;

  useEffect(() => {
    const map = new Map<string, BoardSquare>();
    for (const s of squares) map.set(`${s.x},${s.y}`, s);
    indexRef.current = map;
  }, [squares]);

  const rebuildGrid = () => {
    const { boardW, boardH } = layoutRef.current;
    let grid = gridRef.current;
    if (!grid) {
      grid = document.createElement("canvas");
      gridRef.current = grid;
    }
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.ceil(boardW * dpr));
    const h = Math.max(1, Math.ceil(boardH * dpr));
    if (grid.width !== w || grid.height !== h) {
      grid.width = w;
      grid.height = h;
    }
    const gctx = grid.getContext("2d");
    if (!gctx) return;
    gctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintGrid(
      gctx,
      layoutRef.current,
      selectedRef.current,
      indexRef.current,
      imageCacheRef.current,
    );
  };

  const blit = () => {
    const canvas = canvasRef.current;
    const grid = gridRef.current;
    if (!canvas || !grid) return;
    const { w, h, dpr } = viewRef.current;
    if (w <= 0 || h <= 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const cam = cameraRef.current;
    const { boardW, boardH } = layoutRef.current;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#f6f7f9";
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.translate(cam.offsetX, cam.offsetY);
    ctx.scale(cam.scale, cam.scale);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(grid, 0, 0, boardW, boardH);
    ctx.restore();
  };

  const scheduleBlit = () => {
    if (drawRafRef.current != null) return;
    drawRafRef.current = requestAnimationFrame(() => {
      drawRafRef.current = null;
      blit();
    });
  };

  // Load / prune Image objects when square imageUrl map changes
  useEffect(() => {
    const wanted = new Set<string>();
    for (const s of squares) {
      if (s.imageUrl) wanted.add(s.imageUrl);
    }

    const cache = imageCacheRef.current;
    for (const url of [...cache.keys()]) {
      if (!wanted.has(url)) cache.delete(url);
    }

    let cancelled = false;
    for (const url of wanted) {
      if (cache.has(url)) continue;
      const img = new Image();
      img.decoding = "async";
      img.onload = () => {
        if (cancelled) return;
        cache.set(url, img);
        rebuildGrid();
        scheduleBlit();
      };
      img.onerror = () => {
        if (cancelled) return;
        cache.delete(url);
      };
      // Placeholder entry so we don't double-load while pending
      cache.set(url, img);
      img.src = url;
    }

    rebuildGrid();
    scheduleBlit();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rebuildGrid/scheduleBlit are stable closures over refs
  }, [squares]);

  // Rebuild cached grid when layout/selection changes
  useEffect(() => {
    rebuildGrid();
    scheduleBlit();
  }, [layout, selectedId]);

  // Camera updates: blit only (cheap)
  useEffect(() => {
    scheduleBlit();
  }, [scale, offsetX, offsetY]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const resize = () => {
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      viewRef.current = { w, h, dpr };
      onViewportRef.current(w, h);
      rebuildGrid();
      blit();
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(parent);
    return () => {
      ro.disconnect();
      if (drawRafRef.current != null) cancelAnimationFrame(drawRafRef.current);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => e.preventDefault();
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, []);

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const cam = cameraRef.current;
    const bx = (mx - cam.offsetX) / cam.scale;
    const by = (my - cam.offsetY) / cam.scale;
    const hit = hitTestCell(layoutRef.current, bx, by);
    if (!hit) return;
    const s = indexRef.current.get(`${hit.x},${hit.y}`);
    if (s) onSelect(s.id);
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      moved: false,
      total: 0,
    };
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const deltaX = e.clientX - drag.x;
    const deltaY = e.clientY - drag.y;
    if (deltaX === 0 && deltaY === 0) return;
    drag.x = e.clientX;
    drag.y = e.clientY;
    drag.total += Math.hypot(deltaX, deltaY);
    if (drag.total < 8) return;
    drag.moved = true;
    onPan(deltaX, deltaY);
  }

  function finishPointer(e: React.PointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    suppressClickRef.current = drag.moved;
    dragRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLCanvasElement>) {
    const selected = squares.find((square) => square.id === selectedId);
    const next = nextBoardCoordinate(
      selected ? { x: selected.x, y: selected.y } : null,
      e.key,
    );
    if (!next) return;
    e.preventDefault();
    const square = indexRef.current.get(`${next.x},${next.y}`);
    if (square) onSelect(square.id);
  }

  return (
    <canvas
      ref={canvasRef}
      className="block h-full w-full cursor-grab touch-none focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-600 active:cursor-grabbing"
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishPointer}
      onPointerCancel={finishPointer}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="application"
      aria-label="Square market board. Use arrow keys to move the selection."
    />
  );
}
