"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";

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

export function BoardNotificationsRail() {
  const { data: session, status: sessionStatus } = useSession();
  const [filter, setFilter] = useState<FilterId>("all");
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());

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

  const loggedOut = sessionStatus !== "loading" && !session?.user;

  return (
    <aside
      id="board-notifications"
      className="sm-glass-strong flex h-full min-w-0 flex-1 basis-0 flex-col rounded-none border-y-0 border-r-0"
    >
      <div className="shrink-0 border-b border-black/5 px-3 py-3 sm:px-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900">
              Notifications
              {unreadCount > 0 && (
                <span className="ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  {unreadCount}
                </span>
              )}
            </h2>
            <p className="mt-0.5 text-xs text-neutral-500">Your activity</p>
          </div>
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
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {sessionStatus === "loading" || items === null ? (
          <p className="px-3 py-4 text-sm text-neutral-500">Loading…</p>
        ) : loggedOut ? (
          <div className="flex flex-col items-center px-4 py-10 text-center">
            <p className="text-sm font-medium text-neutral-800">Log in to see activity</p>
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
            <p className="text-sm font-medium text-neutral-800">No activity yet</p>
            <p className="mt-1 max-w-[16rem] text-xs leading-relaxed text-neutral-500">
              When you buy a square or list one for sale, it appears in this feed.
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
        )}
      </div>
    </aside>
  );
}
