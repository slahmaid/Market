# Store Profile + Products Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let square owners create a store profile and product catalog on each owned/listed square; visitors browse `/store/[squareId]` and Buy opens an external HTTPS product URL.

**Architecture:** One `Store` per `Square`, many `Product`s with optional `ProductImage`s. Public GET + owner PUT/POST/PATCH/DELETE under `/api/stores/[squareId]/…`. Public page and owner edit page in App Router; My squares dropdown gets View/Edit links plus quick name/hours.

**Tech Stack:** Next.js 15 App Router, Auth.js, Prisma/PostgreSQL, Zod, sharp, Vitest, Tailwind (existing light/glass patterns).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-09-15-square-market-store-profile-products-design.md`.
- Mutates only when `session.user.id === square.ownerId` and status ∈ `{owned, listed}`.
- Public GET: active products only; `?mine=1` + owner → include inactive.
- Buy = plain `<a href={buyUrl} target="_blank" rel="noopener noreferrer">` when `buyUrl` is `https://…`. No commission tracking.
- ≤ 50 products/store; ≤ 5 images/product; product images 512×512 WebP under `/uploads/products/`.
- URLs (`websiteUrl`, `buyUrl`) must be `https://` or empty/null.
- No Stripe product checkout, chat, search, ads, auctions.
- Commits: conventional; author `Cam <slahmaid@gmail.com>` via `GIT_*` env only (never `git config`).
- Do not commit `.env` or upload binaries.
- Branch: `feat/store-profile-products` off `master` unless user directs otherwise.
- Tests: `npm test -- <path>`.

---

## File structure (create/modify)

```
prisma/schema.prisma                              # Store, Product, ProductImage + Square.store
prisma/migrations/…_store_products/               # migrate

src/lib/store/assertSquareStoreOwner.ts           # shared owner gate
src/lib/store/storeSchemas.ts                     # zod bodies + https helpers
src/lib/store/serializeStore.ts                   # JSON shapes for API
src/lib/storage/productImage.ts                   # sharp 512 WebP save/delete

src/app/api/stores/[squareId]/route.ts             # GET public, PUT upsert
src/app/api/stores/[squareId]/products/route.ts    # POST create
src/app/api/stores/[squareId]/products/[productId]/route.ts  # PATCH, DELETE
src/app/api/stores/[squareId]/products/[productId]/images/route.ts  # POST
src/app/api/stores/[squareId]/products/[productId]/images/[imageId]/route.ts  # DELETE

src/app/store/[squareId]/page.tsx                  # public store
src/app/store/[squareId]/edit/page.tsx             # auth gate shell
src/app/store/[squareId]/edit/store-edit-client.tsx  # forms + products UI

src/components/board/SquareDetailsDropdown.tsx    # View/Edit + quick name/hours
src/components/board/SquarePanel.tsx              # optional View store link

tests/store/storeApi.test.ts
tests/store/productsApi.test.ts
tests/store/productImagesApi.test.ts
tests/store/storeSchemas.test.ts
```

---

### Task 1: Prisma models + migrate

**Files:**
- Modify: `prisma/schema.prisma`
- Create: migration via `npx prisma migrate dev`

**Interfaces:**
- `Square.store Store?`
- `Store` / `Product` / `ProductImage` as in spec §5

- [ ] **Step 1: Add models to schema**

Append to `prisma/schema.prisma` and add `store Store?` on `Square`:

```prisma
model Store {
  id         String    @id @default(cuid())
  squareId   String    @unique
  square     Square    @relation(fields: [squareId], references: [id], onDelete: Cascade)
  name       String
  about      String?
  email      String?
  phone      String?
  address    String?
  hours      String?
  websiteUrl String?
  products   Product[]
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt
}

model Product {
  id          String         @id @default(cuid())
  storeId     String
  store       Store          @relation(fields: [storeId], references: [id], onDelete: Cascade)
  name        String
  description String?
  priceCents  Int
  buyUrl      String?
  active      Boolean        @default(true)
  sortOrder   Int            @default(0)
  images      ProductImage[]
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt

  @@index([storeId])
}

model ProductImage {
  id        String  @id @default(cuid())
  productId String
  product   Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  url       String
  sortOrder Int     @default(0)

  @@index([productId])
}
```

- [ ] **Step 2: Migrate**

```bash
npx prisma migrate dev --name store_products
npx prisma generate
```

Expected: migration applied; client regenerated.

- [ ] **Step 3: Commit**

```powershell
$env:GIT_AUTHOR_NAME="Cam"; $env:GIT_AUTHOR_EMAIL="slahmaid@gmail.com"
$env:GIT_COMMITTER_NAME="Cam"; $env:GIT_COMMITTER_EMAIL="slahmaid@gmail.com"
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add Store, Product, ProductImage models"
```

---

### Task 2: Shared store helpers + schema tests (TDD)

**Files:**
- Create: `src/lib/store/storeSchemas.ts`
- Create: `src/lib/store/assertSquareStoreOwner.ts`
- Create: `src/lib/store/serializeStore.ts`
- Test: `tests/store/storeSchemas.test.ts`

**Interfaces:**
- `httpsUrlOrNull(raw: string | null | undefined): string | null` — empty → null; else must `https://`
- `storeUpsertSchema` — zod for PUT body
- `productCreateSchema` / `productPatchSchema`
- `assertSquareStoreOwner(squareId, userId)` → `{ square, store }` or throws `{ status: 401|403|404, error: string }` pattern — prefer return `Result` for routes:

```ts
export type OwnerGate =
  | { ok: true; square: { id: string; ownerId: string | null; status: string }; store: /* Store | null */ }
  | { ok: false; status: 401 | 403 | 404; error: string };

export async function requireSquareStoreOwner(
  squareId: string,
  userId: string | undefined,
): Promise<OwnerGate>
```

Rules: no `userId` → 401; square missing → 404; `ownerId !== userId` or status not in owned|listed → 403.

- [ ] **Step 1: Failing schema tests**

```ts
import { describe, expect, it } from "vitest";
import { storeUpsertSchema, productCreateSchema } from "@/lib/store/storeSchemas";

describe("storeUpsertSchema", () => {
  it("requires name", () => {
    expect(storeUpsertSchema.safeParse({ name: "" }).success).toBe(false);
  });
  it("rejects non-https websiteUrl", () => {
    expect(
      storeUpsertSchema.safeParse({ name: "Shop", websiteUrl: "http://x.com" }).success,
    ).toBe(false);
  });
  it("accepts https websiteUrl and trims name", () => {
    const r = storeUpsertSchema.safeParse({
      name: "  Cafe  ",
      websiteUrl: "https://cafe.example",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.name).toBe("Cafe");
  });
});

describe("productCreateSchema", () => {
  it("rejects negative priceCents", () => {
    expect(
      productCreateSchema.safeParse({ name: "Mug", priceCents: -1 }).success,
    ).toBe(false);
  });
  it("rejects http buyUrl", () => {
    expect(
      productCreateSchema.safeParse({
        name: "Mug",
        priceCents: 500,
        buyUrl: "http://bad",
      }).success,
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npm test -- tests/store/storeSchemas.test.ts
```

- [ ] **Step 3: Implement schemas + owner gate + serialize**

`storeSchemas.ts` (core):

```ts
import { z } from "zod";

const optionalHttps = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => {
    if (v == null) return null;
    const t = v.trim();
    return t === "" ? null : t;
  })
  .pipe(z.string().url().startsWith("https://").nullable());

export const storeUpsertSchema = z.object({
  name: z.string().trim().min(1).max(120),
  about: z.string().trim().max(2000).nullable().optional(),
  email: z.string().trim().max(254).nullable().optional(),
  phone: z.string().trim().max(64).nullable().optional(),
  address: z.string().trim().max(500).nullable().optional(),
  hours: z.string().trim().max(500).nullable().optional(),
  websiteUrl: optionalHttps.optional(),
});

export const productCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(4000).nullable().optional(),
  priceCents: z.number().int().min(0),
  buyUrl: optionalHttps.optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export const productPatchSchema = productCreateSchema.partial();
```

`assertSquareStoreOwner.ts`: load square by id; apply gate rules above; include `store: true` in findUnique.

`serializeStore.ts`: map store + products (+ images ordered by sortOrder) to the JSON shape in spec §7.

- [ ] **Step 4: PASS + commit**

```bash
npm test -- tests/store/storeSchemas.test.ts
```

```powershell
git add src/lib/store tests/store/storeSchemas.test.ts
git commit -m "feat: add store validation and owner gate helpers"
```

---

### Task 3: GET + PUT `/api/stores/[squareId]` (TDD)

**Files:**
- Create: `src/app/api/stores/[squareId]/route.ts`
- Test: `tests/store/storeApi.test.ts`

**Interfaces:**
- `GET(req, { params })` — public; 404 if no store; products where `active: true` unless `mine=1` and requester is owner
- `PUT(req, { params })` — upsert; 401/403 via gate; body `storeUpsertSchema`; returns `{ store }`

- [ ] **Step 1: Failing API tests** (mock `auth` + `prisma`)

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

const mockAuth = vi.fn();
const mockSquareFindUnique = vi.fn();
const mockStoreFindUnique = vi.fn();
const mockStoreUpsert = vi.fn();

vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    square: { findUnique: (...a: unknown[]) => mockSquareFindUnique(...a) },
    store: {
      findUnique: (...a: unknown[]) => mockStoreFindUnique(...a),
      upsert: (...a: unknown[]) => mockStoreUpsert(...a),
    },
  },
}));

import { GET, PUT } from "@/app/api/stores/[squareId]/route";

const params = Promise.resolve({ squareId: "sq1" });

describe("GET /api/stores/[squareId]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("404 when no store", async () => {
    mockStoreFindUnique.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/stores/sq1"), { params });
    expect(res.status).toBe(404);
  });

  it("hides inactive products for public", async () => {
    mockAuth.mockResolvedValue(null);
    mockStoreFindUnique.mockResolvedValue({
      id: "st1",
      squareId: "sq1",
      name: "Shop",
      about: null,
      email: null,
      phone: null,
      address: null,
      hours: null,
      websiteUrl: null,
      square: { ownerId: "owner-1" },
      products: [
        { id: "p1", name: "A", description: null, priceCents: 100, buyUrl: null, active: true, sortOrder: 0, images: [] },
        { id: "p2", name: "B", description: null, priceCents: 200, buyUrl: null, active: false, sortOrder: 1, images: [] },
      ],
    });
    const res = await GET(new Request("http://localhost/api/stores/sq1"), { params });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.products.map((p: { id: string }) => p.id)).toEqual(["p1"]);
  });
});

describe("PUT /api/stores/[squareId]", () => {
  it("401 without session", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await PUT(
      new Request("http://localhost/api/stores/sq1", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Shop" }),
      }),
      { params },
    );
    expect(res.status).toBe(401);
  });
});
```

Add cases: owner `?mine=1` sees inactive; non-owner PUT → 403; PUT upsert success.

- [ ] **Step 2: Run — expect FAIL**

```bash
npm test -- tests/store/storeApi.test.ts
```

- [ ] **Step 3: Implement route**

```ts
// GET: find store by squareId include products.images orderBy sortOrder
// filter products if !(mine && isOwner)
// PUT: requireSquareStoreOwner → storeUpsertSchema.parse → prisma.store.upsert
```

Upsert:

```ts
await prisma.store.upsert({
  where: { squareId },
  create: { squareId, ...data },
  update: { ...data },
});
```

Normalize optional string fields: omitted on PUT may mean “leave unchanged” **or** full replace — **v1: full replace of provided keys; require `name` always; other fields if omitted → set null** for predictable form saves (edit page always sends full form).

- [ ] **Step 4: PASS + commit**

```bash
npm test -- tests/store/storeApi.test.ts
```

```powershell
git add src/app/api/stores tests/store/storeApi.test.ts
git commit -m "feat: add store GET and PUT APIs"
```

---

### Task 4: Public store page + owner edit shell (store fields only)

**Files:**
- Create: `src/app/store/[squareId]/page.tsx`
- Create: `src/app/store/[squareId]/edit/page.tsx`
- Create: `src/app/store/[squareId]/edit/store-edit-client.tsx` (store form first; products section stub OK until Task 6)

**Interfaces:**
- Public page: `prisma.store.findUnique`; missing → `notFound()`; render header + product grid (empty state OK)
- Edit page: `auth()`; no session → `redirect(/login?callbackUrl=/store/${id}/edit)`; not owner → `notFound()` or redirect `/`; pass `squareId` to client
- Client: load `GET /api/stores/${id}?mine=1`, form → `PUT`, toast/errors inline

- [ ] **Step 1: Public page**

Server component: fetch store+active products via Prisma (or fetch API). Prefer Prisma in RSC for SSR.

UI: `bg-[#f6f7f9]`, max-w content, name as H1, contact block, grid of products with `formatUsd`, Buy link when `buyUrl`.

- [ ] **Step 2: Edit page + store form client**

Fields: name, about, email, phone, address, hours, websiteUrl. Save button calls PUT. Links: View store, ← Board, My squares.

- [ ] **Step 3: Manual smoke** — create store via edit, open public page.

- [ ] **Step 4: Commit**

```powershell
git add src/app/store
git commit -m "feat: add public store page and store edit form"
```

---

### Task 5: Product CRUD APIs (TDD)

**Files:**
- Create: `src/app/api/stores/[squareId]/products/route.ts`
- Create: `src/app/api/stores/[squareId]/products/[productId]/route.ts`
- Test: `tests/store/productsApi.test.ts`

**Interfaces:**
- `POST` → create; if `prisma.product.count({ where: { storeId } }) >= 50` → `400` `{ error: "Product limit reached" }`; ensure store exists (create store first if missing? **No** — require store row; if none → `404` “Create store profile first”)
- `PATCH` → update fields; verify product belongs to store for squareId
- `DELETE` → delete product; best-effort unlink image files later (Task 6)

- [ ] **Step 1: Failing tests**

Cases: POST 401; POST at 50 → 400; POST success; PATCH non-owner 403; PATCH other square’s product 404; DELETE success.

- [ ] **Step 2: FAIL then implement then PASS**

```bash
npm test -- tests/store/productsApi.test.ts
```

- [ ] **Step 3: Commit**

```powershell
git add src/app/api/stores tests/store/productsApi.test.ts
git commit -m "feat: add product create update delete APIs"
```

---

### Task 6: Product UI on edit page

**Files:**
- Modify: `src/app/store/[squareId]/edit/store-edit-client.tsx`

**Interfaces:**
- List products from `mine=1` payload
- Add form: name, description, price (dollars input → `dollarsToCents` from `@/lib/listing`), buyUrl, active checkbox
- Per row: edit save (PATCH), toggle active, delete (confirm)
- After mutations, refetch GET `?mine=1`

- [ ] **Step 1: Implement product list + forms**

Price input: dollars string; convert with `dollarsToCents`; reject null.

- [ ] **Step 2: Commit**

```powershell
git add src/app/store/[squareId]/edit/store-edit-client.tsx
git commit -m "feat: add product CRUD UI on store edit page"
```

---

### Task 7: Product image upload APIs + storage (TDD)

**Files:**
- Create: `src/lib/storage/productImage.ts`
- Create: `src/app/api/stores/[squareId]/products/[productId]/images/route.ts`
- Create: `src/app/api/stores/[squareId]/products/[productId]/images/[imageId]/route.ts`
- Test: `tests/store/productImagesApi.test.ts`

**Interfaces:**

```ts
export async function saveProductImage(
  productId: string,
  imageId: string,
  bytes: Buffer,
  mime: string,
): Promise<string> // `/uploads/products/${productId}/${imageId}.webp`

export async function deleteProductImageFile(url: string): Promise<void>
```

- Resize 512×512 cover WebP; MIME jpeg/png/webp; sanitize ids like `squareImage.ts`
- POST multipart field `image`; max ~2MB content-length; count images ≥ 5 → 400
- DELETE image: owner gate + delete row + `deleteProductImageFile`
- On product DELETE: load image urls, delete files best-effort, then delete product (cascade images)

- [ ] **Step 1: Tests** — POST 401; at 5 images → 400; success returns image JSON; DELETE 403 non-owner

- [ ] **Step 2: Implement storage + routes**

- [ ] **Step 3: PASS + wire edit UI** file input per product → FormData POST; remove button → DELETE

- [ ] **Step 4: Commit**

```powershell
git add src/lib/storage/productImage.ts src/app/api/stores tests/store/productImagesApi.test.ts src/app/store
git commit -m "feat: add product image upload and delete"
```

---

### Task 8: My squares dropdown + panel links

**Files:**
- Modify: `src/components/board/SquareDetailsDropdown.tsx`
- Modify: `src/components/board/SquarePanel.tsx` (View store if store exists — optional fetch or link always to `/store/${id}` and let 404 page handle)

**Interfaces:**
- Links: `View store` → `/store/${squareId}`; `Edit store` → `/store/${squareId}/edit`
- Quick fields: `name`, `hours` local state; Save calls `PUT /api/stores/${squareId}` with at least `{ name, hours }` — if store may not exist, name required (placeholder default `My store` if empty on first quick save)
- On mount (with square detail): `GET /api/stores/${squareId}?mine=1` — 404 OK (no store yet); else prefill quick fields

- [ ] **Step 1: Add store section UI under existing customize block**

Compact: two inputs + Save store; two links.

- [ ] **Step 2: Panel link** — for owned squares, show “View store” / “Edit store” text links.

- [ ] **Step 3: Commit**

```powershell
git add src/components/board/SquareDetailsDropdown.tsx src/components/board/SquarePanel.tsx
git commit -m "feat: wire store view edit and quick fields in board UI"
```

---

### Task 9: Verification + polish

**Files:** as needed for failing tests / lint

- [ ] **Step 1: Run full suite**

```bash
npm test
npm run lint
```

Expected: all pass.

- [ ] **Step 2: Manual checklist**

1. Own a square → Edit store → save profile → public page shows header.  
2. Add product + image → appears on public page → Buy opens HTTPS URL.  
3. Set product inactive → hidden on public; visible on edit.  
4. Quick name/hours from dropdown updates public page.  
5. Non-owner cannot PUT (403). Guest GET works.

- [ ] **Step 3: Final commit if fixes**

```powershell
git commit -m "fix: polish store profile edge cases"
```

---

## Spec coverage checklist

| Spec item | Task |
|-----------|------|
| Store/Product/ProductImage models | 1 |
| HTTPS validation, limits | 2, 5, 7 |
| GET/PUT store | 3 |
| Public `/store/[squareId]` | 4 |
| Edit `/store/[squareId]/edit` | 4, 6, 7 |
| Product CRUD APIs | 5 |
| Product UI | 6 |
| Image upload 512 WebP | 7 |
| Dropdown quick + View/Edit | 8 |
| Board panel links | 8 |
| Auth/IDOR tests | 3, 5, 7, 9 |
| Commission / Stripe products | Explicitly skipped |

## Out of scope (do not implement)

- Referral / commission click tracking  
- In-app checkout for products  
- Chat, search, ads, auctions  
- Structured hours schema  
