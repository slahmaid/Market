"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { AccountFab } from "./AccountFab";

export type AppChromeActive =
  | "board"
  | "search"
  | "messages"
  | "dashboard";

const NAV: { id: AppChromeActive; href: string; label: string }[] = [
  { id: "board", href: "/", label: "Board" },
  { id: "search", href: "/search", label: "Search" },
  { id: "messages", href: "/messages", label: "Messages" },
  { id: "dashboard", href: "/dashboard", label: "My squares" },
];

function navClass(isActive: boolean) {
  return `sm-press min-h-11 shrink-0 inline-flex items-center px-3 py-2 text-neutral-800 active:bg-white/50 rounded-xl touch-manipulation ${
    isActive ? "font-semibold" : "font-medium"
  }`;
}

export function AppChrome({
  active,
}: {
  active?: AppChromeActive;
} = {}) {
  const { data: session } = useSession();
  const email = session?.user?.email ?? null;
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setDrawerOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [drawerOpen]);

  return (
    <>
      <header
        className="sm-chrome z-30 flex shrink-0 items-center justify-center gap-2 border-b border-black/5 bg-transparent px-3 py-2.5"
        style={{
          paddingTop: "max(0.5rem, var(--safe-top))",
          paddingLeft: "max(0.75rem, var(--safe-left))",
          paddingRight: "max(0.75rem, var(--safe-right))",
        }}
      >
        <div className="sm-glass flex w-full max-w-[95%] items-center gap-1 rounded-2xl px-1.5 py-1 md:max-w-[85%] md:gap-2 md:px-2 md:py-1.5 text-sm">
          {/* Mobile hamburger */}
          <button
            type="button"
            className="sm-press inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-neutral-800 active:bg-white/50 touch-manipulation md:hidden"
            aria-label={drawerOpen ? "Close menu" : "Open menu"}
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen((v) => !v)}
          >
            {drawerOpen ? (
              <X className="h-5 w-5" aria-hidden />
            ) : (
              <Menu className="h-5 w-5" aria-hidden />
            )}
          </button>

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
              className="min-h-11 min-w-0 flex-1 rounded-xl border-0 bg-transparent px-2 text-xs text-neutral-800 outline-none placeholder:text-neutral-400 md:text-sm"
            />
            <button
              type="submit"
              className="sm-press min-h-11 shrink-0 rounded-xl px-2 text-xs font-medium text-neutral-800 active:bg-white/50 md:px-3"
            >
              Go
            </button>
          </form>

          {/* Desktop nav + auth */}
          <nav className="hidden items-center gap-0.5 md:flex">
            {NAV.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className={navClass(active === item.id)}
              >
                {item.label}
              </Link>
            ))}
            {email ? (
              <>
                <span
                  className="max-w-[10rem] truncate px-3 py-2 text-xs text-neutral-700 lg:max-w-[14rem] lg:text-sm"
                  title={email}
                >
                  {email}
                </span>
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="sm-press min-h-11 shrink-0 inline-flex items-center rounded-xl px-3 py-2 font-medium text-neutral-800 active:bg-white/50 touch-manipulation"
                >
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="sm-press min-h-11 inline-flex items-center rounded-xl px-3 py-2 font-medium text-neutral-800 active:bg-white/50 touch-manipulation"
                >
                  Log in
                </Link>
                <Link
                  href="/register"
                  className="sm-press min-h-11 inline-flex items-center rounded-xl bg-[var(--accent)] px-3 py-2 font-medium text-white active:opacity-90 touch-manipulation"
                >
                  Register
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Mobile drawer */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Dismiss menu"
            className="sm-scrim absolute inset-0 bg-black/30"
            onClick={() => setDrawerOpen(false)}
          />
          <nav
            className="absolute inset-y-0 left-0 flex w-[min(18rem,86vw)] flex-col border-r border-black/10 bg-white shadow-xl"
            style={{
              paddingTop: "max(0.75rem, var(--safe-top))",
              paddingBottom: "max(0.75rem, var(--safe-bottom))",
            }}
            aria-label="Main"
          >
            <div className="flex items-center justify-between border-b border-black/5 px-4 py-3">
              <p className="text-sm font-semibold text-neutral-900">Menu</p>
              <button
                type="button"
                className="sm-press inline-flex h-11 w-11 items-center justify-center rounded-xl text-neutral-700 active:bg-white/50 touch-manipulation"
                aria-label="Close menu"
                onClick={() => setDrawerOpen(false)}
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <ul className="flex flex-col gap-0.5 p-2">
              {NAV.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    onClick={() => setDrawerOpen(false)}
                    className={`sm-press flex min-h-12 items-center rounded-xl px-4 text-base touch-manipulation ${
                      active === item.id
                        ? "bg-neutral-900 font-semibold text-white"
                        : "font-medium text-neutral-800 active:bg-white/50"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
            {email ? (
              <p
                className="mt-auto truncate border-t border-black/5 px-4 py-3 text-xs text-neutral-500"
                title={email}
              >
                {email}
              </p>
            ) : null}
          </nav>
        </div>
      ) : null}

      <AccountFab />
    </>
  );
}
