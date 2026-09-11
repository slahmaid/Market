"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { startPrimaryCheckout } from "@/lib/checkout/startPrimaryCheckout";

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
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function labelTone(label: string) {
  switch (label) {
    case "fair":
      return "bg-emerald-50 text-emerald-800 border-emerald-200";
    case "balanced":
      return "bg-amber-50 text-amber-900 border-amber-200";
    case "unfair":
      return "bg-rose-50 text-rose-800 border-rose-200";
    default:
      return "bg-neutral-50 text-neutral-700 border-neutral-200";
  }
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
  const [buying, setBuying] = useState(false);
  const [buyError, setBuyError] = useState<string | null>(null);

  useEffect(() => {
    if (!squareId) {
      setData(null);
      return;
    }
    let cancelled = false;
    setData(null);
    setError(null);
    setBuyError(null);
    setBuying(false);
    fetch(`/api/squares/${squareId}`)
      .then(async (r) => {
        const text = await r.text();
        if (!r.ok || !text.trim()) {
          throw new Error("Failed to load square");
        }
        return JSON.parse(text) as Detail;
      })
      .then((j) => {
        if (!cancelled) setData(j);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load square");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [squareId]);

  async function onBuy() {
    if (!squareId || buying) return;
    setBuying(true);
    setBuyError(null);
    try {
      const url = await startPrimaryCheckout(squareId);
      window.location.assign(url);
    } catch (e) {
      setBuyError(e instanceof Error ? e.message : "Checkout failed");
      setBuying(false);
    }
  }

  if (!squareId) return null;

  const isPlatform = data?.square.status === "platform";
  const loggedIn = Boolean(session?.user);

  return (
    <>
      {/* Mobile scrim — tap outside to close */}
      <button
        type="button"
        aria-label="Dismiss square details"
        className="sm-scrim fixed inset-0 z-20 bg-black/25 md:hidden touch-manipulation"
        onClick={onClose}
      />

      <aside
        className="sm-panel fixed z-30 bg-white shadow-xl
          max-md:inset-x-0 max-md:bottom-0 max-md:left-0 max-md:right-0
          max-md:rounded-t-2xl max-md:border-t max-md:border-black/10
          max-md:max-h-[min(70dvh,520px)] max-md:overflow-y-auto
          md:inset-y-0 md:right-0 md:top-0 md:h-full md:w-full md:max-w-md
          md:border-l md:border-black/10 md:rounded-none"
        style={{
          paddingBottom: "max(1rem, var(--safe-bottom))",
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="square-panel-title"
      >
        {/* Mobile drag affordance */}
        <div className="md:hidden flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-neutral-300" aria-hidden />
        </div>

        <div className="px-5 pt-2 pb-4 md:p-5 md:pt-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2
                id="square-panel-title"
                className="text-lg font-semibold text-neutral-900"
              >
                Square
              </h2>
              {data && (
                <p className="mt-0.5 text-sm text-neutral-500">
                  ({data.square.x}, {data.square.y}) · {data.square.status}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="sm-press min-h-11 min-w-11 -mr-2 inline-flex items-center justify-center rounded-lg text-neutral-500 active:bg-neutral-100 touch-manipulation"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          {!data && !error && (
            <p className="mt-6 text-sm text-neutral-500">Loading…</p>
          )}

          {data && (
            <div className="mt-5 space-y-4 text-sm text-neutral-800">
              <div>
                <p className="text-3xl font-semibold tracking-tight text-neutral-900 tabular-nums">
                  {formatUsd(data.quote.askCents)}
                </p>
                <span
                  className={`mt-2 inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${labelTone(data.quote.label)}`}
                >
                  {data.quote.label}
                </span>
                <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                  {data.quote.reason}
                </p>
              </div>

              {isPlatform &&
                (loggedIn ? (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={onBuy}
                      disabled={buying}
                      className="sm-press w-full min-h-12 rounded-xl bg-neutral-900 text-white text-sm font-semibold active:bg-neutral-800 disabled:opacity-60 touch-manipulation"
                    >
                      {buying ? "Redirecting…" : "Buy"}
                    </button>
                    {buyError && (
                      <p className="text-sm text-red-600" role="alert">
                        {buyError}
                      </p>
                    )}
                  </div>
                ) : (
                  <Link
                    href="/login"
                    className="sm-press flex w-full min-h-12 items-center justify-center rounded-xl bg-neutral-900 text-white text-sm font-semibold active:bg-neutral-800 touch-manipulation"
                  >
                    Log in to buy
                  </Link>
                ))}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
