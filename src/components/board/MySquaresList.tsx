"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  SquareDetailsDropdown,
  type SquareUpdatedPayload,
} from "./SquareDetailsDropdown";

export type MySquareRow = {
  id: string;
  x: number;
  y: number;
  status: string;
  imageUrl: string | null;
  linkUrl: string | null;
  listPriceCents: number | null;
};

function formatUsd(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

type MySquaresListProps = {
  compact?: boolean;
  onSquareUpdated?: (square: SquareUpdatedPayload) => void;
};

export function MySquaresList({ compact, onSquareUpdated }: MySquaresListProps) {
  const [squares, setSquares] = useState<MySquareRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/me/squares");
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          if (!cancelled) {
            setError(body?.error ?? "Failed to load squares");
            setSquares([]);
          }
          return;
        }
        const data = (await res.json()) as { squares: MySquareRow[] };
        if (!cancelled) {
          setSquares(data.squares);
          setError(null);
        }
      } catch {
        if (!cancelled) {
          setError("Failed to load squares");
          setSquares([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const pad = compact ? "px-3 py-3" : "px-6 py-8";
  const rowPad = compact ? "px-3 py-2.5" : "px-4 py-3";
  const thumb = compact ? "h-11 w-11 rounded-lg" : "h-14 w-14 rounded-xl";
  const linkPad = compact ? "px-3" : "px-4";

  function applyUpdate(updated: SquareUpdatedPayload) {
    setSquares((prev) =>
      prev
        ? prev.map((s) =>
            s.id === updated.id
              ? {
                  ...s,
                  imageUrl: updated.imageUrl,
                  linkUrl: updated.linkUrl,
                  status: updated.status,
                  listPriceCents: updated.listPriceCents,
                }
              : s,
          )
        : prev,
    );
    onSquareUpdated?.(updated);
  }

  if (squares === null) {
    return <p className={`${pad} text-sm text-neutral-500`}>Loading…</p>;
  }

  if (error) {
    return <p className={`${pad} text-sm text-red-600`}>{error}</p>;
  }

  if (squares.length === 0) {
    return (
      <div className={`${pad} space-y-3`}>
        <p className="text-sm text-neutral-600">You don’t own any squares yet.</p>
        <Link
          href="/"
          className="inline-flex text-sm text-neutral-700 underline-offset-2 hover:underline"
        >
          Buy a square on the Board
        </Link>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-neutral-100/80">
      {squares.map((square) => {
        const open = expandedId === square.id;
        return (
          <li key={square.id} className={open ? "bg-white/40" : undefined}>
            <button
              type="button"
              aria-expanded={open}
              onClick={() =>
                setExpandedId((id) => (id === square.id ? null : square.id))
              }
              className={`sm-press flex w-full min-h-11 items-center gap-3 ${rowPad} text-left active:bg-neutral-50/80 touch-manipulation`}
            >
              <div
                className={`${thumb} shrink-0 overflow-hidden border border-neutral-200 bg-neutral-100`}
              >
                {square.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={square.imageUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-neutral-400">
                    —
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-neutral-900">
                  ({square.x}, {square.y})
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-medium ${
                      square.status === "listed"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border-neutral-200 bg-neutral-50 text-neutral-700"
                    }`}
                  >
                    {square.status}
                  </span>
                  {square.status === "listed" &&
                    square.listPriceCents != null && (
                      <span className="text-sm text-neutral-600">
                        {formatUsd(square.listPriceCents)}
                      </span>
                    )}
                </div>
              </div>
              <span
                className={`shrink-0 text-neutral-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
                aria-hidden
              >
                ▾
              </span>
            </button>
            <div
              className={`flex flex-wrap gap-3 pb-2.5 text-sm ${linkPad}`}
            >
              <Link
                href={`/store/${square.id}`}
                className="text-neutral-700 underline-offset-2 hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                View store
              </Link>
              <Link
                href={`/store/${square.id}/edit`}
                className="text-neutral-700 underline-offset-2 hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                Edit store
              </Link>
            </div>
            {open && (
              <div className="sm-fade-in">
                <SquareDetailsDropdown
                  squareId={square.id}
                  onSquareUpdated={applyUpdate}
                />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
