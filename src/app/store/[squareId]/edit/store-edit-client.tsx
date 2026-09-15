"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type StoreFields = {
  name: string;
  about: string;
  email: string;
  phone: string;
  address: string;
  hours: string;
  websiteUrl: string;
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

export default function StoreEditClient({ squareId }: { squareId: string }) {
  const [fields, setFields] = useState<StoreFields>(emptyStore);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [hasStore, setHasStore] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/stores/${squareId}?mine=1`)
      .then(async (r) => {
        if (r.status === 404) {
          if (!cancelled) {
            setHasStore(false);
            setFields(emptyStore);
          }
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
        };
        if (cancelled) return;
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
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [squareId]);

  async function onSave(e: React.FormEvent) {
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
          <form onSubmit={onSave} className="space-y-4">
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
        )}

        <section className="mt-10 border-t border-zinc-200 pt-8">
          <h2 className="text-lg font-semibold">Products</h2>
          <p className="mt-2 text-sm text-zinc-600">
            Product management comes next — save your store profile first.
          </p>
        </section>
      </div>
    </main>
  );
}
