"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type SquareRow = {
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

export default function MySquaresClient() {
  const [squares, setSquares] = useState<SquareRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        const data = (await res.json()) as { squares: SquareRow[] };
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

  return (
    <main
      className="min-h-[100dvh] bg-[#f6f7f9] px-4 py-8"
      style={{
        paddingTop: "max(2rem, var(--safe-top))",
        paddingBottom: "max(2rem, var(--safe-bottom))",
      }}
    >
      <div className="mx-auto w-full max-w-lg space-y-4">
        <header className="rounded-2xl bg-white p-6 shadow-sm border border-black/5">
          <Link
            href="/"
            className="text-sm text-neutral-500 active:text-neutral-800 min-h-11 inline-flex items-center"
          >
            ← Board
          </Link>
          <h1 className="mt-3 text-2xl font-semibold text-neutral-900">
            My squares
          </h1>
        </header>

        <section className="rounded-2xl bg-white shadow-sm border border-black/5 overflow-hidden">
          {squares === null && (
            <p className="px-6 py-8 text-sm text-neutral-500">Loading…</p>
          )}

          {squares !== null && error && (
            <p className="px-6 py-8 text-sm text-red-600">{error}</p>
          )}

          {squares !== null && !error && squares.length === 0 && (
            <div className="px-6 py-8 space-y-3">
              <p className="text-sm text-neutral-600">
                You don’t own any squares yet.
              </p>
              <Link
                href="/"
                className="sm-press inline-flex min-h-11 items-center justify-center rounded-xl bg-neutral-900 px-4 text-sm font-semibold text-white active:bg-neutral-800 touch-manipulation"
              >
                Browse the board
              </Link>
            </div>
          )}

          {squares !== null && !error && squares.length > 0 && (
            <ul className="divide-y divide-neutral-100">
              {squares.map((square) => (
                <li key={square.id} className="px-4 py-3">
                  <Link
                    href={`/?square=${square.id}`}
                    className="sm-press flex min-h-11 items-center gap-3 active:bg-neutral-50 touch-manipulation rounded-lg"
                  >
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100">
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
                  </Link>
                  <div className="mt-2 flex flex-wrap gap-3 pl-[4.25rem] text-sm">
                    <Link
                      href={`/store/${square.id}`}
                      className="text-neutral-600 underline-offset-2 hover:underline"
                    >
                      View store
                    </Link>
                    <Link
                      href={`/store/${square.id}/edit`}
                      className="text-neutral-600 underline-offset-2 hover:underline"
                    >
                      Edit store
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
