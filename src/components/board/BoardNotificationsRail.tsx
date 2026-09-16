"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { startPrimaryCheckout } from "@/lib/checkout/startPrimaryCheckout";

type RailTab = "activity" | "for-sale";
type FeedType = "sale" | "listing";
type FilterId = "all" | FeedType;

type FeedItem = {
  id: string;
  type: FeedType;
  title: string;
  subtitle: string;
  createdAt: string;
  squareId: string | null;
  accent: string;
};

type AvailableSquare = {
  id: string;
  x: number;
  y: number;
  askCents: number;
};

const FILTERS: { id: FilterId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "sale", label: "Sales" },
  { id: "listing", label: "Listings" },
];

const TYPE_LABEL: Record<FeedType, string> = {
  sale: "Sale",
  listing: "Listing",
};

const TYPE_TONE: Record<FeedType, string> = {
  sale: "border-emerald-200 bg-emerald-50 text-emerald-800",
  listing: "border-indigo-200 bg-indigo-50 text-indigo-800",
};

const READ_KEY = "sm-feed-read-ids";
const PAGE_SIZE = 50;

function formatUsd(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function loadReadIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(READ_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

function saveReadIds(ids: Set<string>) {
  localStorage.setItem(READ_KEY, JSON.stringify([...ids]));
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const minutesAgo = Math.max(0, Math.floor((Date.now() - then) / 60_000));
  if (minutesAgo < 1) return "Just now";
  if (minutesAgo < 60) return `${minutesAgo}m ago`;
  const hours = Math.floor(minutesAgo / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

type BoardNotificationsRailProps = {
  focusedSquareId?: string | null;
  onFocusSquare?: (id: string) => void;
  /** Mobile expand state; desktop always shows the body. */
  open?: boolean;
  onToggle?: () => void;
};

export function BoardNotificationsRail({
  focusedSquareId = null,
  onFocusSquare,
  open = true,
  onToggle,
}: BoardNotificationsRailProps) {
  const { data: session, status: sessionStatus } = useSession();
  const [tab, setTab] = useState<RailTab>("activity");
  const [filter, setFilter] = useState<FilterId>("all");
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());

  const [saleSquares, setSaleSquares] = useState<AvailableSquare[]>([]);
  const [saleNextOffset, setSaleNextOffset] = useState<number | null>(null);
  const [saleLoading, setSaleLoading] = useState(false);
  const [saleError, setSaleError] = useState<string | null>(null);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [buyError, setBuyError] = useState<string | null>(null);

  useEffect(() => {
    setReadIds(loadReadIds());
  }, []);

  useEffect(() => {
    if (sessionStatus === "loading") return;
    if (!session?.user) {
      setItems([]);
      setError(null);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/me/feed");
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          if (!cancelled) {
            setError(body?.error ?? "Failed to load activity");
            setItems([]);
          }
          return;
        }
        const data = (await res.json()) as { items: FeedItem[] };
        if (!cancelled) {
          setItems(data.items);
          setError(null);
        }
      } catch {
        if (!cancelled) {
          setError("Failed to load activity");
          setItems([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionStatus, session?.user]);

  async function loadAvailable(offset: number, append: boolean) {
    setSaleLoading(true);
    setSaleError(null);
    try {
      const res = await fetch(
        `/api/squares/available?limit=${PAGE_SIZE}&offset=${offset}`,
      );
      const data = (await res.json().catch(() => null)) as {
        squares?: AvailableSquare[];
        nextOffset?: number | null;
        error?: string;
      } | null;
      if (!res.ok) {
        setSaleError(data?.error ?? "Failed to load squares");
        if (!append) setSaleSquares([]);
        return;
      }
      const next = Array.isArray(data?.squares) ? data.squares : [];
      setSaleSquares((prev) => (append ? [...prev, ...next] : next));
      setSaleNextOffset(
        typeof data?.nextOffset === "number" ? data.nextOffset : null,
      );
    } catch {
      setSaleError("Failed to load squares");
      if (!append) setSaleSquares([]);
    } finally {
      setSaleLoading(false);
    }
  }

  useEffect(() => {
    if (tab !== "for-sale") return;
    void loadAvailable(0, false);
  }, [tab]);

  const visible = useMemo(() => {
    if (!items) return [];
    return items.filter((item) =>
      filter === "all" ? true : item.type === filter,
    );
  }, [items, filter]);

  const unreadCount = useMemo(() => {
    if (!items) return 0;
    return items.filter((i) => !readIds.has(i.id)).length;
  }, [items, readIds]);

  function markAllRead() {
    if (!items) return;
    const next = new Set(readIds);
    for (const i of items) next.add(i.id);
    setReadIds(next);
    saveReadIds(next);
  }

  function markRead(id: string) {
    const next = new Set(readIds);
    next.add(id);
    setReadIds(next);
    saveReadIds(next);
  }

  async function onBuy(squareId: string) {
    if (buyingId) return;
    setBuyingId(squareId);
    setBuyError(null);
    try {
      const url = await startPrimaryCheckout(squareId);
      window.location.assign(url);
    } catch (e) {
      setBuyError(e instanceof Error ? e.message : "Checkout failed");
      setBuyingId(null);
    }
  }

  const loggedOut = sessionStatus !== "loading" && !session?.user;

  return (
    <aside
      id="board-notifications"
      className="sm-glass-strong flex min-w-0 shrink-0 flex-col rounded-none border-y-0 border-r-0 max-md:border-t max-md:border-black/5 md:h-full md:flex-1 md:basis-0 md:border-t-0"
    >
      <div className="shrink-0 border-b border-black/5">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls="board-notifications-body"
          className="sm-press flex w-full items-center justify-between gap-2 px-3 py-3 text-left touch-manipulation sm:px-4 md:cursor-default md:active:transform-none"
        >
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-neutral-900">
              Notifications
              {unreadCount > 0 ? (
                <span className="ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  {unreadCount}
                </span>
              ) : null}
            </h2>
            <p className="mt-0.5 text-xs text-neutral-500 md:hidden">
              {open
                ? tab === "for-sale"
                  ? "Available squares"
                  : "Your activity"
                : "Tap to expand"}
            </p>
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
          className={`px-3 pb-3 sm:px-4 ${
            open ? "block" : "hidden"
          } md:block`}
        >
          <div className="flex gap-1 rounded-xl bg-black/[0.04] p-1">
            {(
              [
                { id: "activity", label: "Activity" },
                { id: "for-sale", label: "For sale" },
              ] as const
            ).map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`sm-press flex-1 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold touch-manipulation ${
                    active
                      ? "bg-white text-neutral-900 shadow-sm"
                      : "text-neutral-600 active:bg-white/50"
                  }`}
                >
                  {t.label}
                  {t.id === "activity" && unreadCount > 0 ? (
                    <span className="ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      {unreadCount}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          {tab === "activity" ? (
            <>
              <div className="mt-3 flex items-start justify-between gap-2">
                <p className="text-xs text-neutral-500">Your activity</p>
                <button
                  type="button"
                  onClick={markAllRead}
                  disabled={unreadCount === 0}
                  className="sm-press shrink-0 rounded-lg px-2 py-1.5 text-[11px] font-medium text-neutral-600 active:bg-white/50 disabled:opacity-40"
                >
                  Mark all read
                </button>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {FILTERS.map((f) => {
                  const active = filter === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFilter(f.id)}
                      className={`sm-press rounded-full px-2.5 py-1 text-[11px] font-medium touch-manipulation ${
                        active
                          ? "bg-neutral-900 text-white"
                          : "bg-white/60 text-neutral-600 active:bg-white/80"
                      }`}
                    >
                      {f.label}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="mt-3">
              <p className="text-xs text-neutral-500">
                Cheapest platform squares first
              </p>
              {buyError ? (
                <p className="mt-2 text-xs text-red-600">{buyError}</p>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <div
        id="board-notifications-body"
        className={`min-h-0 overflow-y-auto overscroll-contain md:block md:flex-1 ${
          open
            ? "block max-h-[min(42vh,320px)] md:max-h-none"
            : "hidden"
        }`}
      >
        {tab === "activity" ? (
          sessionStatus === "loading" || items === null ? (
            <p className="px-3 py-4 text-sm text-neutral-500">Loading…</p>
          ) : loggedOut ? (
            <div className="flex flex-col items-center px-4 py-10 text-center">
              <p className="text-sm font-medium text-neutral-800">
                Log in to see activity
              </p>
              <p className="mt-1 max-w-[16rem] text-xs leading-relaxed text-neutral-500">
                Purchases and your listings will show up here.
              </p>
            </div>
          ) : error ? (
            <p className="px-3 py-4 text-sm text-red-600">{error}</p>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center px-4 py-10 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/70 text-lg text-neutral-400">
                ✦
              </div>
              <p className="text-sm font-medium text-neutral-800">
                No activity yet
              </p>
              <p className="mt-1 max-w-[16rem] text-xs leading-relaxed text-neutral-500">
                When you buy a square or list one for sale, it appears in this
                feed.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-neutral-100/80">
              {visible.map((item) => {
                const unread = !readIds.has(item.id);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => markRead(item.id)}
                      className={`sm-press flex w-full gap-3 px-3 py-3 text-left touch-manipulation active:bg-white/40 sm:px-4 ${
                        unread ? "bg-[var(--accent)]/[0.04]" : ""
                      }`}
                    >
                      <div className="relative shrink-0">
                        <div
                          className="h-10 w-10 rounded-xl border border-black/5 shadow-sm"
                          style={{ background: item.accent }}
                          aria-hidden
                        />
                        {unread && (
                          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-[var(--accent)]" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <span
                            className={`inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${TYPE_TONE[item.type]}`}
                          >
                            {TYPE_LABEL[item.type]}
                          </span>
                          <time className="shrink-0 text-[10px] text-neutral-400">
                            {formatRelative(item.createdAt)}
                          </time>
                        </div>
                        <p
                          className={`mt-1 text-sm leading-snug ${
                            unread
                              ? "font-semibold text-neutral-900"
                              : "font-medium text-neutral-800"
                          }`}
                        >
                          {item.title}
                        </p>
                        <p className="mt-0.5 text-xs leading-relaxed text-neutral-500">
                          {item.subtitle}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )
        ) : saleLoading && saleSquares.length === 0 ? (
          <p className="px-3 py-4 text-sm text-neutral-500">Loading…</p>
        ) : saleError && saleSquares.length === 0 ? (
          <p className="px-3 py-4 text-sm text-red-600">{saleError}</p>
        ) : saleSquares.length === 0 ? (
          <div className="flex flex-col items-center px-4 py-10 text-center">
            <p className="text-sm font-medium text-neutral-800">
              No platform squares left
            </p>
            <p className="mt-1 max-w-[16rem] text-xs leading-relaxed text-neutral-500">
              Check back later or browse the sphere.
            </p>
          </div>
        ) : (
          <>
            <ul className="divide-y divide-neutral-100/80">
              {saleSquares.map((sq) => {
                const focused = focusedSquareId === sq.id;
                return (
                  <li key={sq.id}>
                    <div
                      className={`flex items-center gap-2 px-3 py-2.5 sm:px-4 ${
                        focused ? "bg-[var(--accent)]/[0.06]" : ""
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onFocusSquare?.(sq.id)}
                        className="sm-press min-w-0 flex-1 rounded-lg px-1 py-1 text-left touch-manipulation active:bg-white/40"
                      >
                        <p className="text-sm font-medium text-neutral-900">
                          ({sq.x}, {sq.y})
                        </p>
                        <p className="mt-0.5 text-xs tabular-nums text-neutral-500">
                          {formatUsd(sq.askCents)}
                        </p>
                      </button>
                      <button
                        type="button"
                        disabled={buyingId === sq.id}
                        onClick={() => void onBuy(sq.id)}
                        className="sm-press shrink-0 rounded-lg bg-neutral-900 px-3 py-2 text-[11px] font-semibold text-white touch-manipulation active:opacity-90 disabled:opacity-50"
                      >
                        {buyingId === sq.id ? "…" : "Buy"}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
            {saleNextOffset != null ? (
              <div className="px-3 py-3 sm:px-4">
                <button
                  type="button"
                  disabled={saleLoading}
                  onClick={() => void loadAvailable(saleNextOffset, true)}
                  className="sm-press w-full rounded-xl border border-black/10 bg-white/70 px-3 py-2.5 text-sm font-medium text-neutral-800 touch-manipulation active:bg-white disabled:opacity-50"
                >
                  {saleLoading ? "Loading…" : "Load more"}
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </aside>
  );
}
