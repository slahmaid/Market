import Link from "next/link";
import { AppChrome } from "@/components/board/AppChrome";
import { PageShell } from "@/components/board/PageShell";
import { searchMarketplace } from "@/lib/search/searchMarketplace";

function formatUsd(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

type Props = {
  searchParams: Promise<{ q?: string }>;
};

export default async function SearchPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const results = await searchMarketplace(q);
  const tooShort = q.length > 0 && q.length < 2;

  return (
    <main className="min-h-[100dvh] bg-[#f6f7f9] text-zinc-900">
      <AppChrome active="search" />
      <PageShell maxWidthClassName="max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">Search</h1>

        <form method="GET" action="/search" className="mt-4 flex gap-2">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Stores or products…"
            aria-label="Search"
            className="min-h-11 flex-1 rounded-xl border border-zinc-300 bg-white px-3 text-base outline-none focus:border-zinc-500 sm:text-sm"
          />
          <button
            type="submit"
            className="sm-press min-h-11 rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white touch-manipulation"
          >
            Search
          </button>
        </form>

        {tooShort ? (
          <p className="mt-6 text-sm text-zinc-600">Type at least 2 characters.</p>
        ) : q.length === 0 ? (
          <p className="mt-6 text-sm text-zinc-600">Enter a search above.</p>
        ) : (
          <div className="mt-8 space-y-10">
            <section>
              <h2 className="text-lg font-semibold">Stores</h2>
              {results.stores.length === 0 ? (
                <p className="mt-2 text-sm text-zinc-600">No stores found.</p>
              ) : (
                <ul className="mt-3 divide-y divide-zinc-200 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
                  {results.stores.map((s) => (
                    <li key={s.id}>
                      <Link
                        href={`/store/${s.squareId}`}
                        className="sm-press block px-4 py-3.5 active:bg-zinc-50 touch-manipulation"
                      >
                        <p className="font-medium">{s.name}</p>
                        {s.about ? (
                          <p className="mt-1 line-clamp-2 text-sm text-zinc-600">
                            {s.about}
                          </p>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h2 className="text-lg font-semibold">Products</h2>
              {results.products.length === 0 ? (
                <p className="mt-2 text-sm text-zinc-600">No products found.</p>
              ) : (
                <ul className="mt-3 divide-y divide-zinc-200 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
                  {results.products.map((p) => (
                    <li key={p.id}>
                      <Link
                        href={`/store/${p.squareId}#product-${p.id}`}
                        className="sm-press flex items-center gap-3 px-4 py-3.5 active:bg-zinc-50 touch-manipulation"
                      >
                        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-zinc-100">
                          {p.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={p.imageUrl}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{p.name}</p>
                          <p className="text-sm text-zinc-600">
                            {formatUsd(p.priceCents)} · {p.storeName}
                          </p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </PageShell>
    </main>
  );
}
