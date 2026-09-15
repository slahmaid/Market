# Square Market — Store Profile + Products Design

**Date:** 2026-09-15  
**Status:** Draft for user review  
**Parent spec:** `docs/superpowers/specs/2026-09-10-square-market-design.md`

## 1. Summary

Add a **store profile** and **product catalog** on each owned square. Visitors open a public store page (profile first, products below). Buy sends them to the merchant’s own product URL (HTTPS). Owners edit via the My squares dropdown (quick fields + link) and a full `/store/[squareId]/edit` page. Commission / referral tracking and in-app checkout are deferred.

## 2. Decisions (locked)

| Topic | Choice |
|-------|--------|
| First marketplace slice | **Store profile + products** (not chat, search, ads, or auctions) |
| Visitor first view | Store page header, then product grid on `/store/[squareId]` |
| Buy behavior | Outbound HTTPS product URL only (no SM checkout) |
| Commission | **Out of scope** this phase (track later) |
| Owner edit | **Both** — quick edits in My squares dropdown + full `/store/[squareId]/edit` |
| Data model | One `Store` per square; many `Product`s per store |

## 3. Goals & non-goals

### Goals

- Owned / listed squares can have one store profile (name, about, contact, hours, optional website).
- Owners add, edit, hide, and delete products (name, description, price, 1–5 images, outbound buy URL).
- Public `/store/[squareId]` shows store header then active products; Buy opens `buyUrl` in a new tab when set.
- Guests and other users can view any published store; only the square owner can mutate.
- Entry: **Edit store** / quick fields from My squares dropdown; **View store** from dropdown (and optionally board panel when a store exists).
- Reuse existing Auth.js session and image upload patterns (WebP via sharp).

### Non-goals

- Stripe / Connect product checkout or platform fee collection.
- Click / referral / commission tracking.
- Chat, search, ads, auctions.
- Multi-location “user-level store” spanning many squares.
- Structured opening-hours schema (v1 is free text).
- Product categories, inventory counts, variants, reviews.

## 4. Approaches considered

1. **Store + Products per owned square** — recommended; matches 1 plot = 1 shop.  
2. **User-level store, squares as locations** — heavier; unclear with current ownership model.  
3. **JSON blob on `Square`** — fast to ship; weak validation and future search.

**Decision:** Approach **1**.

## 5. Data model

### `Store`

| Field | Type | Notes |
|-------|------|--------|
| `id` | cuid | PK |
| `squareId` | string | **Unique** FK → `Square` |
| `name` | string | Required, trimmed, max 120 |
| `about` | string? | Max ~2_000 |
| `email` | string? | Optional contact email |
| `phone` | string? | Free text |
| `address` | string? | Free text |
| `hours` | string? | Free text, e.g. `Mon–Fri 9–18` |
| `websiteUrl` | string? | Must be `https` if set |
| `createdAt` / `updatedAt` | DateTime | |

Relation: `Square` has optional `store Store?`.

### `Product`

| Field | Type | Notes |
|-------|------|--------|
| `id` | cuid | PK |
| `storeId` | string | FK → `Store`, cascade delete |
| `name` | string | Required, max 120 |
| `description` | string? | Max ~4_000 |
| `priceCents` | int | ≥ 0, USD cents for display |
| `buyUrl` | string? | `https` if set; required for Buy button |
| `active` | boolean | Default `true`; false = hidden from public |
| `sortOrder` | int | Default 0; lower first |
| `createdAt` / `updatedAt` | DateTime | |

### `ProductImage`

| Field | Type | Notes |
|-------|------|--------|
| `id` | cuid | PK |
| `productId` | string | FK → `Product`, cascade delete |
| `url` | string | Public path under `/uploads/products/…` |
| `sortOrder` | int | 0–4 |

**Limits:** ≤ **50** products per store; **0–5** images per product (placeholder thumb if none); product images resized to **512×512** cover WebP (separate from 128×128 square thumbs).

## 6. Pages

### Public — `/store/[squareId]`

- Load store + **active** products (ordered by `sortOrder`, then `createdAt`).
- Missing store: friendly empty / “No store yet” (404 or empty state — prefer **404** if no `Store` row).
- Header: name, about, email, phone, address, hours, website link.
- Grid: primary image (or placeholder), name, formatted USD price, **Buy** if `buyUrl` present (`target=_blank`, `rel=noopener noreferrer`).
- Empty products: “No products yet”.

### Owner — `/store/[squareId]/edit`

- Auth required; must be square owner (`owned` or `listed`). Else redirect `/login` or 403.
- Store form (all store fields) + save.
- Product list: add / edit / delete / toggle active; image upload/reorder/remove within 1–5.
- Link back to public store and to board / My squares.

### My squares dropdown (quick + full)

- **View store** → `/store/[squareId]` (if store exists; else still allow edit to create).
- **Edit store** → `/store/[squareId]/edit`.
- **Quick fields (v1):** `name`, `hours` — save via same `PUT` store API without leaving the rail.
- Full product CRUD stays on the edit page (dropdown does not embed full product forms).

## 7. APIs

All mutating routes: session required; caller must own the square; square status `owned` or `listed`.

### `GET /api/stores/[squareId]`

- Public.
- If no store → `404`.
- Query `?mine=1` (auth + owner only): include inactive products; otherwise active only.
- Response shape:

```json
{
  "store": {
    "id": "...",
    "squareId": "...",
    "name": "...",
    "about": null,
    "email": null,
    "phone": null,
    "address": null,
    "hours": null,
    "websiteUrl": null
  },
  "products": [
    {
      "id": "...",
      "name": "...",
      "description": null,
      "priceCents": 1999,
      "buyUrl": "https://example.com/p/1",
      "active": true,
      "sortOrder": 0,
      "images": [{ "id": "...", "url": "/uploads/products/....webp", "sortOrder": 0 }]
    }
  ]
}
```

### `PUT /api/stores/[squareId]`

- Owner upsert (create store on first save).
- Body: store fields; validate HTTPS for `websiteUrl`; trim lengths.
- Returns updated `store`.

### `POST /api/stores/[squareId]/products`

- Owner create; reject if product count ≥ 50.
- Body: product fields (images via separate upload or multipart — prefer **create then upload images**).

### `PATCH /api/stores/[squareId]/products/[productId]`

- Owner update fields / `active` / `sortOrder`.

### `DELETE /api/stores/[squareId]/products/[productId]`

- Owner delete; remove image files from disk best-effort.

### `POST /api/stores/[squareId]/products/[productId]/images`

- Owner; multipart image; MIME jpeg/png/webp; sharp → 512×512 WebP under `public/uploads/products/`.
- Reject if already 5 images.
- Returns new image record.

### `DELETE /api/stores/[squareId]/products/[productId]/images/[imageId]`

- Owner; delete DB row + file.

**Validation shared rules:** URLs must start with `https://`; reject `javascript:` / non-http schemes; no open redirects on SM domain for Buy (Buy is plain external anchor).

## 8. Auth & safety

- IDOR: every mutate path checks `square.ownerId === session.user.id`.
- Public GET never returns inactive products unless `mine=1` and owner.
- Upload path sanitizes ids (basename, no `..`); same pattern as `saveSquareImage`.
- Do not expose other users’ emails beyond the store’s public contact email field (owner-chosen).

## 9. UI notes

- Match existing glass / light board chrome language; store pages can be simpler full-width content, not the sphere.
- Price display: `Intl.NumberFormat` USD from `priceCents`.
- Mobile: single column product grid; edit forms stack.

## 10. Testing

- API: unauthenticated mutate → 401; non-owner → 403; public GET hides inactive; owner `mine=1` sees inactive; product cap 50; image cap 5; invalid URL rejected.
- Model/migration: one store per square unique constraint.
- Manual: create store → public page; add product + image → Buy opens external URL; hide product → gone from public; quick name/hours from dropdown.

## 11. Parent / roadmap amendments

- Marketplace vision splits into: **Store+Products (this)** → commission/referral later → chat → search → ads → auctions.
- Square `linkUrl` / board thumb remain the **plot** customize layer; store is the **shop** layer on the same square (both can coexist).
- Stripe product checkout stays deferred with Connect / secondary market work.

## 12. Implementation order (for planning)

1. Prisma models + migrate.  
2. Store GET/PUT APIs + public + edit pages (store fields only).  
3. Product CRUD APIs + edit UI.  
4. Product image upload.  
5. Dropdown quick fields + View/Edit links.  
6. Tests + polish.
