"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { MySquaresList } from "./MySquaresList";
import type { SquareUpdatedPayload } from "./SquareDetailsDropdown";

type BoardDashboardRailProps = {
  onSquareUpdated?: (square: SquareUpdatedPayload) => void;
};

export function BoardDashboardRail({ onSquareUpdated }: BoardDashboardRailProps) {
  const { data: session, status } = useSession();
  const email = session?.user?.email ?? null;

  return (
    <aside
      id="board-dashboard"
      className="sm-glass-strong flex h-full min-w-0 flex-1 basis-0 flex-col rounded-none border-y-0 border-l-0"
    >
      <div className="shrink-0 border-b border-black/5 px-3 py-3 sm:px-4">
        <h2 className="text-sm font-semibold text-neutral-900">My squares</h2>
        {email && (
          <p className="mt-0.5 truncate text-xs text-neutral-500" title={email}>
            {email}
          </p>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
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
