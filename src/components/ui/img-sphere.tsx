"use client";

import React, { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

/**
 * Canvas sphere — paints 2500 points on one canvas so drag/rotate stay smooth.
 */

export interface ImageData {
  id: string;
  src: string;
  alt: string;
  title?: string;
  description?: string;
}

export interface SphereImageGridProps {
  images?: ImageData[];
  containerSize?: number;
  sphereRadius?: number;
  dragSensitivity?: number;
  momentumDecay?: number;
  maxRotationSpeed?: number;
  baseImageScale?: number;
  hoverScale?: number;
  perspective?: number;
  autoRotate?: boolean;
  autoRotateSpeed?: number;
  className?: string;
  onImageSelect?: (image: ImageData) => void;
  showModal?: boolean;
}

type Vec3 = { x: number; y: number; z: number };

const STATUS_FILL: Record<string, string> = {
  platform: "#e8ecf3",
  owned: "#c7d2fe",
  listed: "#a7f3d0",
};

const STATUS_STROKE: Record<string, string> = {
  platform: "#c5cad3",
  owned: "#6366f1",
  listed: "#059669",
};

function normalizeAngle(angle: number) {
  let a = angle;
  while (a > 180) a -= 360;
  while (a < -180) a += 360;
  return a;
}

function buildUnitSphere(count: number): Float32Array {
  const out = new Float32Array(count * 3);
  if (count <= 0) return out;
  const golden = (1 + Math.sqrt(5)) / 2;
  const step = (2 * Math.PI) / golden;

  for (let i = 0; i < count; i++) {
    const t = i / count;
    const incl = Math.acos(1 - 2 * t);
    const az = step * i;
    const jTheta = ((((i * 17) % 21) - 10) * Math.PI) / 180;
    const jPhi = ((((i * 13) % 11) - 5) * Math.PI) / 180;
    const phi = incl + jPhi;
    const theta = az + jTheta;
    const sinP = Math.sin(phi);
    out[i * 3] = sinP * Math.cos(theta);
    out[i * 3 + 1] = Math.cos(phi);
    out[i * 3 + 2] = sinP * Math.sin(theta);
  }
  return out;
}

function rotatePoint(
  ux: number,
  uy: number,
  uz: number,
  rotX: number,
  rotY: number,
  radius: number,
): Vec3 {
  const rx = (rotX * Math.PI) / 180;
  const ry = (rotY * Math.PI) / 180;
  let x = ux * radius;
  const y = uy * radius;
  let z = uz * radius;

  const x1 = x * Math.cos(ry) + z * Math.sin(ry);
  const z1 = -x * Math.sin(ry) + z * Math.cos(ry);
  x = x1;
  z = z1;

  const y2 = y * Math.cos(rx) - z * Math.sin(rx);
  const z2 = y * Math.sin(rx) + z * Math.cos(rx);
  return { x, y: y2, z: z2 };
}

const SphereImageGrid: React.FC<SphereImageGridProps> = ({
  images = [],
  containerSize = 400,
  sphereRadius,
  dragSensitivity = 0.5,
  momentumDecay = 0.94,
  maxRotationSpeed = 5,
  baseImageScale = 0.04,
  autoRotate = true,
  autoRotateSpeed = 0.14,
  className = "",
  onImageSelect,
  showModal = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedImage, setSelectedImage] = useState<ImageData | null>(null);

  const imagesRef = useRef(images);
  imagesRef.current = images;
  const onSelectRef = useRef(onImageSelect);
  onSelectRef.current = onImageSelect;
  const showModalRef = useRef(showModal);
  showModalRef.current = showModal;

  const bitmapsRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const unitRef = useRef<Float32Array>(new Float32Array(0));
  const rotRef = useRef({ x: 16, y: 10 });
  const velRef = useRef({ x: 0, y: 0 });
  const dragRef = useRef<{
    active: boolean;
    moved: boolean;
    lastX: number;
    lastY: number;
    pointerId: number;
  } | null>(null);
  const hoverRef = useRef(-1);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef(0);

  const propsRef = useRef({
    containerSize,
    radius: sphereRadius ?? containerSize * 0.44,
    baseR: Math.max(3, containerSize * baseImageScale * 0.5),
    dragSensitivity,
    momentumDecay,
    maxRotationSpeed,
    autoRotate,
    autoRotateSpeed,
  });
  propsRef.current = {
    containerSize,
    radius: sphereRadius ?? containerSize * 0.44,
    baseR: Math.max(3, containerSize * baseImageScale * 0.5),
    dragSensitivity,
    momentumDecay,
    maxRotationSpeed,
    autoRotate,
    autoRotateSpeed,
  };

  useEffect(() => {
    unitRef.current = buildUnitSphere(images.length);
  }, [images.length]);

  useEffect(() => {
    const cache = bitmapsRef.current;
    const wanted = new Set<string>();
    for (const img of images) {
      if (!img.src || img.src.startsWith("data:")) continue;
      wanted.add(img.src);
      if (cache.has(img.src)) continue;
      const el = new Image();
      el.decoding = "async";
      el.src = img.src;
      cache.set(img.src, el);
    }
    for (const key of [...cache.keys()]) {
      if (!wanted.has(key)) cache.delete(key);
    }
  }, [images]);

  // One long-lived RAF loop — props read from refs so React re-renders don't reset physics
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let alive = true;
    let paintX = new Float32Array(1);
    let paintY = new Float32Array(1);
    let paintZ = new Float32Array(1);
    let order = new Uint32Array(1);

    const ensureBuffers = (n: number) => {
      if (paintX.length >= n) return;
      paintX = new Float32Array(n);
      paintY = new Float32Array(n);
      paintZ = new Float32Array(n);
      order = new Uint32Array(n);
    };

    const syncCanvasSize = () => {
      const { containerSize: size } = propsRef.current;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.floor(size * dpr);
      const h = Math.floor(size * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        canvas.style.width = `${size}px`;
        canvas.style.height = `${size}px`;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const clamp = (v: number, max: number) =>
      Math.max(-max, Math.min(max, v));

    const projectIndex = (i: number, radius: number, rotX: number, rotY: number) => {
      const u = unitRef.current;
      return rotatePoint(u[i * 3]!, u[i * 3 + 1]!, u[i * 3 + 2]!, rotX, rotY, radius);
    };

    const hitTest = (mx: number, my: number): number => {
      const p = propsRef.current;
      const cx = p.containerSize / 2;
      const cy = p.containerSize / 2;
      const rot = rotRef.current;
      let best = -1;
      let bestZ = -Infinity;
      const n = imagesRef.current.length;
      for (let i = 0; i < n; i++) {
        const pt = projectIndex(i, p.radius, rot.x, rot.y);
        if (pt.z < 0) continue;
        const depth = (pt.z + p.radius) / (2 * p.radius);
        const r = p.baseR * (0.55 + depth * 0.7);
        const dx = mx - (cx + pt.x);
        const dy = my - (cy + pt.y);
        if (dx * dx + dy * dy <= r * r && pt.z > bestZ) {
          bestZ = pt.z;
          best = i;
        }
      }
      return best;
    };

    const paint = () => {
      const p = propsRef.current;
      const n = imagesRef.current.length;
      const unit = unitRef.current;
      if (n === 0 || unit.length < n * 3) return;

      ensureBuffers(n);
      syncCanvasSize();

      const rot = rotRef.current;
      const cx = p.containerSize / 2;
      const cy = p.containerSize / 2;
      let visible = 0;

      for (let i = 0; i < n; i++) {
        const pt = rotatePoint(
          unit[i * 3]!,
          unit[i * 3 + 1]!,
          unit[i * 3 + 2]!,
          rot.x,
          rot.y,
          p.radius,
        );
        paintX[i] = pt.x;
        paintY[i] = pt.y;
        paintZ[i] = pt.z;
        if (pt.z > -p.radius * 0.12) {
          order[visible++] = i;
        }
      }

      // Sort visible back → front (simple insertion for small swaps; use Array for comparator)
      const idx: number[] = [];
      for (let i = 0; i < visible; i++) idx.push(order[i]!);
      idx.sort((a, b) => paintZ[a]! - paintZ[b]!);

      ctx.clearRect(0, 0, p.containerSize, p.containerSize);

      const glow = ctx.createRadialGradient(
        cx,
        cy,
        p.radius * 0.08,
        cx,
        cy,
        p.radius * 1.05,
      );
      glow.addColorStop(0, "rgba(255,255,255,0.5)");
      glow.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, p.containerSize, p.containerSize);

      const cache = bitmapsRef.current;
      const hover = hoverRef.current;

      for (let k = 0; k < idx.length; k++) {
        const i = idx[k]!;
        const x = paintX[i]!;
        const y = paintY[i]!;
        const z = paintZ[i]!;
        const depth = (z + p.radius) / (2 * p.radius);
        const fade = Math.min(1, Math.max(0.2, depth));
        let r = p.baseR * (0.5 + depth * 0.85);
        if (i === hover) r *= 1.22;

        const img = imagesRef.current[i]!;
        const status = img.description ?? "platform";
        const sx = cx + x;
        const sy = cy + y;

        ctx.globalAlpha = fade;
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);

        const bitmap =
          img.src && !img.src.startsWith("data:") ? cache.get(img.src) : null;
        if (bitmap && bitmap.complete && bitmap.naturalWidth > 0) {
          ctx.save();
          ctx.clip();
          ctx.drawImage(bitmap, sx - r, sy - r, r * 2, r * 2);
          ctx.restore();
          ctx.beginPath();
          ctx.arc(sx, sy, r, 0, Math.PI * 2);
          ctx.lineWidth = i === hover ? 2 : 1;
          ctx.strokeStyle =
            i === hover ? "rgba(0,122,255,0.95)" : "rgba(255,255,255,0.4)";
          ctx.stroke();
        } else {
          ctx.fillStyle = STATUS_FILL[status] ?? STATUS_FILL.platform!;
          ctx.fill();
          ctx.lineWidth = i === hover ? 2 : 1;
          ctx.strokeStyle =
            i === hover
              ? "rgba(0,122,255,0.95)"
              : (STATUS_STROKE[status] ?? STATUS_STROKE.platform!);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    };

    const tick = (ts: number) => {
      if (!alive) return;
      const last = lastTsRef.current || ts;
      const dt = Math.min(32, ts - last) / 16.67;
      lastTsRef.current = ts;

      const conf = propsRef.current;
      const drag = dragRef.current;
      if (!drag?.active) {
        const v = velRef.current;
        v.x *= conf.momentumDecay;
        v.y *= conf.momentumDecay;
        if (Math.abs(v.x) < 0.002) v.x = 0;
        if (Math.abs(v.y) < 0.002) v.y = 0;

        const r = rotRef.current;
        if (conf.autoRotate) r.y += conf.autoRotateSpeed * dt;
        r.x = normalizeAngle(r.x + clamp(v.x, conf.maxRotationSpeed) * dt);
        r.y = normalizeAngle(r.y + clamp(v.y, conf.maxRotationSpeed) * dt);
      }

      paint();
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    const localPoint = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = propsRef.current.containerSize / rect.width;
      const scaleY = propsRef.current.containerSize / rect.height;
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      dragRef.current = {
        active: true,
        moved: false,
        lastX: e.clientX,
        lastY: e.clientY,
        pointerId: e.pointerId,
      };
      velRef.current = { x: 0, y: 0 };
      canvas.style.cursor = "grabbing";
    };

    const onPointerMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      const conf = propsRef.current;
      const pt = localPoint(e);

      if (drag?.active && drag.pointerId === e.pointerId) {
        const dx = e.clientX - drag.lastX;
        const dy = e.clientY - drag.lastY;
        if (Math.hypot(dx, dy) > 3) drag.moved = true;
        const deltaX = clamp(-dy * conf.dragSensitivity, conf.maxRotationSpeed);
        const deltaY = clamp(dx * conf.dragSensitivity, conf.maxRotationSpeed);
        const r = rotRef.current;
        r.x = normalizeAngle(r.x + deltaX);
        r.y = normalizeAngle(r.y + deltaY);
        velRef.current = { x: deltaX, y: deltaY };
        drag.lastX = e.clientX;
        drag.lastY = e.clientY;
        hoverRef.current = -1;
        return;
      }

      hoverRef.current = hitTest(pt.x, pt.y);
    };

    const endPointer = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      const moved = drag.moved;
      dragRef.current = null;
      canvas.style.cursor = "grab";
      if (canvas.hasPointerCapture(e.pointerId)) {
        canvas.releasePointerCapture(e.pointerId);
      }
      if (moved) return;
      const pt = localPoint(e);
      const hit = hitTest(pt.x, pt.y);
      if (hit < 0) return;
      const image = imagesRef.current[hit];
      if (!image) return;
      onSelectRef.current?.(image);
      if (showModalRef.current) setSelectedImage(image);
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", endPointer);
    canvas.addEventListener("pointercancel", endPointer);

    return () => {
      alive = false;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", endPointer);
      canvas.removeEventListener("pointercancel", endPointer);
    };
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        className={`touch-none ${className}`}
        style={{
          width: containerSize,
          height: containerSize,
          cursor: "grab",
          borderRadius: 16,
          display: "block",
        }}
        aria-label="Interactive square sphere"
      />

      {showModal && selectedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm"
          onClick={() => setSelectedImage(null)}
        >
          <div
            className="sm-glass-strong w-full max-w-md overflow-hidden rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative aspect-square bg-neutral-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selectedImage.src}
                alt={selectedImage.alt}
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => setSelectedImage(null)}
                className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            {(selectedImage.title || selectedImage.description) && (
              <div className="p-5">
                {selectedImage.title && (
                  <h3 className="mb-1 text-lg font-semibold">
                    {selectedImage.title}
                  </h3>
                )}
                {selectedImage.description && (
                  <p className="text-sm capitalize text-neutral-600">
                    {selectedImage.description}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default SphereImageGrid;
