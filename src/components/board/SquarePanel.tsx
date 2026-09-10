"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

type Detail = {
  square: { id: string; x: number; y: number; status: string };
  quote: {
    askCents: number;
    suggestedPriceCents: number;
    label: string;
    reason: string;
  };
};

function formatUsd(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export function SquarePanel({
  squareId,
  onClose,
}: {
  squareId: string | null;
  onClose: () => void;
}) {
  const { data: session } = useSession();
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!squareId) {
      setData(null);
      return;
    }
    let cancelled = false;
    setError(null);
    fetch(`/api/squares/${squareId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("Failed to load square");
        return r.json();
      })
      .then((j) => {
        if (!cancelled) setData(j);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [squareId]);

  if (!squareId) return null;

  return (
    <aside className="fixed z-20 right-0 top-0 h-full w-full max-w-md bg-white border-l border-black/10 p-5 shadow-lg md:top-0 max-md:top-auto max-md:bottom-0 max-md:h-auto max-md:max-h-[55vh] max-md:right-0 max-md:left-0 max-md:border-l-0 max-md:border-t">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-semibold text-neutral-900">Square</h2>
        <button type="button" onClick={onClose} className="text-neutral-500">
          Close
        </button>
      </div>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {!data && !error && <p className="mt-3 text-sm text-neutral-500">Loading…</p>}
      {data && (
        <div className="mt-4 space-y-3 text-sm text-neutral-800">
          <p>
            Coords: ({data.square.x}, {data.square.y})
          </p>
          <p>Status: {data.square.status}</p>
          <p className="text-base font-medium">{formatUsd(data.quote.askCents)}</p>
          <p>
            <span className="uppercase tracking-wide text-xs font-semibold">{data.quote.label}</span>
            {" — "}
            {data.quote.reason}
          </p>
          {session?.user ? (
            <button
              type="button"
              disabled
              className="w-full bg-neutral-200 text-neutral-600 py-2 cursor-not-allowed"
            >
              Buying comes in Phase 2
            </button>
          ) : (
            <Link
              href="/login"
              className="block w-full bg-neutral-900 text-white py-2 text-center text-sm font-medium"
            >
              Log in to buy
            </Link>
          )}
        </div>
      )}
    </aside>
  );
}
