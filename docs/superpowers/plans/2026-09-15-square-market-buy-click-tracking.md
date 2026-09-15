# Buy Click Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Log each outbound product Buy via `/go/[productId]` redirect and show per-product click counts to square owners on the store edit page.

**Architecture:** `ProductClick` rows store `productId` + `storeId` + `createdAt`. Public `GET /go/[productId]` validates active https `buyUrl`, best-effort inserts a click, then `302`s. Owner `GET /api/stores/[squareId]?mine=1` includes `clickCount`; public store Buy links point at `/go/…`.

**Tech Stack:** Next.js 15 App Router, Prisma/PostgreSQL, Vitest, existing store APIs/UI.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-09-15-square-market-buy-click-tracking-design.md`.
- Minimal click fields only: `productId`, `storeId`, `createdAt`.
- Redirect-anyway if insert fails; 404 if inactive / missing https `buyUrl`.
- `clickCount` only on owner `mine=1` responses — never on public GET.
- No IP/UA, payouts, fees, or admin analytics.
- Commits: conventional; author `Cam <slahmaid@gmail.com>` via `GIT_*` env only (never `git config`).
- Branch: implement on `master` (or `feat/buy-click-tracking` if preferred); do not commit unrelated sphere/glass WIP.

---

## File structure

```
prisma/schema.prisma                          # ProductClick model
prisma/migrations/…_product_clicks/

src/app/go/[productId]/route.ts               # GET redirect + log
src/lib/store/serializeStore.ts               # optional clickCount on product
src/app/api/stores/[squareId]/route.ts         # mine=1 _count clicks
src/app/store/[squareId]/page.tsx              # Buy href → /go/…
src/app/store/[squareId]/edit/store-edit-client.tsx  # show counts

tests/store/goRedirect.test.ts
tests/store/storeApi.test.ts                  # extend mine=1 clickCount
```

---

### Task 1: Prisma ProductClick + migrate

**Files:**
- Modify: `prisma/schema.prisma`
- Create: migration via `npx prisma migrate dev --name product_clicks`

**Interfaces:**
- `ProductClick { id, productId, storeId, createdAt }`
- `Product.clicks ProductClick[]`
- `Store.clicks ProductClick[]` (optional but useful)
- Indexes on `productId`, `storeId`

- [ ] **Step 1: Add model**

```prisma
model ProductClick {
  id        String   @id @default(cuid())
  productId String
  product   Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  storeId   String
  store     Store    @relation(fields: [storeId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())

  @@index([productId])
  @@index([storeId])
}
```

Add `clicks ProductClick[]` on `Product` and `Store`.

- [ ] **Step 2: Migrate + generate**

```bash
npx prisma migrate dev --name product_clicks
npx prisma generate
```

- [ ] **Step 3: Commit**

```powershell
git commit -m "feat: add ProductClick model for buy attribution"
```

---

### Task 2: GET /go/[productId] (TDD)

**Files:**
- Create: `src/app/go/[productId]/route.ts`
- Test: `tests/store/goRedirect.test.ts`

**Interfaces:**
- `GET` → `302` Location=`buyUrl` when product `active` and `buyUrl` starts with `https://`
- Else `404`
- Always attempt `prisma.productClick.create`; on throw, still redirect

- [ ] **Step 1: Failing tests** (mock `prisma.product.findUnique` + `productClick.create`)

Cases:
1. active + https → 302 + create called with productId/storeId  
2. inactive → 404, create not called  
3. null buyUrl → 404  
4. create throws → still 302  

- [ ] **Step 2: Implement route**

```ts
export async function GET(_req: Request, { params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, active: true, buyUrl: true, storeId: true },
  });
  if (!product?.active || !product.buyUrl?.startsWith("https://")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  try {
    await prisma.productClick.create({
      data: { productId: product.id, storeId: product.storeId },
    });
  } catch (e) {
    console.error("productClick create failed", e);
  }
  return NextResponse.redirect(product.buyUrl, 302);
}
```

- [ ] **Step 3: PASS + commit**

```powershell
git commit -m "feat: add /go product buy redirect with click log"
```

---

### Task 3: Wire public Buy + owner clickCount

**Files:**
- Modify: `src/app/store/[squareId]/page.tsx` — `href={`/go/${p.id}`}` when buyUrl present  
- Modify: `src/lib/store/serializeStore.ts` — `clickCount?: number` on `SerializedProduct`  
- Modify: `src/app/api/stores/[squareId]/route.ts` — when `includeInactive` (owner mine), include `_count: { select: { clicks: true } }` and map to `clickCount`  
- Modify: `src/app/store/[squareId]/edit/store-edit-client.tsx` — show `N clicks`  
- Extend: `tests/store/storeApi.test.ts` — public omits clickCount; mine=1 includes it  

- [ ] **Step 1: Tests for mine=1 clickCount / public omit**  
- [ ] **Step 2: Implement serialize + GET + UI**  
- [ ] **Step 3: `npm test` + commit**

```powershell
git commit -m "feat: show owner product click counts and route Buy via /go"
```

---

### Task 4: Verify

- [ ] `npm test` all green  
- [ ] Manual: public store Buy → external URL; edit page count increments  

---

## Spec coverage

| Spec item | Task |
|-----------|------|
| ProductClick model | 1 |
| /go redirect + log + redirect-anyway | 2 |
| Public Buy href | 3 |
| Owner clickCount | 3 |
| No public clickCount | 3 |
| No payouts/IP/admin | skipped |

## Out of scope

- Commission math, payouts, IP hashing, admin dashboards, click dedupe
