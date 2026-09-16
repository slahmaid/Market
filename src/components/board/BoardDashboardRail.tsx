"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { MySquaresList } from "./MySquaresList";
import type { SquareUpdatedPayload } from "./SquareDetailsDropdown";

type BoardDashboardRailProps = {
  onSquareUpdated?: (square: SquareUpdatedPayload) => void;
  /** Mobile expand state; desktop always shows the body. */
  open?: boolean;
  onToggle?: () => void;
};

export function BoardDashboardRail({
  onSquareUpdated,
  open = true,
  onToggle,
}: BoardDashboardRailProps) {
  const { data: session, status } = useSession();
  const email = session?.user?.email ?? null;

  return (
    <aside
      id="board-dashboard"
      className="sm-glass-strong flex min-w-0 shrink-0 flex-col rounded-none border-y-0 border-l-0 max-md:border-b max-md:border-black/5 md:h-full md:flex-1 md:basis-0 md:border-b-0"
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls="board-dashboard-body"
        className="sm-press flex w-full shrink-0 items-center justify-between gap-2 border-b border-black/5 px-3 py-3 text-left touch-manipulation sm:px-4 md:cursor-default md:active:transform-none"
      >
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-neutral-900">My squares</h2>
          {email && (
            <p
              className="mt-0.5 truncate text-xs text-neutral-500"
              title={email}
            >
              {email}
            </p>
          )}
        </div>
        <span
          className={`md:hidden text-neutral-500 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden
        >
          ▾
        </span>
      </button>

      <div
        id="board-dashboard-body"
        className={`min-h-0 overflow-y-auto overscroll-contain md:block md:flex-1 ${
          open
            ? "block max-h-[min(40vh,280px)] md:max-h-none"
            : "hidden"
        }`}
      >
        {status === "loading" && (
          <p className="px-3 py-3 text-sm text-neutral-500">Loading…</p>
        )}

        {status !== "loading" && !email && (
          <div className="space-y-3 px-3 py-4 sm:px-4">
            <p className="text-sm text-neutral-600">
              Log in to see squares you own here.
            </p>
            <div className="flex flex-col gap-2">
              <Link
                href="/login?callbackUrl=/"
                className="sm-press inline-flex min-h-11 items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 text-sm font-medium text-neutral-800 active:bg-neutral-50 touch-manipulation"
              >
                Log in
              </Link>
              <Link
                href="/register"
                className="sm-press inline-flex min-h-11 items-center justify-center rounded-xl bg-neutral-900 px-4 text-sm font-semibold text-white active:bg-neutral-800 touch-manipulation"
              >
                Register
              </Link>
            </div>
          </div>
        )}

        {status !== "loading" && email && (
          <MySquaresList compact onSquareUpdated={onSquareUpdated} />
        )}
      </div>
    </aside>
  );
}
