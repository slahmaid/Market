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

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-10 flex items-start justify-between gap-3 p-3">
      <div className="pointer-events-auto">
        <ZoomControls onZoomIn={onZoomIn} onZoomOut={onZoomOut} onFit={onFit} />
      </div>
      <div className="pointer-events-auto flex items-center gap-3 rounded-lg bg-white/90 border border-black/10 shadow-sm px-3 py-2 text-sm backdrop-blur-sm">
        {session?.user?.email ? (
          <span className="text-neutral-700">{session.user.email}</span>
        ) : (
          <>
            <Link href="/login" className="text-neutral-700 hover:underline">
              Log in
            </Link>
            <Link href="/register" className="text-neutral-700 hover:underline">
              Register
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
