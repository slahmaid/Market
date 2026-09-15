"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";

export function BoardChrome() {
  const { data: session } = useSession();
  const email = session?.user?.email ?? null;
  const shortEmail =
    email && email.length > 18 ? `${email.slice(0, 14)}…` : email;

  return (
    <header
      className="sm-chrome z-10 flex shrink-0 items-center justify-between gap-2 border-b border-black/5 bg-transparent px-3 py-2.5"
      style={{
        paddingTop: "max(0.5rem, var(--safe-top))",
        paddingLeft: "max(0.75rem, var(--safe-left))",
        paddingRight: "max(0.75rem, var(--safe-right))",
      }}
    >
      <div className="sm-glass flex max-w-[95%] flex-1 items-center gap-1 rounded-2xl px-1.5 py-1 sm:max-w-[85%] sm:gap-2 sm:px-2 sm:py-1.5 text-sm">
        <form
          method="GET"
          action="/search"
          className="flex min-w-0 flex-1 items-center gap-1"
        >
          <input
            type="search"
            name="q"
            placeholder="Search…"
            aria-label="Search"
            className="min-h-11 min-w-0 flex-1 rounded-xl border-0 bg-transparent px-2 text-xs text-neutral-800 outline-none placeholder:text-neutral-400 sm:text-sm"
          />
          <button
            type="submit"
            className="sm-press min-h-11 shrink-0 rounded-xl px-2 text-xs font-medium text-neutral-800 active:bg-white/50 sm:px-3"
          >
            Go
          </button>
        </form>
        {email ? (
          <>
            <span
              className="truncate px-3 py-2 text-neutral-700 text-xs sm:text-sm"
              title={email}
            >
              <span className="sm:hidden">{shortEmail}</span>
              <span className="hidden sm:inline">{email}</span>
            </span>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/" })}
              className="sm-press min-h-11 shrink-0 inline-flex items-center px-3 py-2 text-neutral-800 font-medium active:bg-white/50 rounded-xl touch-manipulation"
            >
              Log out
            </button>
          </>
        ) : (
          <>
            <Link
              href="/login"
              className="sm-press min-h-11 inline-flex items-center px-3 py-2 text-neutral-800 font-medium active:bg-white/50 rounded-xl touch-manipulation"
            >
              Log in
            </Link>
            <Link
              href="/register"
              className="sm-press min-h-11 inline-flex items-center px-3 py-2 rounded-xl bg-[var(--accent)] text-white font-medium active:opacity-90 touch-manipulation"
            >
              <span className="sm:hidden">Join</span>
              <span className="hidden sm:inline">Register</span>
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
