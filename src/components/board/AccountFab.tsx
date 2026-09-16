"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { User } from "lucide-react";
import { signOut, useSession } from "next-auth/react";

/** Fixed bottom-right account control (mobile only). */
export function AccountFab() {
  const { data: session, status } = useSession();
  const loggedIn = Boolean(session?.user);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      const el = rootRef.current;
      if (el && !el.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (status === "loading") return null;

  return (
    <div
      ref={rootRef}
      className="fixed z-50 md:hidden"
      style={{
        right: "max(0.75rem, var(--safe-right))",
        bottom: "max(0.75rem, var(--safe-bottom))",
      }}
    >
      {open ? (
        <div
          role="menu"
          className="absolute bottom-[calc(100%+0.5rem)] right-0 min-w-[10.5rem] overflow-hidden rounded-2xl border border-black/10 bg-white py-1 shadow-lg"
        >
          {loggedIn ? (
            <button
              type="button"
              role="menuitem"
              className="sm-press flex w-full min-h-11 items-center px-4 text-left text-sm font-medium text-neutral-900 active:bg-white/50 touch-manipulation"
              onClick={() => {
                setOpen(false);
                void signOut({ callbackUrl: "/" });
              }}
            >
              Log out
            </button>
          ) : (
            <>
              <Link
                href="/login"
                role="menuitem"
                className="sm-press flex min-h-11 items-center px-4 text-sm font-medium text-neutral-900 active:bg-white/50 touch-manipulation"
                onClick={() => setOpen(false)}
              >
                Login
              </Link>
              <Link
                href="/register"
                role="menuitem"
                className="sm-press flex min-h-11 items-center px-4 text-sm font-medium text-neutral-900 active:bg-white/50 touch-manipulation"
                onClick={() => setOpen(false)}
              >
                Register
              </Link>
            </>
          )}
        </div>
      ) : null}

      <button
        type="button"
        aria-label={loggedIn ? "Account menu" : "Log in or register"}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className={`sm-press flex h-12 w-12 items-center justify-center rounded-xl text-white shadow-md touch-manipulation active:scale-95 ${
          loggedIn
            ? "bg-emerald-300 text-emerald-950"
            : "bg-red-500 text-white"
        }`}
      >
        <User className="h-5 w-5" strokeWidth={2.25} aria-hidden />
      </button>
    </div>
  );
}
