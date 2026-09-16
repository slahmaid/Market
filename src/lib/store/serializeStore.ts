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
  estimatedOwedCents?: number;
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
  estimatedOwedCents?: number;
  lifetimeFeesCents?: number;
  paidCents?: number;
  canPayCommission?: boolean;
};

type StoreRow = Omit<
  SerializedStore,
  | "estimatedOwedCents"
  | "lifetimeFeesCents"
  | "paidCents"
  | "canPayCommission"
>;

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
  estimatedOwedCents?: number;
};

export function serializeStore(
  store: StoreRow,
  opts?: {
    estimatedOwedCents?: number;
    lifetimeFeesCents?: number;
    paidCents?: number;
    canPayCommission?: boolean;
  },
): SerializedStore {
  const serialized: SerializedStore = {
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
  if (opts?.estimatedOwedCents !== undefined) {
    serialized.estimatedOwedCents = opts.estimatedOwedCents;
  }
  if (opts?.lifetimeFeesCents !== undefined) {
    serialized.lifetimeFeesCents = opts.lifetimeFeesCents;
  }
  if (opts?.paidCents !== undefined) {
    serialized.paidCents = opts.paidCents;
  }
  if (opts?.canPayCommission !== undefined) {
    serialized.canPayCommission = opts.canPayCommission;
  }
  return serialized;
}

export function serializeProduct(
  product: ProductRow,
  opts?: { includeClickCount?: boolean; includeEstimatedOwed?: boolean },
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
  if (opts?.includeEstimatedOwed) {
    serialized.estimatedOwedCents = product.estimatedOwedCents ?? 0;
  }
  return serialized;
}

export function serializeStorePayload(
  store: StoreRow,
  products: ProductRow[],
  opts?: {
    includeInactive?: boolean;
    includeClickCount?: boolean;
    includeEstimatedOwed?: boolean;
    estimatedOwedCents?: number;
    lifetimeFeesCents?: number;
    paidCents?: number;
    canPayCommission?: boolean;
  },
): { store: SerializedStore; products: SerializedProduct[] } {
  const filtered = opts?.includeInactive
    ? products
    : products.filter((p) => p.active);

  const ordered = [...filtered].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.id.localeCompare(b.id);
  });

  return {
    store: serializeStore(store, {
      estimatedOwedCents: opts?.includeEstimatedOwed
        ? (opts.estimatedOwedCents ?? 0)
        : undefined,
      lifetimeFeesCents: opts?.includeEstimatedOwed
        ? (opts.lifetimeFeesCents ?? 0)
        : undefined,
      paidCents: opts?.includeEstimatedOwed ? (opts.paidCents ?? 0) : undefined,
      canPayCommission: opts?.includeEstimatedOwed
        ? (opts.canPayCommission ?? false)
        : undefined,
    }),
    products: ordered.map((p) =>
      serializeProduct(p, {
        includeClickCount: opts?.includeClickCount,
        includeEstimatedOwed: opts?.includeEstimatedOwed,
      }),
    ),
  };
}
