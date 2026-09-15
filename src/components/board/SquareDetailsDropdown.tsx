"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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

export type SquareUpdatedPayload = {
  id: string;
  imageUrl: string | null;
  linkUrl: string | null;
  status: string;
  listPriceCents: number | null;
};

type Props = {
  squareId: string;
  onSquareUpdated?: (square: SquareUpdatedPayload) => void;
};

/** Compact owner details shown under a My squares row. */
export function SquareDetailsDropdown({ squareId, onSquareUpdated }: Props) {
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);
  const [thumbBust, setThumbBust] = useState(0);
  const [listPriceInput, setListPriceInput] = useState("");
  const [listing, setListing] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [storeName, setStoreName] = useState("");
  const [storeHours, setStoreHours] = useState("");
  const [hasStore, setHasStore] = useState(false);
  const [storeSaving, setStoreSaving] = useState(false);
  const [storeError, setStoreError] = useState<string | null>(null);
  const [storeOk, setStoreOk] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    setLinkUrl("");
    setImageFile(null);
    setSaving(false);
    setSaveError(null);
    setSaveOk(false);
    setThumbBust(0);
    setListPriceInput("");
    setListing(false);
    setListError(null);
    setStoreName("");
    setStoreHours("");
    setHasStore(false);
    setStoreSaving(false);
    setStoreError(null);
    setStoreOk(false);

    fetch(`/api/squares/${squareId}`)
      .then(async (r) => {
        const text = await r.text();
        if (!r.ok || !text.trim()) throw new Error("Failed to load square");
        return JSON.parse(text) as Detail;
      })
      .then((j) => {
        if (cancelled) return;
        setData(j);
        setLinkUrl(j.square.linkUrl ?? "");
        if (j.square.listPriceCents != null && j.square.listPriceCents >= 1) {
          setListPriceInput((j.square.listPriceCents / 100).toFixed(2));
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load square");
        }
      });

    fetch(`/api/stores/${squareId}?mine=1`)
      .then(async (r) => {
        if (r.status === 404) return null;
        if (!r.ok) return null;
        return (await r.json()) as {
          store: { name: string; hours: string | null };
        };
      })
      .then((body) => {
        if (cancelled || !body) return;
        setHasStore(true);
        setStoreName(body.store.name ?? "");
        setStoreHours(body.store.hours ?? "");
      })
      .catch(() => {
        /* store optional */
      });

    return () => {
      cancelled = true;
    };
  }, [squareId]);

  async function onSaveCustomize() {
    if (saving) return;
    if (!imageFile && linkUrl === (data?.square.linkUrl ?? "")) {
      setSaveError("Choose an image or change the link");
      return;
    }
    setSaving(true);
    setSaveError(null);
    setSaveOk(false);
    try {
      const payload: { image?: File; linkUrl?: string } = { linkUrl };
      if (imageFile) payload.image = imageFile;
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
    if (listing) return;
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
    if (listing) return;
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

  if (error) {
    return <p className="px-3 py-3 text-xs text-red-600">{error}</p>;
  }
  if (!data) {
    return <p className="px-3 py-3 text-xs text-neutral-500">Loading…</p>;
  }

  const isListed = data.square.status === "listed";
  const draftCents = dollarsToCents(listPriceInput);
  const livePreview =
    draftCents != null
      ? classifyPrice(draftCents, data.quote.suggestedPriceCents)
      : null;

  return (
    <div className="space-y-3 border-t border-black/5 bg-black/[0.02] px-3 py-3 text-sm">
      <div>
        <p className="text-base font-semibold tabular-nums text-neutral-900">
          {formatUsd(
            isListed && data.square.listPriceCents != null
              ? data.square.listPriceCents
              : data.quote.suggestedPriceCents,
          )}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-neutral-600">
          Suggested {formatUsd(data.quote.suggestedPriceCents)} ·{" "}
          {data.quote.reason}
        </p>
      </div>

      <div className="space-y-2 border-t border-black/5 pt-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Store
        </p>
        <div className="flex flex-wrap gap-3 text-xs">
          {hasStore ? (
            <Link
              href={`/store/${squareId}`}
              className="text-neutral-700 underline-offset-2 hover:underline"
            >
              View store
            </Link>
          ) : null}
          <Link
            href={`/store/${squareId}/edit`}
            className="text-neutral-700 underline-offset-2 hover:underline"
          >
            Edit store
          </Link>
        </div>
        <input
          type="text"
          value={storeName}
          onChange={(e) => {
            setStoreName(e.target.value);
            setStoreOk(false);
            setStoreError(null);
          }}
          placeholder="Store name"
          className="w-full min-h-10 rounded-xl border border-neutral-200 bg-white px-3 text-xs outline-none focus:border-neutral-400"
        />
        <input
          type="text"
          value={storeHours}
          onChange={(e) => {
            setStoreHours(e.target.value);
            setStoreOk(false);
            setStoreError(null);
          }}
          placeholder="Hours (e.g. Mon–Fri 9–18)"
          className="w-full min-h-10 rounded-xl border border-neutral-200 bg-white px-3 text-xs outline-none focus:border-neutral-400"
        />
        <button
          type="button"
          disabled={storeSaving || !storeName.trim()}
          onClick={() => {
            void (async () => {
              setStoreSaving(true);
              setStoreError(null);
              setStoreOk(false);
              try {
                const res = await fetch(`/api/stores/${squareId}`, {
                  method: "PUT",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({
                    name: storeName.trim() || "My store",
                    hours: storeHours.trim() || null,
                  }),
                });
                if (!res.ok) {
                  const body = (await res.json().catch(() => null)) as
                    | { error?: string }
                    | null;
                  throw new Error(body?.error ?? "Save failed");
                }
                setHasStore(true);
                setStoreOk(true);
              } catch (e) {
                setStoreError(
                  e instanceof Error ? e.message : "Save failed",
                );
              } finally {
                setStoreSaving(false);
              }
            })();
          }}
          className="sm-press w-full min-h-10 rounded-xl bg-neutral-900 text-xs font-semibold text-white active:bg-neutral-800 disabled:opacity-60"
        >
          {storeSaving ? "Saving…" : "Save store"}
        </button>
        {storeOk && <p className="text-xs text-emerald-700">Store saved</p>}
        {storeError && <p className="text-xs text-red-600">{storeError}</p>}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Customize
        </p>
        {data.square.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={
              thumbBust
                ? `${data.square.imageUrl}${data.square.imageUrl.includes("?") ? "&" : "?"}v=${thumbBust}`
                : data.square.imageUrl
            }
            alt=""
            className="h-12 w-12 rounded-lg border border-neutral-200 object-cover"
          />
        )}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => {
            setImageFile(e.target.files?.[0] ?? null);
            setSaveOk(false);
            setSaveError(null);
          }}
          className="block w-full text-xs text-neutral-700 file:mr-2 file:rounded-lg file:border-0 file:bg-white file:px-2 file:py-1.5 file:text-xs file:font-medium"
        />
        <input
          type="url"
          value={linkUrl}
          onChange={(e) => {
            setLinkUrl(e.target.value);
            setSaveOk(false);
            setSaveError(null);
          }}
          placeholder="https://…"
          className="w-full min-h-10 rounded-xl border border-neutral-200 bg-white px-3 text-xs outline-none focus:border-neutral-400"
        />
        <button
          type="button"
          onClick={onSaveCustomize}
          disabled={saving}
          className="sm-press w-full min-h-10 rounded-xl bg-neutral-900 text-xs font-semibold text-white active:bg-neutral-800 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {saveOk && <p className="text-xs text-emerald-700">Saved</p>}
        {saveError && <p className="text-xs text-red-600">{saveError}</p>}
      </div>

      <div className="space-y-2 border-t border-black/5 pt-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          {isListed ? "Listing" : "List for sale"}
        </p>
        <input
          type="text"
          inputMode="decimal"
          value={listPriceInput}
          onChange={(e) => {
            setListPriceInput(e.target.value);
            setListError(null);
          }}
          placeholder="100.00"
          className="w-full min-h-10 rounded-xl border border-neutral-200 bg-white px-3 text-xs outline-none focus:border-neutral-400"
        />
        {livePreview && (
          <p className="text-[11px] text-neutral-600">
            <span className="font-semibold uppercase">{livePreview.label}</span>{" "}
            — {livePreview.reason}
          </p>
        )}
        <button
          type="button"
          onClick={onListOrUpdate}
          disabled={listing}
          className="sm-press w-full min-h-10 rounded-xl bg-neutral-900 text-xs font-semibold text-white active:bg-neutral-800 disabled:opacity-60"
        >
          {listing ? "Saving…" : isListed ? "Update price" : "List"}
        </button>
        {isListed && (
          <button
            type="button"
            onClick={onUnlist}
            disabled={listing}
            className="sm-press w-full min-h-10 rounded-xl border border-neutral-200 bg-white text-xs font-medium text-neutral-800 active:bg-neutral-50 disabled:opacity-60"
          >
            Unlist
          </button>
        )}
        {listError && <p className="text-xs text-red-600">{listError}</p>}
      </div>
    </div>
  );
}
