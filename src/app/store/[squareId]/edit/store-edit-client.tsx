"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type StoreFields = {
  name: string;
  about: string;
  email: string;
  phone: string;
  address: string;
  hours: string;
  websiteUrl: string;
};

type ProductRow = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  buyUrl: string | null;
  active: boolean;
  sortOrder: number;
  images: { id: string; url: string; sortOrder: number }[];
  clickCount?: number;
};

const emptyStore: StoreFields = {
  name: "",
  about: "",
  email: "",
  phone: "",
  address: "",
  hours: "",
  websiteUrl: "",
};

function formatUsd(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function productDollarsToCents(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export default function StoreEditClient({ squareId }: { squareId: string }) {
  const [fields, setFields] = useState<StoreFields>(emptyStore);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [hasStore, setHasStore] = useState(false);

  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newBuyUrl, setNewBuyUrl] = useState("");
  const [productBusy, setProductBusy] = useState(false);
  const [productError, setProductError] = useState<string | null>(null);

  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editBuyUrl, setEditBuyUrl] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/stores/${squareId}?mine=1`);
      if (r.status === 404) {
        setHasStore(false);
        setFields(emptyStore);
        setProducts([]);
        return;
      }
      if (!r.ok) throw new Error("Failed to load store");
      const body = (await r.json()) as {
        store: {
          name: string;
          about: string | null;
          email: string | null;
          phone: string | null;
          address: string | null;
          hours: string | null;
          websiteUrl: string | null;
        };
        products: ProductRow[];
      };
      setHasStore(true);
      setFields({
        name: body.store.name ?? "",
        about: body.store.about ?? "",
        email: body.store.email ?? "",
        phone: body.store.phone ?? "",
        address: body.store.address ?? "",
        hours: body.store.hours ?? "",
        websiteUrl: body.store.websiteUrl ?? "",
      });
      setProducts(body.products);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [squareId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSaveStore(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setOk(false);
    try {
      const res = await fetch(`/api/stores/${squareId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: fields.name,
          about: fields.about || null,
          email: fields.email || null,
          phone: fields.phone || null,
          address: fields.address || null,
          hours: fields.hours || null,
          websiteUrl: fields.websiteUrl || null,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(body?.error ?? "Save failed");
      }
      setHasStore(true);
      setOk(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function setField<K extends keyof StoreFields>(key: K, value: StoreFields[K]) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  async function onAddProduct(e: React.FormEvent) {
    e.preventDefault();
    setProductError(null);
    const priceCents = productDollarsToCents(newPrice);
    if (priceCents == null) {
      setProductError("Enter a valid price (0 or more)");
      return;
    }
    setProductBusy(true);
    try {
      const res = await fetch(`/api/stores/${squareId}/products`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: newName,
          description: newDescription || null,
          priceCents,
          buyUrl: newBuyUrl || null,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(body?.error ?? "Create failed");
      }
      setNewName("");
      setNewDescription("");
      setNewPrice("");
      setNewBuyUrl("");
      await load();
    } catch (err) {
      setProductError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setProductBusy(false);
    }
  }

  function startEdit(p: ProductRow) {
    setEditId(p.id);
    setEditName(p.name);
    setEditDescription(p.description ?? "");
    setEditPrice((p.priceCents / 100).toFixed(2));
    setEditBuyUrl(p.buyUrl ?? "");
    setProductError(null);
  }

  async function saveEdit(productId: string) {
    setProductError(null);
    const priceCents = productDollarsToCents(editPrice);
    if (priceCents == null) {
      setProductError("Enter a valid price (0 or more)");
      return;
    }
    setProductBusy(true);
    try {
      const res = await fetch(
        `/api/stores/${squareId}/products/${productId}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: editName,
            description: editDescription || null,
            priceCents,
            buyUrl: editBuyUrl || null,
          }),
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(body?.error ?? "Update failed");
      }
      setEditId(null);
      await load();
    } catch (err) {
      setProductError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setProductBusy(false);
    }
  }

  async function toggleActive(p: ProductRow) {
    setProductBusy(true);
    setProductError(null);
    try {
      const res = await fetch(`/api/stores/${squareId}/products/${p.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ active: !p.active }),
      });
      if (!res.ok) throw new Error("Toggle failed");
      await load();
    } catch (err) {
      setProductError(err instanceof Error ? err.message : "Toggle failed");
    } finally {
      setProductBusy(false);
    }
  }

  async function deleteProduct(productId: string) {
    if (!window.confirm("Delete this product?")) return;
    setProductBusy(true);
    setProductError(null);
    try {
      const res = await fetch(
        `/api/stores/${squareId}/products/${productId}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error("Delete failed");
      if (editId === productId) setEditId(null);
      await load();
    } catch (err) {
      setProductError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setProductBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f7f9] text-zinc-900">
      <div className="mx-auto max-w-xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-wrap gap-3 text-sm">
          <Link href="/" className="text-zinc-600 underline-offset-2 hover:underline">
            ← Board
          </Link>
          <Link
            href="/dashboard"
            className="text-zinc-600 underline-offset-2 hover:underline"
          >
            My squares
          </Link>
          {hasStore ? (
            <Link
              href={`/store/${squareId}`}
              className="text-zinc-600 underline-offset-2 hover:underline"
            >
              View store
            </Link>
          ) : null}
        </div>

        <h1 className="mb-6 text-2xl font-semibold tracking-tight">Edit store</h1>

        {loading ? (
          <p className="text-sm text-zinc-600">Loading…</p>
        ) : (
          <>
            <form onSubmit={onSaveStore} className="space-y-4">
              {(
                [
                  ["name", "Name", "text", true],
                  ["about", "About", "textarea", false],
                  ["email", "Email", "email", false],
                  ["phone", "Phone", "text", false],
                  ["address", "Address", "text", false],
                  ["hours", "Hours", "text", false],
                  ["websiteUrl", "Website (https)", "url", false],
                ] as const
              ).map(([key, label, type, required]) => (
                <label key={key} className="block space-y-1 text-sm">
                  <span className="font-medium text-zinc-800">{label}</span>
                  {type === "textarea" ? (
                    <textarea
                      className="min-h-24 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2"
                      value={fields[key]}
                      onChange={(e) => setField(key, e.target.value)}
                    />
                  ) : (
                    <input
                      type={type}
                      required={required}
                      className="min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2"
                      value={fields[key]}
                      onChange={(e) => setField(key, e.target.value)}
                      placeholder={key === "hours" ? "Mon–Fri 9–18" : undefined}
                    />
                  )}
                </label>
              ))}

              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              {ok ? <p className="text-sm text-emerald-700">Saved.</p> : null}

              <button
                type="submit"
                disabled={saving || !fields.name.trim()}
                className="inline-flex min-h-11 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save store"}
              </button>
            </form>

            <section className="mt-10 border-t border-zinc-200 pt-8">
              <h2 className="text-lg font-semibold">Products</h2>
              {!hasStore ? (
                <p className="mt-2 text-sm text-zinc-600">
                  Save your store profile before adding products.
                </p>
              ) : (
                <>
                  <ul className="mt-4 space-y-4">
                    {products.map((p) => (
                      <li
                        key={p.id}
                        className="rounded-xl border border-zinc-200 bg-white p-4"
                      >
                        {editId === p.id ? (
                          <div className="space-y-2 text-sm">
                            <input
                              className="min-h-11 w-full rounded-lg border border-zinc-300 px-3"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                            />
                            <textarea
                              className="min-h-20 w-full rounded-lg border border-zinc-300 px-3 py-2"
                              value={editDescription}
                              onChange={(e) => setEditDescription(e.target.value)}
                            />
                            <input
                              className="min-h-11 w-full rounded-lg border border-zinc-300 px-3"
                              value={editPrice}
                              onChange={(e) => setEditPrice(e.target.value)}
                              placeholder="Price USD"
                            />
                            <input
                              className="min-h-11 w-full rounded-lg border border-zinc-300 px-3"
                              value={editBuyUrl}
                              onChange={(e) => setEditBuyUrl(e.target.value)}
                              placeholder="Buy URL (https)"
                            />
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                disabled={productBusy}
                                onClick={() => void saveEdit(p.id)}
                                className="min-h-11 rounded-lg bg-zinc-900 px-3 text-white"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditId(null)}
                                className="min-h-11 rounded-lg border border-zinc-300 px-3"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                              <div>
                                <p className="font-medium">{p.name}</p>
                                <p className="text-sm text-zinc-600">
                                  {formatUsd(p.priceCents)}
                                  {!p.active ? " · hidden" : ""}
                                  {typeof p.clickCount === "number"
                                    ? ` · ${p.clickCount} click${p.clickCount === 1 ? "" : "s"}`
                                    : ""}
                                </p>
                              </div>
                              <div className="flex flex-wrap gap-2 text-sm">
                                <button
                                  type="button"
                                  disabled={productBusy}
                                  onClick={() => startEdit(p)}
                                  className="underline-offset-2 hover:underline"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  disabled={productBusy}
                                  onClick={() => void toggleActive(p)}
                                  className="underline-offset-2 hover:underline"
                                >
                                  {p.active ? "Hide" : "Show"}
                                </button>
                                <button
                                  type="button"
                                  disabled={productBusy}
                                  onClick={() => void deleteProduct(p.id)}
                                  className="text-red-600 underline-offset-2 hover:underline"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {p.images.map((img) => (
                                <div key={img.id} className="relative">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={img.url}
                                    alt=""
                                    className="h-16 w-16 rounded object-cover"
                                  />
                                  <button
                                    type="button"
                                    disabled={productBusy}
                                    className="absolute -right-1 -top-1 rounded-full bg-zinc-900 px-1.5 text-xs text-white"
                                    onClick={() =>
                                      void (async () => {
                                        setProductBusy(true);
                                        try {
                                          const res = await fetch(
                                            `/api/stores/${squareId}/products/${p.id}/images/${img.id}`,
                                            { method: "DELETE" },
                                          );
                                          if (!res.ok) throw new Error("Remove failed");
                                          await load();
                                        } catch (err) {
                                          setProductError(
                                            err instanceof Error
                                              ? err.message
                                              : "Remove failed",
                                          );
                                        } finally {
                                          setProductBusy(false);
                                        }
                                      })()
                                    }
                                  >
                                    ×
                                  </button>
                                </div>
                              ))}
                              {p.images.length < 5 ? (
                                <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded border border-dashed border-zinc-300 text-xs text-zinc-500">
                                  +
                                  <input
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    className="hidden"
                                    disabled={productBusy}
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      e.target.value = "";
                                      if (!file) return;
                                      void (async () => {
                                        setProductBusy(true);
                                        setProductError(null);
                                        try {
                                          const fd = new FormData();
                                          fd.set("image", file);
                                          const res = await fetch(
                                            `/api/stores/${squareId}/products/${p.id}/images`,
                                            { method: "POST", body: fd },
                                          );
                                          if (!res.ok) {
                                            const body = (await res
                                              .json()
                                              .catch(() => null)) as
                                              | { error?: string }
                                              | null;
                                            throw new Error(
                                              body?.error ?? "Upload failed",
                                            );
                                          }
                                          await load();
                                        } catch (err) {
                                          setProductError(
                                            err instanceof Error
                                              ? err.message
                                              : "Upload failed",
                                          );
                                        } finally {
                                          setProductBusy(false);
                                        }
                                      })();
                                    }}
                                  />
                                </label>
                              ) : null}
                            </div>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>

                  <form
                    onSubmit={onAddProduct}
                    className="mt-6 space-y-3 rounded-xl border border-dashed border-zinc-300 bg-white/60 p-4"
                  >
                    <h3 className="text-sm font-semibold">Add product</h3>
                    <input
                      required
                      className="min-h-11 w-full rounded-lg border border-zinc-300 px-3 text-sm"
                      placeholder="Name"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                    />
                    <textarea
                      className="min-h-20 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                      placeholder="Description"
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                    />
                    <input
                      required
                      className="min-h-11 w-full rounded-lg border border-zinc-300 px-3 text-sm"
                      placeholder="Price (USD)"
                      value={newPrice}
                      onChange={(e) => setNewPrice(e.target.value)}
                    />
                    <input
                      className="min-h-11 w-full rounded-lg border border-zinc-300 px-3 text-sm"
                      placeholder="Buy URL (https)"
                      value={newBuyUrl}
                      onChange={(e) => setNewBuyUrl(e.target.value)}
                    />
                    {productError ? (
                      <p className="text-sm text-red-600">{productError}</p>
                    ) : null}
                    <button
                      type="submit"
                      disabled={productBusy || products.length >= 50}
                      className="inline-flex min-h-11 items-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white disabled:opacity-50"
                    >
                      {productBusy ? "Working…" : "Add product"}
                    </button>
                  </form>
                </>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
