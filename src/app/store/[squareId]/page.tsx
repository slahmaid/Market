import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { serializeStorePayload } from "@/lib/store/serializeStore";

function formatUsd(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

type Props = { params: Promise<{ squareId: string }> };

export default async function PublicStorePage({ params }: Props) {
  const { squareId } = await params;

  let storeRow;
  try {
    storeRow = await prisma.store.findUnique({
      where: { squareId },
      include: {
        products: {
          where: { active: true },
          include: { images: { orderBy: { sortOrder: "asc" } } },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        },
      },
    });
  } catch {
    notFound();
  }

  if (!storeRow) notFound();

  const { store, products } = serializeStorePayload(
    storeRow,
    storeRow.products,
    { includeInactive: false },
  );

  return (
    <main className="min-h-screen bg-[#f6f7f9] text-zinc-900">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center gap-3 text-sm">
          <Link href="/" className="text-zinc-600 underline-offset-2 hover:underline">
            ← Board
          </Link>
        </div>

        <header className="mb-10 space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight">{store.name}</h1>
          {store.about ? (
            <p className="max-w-prose text-zinc-700 whitespace-pre-wrap">{store.about}</p>
          ) : null}
          <dl className="grid gap-1 text-sm text-zinc-600 sm:grid-cols-2">
            {store.hours ? (
              <div>
                <dt className="inline font-medium text-zinc-800">Hours: </dt>
                <dd className="inline">{store.hours}</dd>
              </div>
            ) : null}
            {store.email ? (
              <div>
                <dt className="inline font-medium text-zinc-800">Email: </dt>
                <dd className="inline">
                  <a className="underline-offset-2 hover:underline" href={`mailto:${store.email}`}>
                    {store.email}
                  </a>
                </dd>
              </div>
            ) : null}
            {store.phone ? (
              <div>
                <dt className="inline font-medium text-zinc-800">Phone: </dt>
                <dd className="inline">{store.phone}</dd>
              </div>
            ) : null}
            {store.address ? (
              <div className="sm:col-span-2">
                <dt className="inline font-medium text-zinc-800">Address: </dt>
                <dd className="inline">{store.address}</dd>
              </div>
            ) : null}
            {store.websiteUrl ? (
              <div className="sm:col-span-2">
                <dt className="inline font-medium text-zinc-800">Website: </dt>
                <dd className="inline">
                  <a
                    className="underline-offset-2 hover:underline"
                    href={store.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {store.websiteUrl}
                  </a>
                </dd>
              </div>
            ) : null}
          </dl>
        </header>

        <section>
          <h2 className="mb-4 text-lg font-semibold">Products</h2>
          {products.length === 0 ? (
            <p className="text-sm text-zinc-600">No products yet</p>
          ) : (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {products.map((p) => {
                const thumb = p.images[0]?.url;
                return (
                  <li
                    key={p.id}
                    id={`product-${p.id}`}
                    className="flex flex-col gap-3 rounded-xl border border-zinc-200/80 bg-white p-4 scroll-mt-24"
                  >
                    <div className="aspect-square w-full overflow-hidden rounded-lg bg-zinc-100">
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={thumb}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-zinc-400">
                          No image
                        </div>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col gap-2">
                      <div>
                        <h3 className="font-medium">{p.name}</h3>
                        <p className="text-sm text-zinc-600">{formatUsd(p.priceCents)}</p>
                      </div>
                      {p.description ? (
                        <p className="line-clamp-3 text-sm text-zinc-600">{p.description}</p>
                      ) : null}
                      {p.buyUrl ? (
                        <a
                          href={`/go/${p.id}`}
                          rel="noopener noreferrer"
                          className="mt-auto inline-flex min-h-11 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white"
                        >
                          Buy
                        </a>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
