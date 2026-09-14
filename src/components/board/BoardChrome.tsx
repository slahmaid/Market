"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { ZoomControls } from "./ZoomControls";

type BoardChromeProps = {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
};

export function BoardChrome({ onZoomIn, onZoomOut, onFit }: BoardChromeProps) {
  const { data: session } = useSession();
  const email = session?.user?.email ?? null;
  const shortEmail =
    email && email.length > 18 ? `${email.slice(0, 14)}…` : email;

  return (
    <div
      className="sm-chrome pointer-events-none fixed inset-x-0 top-0 z-10 flex items-start justify-between gap-2 px-3 sm:p-3"
      style={{
        paddingTop: "max(0.75rem, var(--safe-top))",
        paddingLeft: "max(0.75rem, var(--safe-left))",
        paddingRight: "max(0.75rem, var(--safe-right))",
      }}
    >
      <div className="pointer-events-auto">
        <ZoomControls onZoomIn={onZoomIn} onZoomOut={onZoomOut} onFit={onFit} />
      </div>
      <div className="pointer-events-auto flex max-w-[55%] items-center gap-1 sm:gap-3 rounded-xl bg-white/95 border border-black/10 shadow-sm px-1.5 py-1 sm:px-3 sm:py-2 text-sm backdrop-blur-md">
        {email ? (
          <>
            <Link
              href="/dashboard"
              className="sm-press min-h-11 inline-flex items-center px-3 py-2 text-neutral-800 font-medium active:bg-neutral-100 rounded-lg touch-manipulation"
            >
              Dashboard
            </Link>
            <span
              className="truncate px-2 py-2 text-neutral-700 text-xs sm:text-sm"
              title={email}
            >
              <span className="sm:hidden">{shortEmail}</span>
              <span className="hidden sm:inline">{email}</span>
            </span>
          </>
        ) : (
          <>
            <Link
              href="/login"
              className="sm-press min-h-11 inline-flex items-center px-3 py-2 text-neutral-800 font-medium active:bg-neutral-100 rounded-lg touch-manipulation"
            >
              Log in
            </Link>
            <Link
              href="/register"
              className="sm-press min-h-11 inline-flex items-center px-3 py-2 rounded-lg bg-neutral-900 text-white font-medium active:bg-neutral-800 touch-manipulation"
            >
              <span className="sm:hidden">Join</span>
              <span className="hidden sm:inline">Register</span>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
