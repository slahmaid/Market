export type SerializedProductImage = {
  id: string;
  url: string;
  sortOrder: number;
};

export type SerializedProduct = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  buyUrl: string | null;
  active: boolean;
  sortOrder: number;
  images: SerializedProductImage[];
  clickCount?: number;
};

export type SerializedStore = {
  id: string;
  squareId: string;
  name: string;
  about: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  hours: string | null;
  websiteUrl: string | null;
};

type StoreRow = SerializedStore;

type ProductRow = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  buyUrl: string | null;
  active: boolean;
  sortOrder: number;
  images: SerializedProductImage[];
  _count?: { clicks: number };
  clickCount?: number;
};

export function serializeStore(store: StoreRow): SerializedStore {
  return {
    id: store.id,
    squareId: store.squareId,
    name: store.name,
    about: store.about,
    email: store.email,
    phone: store.phone,
    address: store.address,
    hours: store.hours,
    websiteUrl: store.websiteUrl,
  };
}

export function serializeProduct(
  product: ProductRow,
  opts?: { includeClickCount?: boolean },
): SerializedProduct {
  const images = [...product.images].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
  const serialized: SerializedProduct = {
    id: product.id,
    name: product.name,
    description: product.description,
    priceCents: product.priceCents,
    buyUrl: product.buyUrl,
    active: product.active,
    sortOrder: product.sortOrder,
    images: images.map((img) => ({
      id: img.id,
      url: img.url,
      sortOrder: img.sortOrder,
    })),
  };
  if (opts?.includeClickCount) {
    serialized.clickCount =
      product.clickCount ?? product._count?.clicks ?? 0;
  }
  return serialized;
}

export function serializeStorePayload(
  store: StoreRow,
  products: ProductRow[],
  opts?: { includeInactive?: boolean; includeClickCount?: boolean },
): { store: SerializedStore; products: SerializedProduct[] } {
  const filtered = opts?.includeInactive
    ? products
    : products.filter((p) => p.active);

  const ordered = [...filtered].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.id.localeCompare(b.id);
  });

  return {
    store: serializeStore(store),
    products: ordered.map((p) =>
      serializeProduct(p, { includeClickCount: opts?.includeClickCount }),
    ),
  };
}
