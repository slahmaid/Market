"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import SphereImageGrid, {
  type ImageData,
} from "@/components/ui/img-sphere";
import type { BoardSquare } from "@/components/board/BoardCanvas";
import { GRID_SIZE } from "@/lib/pricing/constants";

const TARGET_COUNT = GRID_SIZE * GRID_SIZE; // 2500

/** Shared placeholders — avoid 2500 unique data-URLs decoding at once. */
const PLACEHOLDER: Record<string, string> = {
  platform: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="#eef1f6" stroke="#d1d5db" stroke-width="2"/></svg>`,
  )}`,
  owned: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="#e0e7ff" stroke="#6366f1" stroke-width="2"/></svg>`,
  )}`,
  listed: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="#d1fae5" stroke="#059669" stroke-width="2"/></svg>`,
  )}`,
};

function toSphereImages(squares: BoardSquare[]): ImageData[] {
  const byKey = new Map(squares.map((s) => [`${s.x},${s.y}`, s]));
  const images: ImageData[] = [];

  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const existing = byKey.get(`${x},${y}`);
      const id = existing?.id ?? `preview-${x}-${y}`;
      const status = existing?.status ?? "platform";
      const src =
        existing?.imageUrl && existing.imageUrl.length > 0
          ? existing.imageUrl
          : (PLACEHOLDER[status] ?? PLACEHOLDER.platform!);
      images.push({
        id,
        src,
        alt: `Square (${x}, ${y})`,
        title: `(${x}, ${y})`,
        description: status,
      });
    }
  }

  if (images.length !== TARGET_COUNT) {
    throw new Error(`Expected ${TARGET_COUNT} sphere nodes, got ${images.length}`);
  }
  return images;
}

type BoardSphereProps = {
  squares: BoardSquare[];
  onSelect?: (id: string) => void;
};

export function BoardSphere({ squares, onSelect }: BoardSphereProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(480);

  const images = useMemo(() => toSphereImages(squares), [squares]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    let frame = 0;
    const update = () => {
      const side = Math.max(
        280,
        Math.floor(Math.min(el.clientWidth, el.clientHeight) * 0.96),
      );
      setSize((prev) => (Math.abs(prev - side) < 2 ? prev : side));
    };
    const onResize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    update();
    const ro = new ResizeObserver(onResize);
    ro.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      className="flex h-full w-full items-center justify-center"
      data-sphere-count={images.length}
    >
      <SphereImageGrid
        images={images}
        containerSize={size}
        sphereRadius={Math.round(size * 0.44)}
        dragSensitivity={0.55}
        momentumDecay={0.945}
        maxRotationSpeed={5}
        baseImageScale={0.038}
        autoRotate
        autoRotateSpeed={0.12}
        showModal={false}
        onImageSelect={(image) => onSelect?.(image.id)}
      />
    </div>
  );
}
