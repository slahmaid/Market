"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { startPrimaryCheckout } from "@/lib/checkout/startPrimaryCheckout";
import { customizeSquare } from "@/lib/customize/customizeSquare";
import { dollarsToCents } from "@/lib/listing";
import { listSquare, unlistSquare } from "@/lib/listing/listSquare";
import { classifyPrice } from "@/lib/pricing/priceComment";

type Detail = {
  square: {
    id: string;
    x: number;
    y: number;
    status: string;
    imageUrl: string | null;
    linkUrl: string | null;
    listPriceCents: number | null;
    ownerId: string | null;
  };
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
  onSquareUpdated,
}: {
  squareId: string | null;
  onClose: () => void;
  onSquareUpdated?: (square: {
    id: string;
    imageUrl: string | null;
    linkUrl: string | null;
    status: string;
    listPriceCents: number | null;
  }) => void;
}) {
  const { data: session, status: sessionStatus } = useSession();
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [buying, setBuying] = useState(false);
  const [buyError, setBuyError] = useState<string | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);
  const [thumbBust, setThumbBust] = useState(0);
  const [listPriceInput, setListPriceInput] = useState("");
  const [listing, setListing] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

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
    setThumbBust(0);
    setLinkUrl("");
    setImageFile(null);
    setSaving(false);
    setSaveError(null);
    setSaveOk(false);
    setListPriceInput("");
    setListing(false);
    setListError(null);
    fetch(`/api/squares/${squareId}`)
      .then(async (r) => {
        const text = await r.text();
        if (!r.ok || !text.trim()) {
          throw new Error("Failed to load square");
        }
        return JSON.parse(text) as Detail;
      })
      .then((j) => {
        if (!cancelled) {
          setData(j);
          setLinkUrl(j.square.linkUrl ?? "");
          if (
            j.square.listPriceCents != null &&
            j.square.listPriceCents >= 1
          ) {
            setListPriceInput((j.square.listPriceCents / 100).toFixed(2));
          }
        }
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

  async function onSaveCustomize() {
    if (!squareId || saving) return;
    if (!imageFile && linkUrl === (data?.square.linkUrl ?? "")) {
      setSaveError("Choose an image or change the link");
      return;
    }
    setSaving(true);
    setSaveError(null);
    setSaveOk(false);
    try {
      const payload: { image?: File; linkUrl?: string } = {};
      if (imageFile) payload.image = imageFile;
      // Always send link when saving so owner can clear or update it
      payload.linkUrl = linkUrl;
      const result = await customizeSquare(squareId, payload);
      const nextImage =
        typeof result.square.imageUrl === "string" ||
        result.square.imageUrl === null
          ? result.square.imageUrl
          : (data?.square.imageUrl ?? null);
      const nextLink =
        typeof result.square.linkUrl === "string" ||
        result.square.linkUrl === null
          ? result.square.linkUrl
          : null;
      setData((prev) =>
        prev
          ? {
              ...prev,
              square: {
                ...prev.square,
                imageUrl: nextImage,
                linkUrl: nextLink,
              },
            }
          : prev,
      );
      setLinkUrl(nextLink ?? "");
      setImageFile(null);
      setSaveOk(true);
      if (imageFile && nextImage) setThumbBust(Date.now());
      onSquareUpdated?.({
        id: squareId,
        imageUrl: nextImage,
        linkUrl: nextLink,
        status: data?.square.status ?? "owned",
        listPriceCents: data?.square.listPriceCents ?? null,
      });
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Customize failed");
    } finally {
      setSaving(false);
    }
  }

  async function onListOrUpdate() {
    if (!squareId || listing) return;
    const cents = dollarsToCents(listPriceInput);
    if (cents == null) {
      setListError("Enter a valid price of at least $0.01");
      return;
    }
    setListing(true);
    setListError(null);
    try {
      const result = await listSquare(squareId, cents);
      setData({
        square: {
          id: result.square.id,
          x: result.square.x,
          y: result.square.y,
          status: result.square.status,
          imageUrl: result.square.imageUrl,
          linkUrl: result.square.linkUrl,
          listPriceCents: result.square.listPriceCents,
          ownerId: result.square.ownerId,
        },
        quote: result.quote,
      });
      if (
        result.square.listPriceCents != null &&
        result.square.listPriceCents >= 1
      ) {
        setListPriceInput((result.square.listPriceCents / 100).toFixed(2));
      }
      onSquareUpdated?.({
        id: result.square.id,
        imageUrl: result.square.imageUrl,
        linkUrl: result.square.linkUrl,
        status: result.square.status,
        listPriceCents: result.square.listPriceCents,
      });
    } catch (e) {
      setListError(e instanceof Error ? e.message : "List failed");
    } finally {
      setListing(false);
    }
  }

  async function onUnlist() {
    if (!squareId || listing) return;
    setListing(true);
    setListError(null);
    try {
      const result = await unlistSquare(squareId);
      setData({
        square: {
          id: result.square.id,
          x: result.square.x,
          y: result.square.y,
          status: result.square.status,
          imageUrl: result.square.imageUrl,
          linkUrl: result.square.linkUrl,
          listPriceCents: result.square.listPriceCents,
          ownerId: result.square.ownerId,
        },
        quote: result.quote,
      });
      setListPriceInput("");
      onSquareUpdated?.({
        id: result.square.id,
        imageUrl: result.square.imageUrl,
        linkUrl: result.square.linkUrl,
        status: result.square.status,
        listPriceCents: result.square.listPriceCents,
      });
    } catch (e) {
      setListError(e instanceof Error ? e.message : "Unlist failed");
    } finally {
      setListing(false);
    }
  }

  if (!squareId) return null;

  const isPlatform = data?.square.status === "platform";
  const isListed = data?.square.status === "listed";
  const isOwned = data?.square.status === "owned";
  const sessionLoading = sessionStatus === "loading";
  const loggedIn = Boolean(session?.user);
  const isOwner =
    Boolean(session?.user?.id) &&
    Boolean(data?.square.ownerId) &&
    session?.user?.id === data?.square.ownerId;
  const canCustomize =
    isOwner && (isOwned || isListed);
  const canList = isOwner && (isOwned || isListed);
  const visitorListed = Boolean(data) && isListed && !isOwner;
  const visitorLink =
    Boolean(data?.square.linkUrl) && (isOwned || isListed);

  const draftCents = dollarsToCents(listPriceInput);
  const livePreview =
    draftCents != null && data
      ? classifyPrice(draftCents, data.quote.suggestedPriceCents)
      : null;

  const displayAskCents =
    canList && draftCents != null ? draftCents : (data?.quote.askCents ?? 0);
  const displayLabel =
    canList && livePreview ? livePreview.label : (data?.quote.label ?? "");
  const displayReason =
    canList && livePreview ? livePreview.reason : (data?.quote.reason ?? "");

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
        className="sm-panel sm-glass-strong fixed z-30 shadow-xl
          max-md:inset-x-0 max-md:bottom-0 max-md:left-0 max-md:right-0
          max-md:rounded-t-3xl max-md:border-t max-md:border-black/10
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
                  {formatUsd(displayAskCents)}
                </p>
                <span
                  className={`mt-2 inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${labelTone(displayLabel)}`}
                >
                  {displayLabel}
                </span>
                <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                  {displayReason}
                </p>
              </div>

              {isPlatform &&
                (sessionLoading ? (
                  <button
                    type="button"
                    disabled
                    className="w-full min-h-12 rounded-xl bg-neutral-200 text-neutral-600 text-sm font-semibold opacity-80 touch-manipulation"
                  >
                    Loading…
                  </button>
                ) : loggedIn ? (
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

              {visitorListed && (
                <p className="text-sm text-neutral-600">
                  Buying listed squares comes later.
                </p>
              )}

              {canList && (
                <div className="space-y-3 border-t border-neutral-200 pt-4">
                  <h3 className="text-sm font-semibold text-neutral-900">
                    {isListed ? "Listing" : "List for sale"}
                  </h3>
                  <p className="text-sm text-neutral-600">
                    Suggested: {formatUsd(data.quote.suggestedPriceCents)}
                  </p>
                  {isListed && data.square.listPriceCents != null && (
                    <p className="text-sm text-neutral-600">
                      Current ask {formatUsd(data.square.listPriceCents)}
                    </p>
                  )}
                  <label className="block space-y-1.5">
                    <span className="text-xs font-medium text-neutral-600">
                      Ask (USD)
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={listPriceInput}
                      onChange={(e) => {
                        setListPriceInput(e.target.value);
                        setListError(null);
                      }}
                      placeholder="100.00"
                      className="w-full min-h-11 rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-900 outline-none focus:border-neutral-400"
                    />
                  </label>
                  {livePreview && (
                    <p className="text-xs text-neutral-600">
                      Preview:{" "}
                      <span className="font-semibold uppercase">
                        {livePreview.label}
                      </span>{" "}
                      — {livePreview.reason}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={onListOrUpdate}
                    disabled={listing}
                    className="sm-press w-full min-h-12 rounded-xl bg-neutral-900 text-white text-sm font-semibold active:bg-neutral-800 disabled:opacity-60 touch-manipulation"
                  >
                    {listing
                      ? "Saving…"
                      : isListed
                        ? "Update price"
                        : "List"}
                  </button>
                  {isListed && (
                    <button
                      type="button"
                      onClick={onUnlist}
                      disabled={listing}
                      className="sm-press w-full min-h-11 rounded-xl border border-neutral-200 bg-white text-sm font-medium text-neutral-800 active:bg-neutral-50 disabled:opacity-60 touch-manipulation"
                    >
                      Unlist
                    </button>
                  )}
                  {listError && (
                    <p className="text-sm text-red-600" role="alert">
                      {listError}
                    </p>
                  )}
                </div>
              )}

              {visitorLink && !canCustomize && (
                <button
                  type="button"
                  onClick={() =>
                    window.open(
                      data.square.linkUrl!,
                      "_blank",
                      "noopener,noreferrer",
                    )
                  }
                  className="sm-press w-full min-h-11 rounded-xl border border-neutral-200 bg-white text-sm font-medium text-neutral-800 active:bg-neutral-50 touch-manipulation"
                >
                  Open link
                </button>
              )}

              {canCustomize && (
                <div className="space-y-3 border-t border-neutral-200 pt-4">
                  <h3 className="text-sm font-semibold text-neutral-900">
                    Store
                  </h3>
                  <div className="flex flex-col gap-2">
                    <a
                      href={`/store/${data.square.id}`}
                      className="sm-press inline-flex min-h-11 items-center justify-center rounded-xl border border-neutral-200 bg-white text-sm font-medium text-neutral-800"
                    >
                      View store
                    </a>
                    <a
                      href={`/store/${data.square.id}/edit`}
                      className="sm-press inline-flex min-h-11 items-center justify-center rounded-xl bg-neutral-900 text-sm font-semibold text-white"
                    >
                      Edit store
                    </a>
                  </div>
                </div>
              )}

              {canCustomize && (
                <div className="space-y-3 border-t border-neutral-200 pt-4">
                  <h3 className="text-sm font-semibold text-neutral-900">
                    Customize
                  </h3>
                  {data.square.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={
                        thumbBust
                          ? `${data.square.imageUrl}${data.square.imageUrl.includes("?") ? "&" : "?"}v=${thumbBust}`
                          : data.square.imageUrl
                      }
                      alt="Current square thumbnail"
                      className="h-16 w-16 rounded-md border border-neutral-200 object-cover"
                    />
                  )}
                  <label className="block space-y-1.5">
                    <span className="text-xs font-medium text-neutral-600">
                      Image (JPEG, PNG, or WebP)
                    </span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => {
                        setImageFile(e.target.files?.[0] ?? null);
                        setSaveOk(false);
                        setSaveError(null);
                      }}
                      className="block w-full text-sm text-neutral-700 file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-neutral-800"
                    />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-xs font-medium text-neutral-600">
                      Link (https)
                    </span>
                    <input
                      type="url"
                      value={linkUrl}
                      onChange={(e) => {
                        setLinkUrl(e.target.value);
                        setSaveOk(false);
                        setSaveError(null);
                      }}
                      placeholder="https://example.com"
                      className="w-full min-h-11 rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-900 outline-none focus:border-neutral-400"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={onSaveCustomize}
                    disabled={saving}
                    className="sm-press w-full min-h-12 rounded-xl bg-neutral-900 text-white text-sm font-semibold active:bg-neutral-800 disabled:opacity-60 touch-manipulation"
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>
                  {data.square.linkUrl && (
                    <button
                      type="button"
                      onClick={() =>
                        window.open(
                          data.square.linkUrl!,
                          "_blank",
                          "noopener,noreferrer",
                        )
                      }
                      className="sm-press w-full min-h-11 rounded-xl border border-neutral-200 bg-white text-sm font-medium text-neutral-800 active:bg-neutral-50 touch-manipulation"
                    >
                      Open link
                    </button>
                  )}
                  {saveError && (
                    <p className="text-sm text-red-600" role="alert">
                      {saveError}
                    </p>
                  )}
                  {saveOk && (
                    <p className="text-sm text-emerald-700" role="status">
                      Saved
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
