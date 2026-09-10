"use client";

import { useEffect, useRef } from "react";
import { GRID_SIZE } from "@/lib/pricing/constants";
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
  cellPx?: number;
  scale: number;
  offsetX: number;
  offsetY: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onPan: (deltaX: number, deltaY: number) => void;
  onViewport: (w: number, h: number) => void;
};

export function BoardCanvas({
  squares,
  cellPx = 12,
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
  const dragRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
    moved: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);

  useEffect(() => {
    const map = new Map<string, BoardSquare>();
    for (const s of squares) map.set(`${s.x},${s.y}`, s);
    indexRef.current = map;
  }, [squares]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const resize = () => {
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      onViewport(w, h);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#f6f7f9";
      ctx.fillRect(0, 0, w, h);
      ctx.save();
      ctx.translate(offsetX, offsetY);
      ctx.scale(scale, scale);
      for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
          const s = indexRef.current.get(`${x},${y}`);
          const px = x * cellPx;
          const py = y * cellPx;
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(px, py, cellPx, cellPx);
          ctx.strokeStyle = "#e6e8ec";
          ctx.lineWidth = 1 / scale;
          ctx.strokeRect(px, py, cellPx, cellPx);
          if (s?.id === selectedId) {
            ctx.strokeStyle = "#111827";
            ctx.lineWidth = 2 / scale;
            ctx.strokeRect(px + 0.5, py + 0.5, cellPx - 1, cellPx - 1);
          }
        }
      }
      ctx.restore();
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(parent);
    return () => ro.disconnect();
  }, [squares, scale, offsetX, offsetY, selectedId, cellPx, onViewport]);

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
    const bx = (mx - offsetX) / scale;
    const by = (my - offsetY) / scale;
    const x = Math.floor(bx / cellPx);
    const y = Math.floor(by / cellPx);
    if (x < 0 || y < 0 || x >= GRID_SIZE || y >= GRID_SIZE) return;
    const s = indexRef.current.get(`${x},${y}`);
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
