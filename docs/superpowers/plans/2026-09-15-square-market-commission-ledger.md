# Commission Ledger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Snapshot commission fee on each Buy click and show store owners a lifetime estimated commission owed on the store edit page.

**Architecture:** Extend `ProductClick` with `priceCentsAtClick`, `feeBps`, and `feeCents` written on `/go`. Pure helpers compute fee from env bps (default 700). Owner `GET /api/stores/[squareId]?mine=1` aggregates `SUM(feeCents)` for store + per product; public responses omit owed fields. Edit UI shows lifetime owed; no Stripe.

**Tech Stack:** Next.js 15 App Router, Prisma/PostgreSQL, Vitest, existing store APIs/UI.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-09-15-square-market-commission-ledger-design.md`.
- Default fee: `COMMISSION_FEE_BPS=700` (7%); invalid/missing/negative → `700`.
- Fee formula: `Math.floor(priceCents * feeBps / 10000)`.
- Snapshot at click write time; legacy `null` fee columns contribute `0` to sums (no backfill).
- Redirect-anyway if click insert fails; open-redirect safety unchanged.
- `estimatedOwedCents` only on owner `mine=1` — never on public GET.
- No Stripe collection, admin UI, monthly periods, or `/earnings` route.
- Commits: conventional; author `Cam <slahmaid@gmail.com>` via `GIT_*` env only (never `git config`).
- Branch: implement on `master` (or a short-lived `feat/commission-ledger` if preferred).

---

## File structure

```
prisma/schema.prisma                                    # ProductClick snapshot columns
prisma/migrations/…_product_click_commission/

src/lib/commission/fee.ts                               # computeClickFeeCents + getCommissionFeeBps
tests/commission/fee.test.ts

src/app/go/[productId]/route.ts                         # write snapshots on create
tests/store/goRedirect.test.ts                          # expect snapshot fields

src/lib/store/serializeStore.ts                         # estimatedOwedCents on store + products
src/app/api/stores/[squareId]/route.ts                   # aggregate/groupBy for mine=1
tests/store/storeApi.test.ts                            # owed fields owner vs public

src/app/store/[squareId]/edit/store-edit-client.tsx      # lifetime owed line (+ optional per-product)
.env.example                                            # document COMMISSION_FEE_BPS
```

---

### Task 1: Prisma ProductClick fee columns + migrate

**Files:**
- Modify: `prisma/schema.prisma` (`ProductClick` model ~lines 123–133)
- Create: migration via `npx prisma migrate dev --name product_click_commission`

**Interfaces:**
- Produces: `ProductClick.priceCentsAtClick Int?`, `ProductClick.feeBps Int?`, `ProductClick.feeCents Int?` (all nullable for legacy rows)

- [ ] **Step 1: Extend model**

In `prisma/schema.prisma`, update `ProductClick` to:

```prisma
model ProductClick {
  id                 String   @id @default(cuid())
  productId          String
  product            Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  storeId            String
  store              Store    @relation(fields: [storeId], references: [id], onDelete: Cascade)
  createdAt          DateTime @default(now())
  priceCentsAtClick  Int?
  feeBps             Int?
  feeCents           Int?

  @@index([productId])
  @@index([storeId])
}
```

- [ ] **Step 2: Migrate + generate**

If `npm run dev` holds the Prisma engine DLL on Windows, stop it first, then:

```powershell
npx prisma migrate dev --name product_click_commission
npx prisma generate
```

Expected: migration applied; client regenerated with the three new fields.

- [ ] **Step 3: Commit**

```powershell
$env:GIT_AUTHOR_NAME="Cam"; $env:GIT_AUTHOR_EMAIL="slahmaid@gmail.com"
$env:GIT_COMMITTER_NAME="Cam"; $env:GIT_COMMITTER_EMAIL="slahmaid@gmail.com"
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add commission snapshot columns on ProductClick"
```

---

### Task 2: Fee helpers (TDD)

**Files:**
- Create: `src/lib/commission/fee.ts`
- Create: `tests/commission/fee.test.ts`
- Modify: `.env.example` (document `COMMISSION_FEE_BPS`)

**Interfaces:**
- Produces: `computeClickFeeCents(priceCents: number, feeBps: number): number`
- Produces: `getCommissionFeeBps(): number` — reads `process.env.COMMISSION_FEE_BPS`, default `700`
- Produces: `DEFAULT_COMMISSION_FEE_BPS = 700` (exported constant)

- [ ] **Step 1: Write failing tests**

Create `tests/commission/fee.test.ts`:

```ts
import { afterEach, describe, expect, it } from "vitest";
import {
  computeClickFeeCents,
  getCommissionFeeBps,
  DEFAULT_COMMISSION_FEE_BPS,
} from "@/lib/commission/fee";

describe("computeClickFeeCents", () => {
  it("floors 1999 × 700 bps", () => {
    expect(computeClickFeeCents(1999, 700)).toBe(139);
  });

  it("returns 0 for zero price", () => {
    expect(computeClickFeeCents(0, 700)).toBe(0);
  });

  it("floors small amounts", () => {
    expect(computeClickFeeCents(1, 700)).toBe(0);
    expect(computeClickFeeCents(15, 700)).toBe(1);
  });
});

describe("getCommissionFeeBps", () => {
  const prev = process.env.COMMISSION_FEE_BPS;

  afterEach(() => {
    if (prev === undefined) delete process.env.COMMISSION_FEE_BPS;
    else process.env.COMMISSION_FEE_BPS = prev;
  });

  it("defaults to 700 when unset", () => {
    delete process.env.COMMISSION_FEE_BPS;
    expect(getCommissionFeeBps()).toBe(DEFAULT_COMMISSION_FEE_BPS);
  });

  it("parses a valid override", () => {
    process.env.COMMISSION_FEE_BPS = "500";
    expect(getCommissionFeeBps()).toBe(500);
  });

  it("falls back to 700 for invalid or negative", () => {
    process.env.COMMISSION_FEE_BPS = "nope";
    expect(getCommissionFeeBps()).toBe(700);
    process.env.COMMISSION_FEE_BPS = "-1";
    expect(getCommissionFeeBps()).toBe(700);
    process.env.COMMISSION_FEE_BPS = "12.5";
    expect(getCommissionFeeBps()).toBe(700);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```powershell
npx vitest run tests/commission/fee.test.ts
```

Expected: FAIL (module not found / exports missing).

- [ ] **Step 3: Implement helpers**

Create `src/lib/commission/fee.ts`:

```ts
export const DEFAULT_COMMISSION_FEE_BPS = 700;

export function computeClickFeeCents(
  priceCents: number,
  feeBps: number,
): number {
  return Math.floor((priceCents * feeBps) / 10000);
}

export function getCommissionFeeBps(): number {
  const raw = process.env.COMMISSION_FEE_BPS;
  if (raw === undefined || raw.trim() === "") {
    return DEFAULT_COMMISSION_FEE_BPS;
  }
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) {
    return DEFAULT_COMMISSION_FEE_BPS;
  }
  return n;
}
```

Add to `.env.example`:

```
# Buy-click commission rate in basis points (700 = 7%). Applied at /go write time.
COMMISSION_FEE_BPS="700"
```

- [ ] **Step 4: Run tests — expect PASS**

```powershell
npx vitest run tests/commission/fee.test.ts
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```powershell
$env:GIT_AUTHOR_NAME="Cam"; $env:GIT_AUTHOR_EMAIL="slahmaid@gmail.com"
$env:GIT_COMMITTER_NAME="Cam"; $env:GIT_COMMITTER_EMAIL="slahmaid@gmail.com"
git add src/lib/commission/fee.ts tests/commission/fee.test.ts .env.example
git commit -m "feat: add commission fee helpers with default 7%"
```

---

### Task 3: `/go` writes fee snapshots (TDD)

**Files:**
- Modify: `src/app/go/[productId]/route.ts`
- Modify: `tests/store/goRedirect.test.ts`

**Interfaces:**
- Consumes: `computeClickFeeCents`, `getCommissionFeeBps` from `@/lib/commission/fee`
- Produces: `productClick.create` data includes `priceCentsAtClick`, `feeBps`, `feeCents` in addition to `productId`, `storeId`
- Select on product must include `priceCents`

- [ ] **Step 1: Update failing expectations**

In `tests/store/goRedirect.test.ts`, add `priceCents: 1999` to active-product mocks. Change the successful create assertion to:

```ts
expect(mockClickCreate).toHaveBeenCalledWith({
  data: {
    productId: "prod1",
    storeId: "st1",
    priceCentsAtClick: 1999,
    feeBps: 700,
    feeCents: 139,
  },
});
```

Ensure inactive / missing-buyUrl / create-fails cases still pass (add `priceCents` on mocks used for redirect path). For the create-fails test, assert create was still attempted with the snapshot fields (optional) and response remains `302`.

Stub env if needed:

```ts
beforeEach(() => {
  vi.clearAllMocks();
  process.env.COMMISSION_FEE_BPS = "700";
});
```

- [ ] **Step 2: Run test — expect FAIL**

```powershell
npx vitest run tests/store/goRedirect.test.ts
```

Expected: FAIL (create called without snapshot fields / priceCents not selected).

- [ ] **Step 3: Update route**

Replace `src/app/go/[productId]/route.ts` with logic equivalent to:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  computeClickFeeCents,
  getCommissionFeeBps,
} from "@/lib/commission/fee";

type Params = { params: Promise<{ productId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { productId } = await params;

  let product: {
    id: string;
    active: boolean;
    buyUrl: string | null;
    storeId: string;
    priceCents: number;
  } | null;

  try {
    product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        active: true,
        buyUrl: true,
        storeId: true,
        priceCents: true,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Database unavailable" },
      { status: 503 },
    );
  }

  if (
    !product ||
    !product.active ||
    !product.buyUrl ||
    !product.buyUrl.startsWith("https://")
  ) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const feeBps = getCommissionFeeBps();
  const feeCents = computeClickFeeCents(product.priceCents, feeBps);

  try {
    await prisma.productClick.create({
      data: {
        productId: product.id,
        storeId: product.storeId,
        priceCentsAtClick: product.priceCents,
        feeBps,
        feeCents,
      },
    });
  } catch (e) {
    console.error("productClick create failed", e);
  }

  return NextResponse.redirect(product.buyUrl, 302);
}
```

- [ ] **Step 4: Run tests — expect PASS**

```powershell
npx vitest run tests/store/goRedirect.test.ts tests/commission/fee.test.ts
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```powershell
$env:GIT_AUTHOR_NAME="Cam"; $env:GIT_AUTHOR_EMAIL="slahmaid@gmail.com"
$env:GIT_COMMITTER_NAME="Cam"; $env:GIT_COMMITTER_EMAIL="slahmaid@gmail.com"
git add src/app/go/[productId]/route.ts tests/store/goRedirect.test.ts
git commit -m "feat: snapshot commission fee on product buy clicks"
```

---

### Task 4: Owner `estimatedOwedCents` on store GET (TDD)

**Files:**
- Modify: `src/lib/store/serializeStore.ts`
- Modify: `src/app/api/stores/[squareId]/route.ts`
- Modify: `tests/store/storeApi.test.ts`

**Interfaces:**
- Consumes: Prisma `productClick.aggregate` + `productClick.groupBy` when owner `mine=1`
- Produces: `SerializedStore.estimatedOwedCents?: number`
- Produces: `SerializedProduct.estimatedOwedCents?: number` (with `clickCount` when owner metrics on)
- Public GET: both fields **undefined** (omitted)

- [ ] **Step 1: Extend serialize types + helpers**

Update `src/lib/store/serializeStore.ts`:

```ts
export type SerializedProduct = {
  // ...existing fields...
  clickCount?: number;
  estimatedOwedCents?: number;
};

export type SerializedStore = {
  // ...existing fields...
  estimatedOwedCents?: number;
};

type ProductRow = {
  // ...existing...
  _count?: { clicks: number };
  clickCount?: number;
  estimatedOwedCents?: number;
};

export function serializeStore(
  store: StoreRow,
  opts?: { estimatedOwedCents?: number },
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
  return serialized;
}

export function serializeProduct(
  product: ProductRow,
  opts?: { includeClickCount?: boolean; includeEstimatedOwed?: boolean },
): SerializedProduct {
  // ...existing image sort + base fields...
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
  },
): { store: SerializedStore; products: SerializedProduct[] } {
  // ...existing filter/sort...
  return {
    store: serializeStore(store, {
      estimatedOwedCents: opts?.includeEstimatedOwed
        ? (opts.estimatedOwedCents ?? 0)
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
```

Keep full field lists identical to the current file; only add the owed plumbing above.

- [ ] **Step 2: Update store GET route**

In `src/app/api/stores/[squareId]/route.ts`, mockable Prisma calls need `productClick` on the client. After owner `mine=1` gate sets `includeClickCount = true`, also set `includeEstimatedOwed = true`, then:

```ts
let estimatedOwedCents = 0;
let productsForPayload = products;

if (includeEstimatedOwed) {
  const [storeAgg, byProduct] = await Promise.all([
    prisma.productClick.aggregate({
      where: { storeId: store.id },
      _sum: { feeCents: true },
    }),
    prisma.productClick.groupBy({
      by: ["productId"],
      where: { storeId: store.id },
      _sum: { feeCents: true },
    }),
  ]);
  estimatedOwedCents = storeAgg._sum.feeCents ?? 0;
  const owedByProduct = new Map(
    byProduct.map((row) => [row.productId, row._sum.feeCents ?? 0]),
  );
  productsForPayload = products.map((p) => ({
    ...p,
    estimatedOwedCents: owedByProduct.get(p.id) ?? 0,
  }));
}

return NextResponse.json(
  serializeStorePayload(storeFields, productsForPayload, {
    includeInactive,
    includeClickCount,
    includeEstimatedOwed,
    estimatedOwedCents,
  }),
);
```

Wrap the aggregate/groupBy in the existing try/catch (503 on DB errors). Do **not** run aggregates for public GET.

- [ ] **Step 3: Extend storeApi mocks + tests**

In `tests/store/storeApi.test.ts`, extend the Prisma mock:

```ts
const mockClickAggregate = vi.fn();
const mockClickGroupBy = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    square: { findUnique: (...args: unknown[]) => mockSquareFindUnique(...args) },
    store: {
      findUnique: (...args: unknown[]) => mockStoreFindUnique(...args),
      upsert: (...args: unknown[]) => mockStoreUpsert(...args),
    },
    productClick: {
      aggregate: (...args: unknown[]) => mockClickAggregate(...args),
      groupBy: (...args: unknown[]) => mockClickGroupBy(...args),
    },
  },
}));
```

Public test: assert `body.store.estimatedOwedCents` and `body.products[0].estimatedOwedCents` are `undefined`; `mockClickAggregate` / `groupBy` **not** called.

Owner `mine=1` test: before GET,

```ts
mockClickAggregate.mockResolvedValue({ _sum: { feeCents: 278 } });
mockClickGroupBy.mockResolvedValue([
  { productId: "p1", _sum: { feeCents: 278 } },
]);
```

Assert:

```ts
expect(body.store.estimatedOwedCents).toBe(278);
expect(body.products[0].estimatedOwedCents).toBe(278);
expect(body.products[1].estimatedOwedCents).toBe(0);
expect(mockClickAggregate).toHaveBeenCalled();
expect(mockClickGroupBy).toHaveBeenCalled();
```

- [ ] **Step 4: Run tests — expect PASS**

```powershell
npx vitest run tests/store/storeApi.test.ts tests/store/goRedirect.test.ts tests/commission/fee.test.ts
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```powershell
$env:GIT_AUTHOR_NAME="Cam"; $env:GIT_AUTHOR_EMAIL="slahmaid@gmail.com"
$env:GIT_COMMITTER_NAME="Cam"; $env:GIT_COMMITTER_EMAIL="slahmaid@gmail.com"
git add src/lib/store/serializeStore.ts src/app/api/stores/[squareId]/route.ts tests/store/storeApi.test.ts
git commit -m "feat: expose owner estimated commission owed on store API"
```

---

### Task 5: Store edit UI — lifetime owed

**Files:**
- Modify: `src/app/store/[squareId]/edit/store-edit-client.tsx`

**Interfaces:**
- Consumes: `body.store.estimatedOwedCents` and optional `product.estimatedOwedCents` from `mine=1`
- Produces: visible “Estimated commission owed: $X.XX” near top when `hasStore`; per-product owed appended after click count when `estimatedOwedCents > 0`

- [ ] **Step 1: State + load**

Add to types:

```ts
type ProductRow = {
  // ...existing...
  clickCount?: number;
  estimatedOwedCents?: number;
};
```

Add state:

```ts
const [estimatedOwedCents, setEstimatedOwedCents] = useState(0);
```

In `load()`, after parsing body:

```ts
const storeBody = body.store as {
  // existing fields...
  estimatedOwedCents?: number;
};
setEstimatedOwedCents(storeBody.estimatedOwedCents ?? 0);
```

On 404 path, also `setEstimatedOwedCents(0)`.

- [ ] **Step 2: Render lifetime line**

After the page title / before the store form (only when `hasStore && !loading`), add:

```tsx
<p className="mb-4 text-sm text-zinc-600">
  Estimated commission owed:{" "}
  <span className="font-medium text-zinc-900">
    {formatUsd(estimatedOwedCents)}
  </span>
</p>
```

(`formatUsd` already exists in this file.)

- [ ] **Step 3: Optional per-product dollars**

Where click count is shown (~line 418), extend:

```tsx
{typeof p.clickCount === "number"
  ? ` · ${p.clickCount} click${p.clickCount === 1 ? "" : "s"}`
  : ""}
{typeof p.estimatedOwedCents === "number" && p.estimatedOwedCents > 0
  ? ` · ${formatUsd(p.estimatedOwedCents)} owed`
  : ""}
```

- [ ] **Step 4: Manual smoke**

1. Ensure Postgres is up and `COMMISSION_FEE_BPS` unset or `700`.
2. As store owner, note current “Estimated commission owed”.
3. On public store page, click **Buy** for a product priced `$19.99` → expect owed to increase by **$1.39** after refresh of edit page.
4. Confirm public store JSON / guest view never shows owed.

- [ ] **Step 5: Full suite + commit**

```powershell
npx vitest run
```

Expected: existing suite green (including new commission tests).

```powershell
$env:GIT_AUTHOR_NAME="Cam"; $env:GIT_AUTHOR_EMAIL="slahmaid@gmail.com"
$env:GIT_COMMITTER_NAME="Cam"; $env:GIT_COMMITTER_EMAIL="slahmaid@gmail.com"
git add src/app/store/[squareId]/edit/store-edit-client.tsx
git commit -m "feat: show estimated commission owed on store edit"
```

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Snapshot columns on `ProductClick` | 1 |
| `COMMISSION_FEE_BPS` default 700 + helpers | 2 |
| `/go` writes snapshots; redirect-anyway | 3 |
| Owner store + product `estimatedOwedCents` | 4 |
| Public omits owed | 4 |
| Legacy null → 0 | 4 (SQL SUM / `?? 0`) |
| Edit UI lifetime owed | 5 |
| No Stripe / no `/earnings` | (non-goals; no tasks) |

---

## Self-review notes

- No TBD/placeholder steps; signatures match across tasks (`includeEstimatedOwed`, `estimatedOwedCents`).
- `1999 × 700 → 139` used consistently in helper tests and `/go` expectations.
- Aggregates run only for owner `mine=1` to avoid leaking work and cost on public reads.
